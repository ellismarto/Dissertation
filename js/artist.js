import { db, storage } from './firebase-config.js';
import { 
    doc, getDoc, setDoc, collection, addDoc, getFirestore, updateDoc, query, where, getDocs, deleteDoc 
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
const editControls = document.querySelector('.edit-controls');

// State
let isEditing = false;
let currentArtist = null;
let isCollapsedView = false;

// Get artist name from URL parameter
const urlParams = new URLSearchParams(window.location.search);
const artistName = urlParams.get('name');

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
    
    // Load content
    loadArtistContent();
    setupEventListeners();
});

// Event Listeners
function setupEventListeners() {
    editBtn.addEventListener('click', startEditing);
    saveBtn.addEventListener('click', saveChanges);
    addSectionBtn.addEventListener('click', addNewSection);
    
    // Delegate event listeners for dynamic elements
    sectionsContainer.addEventListener('change', handleFileSelect);
    sectionsContainer.addEventListener('click', handleSectionControls);
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
        
        if (confirm('Are you sure you want to delete this section?')) {
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
        headerContainer.appendChild(artistNameElement);

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
            headerContainer.appendChild(categoryElement);
            console.log('Category element appended to header container');
        }

        // Add feature image container
        const featureImageContainer = document.createElement('div');
        featureImageContainer.className = 'feature-image-container';
        headerContainer.appendChild(featureImageContainer);

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
            
            // Ensure services section exists
            if (!currentArtist.sections) {
                currentArtist.sections = [];
            }
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

        return `
            <div class="section ${isCollapsedView ? 'collapsed-view' : ''}" data-index="${index}" draggable="${isEditing && isCollapsedView}">
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
                    <h2 class="section-title" contenteditable="${section.type !== 'services' && isEditing}" spellcheck="false" 
                        data-placeholder="New Section">${section.type === 'services' ? 'Services' : (section.title || (isEditing ? 'New Section' : ''))}</h2>
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
                        ${isEditing && section.type !== 'services' ? `
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

    if (isEditing) {
        if (isCollapsedView) {
            setupDragAndDrop();
        }
        setupMoveControls();
        setupEditableElements();
        setupImageUpload();
        setupServiceControls();
    }
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
        margin-bottom: 0rem;
        padding-left: 0.6rem;
        letter-spacing: -0.05em;
        line-height: 0.6;
        font-family: 'Helvetica Neue', Arial, sans-serif;
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
        gap: 0rem;
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
            flex-direction: column;
            align-items: flex-start;
            gap: 0rem;
        }
        
        .artist-category {
            font-size: 1rem;
            margin-left: 0;
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
`;
document.head.appendChild(featureImageStyle);

// Start editing
function startEditing() {
    isEditing = true;
    document.body.classList.add('editing');
    editBtn.style.display = 'none';
    saveBtn.style.display = 'block';
    addSectionBtn.style.display = 'block';

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
    if (servicesIndex >= 0) {
        currentArtist.sections.splice(servicesIndex, 0, newSection);
    } else {
        currentArtist.sections.push(newSection);
    }
    
    displayContent(currentArtist);
    document.body.classList.add('editing');
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
                          currentState.featureImage !== currentArtist.featureImage;
        
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
        await setDoc(changeRef, {
            artistName: artistName,
            previousState: currentState,
            proposedState: {
                name: artistName,
                sections: sections,
                featureImage: currentArtist.featureImage,
                lastUpdated: timestamp
            },
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
    addSectionBtn.style.display = isEnabled ? 'block' : 'none';
    isCollapsedView = false; // Reset view mode when exiting edit mode
    displayContent(currentArtist);
}

// Add feature image upload functionality
function setupFeatureImageUpload() {
    const featureImageContainer = document.querySelector('.feature-image-container');
    if (!featureImageContainer) return;

    const isViewMode = document.body.classList.contains('view-mode');
    if (isViewMode) {
        // Remove the upload button in view mode
        const uploadButton = featureImageContainer.querySelector('.upload-feature-image');
        if (uploadButton) {
            uploadButton.remove();
        }
        return;
    }

    // Create upload button and file input
    const uploadButton = document.createElement('button');
    uploadButton.className = 'upload-feature-image';
    uploadButton.textContent = 'Upload Feature Image';
    
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    
    featureImageContainer.appendChild(uploadButton);
    featureImageContainer.appendChild(fileInput);

    // Handle file selection
    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            // Upload to Firebase Storage
            const storageRef = ref(storage, `artist-pages/${artistName}/feature-image/${Date.now()}-${file.name}`);
            const snapshot = await uploadBytes(storageRef, file);
            const url = await getDownloadURL(snapshot.ref);

            // Update the feature image display
            const existingImage = featureImageContainer.querySelector('.feature-image');
            if (existingImage) {
                existingImage.src = url;
            } else {
                const newImage = document.createElement('img');
                newImage.className = 'feature-image';
                newImage.src = url;
                newImage.alt = `${artistName}'s feature image`;
                featureImageContainer.insertBefore(newImage, uploadButton);
            }

            // Update currentArtist with new feature image URL
            currentArtist.featureImage = url;
            document.body.classList.add('editing');
        } catch (error) {
            console.error('Error uploading feature image:', error);
            alert('Error uploading image. Please try again.');
        }
    });

    // Handle upload button click
    uploadButton.addEventListener('click', () => {
        fileInput.click();
    });
} 