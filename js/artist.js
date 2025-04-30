import { db, storage } from './firebase-config.js';
import { 
    doc, getDoc, setDoc, collection, addDoc, getFirestore, updateDoc, query, where, getDocs, deleteDoc, orderBy 
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';
import { ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-storage.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';

const auth = getAuth();

// DOM Elements
const artistNameElement = document.getElementById('artist-name');
const sectionsContainer = document.getElementById('sections-container');
const emptyState = document.getElementById('empty-state');
const editBtn = document.getElementById('edit-btn');
const saveBtn = document.getElementById('save-btn');
const addSectionBtn = document.getElementById('add-section-btn');
addSectionBtn.textContent = 'Add Works';
const editControls = document.querySelector('.edit-controls');
const submissionsBtn = document.getElementById('submissions-btn');
const submissionsPopover = document.querySelector('.submissions-popover');
const submissionsList = document.querySelector('.submissions-list');
const closePopover = document.querySelector('.close-popover');

// Create add shop button
const addShopBtn = document.createElement('button');
addShopBtn.id = 'add-shop-btn';
addShopBtn.className = 'add-section-btn';
addShopBtn.style.display = 'none';
addShopBtn.textContent = 'Add Shop';
// Insert add shop button after add section button
addSectionBtn.parentNode.insertBefore(addShopBtn, addSectionBtn.nextSibling);

// State
let isEditing = false;
let currentArtist = null;
let isCollapsedView = false;

// Get artist name from URL parameter
const urlParams = new URLSearchParams(window.location.search);
const artistName = urlParams.get('name');

// Create cancel button
const cancelBtn = document.createElement('button');
cancelBtn.id = 'cancel-btn';
cancelBtn.className = 'save-btn'; // Use same styling as save button
cancelBtn.style.display = 'none';
cancelBtn.textContent = 'Cancel';
// Insert cancel button before save button
saveBtn.parentNode.insertBefore(cancelBtn, saveBtn);

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    if (!artistName) {
        window.location.href = 'index.html';
        return;
    }

    // Set page title
    document.title = `${artistName} - Sonder`;
    artistNameElement.textContent = artistName;

    // Show edit controls for everyone
    editControls.style.display = 'flex';
    
    // Store original artist data when first loading
    loadArtistContent().then(() => {
        window.originalArtistData = JSON.parse(JSON.stringify(currentArtist));
    });
    
    setupEventListeners();
    setupSubmissionsPopover();
    setupViewToggle();
});

// Event Listeners
function setupEventListeners() {
    editBtn.addEventListener('click', () => {
        toggleEditMode(true);
    });

    saveBtn.addEventListener('click', saveChanges);

    cancelBtn.addEventListener('click', () => {
        // Restore the original data
        if (window.originalArtistData) {
            currentArtist = JSON.parse(JSON.stringify(window.originalArtistData));
            toggleEditMode(false);
            
            // Re-setup feature image to reflect original state
            setupFeatureImageUpload();
            
            // Show message
            const message = document.createElement('div');
            message.className = 'pending-message';
            message.textContent = 'Changes canceled';
            document.body.appendChild(message);
            setTimeout(() => message.remove(), 3000);
        }
    });

    addSectionBtn.addEventListener('click', addNewSection);
    
    // Add event listener for add shop button
    addShopBtn.addEventListener('click', () => {
        const hasShop = currentArtist.sections.some(section => section.type === 'shop');
        
        if (hasShop) {
            // Remove shop functionality
            if (confirm('Are you sure you want to remove the shop section? This will delete all products.')) {
                const shopIndex = currentArtist.sections.findIndex(section => section.type === 'shop');
                if (shopIndex !== -1) {
                    currentArtist.sections.splice(shopIndex, 1);
                    addShopBtn.textContent = 'Add Shop';
                    displayContent(currentArtist);
                    document.body.classList.add('editing');
                }
            }
        } else {
            // Add shop functionality
            const shopSection = {
                type: 'shop',
                title: 'Shop',
                description: 'Browse and purchase my work',
                products: []
            };
            currentArtist.sections.push(shopSection);
            const newShopIndex = currentArtist.sections.length - 1;
            addShopBtn.textContent = 'Remove Shop';
            displayContent(currentArtist);
            document.body.classList.add('editing');

            // Scroll to the newly added shop section
            setTimeout(() => {
                const shopElement = document.querySelector(`.section[data-index="${newShopIndex}"]`);
                if (shopElement) {
                    shopElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    
                    // Flash effect to highlight the new section
                    shopElement.style.transition = 'background-color 0.5s';
                    shopElement.style.backgroundColor = '#f0f0f0';
                    setTimeout(() => {
                        shopElement.style.backgroundColor = '#eeeeee';
                    }, 1000);
                }
            }, 100);
        }
    });
    
    // Delegate event listeners for dynamic elements
    sectionsContainer.addEventListener('change', handleFileSelect);
    sectionsContainer.addEventListener('click', handleSectionControls);
    
    // Add event listeners for shop product uploads
    sectionsContainer.addEventListener('change', handleProductImageSelect);
    sectionsContainer.addEventListener('click', handleAddProduct);
}

// Handle file selection
function handleFileSelect(event) {
    if (!event.target.matches('input[type="file"]')) return;

    const files = event.target.files;
    const section = event.target.closest('.section');
    const imageUploadStatus = section.querySelector('.image-upload-status');
    
    if (files.length > 5) {
        alert('Please select a maximum of 5 images.');
        return;
    }

    imageUploadStatus.textContent = 'Uploading images...';
    imageUploadStatus.style.display = 'block';

    uploadImages(files, section.dataset.index);
}

// Handle section control clicks (delete button)
function handleSectionControls(event) {
    if (event.target.matches('.delete-section-btn')) {
        const section = event.target.closest('.section');
        const index = parseInt(section.dataset.index);
        const sectionType = section.dataset.type;
        
        let confirmMessage = 'Are you sure you want to delete this section?';
        if (sectionType === 'shop') {
            confirmMessage = 'Are you sure you want to delete the shop section? This will remove all products.';
        }
        
        if (confirm(confirmMessage)) {
            currentArtist.sections.splice(index, 1);
            displayContent(currentArtist);
            document.body.classList.add('editing');
        }
    }
}

// Upload images to Firebase Storage
async function uploadImages(files, sectionIndex) {
    const section = document.querySelector(`[data-index="${sectionIndex}"]`);
    const imageUploadStatus = section.querySelector('.image-upload-status');
    const uploadedUrls = [];

    try {
        // Get current content from the DOM
        const titleElement = section.querySelector('.section-title');
        const descriptionElement = section.querySelector('.section-description');
        const currentTitle = titleElement.textContent.trim();
        const currentDescription = descriptionElement.textContent.trim();
        
        // Get existing images
        const existingImages = currentArtist.sections[sectionIndex]?.images || [];
        
        for (const file of files) {
            const storageRef = ref(storage, `artist-pages/${artistName}/${Date.now()}-${file.name}`);
            const snapshot = await uploadBytes(storageRef, file);
            const url = await getDownloadURL(snapshot.ref);
            uploadedUrls.push(url);
        }

        // Update the section with new images while preserving current content
        currentArtist.sections[sectionIndex] = {
            ...currentArtist.sections[sectionIndex],
            title: currentTitle,
            description: currentDescription,
            images: [...existingImages, ...uploadedUrls]
        };
        
        // Update the display
        displayContent(currentArtist);
        document.body.classList.add('editing');
        imageUploadStatus.textContent = 'Images uploaded successfully!';
        setTimeout(() => {
            imageUploadStatus.style.display = 'none';
        }, 3000);

    } catch (error) {
        console.error('Error uploading images:', error);
        imageUploadStatus.textContent = 'Error uploading images. Please try again.';
    }
}

// Load artist content
async function loadArtistContent() {
    try {
        console.log('Loading artist content for:', artistName);
        
        const artistRef = doc(db, 'artistPages', artistName);
        const artistDoc = await getDoc(artistRef);
        console.log('Artist doc exists:', artistDoc.exists());

        // Get the category from submissions
        const submissionsRef = collection(db, 'submissions');
        const q = query(submissionsRef, 
            where('name', '==', artistName),
            where('status', '==', 'approved')
        );
        const submissionsSnapshot = await getDocs(q);
        console.log('Submissions found:', submissionsSnapshot.size);
        
        let category = null;
        if (!submissionsSnapshot.empty) {
            const submission = submissionsSnapshot.docs[0].data();
            category = submission.category;
            console.log('Found category:', category);
        }

        // Set the artist name directly without splitting
        artistNameElement.textContent = artistName;

        // Create header container for name and category
        const headerContainer = document.createElement('div');
        headerContainer.className = 'artist-header-container';
        artistNameElement.parentNode.insertBefore(headerContainer, artistNameElement);

        // Create a row wrapper for the entire header content
        const headerRow = document.createElement('div');
        headerRow.className = 'header-row';
        headerContainer.appendChild(headerRow);

        // Create a wrapper for name and category
        const nameAndCategoryWrapper = document.createElement('div');
        nameAndCategoryWrapper.className = 'name-and-category-wrapper';
        headerRow.appendChild(nameAndCategoryWrapper);

        // Add artist name to the wrapper
        nameAndCategoryWrapper.appendChild(artistNameElement);

        // Add category display if it exists
        if (category) {
            console.log('Adding category element');
            const categoryElement = document.createElement('div');
            categoryElement.className = 'artist-category';
            // Format the category name
            const formattedCategory = category
                .split('-')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
            categoryElement.textContent = formattedCategory;
            console.log('Category element created:', categoryElement);
            nameAndCategoryWrapper.appendChild(categoryElement);
            console.log('Category element appended to name and category wrapper');
        }

        // Add "Go To Services" button to the row
        const servicesButton = document.createElement('button');
        servicesButton.className = 'go-to-services-btn';
        servicesButton.textContent = 'Go To Services';
        servicesButton.style.display = 'none'; // Hide by default
        servicesButton.addEventListener('click', () => {
            const servicesSection = document.querySelector('.section[data-type="services"]');
            if (servicesSection) {
                servicesSection.scrollIntoView({ behavior: 'smooth' });
            }
        });
        headerRow.appendChild(servicesButton);

        // Add feature image container
        const featureImageContainer = document.createElement('div');
        featureImageContainer.className = 'feature-image-container';
        headerContainer.appendChild(featureImageContainer);

        // Add styles once at the start
        const styles = document.createElement('style');
        styles.textContent = `
            .artist-header {
                margin-bottom: 2rem;
                text-align: left;
                position: relative;
                padding-top: 6rem;
                background: #eeeeee !important;
            }

            .artist-name {
                font-size: 7rem;
                font-weight: 500;
                margin-bottom: 0;
                padding-left: 0.6rem;
                letter-spacing: -0.05em;
                line-height: 0.6;
                font-family: 'Helvetica Neue', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                position: relative;
                background: #eeeeee !important;
            }

            .artist-header-container {
                display: flex;
                flex-direction: column;
                align-items: start;
                gap: 0;
                margin-bottom: 2rem;
                position: relative;
                padding-top: 2rem;
                background: #eeeeee !important;
                font-family: 'Helvetica Neue', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }

            .artist-category {
                font-size: 2.2rem;
                color: #666;
                padding-left: 0.9rem;
                display: inline-block;
                font-weight: 400;
                letter-spacing: -0.05em;
                background: #eeeeee !important;
                font-family: 'Helvetica Neue', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }

            .header-row {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                gap: 2rem;
                width: 100%;
                margin-bottom: 2rem;
            }

            .name-and-category-wrapper {
                display: flex;
                flex-direction: column;
                align-items: flex-start;
                gap: 0;
            }

            .go-to-services-btn {
                background: #000;
                color: white;
                border: none;
                padding: 0.8rem 1.5rem;
                font-size: 1.1rem;
                cursor: pointer;
                transition: background-color 0.2s;
                white-space: nowrap;
                margin-top: 1.5rem;
                flex-shrink: 0;
            }

            .go-to-services-btn:hover {
                background: #333;
            }

            @media (max-width: 768px) {
                .artist-name {
                    font-size: 4rem;
                }
                
                .artist-category {
                    font-size: 1.8rem;
                }

                .header-row {
                    flex-direction: column;
                    gap: 1rem;
                }

                .go-to-services-btn {
                    margin-top: 0;
                    font-size: 1rem;
                    padding: 0.6rem 1.2rem;
                    width: 100%;
                }
            }
        `;
        document.head.appendChild(styles);

        if (artistDoc.exists()) {
            currentArtist = artistDoc.data();
            console.log('Current artist data:', currentArtist);
            
            // Display feature image if it exists
            if (currentArtist.featureImage) {
                const featureImage = document.createElement('img');
                featureImage.className = 'feature-image';
                featureImage.src = currentArtist.featureImage;
                featureImage.alt = `${artistName}'s feature image`;
                featureImageContainer.appendChild(featureImage);
            }
            
            // Ensure sections array exists
            if (!currentArtist.sections) {
                currentArtist.sections = [];
            }

            // Ensure services section exists
            if (!currentArtist.sections.some(section => section.type === 'services')) {
                currentArtist.sections.push({
                    type: 'services',
                    title: 'Services',
                    description: '',
                    services: []
                });
            }

            displayContent(currentArtist);
        } else {
            // Show empty state with create button
            emptyState.innerHTML = `
                <h2>Start Creating Your Artist Page</h2>
                <p>Add sections to showcase your work, tell your story, and share your creative journey.</p>
            `;
            emptyState.style.display = 'block';
            sectionsContainer.style.display = 'none';
            currentArtist = {
                name: artistName,
                sections: [{
                    type: 'services',
                    title: 'Services',
                    description: '',
                    services: []
                }]
            };
        }
    } catch (error) {
        console.error('Error loading artist content:', error);
    }
}

// Display content
function displayContent(artist) {
    if (!artist.sections || artist.sections.length === 0) {
        emptyState.style.display = 'block';
        sectionsContainer.style.display = 'none';
        sectionsContainer.innerHTML = '';
        return;
    }

    emptyState.style.display = 'none';
    sectionsContainer.style.display = 'block';

    const sectionsHTML = artist.sections.map((section, index) => {
        // Skip services section if it's empty and not in edit mode
        if (section.type === 'services' && !isEditing && (!section.services || section.services.length === 0)) {
            return '';
        }

        const sectionTitle = section.type === 'services' ? 'Services' : 
                            section.type === 'shop' ? 'Shop' : 
                            (section.title || (isEditing ? 'New Section' : ''));
        
        return `
            <div class="section ${isCollapsedView ? 'collapsed-view' : ''}" data-index="${index}" data-type="${section.type}" draggable="${isEditing && isCollapsedView}">
                <div class="section-content">
                    ${isEditing ? `
                        <div class="section-handle">
                            ${isCollapsedView ? `<div class="drag-handle">⋮⋮</div>` : ''}
                            <div class="move-controls">
                                <button class="move-up" ${index === 0 ? 'disabled' : ''}>↑</button>
                                <button class="move-down" ${index === artist.sections.length - 1 ? 'disabled' : ''}>↓</button>
                            </div>
                        </div>
                    ` : ''}
                    <div class="section-header">
                        <h2 class="section-title" contenteditable="${section.type !== 'services' && section.type !== 'shop' && isEditing}" spellcheck="false" 
                            data-placeholder="New Section">${sectionTitle}</h2>
                        ${section.type === 'shop' && isEditing ? `<button class="delete-section-btn delete-shop-btn">Delete Shop</button>` : ''}
                    </div>
                    <div class="section-details ${isCollapsedView ? 'hidden' : ''}">
                        ${section.type === 'services' ? `
                            <div class="services-list">
                                ${(section.services || []).map(service => `
                                    <div class="service-item">
                                        <span class="service-name">${service.name}</span>
                                        <div class="service-price-container">
                                            <span class="service-price">£${service.price}</span>
                                            ${isEditing ? `<button class="remove-service-btn" data-service-name="${service.name}">&times;</button>` : ''}
                                        </div>
                                    </div>
                                `).join('')}
                                ${isEditing ? `
                                    <div class="add-service-form">
                                        <div class="service-input-group">
                                            <input type="text" class="service-name-input" placeholder="Service name">
                                            <div class="price-input-wrapper">
                                                <span class="currency-symbol">£</span>
                                                <input type="number" class="service-price-input" placeholder="Price" min="0" step="0.01">
                                            </div>
                                            <button class="add-service-btn" data-section-index="${index}">Add Service</button>
                                        </div>
                                    </div>
                                ` : ''}
                            </div>
                        ` : section.type === 'shop' ? `
                            <div class="shop-grid">
                                ${(section.products || []).map(product => `
                                    <div class="shop-card">
                                        <img src="${product.image}" alt="${product.title || 'Product image'}" class="shop-image">
                                        <div class="shop-card-details">
                                            <h3 class="shop-product-title">${product.title || ''}</h3>
                                            <p class="shop-product-price">£${product.price || '0'}</p>
                                        </div>
                                    </div>
                                `).join('')}
                                ${isEditing ? `
                                    <div class="shop-card add-product-card">
                                        <div class="image-upload-area">
                                            <input type="file" accept="image/*" class="product-image-input" data-section-index="${index}">
                                            <div class="upload-placeholder">
                                                <span>+</span>
                                                <p>Add Product</p>
                                            </div>
                                        </div>
                                        <div class="product-details-form">
                                            <input type="text" class="product-title-input" placeholder="Product Title">
                                            <div class="price-input-group">
                                                <span class="currency-symbol">£</span>
                                                <input type="number" class="product-price-input" placeholder="Price" min="0" step="0.01">
                                            </div>
                                            <button class="add-product-btn" data-section-index="${index}">Add Product</button>
                                        </div>
                                    </div>
                                ` : ''}
                            </div>
                        ` : `
                            <div class="section-images">
                                ${(section.images || []).map(image => `
                                    <img src="${image}" alt="${section.title || 'Section image'}" class="section-image">
                                `).join('')}
                            </div>
                            ${isEditing ? `
                                <div class="image-upload">
                                    <input type="file" accept="image/*" multiple>
                                    <p>Select up to 5 images</p>
                                    <div class="image-upload-status" style="display: none;"></div>
                                </div>
                            ` : ''}
                        `}
                        ${isEditing ? `
                            <p class="section-description" contenteditable="true" spellcheck="false"
                                data-placeholder="Add your description here">${section.description || 'Add your description here'}</p>
                        ` : `
                            ${section.description ? `<p class="section-description">${section.description}</p>` : ''}
                        `}
                        ${isEditing && section.type !== 'services' && section.type !== 'shop' ? `
                            <div class="section-controls">
                                <button class="delete-section-btn">Delete Section</button>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');

    sectionsContainer.innerHTML = sectionsHTML;

    // Show/hide Go To Services button based on whether there are any services
    const servicesButton = document.querySelector('.go-to-services-btn');
    if (servicesButton) {
        const servicesSection = artist.sections.find(section => section.type === 'services');
        const hasServices = servicesSection && servicesSection.services && servicesSection.services.length > 0;
        servicesButton.style.display = hasServices ? 'block' : 'none';
    }

    // Add styles for collapsed view if needed
    if (isCollapsedView) {
        const collapsedStyle = document.createElement('style');
        collapsedStyle.textContent = `
            .section.collapsed-view {
                padding: 1rem;
                margin-bottom: 0.5rem;
                border: 1px solid #ddd;
                border-radius: 4px;
                cursor: grab;
                background: #eeeeee !important;
            }

            .section.collapsed-view .section-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 1rem;
            }

            .section.collapsed-view .section-preview {
                display: flex;
                gap: 1rem;
                font-size: 0.9rem;
                color: #666;
            }

            .section.collapsed-view .section-preview span {
                background: rgba(0, 0, 0, 0.05);
                padding: 0.2rem 0.5rem;
                border-radius: 4px;
            }

            .section.collapsed-view .section-details.hidden {
                display: none;
            }

            .section.collapsed-view .section-handle {
                margin-bottom: 0.5rem;
            }
        `;
        document.head.appendChild(collapsedStyle);
    }

    if (isEditing) {
        if (isCollapsedView) {
            setupDragAndDrop();
        }
        setupMoveControls();
        setupEditableElements();
        setupImageUpload();
        setupServiceControls();
    }

    // Add new styles for the button and wrapper
    const headerStyles = document.createElement('style');
    headerStyles.textContent = `
        .header-row {
            display: flex;
            justify-content: space-between;
            align-items: end;
            gap: 2rem;
            width: 100%;
            margin-bottom: 0rem;
        }

        .name-and-category-wrapper {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            gap: 0;
        }

        .go-to-services-btn {
            background: #000;
            color: white;
            border: none;
            padding: 0.3rem 0.4rem;
            font-size: 0.9rem;
            letter-spacing: -0.04em;
            cursor: pointer;
            transition: background-color 0.2s;
            white-space: nowrap;
            margin-right: 1rem;
            flex-shrink: 0;
        }

        .go-to-services-btn:hover {
            background: #333;
        }

        @media (max-width: 768px) {
            .header-row {
                flex-direction: row;
                gap: 1rem;
            }

            .go-to-services-btn {
                margin-top: 0;
                font-size: 0.9rem;
                padding: 0.3rem 0.4rem;
                width: auto;
            }
        }
    `;
    document.head.appendChild(headerStyles);

    // Update the artist name styles
    const artistNameStyle = document.createElement('style');
    artistNameStyle.textContent = `
        .artist-header {
            margin-bottom: 2rem;
            text-align: left;
            position: relative;
            padding-top: 6rem;
            background: #eeeeee !important;
        }

        .artist-name {
            font-size: 7rem;
            font-weight: 500;
            margin-bottom: 0;
            padding-left: 0.6rem;
            letter-spacing: -0.05em;
            line-height: 0.6;
            font-family: 'Helvetica Neue', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            position: relative;
            background: #eeeeee !important;
        }

        @media (max-width: 768px) {
            .artist-name {
                font-size: 4rem;
            }
        }
    `;
    document.head.appendChild(artistNameStyle);

    // Add styles for artist category
    const artistCategoryStyle = document.createElement('style');
    artistCategoryStyle.textContent = `
        .artist-header-container {
            display: flex;
            flex-direction: column;
            align-items: start;
            gap: 0;
            margin-bottom: 2rem;
            position: relative;
            padding-top: 2rem;
            background: #eeeeee !important;
        }

        .artist-category {
            font-size: 2.2rem;
            color: #666;
            padding-left: 0.9rem;
            display: inline-block;
            font-weight: 400;
            letter-spacing: -0.05em;
            background: #eeeeee !important;
        }

        @media (max-width: 768px) {
            .artist-header-container {
                gap: 0;
            }
            
            .artist-category {
                font-size: 1.8rem;
            }
        }
    `;
    document.head.appendChild(artistCategoryStyle);

    // Add styles for feature image
    const featureImageStyle = document.createElement('style');
    featureImageStyle.textContent = `
        .feature-image-container {
            width: 100%;
            margin: 0.5rem 0;
            position: relative;
            background: #eeeeee !important;
        }

        .feature-image {
            width: 100%;
            height: auto;
            max-height: 900px;
            object-fit: cover;
            display: block;
            background: #eeeeee !important;
        }

        .feature-image-upload-btn {
            position: absolute;
            top: 1rem;
            right: 1rem;
            padding: 0.5rem 1rem;
            background: #000 !important;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.9rem;
            z-index: 1;
        }

        .feature-image-upload-btn:hover {
            background: #333 !important;
        }

        .feature-image-upload-area {
            width: 100%;
            height: 300px;
            border: 2px dashed #ddd;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            background: #eeeeee !important;
            transition: border-color 0.3s;
        }

        .feature-image-upload-area:hover {
            border-color: #999;
        }

        .feature-image-upload-content {
            text-align: center;
            color: #666;
        }

        .upload-icon {
            font-size: 3rem;
            margin-bottom: 1rem;
            color: #999;
        }

        .feature-image-upload-content h3 {
            font-size: 1.5rem;
            margin: 0 0 0.5rem 0;
            color: #333;
        }

        .feature-image-upload-content p {
            margin: 0;
            color: #666;
        }

        .feature-image-loading-overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(238, 238, 238, 0.9);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 2;
        }

        .loading-content {
            text-align: center;
        }

        .loading-spinner {
            width: 40px;
            height: 40px;
            border: 3px solid #ddd;
            border-top: 3px solid #333;
            border-radius: 50%;
            margin: 0 auto 1rem;
            animation: spin 1s linear infinite;
        }

        .loading-content p {
            margin: 0;
            color: #333;
            font-size: 1rem;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        body:not(.editing) .feature-image-upload-area {
            cursor: default;
        }

        body:not(.editing) .feature-image-upload-area:hover {
            border-color: #ddd;
        }
    `;
    document.head.appendChild(featureImageStyle);

    // Update the shop styles
    const shopStyles = document.createElement('style');
    shopStyles.textContent = `
        .shop-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 2rem;
            margin: 2rem 0;
            background: #eeeeee !important;
        }

        .shop-card {
            background: #eeeeee !important;
            border: 1px solid #ddd;
            border-radius: 4px;
            overflow: hidden;
            display: flex;
            flex-direction: column;
        }

        .shop-image {
            width: 100%;
            height: 300px;
            object-fit: cover;
            background: #eeeeee !important;
        }

        .shop-card-details {
            padding: 1rem;
            background: #eeeeee !important;
        }

        .shop-product-title {
            font-size: 1.2rem;
            margin: 0 0 0.5rem 0;
            background: #eeeeee !important;
        }

        .shop-product-price {
            font-size: 1.1rem;
            color: #666;
            margin: 0;
            background: #eeeeee !important;
        }

        .add-product-card {
            border: 2px dashed #ddd;
            background: #eeeeee !important;
            display: flex;
            flex-direction: column;
        }

        .image-upload-area {
            position: relative;
            height: 300px;
            background: #eeeeee !important;
            cursor: pointer;
            overflow: hidden;
        }

        .product-image-input {
            position: absolute;
            width: 100%;
            height: 100%;
            opacity: 0;
            cursor: pointer;
            z-index: 2;
        }

        .upload-placeholder {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            color: #666;
            background: #eeeeee !important;
            z-index: 1;
        }

        .upload-placeholder img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }

        .upload-placeholder span {
            font-size: 3rem;
            display: block;
            margin-bottom: 0.5rem;
            background: #eeeeee !important;
        }

        .product-details-form {
            padding: 1rem;
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
            background: #eeeeee !important;
            position: relative;
            z-index: 2;
        }

        .product-title-input,
        .product-price-input {
            width: 100%;
            padding: 0.5rem;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 0.9rem;
            background: #eeeeee !important;
        }

        .price-input-group {
            position: relative;
            background: #eeeeee !important;
        }

        .price-input-group .currency-symbol {
            position: absolute;
            left: 0.5rem;
            top: 50%;
            transform: translateY(-50%);
            color: #666;
            background: #eeeeee !important;
        }

        .price-input-group .product-price-input {
            padding-left: 1.5rem;
        }

        .add-product-btn {
            width: 100%;
            padding: 0.5rem;
            background: #000 !important;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.9rem;
        }

        .add-product-btn:hover {
            background: #333 !important;
        }

        @media (max-width: 1024px) {
            .shop-grid {
                grid-template-columns: repeat(2, 1fr);
            }
        }

        @media (max-width: 768px) {
            .shop-grid {
                grid-template-columns: 1fr;
            }
        }
    `;
    document.head.appendChild(shopStyles);

    // Add styles for the delete shop button
    const shopDeleteStyle = document.createElement('style');
    shopDeleteStyle.textContent = `
        .section-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1.5rem;
            background: #eeeeee !important;
        }

        .delete-shop-btn {
            background: #ff4444 !important;
            color: white;
            border: none;
            padding: 0.5rem 1rem;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.9rem;
            margin-left: auto;
        }

        .delete-shop-btn:hover {
            background: #ff6666 !important;
        }
    `;
    document.head.appendChild(shopDeleteStyle);
}

// Set up drag and drop functionality
function setupDragAndDrop() {
    const sections = document.querySelectorAll('.section');
    let draggedSection = null;

    sections.forEach(section => {
        section.addEventListener('dragstart', (e) => {
            draggedSection = section;
            section.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });

        section.addEventListener('dragend', () => {
            section.classList.remove('dragging');
            draggedSection = null;
            updateSectionIndices();
        });

        section.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (!draggedSection || draggedSection === section) return;

            const rect = section.getBoundingClientRect();
            const midpoint = rect.top + rect.height / 2;
            
            if (e.clientY < midpoint) {
                section.parentNode.insertBefore(draggedSection, section);
            } else {
                section.parentNode.insertBefore(draggedSection, section.nextSibling);
            }
        });
    });
}

// Set up move controls
function setupMoveControls() {
    const moveButtons = sectionsContainer.querySelectorAll('.move-up, .move-down');
    moveButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const section = e.target.closest('.section');
            const index = parseInt(section.dataset.index);
            
            if (button.classList.contains('move-up') && index > 0) {
                moveSection(index, index - 1);
            } else if (button.classList.contains('move-down') && index < currentArtist.sections.length - 1) {
                moveSection(index, index + 1);
            }
        });
    });
}

// Move section from one index to another
function moveSection(fromIndex, toIndex) {
    // Save all current content before moving
    const sections = document.querySelectorAll('.section');
    sections.forEach((section, idx) => {
        const titleElement = section.querySelector('.section-title');
        const descriptionElement = section.querySelector('.section-description');
        const titlePlaceholder = titleElement.getAttribute('data-placeholder');
        const descriptionPlaceholder = descriptionElement.getAttribute('data-placeholder');
        
        const title = titleElement.textContent.trim();
        const description = descriptionElement.textContent.trim();

        currentArtist.sections[idx] = {
            ...currentArtist.sections[idx],
            title: title === titlePlaceholder ? '' : title,
            description: description === descriptionPlaceholder ? '' : description
        };
    });

    // Perform the move
    const [movedSection] = currentArtist.sections.splice(fromIndex, 1);
    currentArtist.sections.splice(toIndex, 0, movedSection);

    // Update display
    displayContent(currentArtist);
    updateMoveButtonStates();
}

// Update move button states
function updateMoveButtonStates() {
    const sections = document.querySelectorAll('.section');
    sections.forEach((section, index) => {
        const upButton = section.querySelector('.move-up');
        const downButton = section.querySelector('.move-down');
        
        if (upButton) upButton.disabled = index === 0;
        if (downButton) downButton.disabled = index === sections.length - 1;
    });
}

// Update section indices after drag and drop
function updateSectionIndices() {
    const sections = Array.from(document.querySelectorAll('.section'));
    const newSections = sections.map(section => {
        const index = parseInt(section.dataset.index);
        const titleElement = section.querySelector('.section-title');
        const descriptionElement = section.querySelector('.section-description');
        const titlePlaceholder = titleElement.getAttribute('data-placeholder');
        const descriptionPlaceholder = descriptionElement.getAttribute('data-placeholder');
        
        const title = titleElement.textContent.trim();
        const description = descriptionElement.textContent.trim();

        return {
            ...currentArtist.sections[index],
            title: title === titlePlaceholder ? '' : title,
            description: description === descriptionPlaceholder ? '' : description
        };
    });
    
    currentArtist.sections = newSections;
    displayContent(currentArtist);
    updateMoveButtonStates();
}

// Setup editable elements
function setupEditableElements() {
    const editableElements = sectionsContainer.querySelectorAll('[contenteditable="true"]');
    editableElements.forEach(element => {
        // Clear placeholder on focus
        element.addEventListener('focus', () => {
            const placeholder = element.getAttribute('data-placeholder');
            if (element.textContent.trim() === placeholder) {
                element.textContent = '';
            }
        });

        // Handle blur (losing focus)
        element.addEventListener('blur', () => {
            const section = element.closest('.section');
            const sectionIndex = parseInt(section.dataset.index);
            const content = element.textContent.trim();
            const placeholder = element.getAttribute('data-placeholder');
            
            // If content is empty or matches placeholder, don't save it
            if (!content || content === placeholder) {
                if (element.classList.contains('section-title')) {
                    currentArtist.sections[sectionIndex].title = '';
                } else if (element.classList.contains('section-description')) {
                    currentArtist.sections[sectionIndex].description = '';
                }
                element.textContent = isEditing ? placeholder : '';
                return;
            }

            // Update the currentArtist object with actual content
            if (element.classList.contains('section-title')) {
                currentArtist.sections[sectionIndex].title = content;
            } else if (element.classList.contains('section-description')) {
                currentArtist.sections[sectionIndex].description = content;
            }
        });

        // Prevent enter key from creating new lines in titles
        if (element.classList.contains('section-title')) {
            element.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    element.blur();
                }
            });
        }
    });
}

// Setup image upload
function setupImageUpload() {
    const sections = document.querySelectorAll('.section');
    sections.forEach(section => {
        const imageUpload = section.querySelector('.image-upload');
        if (imageUpload) {
            const input = imageUpload.querySelector('input[type="file"]');
            input.addEventListener('change', () => {
                const files = input.files;
                const index = parseInt(section.dataset.index);
                uploadImages(files, index);
            });
        }
    });
}

// Update the setupServiceControls function
function setupServiceControls() {
    const addServiceBtns = document.querySelectorAll('.add-service-btn');
    addServiceBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const sectionIndex = parseInt(btn.dataset.sectionIndex);
            const form = btn.closest('.add-service-form');
            const nameInput = form.querySelector('.service-name-input');
            const priceInput = form.querySelector('.service-price-input');
            
            const serviceName = nameInput.value.trim();
            const price = parseFloat(priceInput.value);
            
            if (!serviceName) {
                nameInput.classList.add('error');
                return;
            }
            
            if (isNaN(price) || price < 0) {
                priceInput.classList.add('error');
                return;
            }

            if (!currentArtist.sections[sectionIndex].services) {
                currentArtist.sections[sectionIndex].services = [];
            }

            currentArtist.sections[sectionIndex].services.push({
                name: serviceName,
                price: price
            });

            // Clear inputs
            nameInput.value = '';
            priceInput.value = '';
            nameInput.classList.remove('error');
            priceInput.classList.remove('error');

            displayContent(currentArtist);
        });
    });

    // Add event listeners for remove buttons
    const removeServiceBtns = document.querySelectorAll('.remove-service-btn');
    removeServiceBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const serviceName = btn.dataset.serviceName;
            const section = btn.closest('.section');
            const sectionIndex = parseInt(section.dataset.index);
            
            // Remove the service from the array
            currentArtist.sections[sectionIndex].services = currentArtist.sections[sectionIndex].services.filter(
                service => service.name !== serviceName
            );
            
            displayContent(currentArtist);
        });
    });

    // Add input validation and error clearing
    const serviceInputs = document.querySelectorAll('.service-name-input, .service-price-input');
    serviceInputs.forEach(input => {
        input.addEventListener('input', () => {
            input.classList.remove('error');
        });
    });
}

// Start editing
function startEditing() {
    isEditing = true;
    document.body.classList.add('editing');
    editBtn.style.display = 'none';
    saveBtn.style.display = 'block';
    cancelBtn.style.display = 'block';
    addSectionBtn.style.display = 'block';
    addShopBtn.style.display = 'block';

    // Setup feature image upload
    setupFeatureImageUpload();

    // Add view toggle buttons
    const viewToggle = document.createElement('div');
    viewToggle.className = 'view-toggle';
    viewToggle.innerHTML = `
        <button class="view-btn ${!isCollapsedView ? 'active' : ''}" data-view="grid">
            <span class="icon">▦</span> Grid View
        </button>
        <button class="view-btn ${isCollapsedView ? 'active' : ''}" data-view="list">
            <span class="icon">☰</span> List View
        </button>
    `;
    document.querySelector('.edit-controls').insertBefore(viewToggle, saveBtn);

    // Add view toggle event listeners
    viewToggle.addEventListener('click', (e) => {
        const btn = e.target.closest('.view-btn');
        if (!btn) return;

        const view = btn.dataset.view;
        isCollapsedView = view === 'list';
        
        // Update button states
        viewToggle.querySelectorAll('.view-btn').forEach(button => {
            button.classList.toggle('active', button.dataset.view === view);
        });

        // Update view
        displayContent(currentArtist);
    });

    displayContent(currentArtist);
}

// Add new section
function addNewSection() {
    const newSection = {
        type: 'portfolio',
        title: '',
        description: '',
        images: []
    };

    if (!currentArtist.sections) {
        currentArtist.sections = [];
    }

    // Add the new section before the services section
    const servicesIndex = currentArtist.sections.findIndex(section => section.type === 'services');
    let newSectionIndex;
    if (servicesIndex >= 0) {
        currentArtist.sections.splice(servicesIndex, 0, newSection);
        newSectionIndex = servicesIndex;
    } else {
        currentArtist.sections.push(newSection);
        newSectionIndex = currentArtist.sections.length - 1;
    }
    
    displayContent(currentArtist);
    document.body.classList.add('editing');

    // Scroll to the newly added section
    setTimeout(() => {
        const newSectionElement = document.querySelector(`.section[data-index="${newSectionIndex}"]`);
        if (newSectionElement) {
            newSectionElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            
            // Flash effect to highlight the new section
            newSectionElement.style.transition = 'background-color 0.5s';
            newSectionElement.style.backgroundColor = '#f0f0f0';
            setTimeout(() => {
                newSectionElement.style.backgroundColor = '#eeeeee';
            }, 1000);
        }
    }, 100);
}

// Save changes
async function saveChanges() {
    const artistName = document.getElementById('artist-name').textContent;
    const sections = [];
    const sectionElements = document.querySelectorAll('.section');
    
    sectionElements.forEach((sectionEl, index) => {
        const titleEl = sectionEl.querySelector('.section-title');
        const descEl = sectionEl.querySelector('.section-description');
        const type = sectionEl.querySelector('.services-list') ? 'services' : 'portfolio';
        
        // Get the actual content and placeholders
        const titleContent = titleEl ? titleEl.textContent.trim() : '';
        const descContent = descEl ? descEl.textContent.trim() : '';
        const titlePlaceholder = titleEl ? titleEl.getAttribute('data-placeholder') : '';
        const descPlaceholder = descEl ? descEl.getAttribute('data-placeholder') : '';
        
        // Only use content if it's not empty and not the placeholder text
        const finalTitle = titleContent === titlePlaceholder || !titleContent ? '' : titleContent;
        const finalDesc = descContent === descPlaceholder || !descContent ? '' : descContent;
        
        if (type === 'services') {
            // Handle services section
            const serviceItems = Array.from(sectionEl.querySelectorAll('.service-item')).map(item => ({
                name: item.querySelector('.service-name').textContent,
                price: parseFloat(item.querySelector('.service-price').textContent.replace('£', ''))
            }));
            
            sections.push({
                type: 'services',
                title: 'Services',
                description: finalDesc,
                services: serviceItems,
                index: index
            });
        } else {
            // Handle portfolio section
            const imagesContainer = sectionEl.querySelector('.section-images');
            const images = imagesContainer ? Array.from(imagesContainer.querySelectorAll('img')).map(img => img.src) : [];
            
            sections.push({
                type: 'portfolio',
                title: finalTitle || '',
                description: finalDesc || '',
                images: images,
                index: index
            });
        }
    });

    try {
        // Get the current state of the artist page
        const artistRef = doc(db, 'artistPages', artistName);
        const artistDoc = await getDoc(artistRef);
        const currentState = artistDoc.exists() ? artistDoc.data() : { sections: [] };

        // Check if there are any actual changes
        const hasChanges = checkForChanges(currentState.sections || [], sections) || 
                          (currentState.featureImage !== currentArtist?.featureImage);
        
        if (!hasChanges) {
            // No changes were made, just exit edit mode
            const message = document.createElement('div');
            message.className = 'pending-message';
            message.textContent = 'No changes were made';
            document.body.appendChild(message);
            setTimeout(() => message.remove(), 3000);
            
            toggleEditMode(false);
            return;
        }

        // Delete all pending changes for this artist
        const pendingChangesRef = collection(db, 'pendingChanges');
        const q = query(pendingChangesRef, 
            where('artistName', '==', artistName),
            where('status', '==', 'pending')
        );
        const pendingSnapshot = await getDocs(q);
        
        const deletePromises = [];
        pendingSnapshot.forEach(doc => {
            deletePromises.push(deleteDoc(doc.ref));
        });
        await Promise.all(deletePromises);

        // Create a new pending change document
        const timestamp = new Date().toISOString();
        const changeRef = doc(db, 'pendingChanges', `${artistName}_${timestamp}`);
        
        // Create the proposed state object, only including featureImage if it exists
        const proposedState = {
            name: artistName,
            sections: sections,
            lastUpdated: timestamp
        };
        
        // Only add featureImage if it exists
        if (currentArtist && currentArtist.featureImage) {
            proposedState.featureImage = currentArtist.featureImage;
        }

        await setDoc(changeRef, {
            artistName: artistName,
            previousState: currentState,
            proposedState: proposedState,
            timestamp: timestamp,
            status: 'pending',
            type: 'artist_page_update'
        });

        // Create notification for admin
        await addDoc(collection(db, 'notifications'), {
            userId: 'admin',
            type: 'change_submitted',
            message: `${artistName} has submitted changes to their page for review.`,
            timestamp: new Date(),
            read: false,
            artistName: artistName,
            changeId: changeRef.id
        });

        // Show success message
        const message = document.createElement('div');
        message.className = 'pending-message';
        message.textContent = 'Changes submitted for review';
        document.body.appendChild(message);
        setTimeout(() => message.remove(), 3000);

        // Exit edit mode
        toggleEditMode(false);
    } catch (error) {
        console.error('Error saving changes:', error);
        alert('Error saving changes. Please try again.');
    }
}

// Function to check if there are actual changes between two states
function checkForChanges(oldSections, newSections) {
    // If both are empty or undefined, no changes
    if ((!oldSections || oldSections.length === 0) && (!newSections || newSections.length === 0)) {
        return false;
    }

    // If one is empty and the other isn't, check if it's just a default services section
    if ((!oldSections || oldSections.length === 0) && newSections && newSections.length === 1) {
        const section = newSections[0];
        // If it's just a default empty services section, no changes
        if (section.type === 'services' && 
            section.title === 'Services' && 
            (!section.description || section.description === '') && 
            (!section.services || section.services.length === 0)) {
            return false;
        }
    }

    // If lengths are different (excluding the default services case above), there are changes
    if (oldSections.length !== newSections.length) {
        return true;
    }

    return newSections.some((newSection, index) => {
        const oldSection = oldSections[index];
        
        // If types don't match, there's a change
        if (newSection.type !== oldSection.type) {
            return true;
        }

        if (newSection.type === 'services') {
            // Compare services
            const oldServices = oldSection.services || [];
            const newServices = newSection.services || [];

            // If both services arrays are empty, no changes
            if (oldServices.length === 0 && newServices.length === 0) {
                return false;
            }

            if (oldServices.length !== newServices.length) {
                return true;
            }

            return newServices.some((newService, serviceIndex) => {
                const oldService = oldServices[serviceIndex];
                return newService.name !== oldService.name || 
                       newService.price !== oldService.price;
            });
        } else {
            // Compare portfolio sections
            // If both title and description are empty/default and no images, no changes
            if ((!newSection.title || newSection.title === '') &&
                (!newSection.description || newSection.description === '') &&
                (!newSection.images || newSection.images.length === 0)) {
                return false;
            }

            return newSection.title !== oldSection.title ||
                   newSection.description !== oldSection.description ||
                   JSON.stringify(newSection.images) !== JSON.stringify(oldSection.images);
        }
    });
}

// Toggle edit mode
function toggleEditMode(isEnabled) {
    isEditing = isEnabled;
    document.body.classList.toggle('editing', isEnabled);
    editBtn.style.display = isEnabled ? 'none' : 'block';
    saveBtn.style.display = isEnabled ? 'block' : 'none';
    cancelBtn.style.display = isEnabled ? 'block' : 'none';
    addSectionBtn.style.display = isEnabled ? 'block' : 'none';
    
    // Update add/remove shop button
    const hasShop = currentArtist.sections.some(section => section.type === 'shop');
    addShopBtn.textContent = hasShop ? 'Remove Shop' : 'Add Shop';
    addShopBtn.style.display = isEnabled ? 'block' : 'none';
    
    // Handle view toggle visibility
    const viewToggle = document.querySelector('.view-toggle');
    if (viewToggle) {
        viewToggle.style.display = isEnabled ? 'flex' : 'none';
    }
    
    isCollapsedView = false;

    // Handle feature image upload button visibility
    const uploadButton = document.querySelector('.feature-image-upload-btn');
    if (!uploadButton && isEnabled) {
        // Only create the button if it doesn't exist and we're entering edit mode
        setupFeatureImageUpload();
    } else if (uploadButton) {
        // If button exists, just toggle its visibility
        uploadButton.style.display = isEnabled ? 'block' : 'none';
    }

    // When exiting edit mode, check if we need to show empty state
    if (!isEnabled && (!currentArtist.sections || currentArtist.sections.length === 0 || 
        (currentArtist.sections.length === 1 && 
         currentArtist.sections[0].type === 'services' && 
         (!currentArtist.sections[0].services || currentArtist.sections[0].services.length === 0)))) {
        emptyState.innerHTML = `
            <h2>Start Creating Your Artist Page</h2>
            <p>Add sections to showcase your work, tell your story, and share your creative journey.</p>
        `;
        emptyState.style.display = 'block';
        sectionsContainer.style.display = 'none';
    } else {
        displayContent(currentArtist);
    }
}

// Add feature image upload functionality
function setupFeatureImageUpload() {
    const featureImageContainer = document.querySelector('.feature-image-container');
    if (!featureImageContainer) return;

    // Clear existing content
    featureImageContainer.innerHTML = '';

    // Create file input
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    featureImageContainer.appendChild(fileInput);

    if (currentArtist && currentArtist.featureImage) {
        // If we have an existing image, show it with an overlay button
        const existingImage = document.createElement('img');
        existingImage.className = 'feature-image';
        existingImage.src = currentArtist.featureImage;
        existingImage.alt = `${artistName}'s feature image`;
        featureImageContainer.appendChild(existingImage);

        // Create upload button as an overlay only in edit mode
        if (document.body.classList.contains('editing')) {
            const uploadButton = document.createElement('button');
            uploadButton.className = 'feature-image-upload-btn';
            uploadButton.textContent = 'Change Feature Image';
            featureImageContainer.appendChild(uploadButton);

            uploadButton.addEventListener('click', () => {
                fileInput.click();
            });
        }
    } else if (document.body.classList.contains('editing')) {
        // Only show upload area in edit mode
        const uploadArea = document.createElement('div');
        uploadArea.className = 'feature-image-upload-area';
        
        const uploadContent = document.createElement('div');
        uploadContent.className = 'feature-image-upload-content';
        uploadContent.innerHTML = `
            <div class="upload-icon">+</div>
            <h3>Add Feature Image</h3>
            <p>Upload an image that represents your work</p>
        `;
        
        uploadArea.appendChild(uploadContent);
        featureImageContainer.appendChild(uploadArea);

        // Make the entire area clickable
        uploadArea.addEventListener('click', () => {
            fileInput.click();
        });
    }

    // Handle file selection
    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            // Create and show loading overlay
            const loadingOverlay = document.createElement('div');
            loadingOverlay.className = 'feature-image-loading-overlay';
            loadingOverlay.innerHTML = `
                <div class="loading-content">
                    <div class="loading-spinner"></div>
                    <p>Uploading image...</p>
                </div>
            `;
            featureImageContainer.appendChild(loadingOverlay);

            // Upload to Firebase Storage
            const storageRef = ref(storage, `artist-pages/${artistName}/feature-image/${Date.now()}-${file.name}`);
            const snapshot = await uploadBytes(storageRef, file);
            const url = await getDownloadURL(snapshot.ref);

            // Update currentArtist with new feature image URL
            currentArtist.featureImage = url;
            
            // Refresh the feature image display
            setupFeatureImageUpload();
            document.body.classList.add('editing');
        } catch (error) {
            console.error('Error uploading feature image:', error);
            alert('Error uploading image. Please try again.');
            // Remove loading overlay in case of error
            const loadingOverlay = featureImageContainer.querySelector('.feature-image-loading-overlay');
            if (loadingOverlay) {
                loadingOverlay.remove();
            }
        }
    });
}

// Add styles for feature image
const featureImageStyle = document.createElement('style');
featureImageStyle.textContent = `
    .feature-image-container {
        width: 100%;
        margin: 0.5rem 0;
        position: relative;
        background: #eeeeee !important;
    }

    .feature-image {
        width: 100%;
        height: auto;
        max-height: 900px;
        object-fit: cover;
        display: block;
        background: #eeeeee !important;
    }

    .feature-image-upload-btn {
        position: absolute;
        top: 1rem;
        right: 1rem;
        padding: 0.5rem 1rem;
        background: #000 !important;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.9rem;
        z-index: 1;
    }

    .feature-image-upload-btn:hover {
        background: #333 !important;
    }

    .feature-image-upload-area {
        width: 100%;
        height: 300px;
        border: 2px dashed #ddd;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        background: #eeeeee !important;
        transition: border-color 0.3s;
    }

    .feature-image-upload-area:hover {
        border-color: #999;
    }

    .feature-image-upload-content {
        text-align: center;
        color: #666;
    }

    .upload-icon {
        font-size: 3rem;
        margin-bottom: 1rem;
        color: #999;
    }

    .feature-image-upload-content h3 {
        font-size: 1.5rem;
        margin: 0 0 0.5rem 0;
        color: #333;
    }

    .feature-image-upload-content p {
        margin: 0;
        color: #666;
    }

    .feature-image-loading-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(238, 238, 238, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2;
    }

    .loading-content {
        text-align: center;
    }

    .loading-spinner {
        width: 40px;
        height: 40px;
        border: 3px solid #ddd;
        border-top: 3px solid #333;
        border-radius: 50%;
        margin: 0 auto 1rem;
        animation: spin 1s linear infinite;
    }

    .loading-content p {
        margin: 0;
        color: #333;
        font-size: 1rem;
    }

    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }

    body:not(.editing) .feature-image-upload-area {
        cursor: default;
    }

    body:not(.editing) .feature-image-upload-area:hover {
        border-color: #ddd;
    }
`;
document.head.appendChild(featureImageStyle);

// Add these new functions for handling shop products
async function handleProductImageSelect(event) {
    if (!event.target.matches('.product-image-input')) return;

    const file = event.target.files[0];
    if (!file) return;

    const sectionIndex = parseInt(event.target.dataset.sectionIndex);
    const card = event.target.closest('.add-product-card');
    const uploadPlaceholder = card.querySelector('.upload-placeholder');

    try {
        uploadPlaceholder.innerHTML = '<p>Uploading...</p>';
        
        const storageRef = ref(storage, `artist-pages/${artistName}/shop/${Date.now()}-${file.name}`);
        const snapshot = await uploadBytes(storageRef, file);
        const url = await getDownloadURL(snapshot.ref);
        
        // Store the uploaded image URL in a data attribute
        card.dataset.uploadedImage = url;
        
        // Show preview
        uploadPlaceholder.innerHTML = `<img src="${url}" alt="Product preview" style="max-width: 100%; max-height: 100%; object-fit: contain;">`;
    } catch (error) {
        console.error('Error uploading product image:', error);
        uploadPlaceholder.innerHTML = '<p>Error uploading image. Please try again.</p>';
    }
}

function handleAddProduct(event) {
    if (!event.target.matches('.add-product-btn')) return;

    const sectionIndex = parseInt(event.target.dataset.sectionIndex);
    const card = event.target.closest('.add-product-card');
    const titleInput = card.querySelector('.product-title-input');
    const priceInput = card.querySelector('.product-price-input');
    const uploadedImage = card.dataset.uploadedImage;

    if (!uploadedImage) {
        alert('Please upload an image first');
        return;
    }

    const title = titleInput.value.trim();
    const price = parseFloat(priceInput.value);

    if (!title) {
        titleInput.classList.add('error');
        return;
    }

    if (isNaN(price) || price < 0) {
        priceInput.classList.add('error');
        return;
    }

    // Add the new product
    if (!currentArtist.sections[sectionIndex].products) {
        currentArtist.sections[sectionIndex].products = [];
    }

    currentArtist.sections[sectionIndex].products.push({
        title: title,
        price: price,
        image: uploadedImage
    });

    // Reset the form
    titleInput.value = '';
    priceInput.value = '';
    card.querySelector('.upload-placeholder').innerHTML = `
        <span>+</span>
        <p>Add Product</p>
    `;
    delete card.dataset.uploadedImage;

    // Update display
    displayContent(currentArtist);
}

// Setup submissions popover
function setupSubmissionsPopover() {
    // Toggle popover
    submissionsBtn.addEventListener('click', () => {
        submissionsPopover.classList.add('active');
        loadSubmissions();
    });

    // Close popover
    closePopover.addEventListener('click', () => {
        submissionsPopover.classList.remove('active');
    });

    // Close popover when clicking outside
    document.addEventListener('click', (e) => {
        if (!submissionsPopover.contains(e.target) && 
            !submissionsBtn.contains(e.target) && 
            submissionsPopover.classList.contains('active')) {
            submissionsPopover.classList.remove('active');
        }
    });
}

// Load previous submissions
async function loadSubmissions() {
    try {
        const changesRef = collection(db, 'pendingChanges');
        const q = query(
            changesRef,
            where('artistName', '==', artistName)
        );
        const changesSnapshot = await getDocs(q);

        if (changesSnapshot.empty) {
            submissionsList.innerHTML = '<div class="no-submissions">No previous page versions found.</div>';
            return;
        }

        // Sort the results in memory instead of using orderBy
        const sortedDocs = changesSnapshot.docs.sort((a, b) => {
            return new Date(b.data().timestamp) - new Date(a.data().timestamp);
        });

        const changesHTML = sortedDocs
            .filter(doc => doc.data().type === 'artist_page_update')
            .map(doc => {
                const data = doc.data();
                const date = new Date(data.timestamp).toLocaleDateString();
                const status = data.status;
                const statusClass = status === 'approved' ? 'approved' : 
                                  status === 'rejected' ? 'rejected' : 'pending';
                
                // Count the number of sections in the proposed state
                const sectionCount = data.proposedState.sections?.length || 0;
                
                return `
                    <div class="submission-item">
                        <div class="submission-title">Page Version from ${date}</div>
                        <div class="submission-details">
                            <span class="section-count">${sectionCount} sections</span>
                            <span class="submission-status ${statusClass}">${status.charAt(0).toUpperCase() + status.slice(1)}</span>
                        </div>
                        <div class="submission-actions">
                            <button class="edit-submission-btn" data-id="${doc.id}">View & Restore</button>
                        </div>
                    </div>
                `;
            }).join('');

        submissionsList.innerHTML = changesHTML;

        // Add event listeners to edit buttons
        document.querySelectorAll('.edit-submission-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                const changeId = e.target.dataset.id;
                const changeDoc = await getDoc(doc(db, 'pendingChanges', changeId));
                const changeData = changeDoc.data();
                
                // Show confirmation dialog
                if (confirm('Would you like to restore this version of your page? You can review and edit it before saving.')) {
                    // Update currentArtist with the old version's data
                    currentArtist = { ...changeData.proposedState };
                    
                    // Close the popover
                    submissionsPopover.classList.remove('active');
                    
                    // Display the content and enter edit mode
                    displayContent(currentArtist);
                    startEditing();
                    
                    // Show message
                    const message = document.createElement('div');
                    message.className = 'pending-message';
                    message.textContent = 'Previous version loaded. Make any changes and click Save Changes when ready.';
                    document.body.appendChild(message);
                    setTimeout(() => message.remove(), 3000);
                }
            });
        });
    } catch (error) {
        console.error('Error loading page versions:', error);
        submissionsList.innerHTML = '<div class="error">Error loading page versions. Please try again later.</div>';
    }
}

// Setup view toggle functionality
function setupViewToggle() {
    const gridViewBtn = document.getElementById('grid-view');
    const listViewBtn = document.getElementById('list-view');
    const sectionsContainer = document.getElementById('sections-container');

    if (gridViewBtn && listViewBtn) {
        gridViewBtn.addEventListener('click', () => {
            isCollapsedView = false;
            sectionsContainer.classList.remove('collapsed');
            sectionsContainer.style.display = 'flex';
            sectionsContainer.style.flexDirection = 'column';
            sectionsContainer.style.gap = '6rem';
            gridViewBtn.classList.add('active');
            listViewBtn.classList.remove('active');
            displayContent(currentArtist);
        });

        listViewBtn.addEventListener('click', () => {
            isCollapsedView = true;
            sectionsContainer.classList.add('collapsed');
            sectionsContainer.style.display = 'flex';
            sectionsContainer.style.flexDirection = 'column';
            sectionsContainer.style.gap = '1rem';
            listViewBtn.classList.add('active');
            gridViewBtn.classList.remove('active');
            displayContent(currentArtist);
        });
    }
}

// Add styles to the page
const style = document.createElement('style');
style.textContent = `
    .section,
    .section *,
    .section-content,
    .section-images,
    .section-image,
    .service-item,
    .section.collapsed-view,
    .section.collapsed-view *,
    .move-up,
    .move-down,
    .add-service-btn,
    .service-name-input,
    .service-price-input {
        transition: none !important;
        transform: none !important;
        background: #eeeeee !important;
    }

    .section:hover,
    .section *:hover,
    .section-content:hover,
    .section-images:hover,
    .section-image:hover,
    .service-item:hover,
    .section.collapsed-view:hover,
    .section.collapsed-view *:hover,
    .move-up:hover,
    .move-down:hover,
    .add-service-btn:hover,
    .service-name-input:hover,
    .service-price-input:hover {
        background: #eeeeee !important;
        transform: none !important;
        opacity: 1 !important;
    }

    .section {
        position: relative;
        background: #eeeeee !important;
    }

    .section.collapsed-view {
        padding: 0.5rem;
        margin-bottom: 0.5rem;
        border: 1px solid #ddd;
        border-radius: 4px;
        cursor: grab;
        background: #eeeeee !important;
    }

    .section-content {
        background: #eeeeee !important;
    }

    .section-images {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 200px));
        gap: 1rem;
        margin: 1rem 0;
        justify-content: start;
        background: #eeeeee !important;
    }

    .section-image {
        width: 100%;
        height: 200px;
        object-fit: contain;
        border-radius: 4px;
        background: #eeeeee !important;
    }

    .section-handle {
        display: flex;
        align-items: center;
        gap: 1rem;
        margin-bottom: 1rem;
        background: #eeeeee !important;
    }

    .drag-handle {
        cursor: grab;
        color: #666;
        font-size: 1.2rem;
        user-select: none;
        background: #eeeeee !important;
    }

    .move-controls {
        display: flex;
        gap: 0.5rem;
        background: #eeeeee !important;
    }

    .move-up, .move-down {
        padding: 0.3rem 0.6rem;
        border: 1px solid #ddd;
        background: #eeeeee !important;
        color: #000;
        font-size: 1.2rem;
        line-height: 1;
        border-radius: 4px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 32px;
    }

    .move-up:disabled, .move-down:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        background: #eeeeee !important;
        color: #666;
    }

    .delete-section-btn {
        background: #ff4444 !important;
        color: white;
        border: none;
        padding: 0.5rem 1rem;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.9rem;
    }

    .delete-section-btn:hover {
        background: #ff6666 !important;
    }

    .section-title[contenteditable="true"],
    .section-description[contenteditable="true"] {
        border: 2px solid #ddd !important;
        padding: 0.5rem;
        border-radius: 4px;
        background: #eeeeee !important;
        margin: 0.5rem 0;
    }

    .section-title[contenteditable="true"]:focus,
    .section-description[contenteditable="true"]:focus {
        outline: none;
        border-color: #000 !important;
    }

    body {
        background: #eeeeee !important;
    }

    nav,
    .navbar,
    .navbar-expand-lg,
    header nav {
        background: transparent !important;
        background-color: transparent !important;
    }

    .navbar-nav {
        font-size: inherit;
    }
`;
document.head.appendChild(style);

// Update the services styles
const servicesStyle = document.createElement('style');
servicesStyle.textContent = `
    .services-list {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        margin: 1.5rem 0;
        background: #eeeeee !important;
    }

    .service-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.75rem;
        background: #eeeeee !important;
        border-radius: 4px;
        border: 1px solid #ddd;
    }

    .service-name {
        font-weight: 500;
        background: #eeeeee !important;
    }

    .service-price-container {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        background: #eeeeee !important;
    }

    .service-price {
        font-weight: 500;
        color: #666;
        background: #eeeeee !important;
    }

    .remove-service-btn {
        background: none;
        border: none;
        color: #ff4444;
        font-size: 1.2rem;
        cursor: pointer;
        padding: 0.2rem;
        line-height: 1;
        background: #eeeeee !important;
    }

    .remove-service-btn:hover {
        color: #ff6666;
    }

    .add-service-form {
        margin-top: 1rem;
        background: #eeeeee !important;
        padding: 1rem;
        border-radius: 4px;
        border: 1px solid #ddd;
    }

    .service-input-group {
        display: flex;
        gap: 1rem;
        align-items: center;
        background: #eeeeee !important;
    }

    .service-name-input {
        flex: 2;
        padding: 0.8rem;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 0.9rem;
        background: #eeeeee !important;
    }

    .price-input-wrapper {
        position: relative;
        flex: 1;
        background: #eeeeee !important;
    }

    .currency-symbol {
        position: absolute;
        left: 0.8rem;
        top: 38%;
        transform: translateY(-50%);
        color: #666;
        background: #eeeeee !important;
        line-height: 1;
        font-size: 0.9rem;
    }

    .service-price-input {
        width: 100%;
        padding: 0.8rem;
        padding-left: 1.8rem;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 0.9rem;
        background: #eeeeee !important;
    }

    .add-service-btn {
        padding: 0.8rem 1.5rem;
        background: #000 !important;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.9rem;
        white-space: nowrap;
    }

    .service-name-input.error,
    .service-price-input.error {
        border-color: #ff4444;
    }

    .service-name-input:focus,
    .service-price-input:focus {
        outline: none;
        border-color: #ccc;
        background: #eeeeee !important;
    }

    @media (max-width: 768px) {
        .service-input-group {
            flex-direction: column;
        }

        .service-name-input,
        .price-input-wrapper {
            width: 100%;
        }

        .add-service-btn {
            width: 100%;
        }
    }
`;
document.head.appendChild(servicesStyle); 