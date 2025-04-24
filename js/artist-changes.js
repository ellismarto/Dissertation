import { getFirestore, collection, query, where, getDocs, doc, updateDoc, deleteDoc, getDoc, setDoc, addDoc } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';

const db = getFirestore();

document.addEventListener('DOMContentLoaded', () => {
    loadPendingChanges();
    setupPreviewModal();
});

function setupPreviewModal() {
    const modal = document.getElementById('preview-modal');
    const closeBtn = modal.querySelector('.close-preview');

    closeBtn.addEventListener('click', () => {
        modal.classList.remove('active');
    });

    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });

    // Close modal with escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            modal.classList.remove('active');
        }
    });
}

// Add styles for preview modal
const previewStyle = document.createElement('style');
previewStyle.textContent = `
    .preview-modal {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(238, 238, 238, 0.95);
        z-index: 1000;
    }

    .preview-modal.active {
        display: block;
    }

    .preview-content {
        position: relative;
        width: 90%;
        max-width: 1200px;
        max-height: 90vh;
        margin: 2rem auto;
        background: #eeeeee;
        padding: 3rem 2rem 2rem;
        overflow-y: auto;
        border-radius: 4px;
    }

    .preview-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 2rem;
        padding-bottom: 1rem;
        border-bottom: 1px solid #eee;
        position: relative;
    }

    .preview-title {
        font-size: 8rem;
        font-weight: 500;
        letter-spacing: -0.05em;
        text-transform: uppercase;
        line-height: 0.8;
        font-family: 'Helvetica Neue', Arial, sans-serif;
        margin: 0;
        position: relative;
        padding-bottom: 7rem;
    }

    .preview-title::after {
        content: attr(data-last-name);
        position: absolute;
        left: 8rem;
        top: 7rem;
        white-space: nowrap;
        font-weight: 500;
        letter-spacing: -0.05em;
        line-height: 0.8;
    }

    .preview-title span {
        visibility: hidden;
    }

    .version-floating-title {
        position: absolute;
        top: -1.5rem;
        right: 2rem;
        color: white;
        padding: 0.5rem 1rem;
        font-size: 1rem;
        font-weight: 400;
        letter-spacing: -0.02em;
        text-transform: none;
        border-radius: 4px;
        z-index: 1;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        transform: translateY(-50%);
    }

    .version-floating-title.previous {
        background: #ff8383;
    }

    .version-floating-title.new {
        background: #7baf76;
    }

    .close-preview {
        background: none;
        border: none;
        font-size: 1.5rem;
        cursor: pointer;
        padding: 0.5rem;
        color: #666;
    }

    .preview-sections {
        display: grid;
        gap: 3rem;
    }

    .preview-section {
        border-bottom: 1px solid #ddd;
        padding-bottom: 2rem;
        background: #eeeeee;
    }

    .preview-section:last-child {
        border-bottom: none;
    }

    .preview-section-title {
        font-size: 1.25rem;
        font-weight: 400;
        margin-bottom: 1rem;
    }

    .preview-section-images {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 200px));
        gap: 1rem;
        margin-bottom: 1rem;
        background: #eeeeee;
        justify-content: start;
    }

    .preview-section-image {
        width: 100%;
        height: 200px;
        object-fit: contain;
        border-radius: 4px;
        background: #eeeeee;
    }

    .preview-section-description {
        color: #666;
        line-height: 1.6;
    }

    @media (max-width: 768px) {
        .preview-title {
            font-size: 4rem;
            padding-bottom: 4rem;
        }
        .preview-title::after {
            left: 4rem;
            top: 3.5rem;
        }
        .preview-content {
            margin: 1rem;
            padding: 1rem;
        }
        .version-floating-title {
            top: -1rem;
            right: 1rem;
            font-size: 0.9rem;
            padding: 0.5rem 1rem;
        }
    }
`;
document.head.appendChild(previewStyle);

function showPreview(version, data, artistName) {
    const modal = document.getElementById('preview-modal');
    const title = modal.querySelector('.preview-title');
    const sections = modal.querySelector('.preview-sections');
    const header = modal.querySelector('.preview-header');

    // Clear any existing version title
    const existingVersionTitle = header.querySelector('.version-floating-title');
    if (existingVersionTitle) {
        existingVersionTitle.remove();
    }

    // Format the artist name to show the skewed effect
    const nameParts = artistName.split(' ');
    const firstName = nameParts[0];
    const remainingNames = nameParts.slice(1).join(' ');
    title.textContent = firstName;
    title.innerHTML += `<span> ${remainingNames}</span>`;
    title.setAttribute('data-last-name', remainingNames);
    
    // Add floating version title
    const versionTitle = document.createElement('div');
    versionTitle.className = `version-floating-title ${version.toLowerCase()}`;
    versionTitle.textContent = `${version} version`;
    header.appendChild(versionTitle);

    // Add feature image if it exists
    let featureImageHtml = '';
    if (data.featureImage) {
        featureImageHtml = `
            <div class="preview-feature-image">
                <img src="${data.featureImage}" alt="Feature image" class="feature-image">
            </div>
        `;
    }
    
    sections.innerHTML = featureImageHtml + data.sections.map(section => {
        if (section.type === 'services') {
            return `
                <div class="preview-section">
                    <h3 class="preview-section-title">Services</h3>
                    <div class="services-list">
                        ${(section.services || []).map(service => `
                            <div class="service-item">
                                <span class="service-name">${service.name}</span>
                                <span class="service-price">£${service.price}</span>
                            </div>
                        `).join('')}
                    </div>
                    ${section.description ? `<p class="preview-section-description">${section.description}</p>` : ''}
                </div>
            `;
        }
        return `
            <div class="preview-section">
                <h3 class="preview-section-title">${section.title || 'Untitled Section'}</h3>
                ${section.images && section.images.length > 0 ? `
                    <div class="preview-section-images">
                        ${section.images.map(image => `
                            <img src="${image}" alt="${section.title}" class="preview-section-image">
                        `).join('')}
                    </div>
                ` : ''}
                ${section.description ? `<p class="preview-section-description">${section.description}</p>` : ''}
            </div>
        `;
    }).join('');

    modal.classList.add('active');
}

async function loadPendingChanges() {
    const changesList = document.getElementById('changes-list');
    
    try {
        const pendingChangesRef = collection(db, 'pendingChanges');
        const q = query(pendingChangesRef, where('status', '==', 'pending'));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            changesList.innerHTML = '<div class="no-changes">No pending changes to review</div>';
            return;
        }

        changesList.innerHTML = '';
        snapshot.forEach(doc => {
            const change = doc.data();
            const changeCard = createChangeCard(doc.id, change);
            changesList.appendChild(changeCard);
        });
    } catch (error) {
        console.error('Error loading changes:', error);
        changesList.innerHTML = '<div class="no-changes">Error loading changes. Please try again.</div>';
    }
}

function createChangeCard(changeId, change) {
    const card = document.createElement('div');
    card.className = 'change-card';
    
    const timestamp = new Date(change.timestamp).toLocaleString();
    
    card.innerHTML = `
        <div class="change-header">
            <div class="change-info">
                <h2 class="change-artist">${change.artistName}</h2>
                <div class="change-timestamp">${timestamp}</div>
            </div>
            <div class="change-actions">
                <button class="preview-btn preview-previous">View Previous</button>
                <button class="preview-btn preview-new">View New</button>
                <button class="approve-btn" data-change-id="${changeId}">Approve</button>
                <button class="reject-btn" data-change-id="${changeId}">Reject</button>
            </div>
        </div>
        <div class="change-content">
            ${createSectionComparison(change.previousState, change.proposedState)}
        </div>
    `;

    // Add event listeners for buttons
    card.querySelector('.approve-btn').addEventListener('click', () => handleApprove(changeId, change));
    card.querySelector('.reject-btn').addEventListener('click', () => handleReject(changeId, change));
    card.querySelector('.preview-previous').addEventListener('click', () => {
        if (change.previousState) {
            showPreview('Previous', change.previousState, change.artistName);
        } else {
            alert('No previous version available');
        }
    });
    card.querySelector('.preview-new').addEventListener('click', () => {
        showPreview('New', change.proposedState, change.artistName);
    });

    return card;
}

function createSectionComparison(previousState, proposedState) {
    const previousSections = previousState?.sections || [];
    const proposedSections = proposedState?.sections || [];

    // Create feature image comparison
    const previousFeatureImage = previousState?.featureImage ? `
        <div class="feature-image-comparison">
            <img src="${previousState.featureImage}" alt="Previous feature image" class="feature-image">
        </div>
    ` : '<div class="feature-image-comparison">No feature image</div>';

    const proposedFeatureImage = proposedState?.featureImage ? `
        <div class="feature-image-comparison">
            <img src="${proposedState.featureImage}" alt="Proposed feature image" class="feature-image">
        </div>
    ` : '<div class="feature-image-comparison">No feature image</div>';

    return `
        <div class="section-comparison">
            <div class="previous-version">
                <div class="version-label">Previous Version</div>
                <div class="feature-image-section">
                    <h3>Feature Image</h3>
                    ${previousFeatureImage}
                </div>
                ${previousSections.map(section => {
                    if (section.type === 'services') {
                        return `
                            <div class="change-section">
                                <h3>Services</h3>
                                <div class="services-list">
                                    ${(section.services || []).map(service => `
                                        <div class="service-item">
                                            <span class="service-name">${service.name}</span>
                                            <span class="service-price">£${service.price}</span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        `;
                    } else {
                        return `
                            <div class="change-section">
                                <h3>${section.title || 'Untitled Section'}</h3>
                                <p>${section.description || 'No description'}</p>
                                ${section.images ? `<p>${section.images.length} images</p>` : ''}
                            </div>
                        `;
                    }
                }).join('') || 'No previous content'}
            </div>
            <div class="new-version">
                <div class="version-label">New Version</div>
                <div class="feature-image-section">
                    <h3>Feature Image</h3>
                    ${proposedFeatureImage}
                </div>
                ${proposedSections.map(section => {
                    if (section.type === 'services') {
                        return `
                            <div class="change-section">
                                <h3>Services</h3>
                                <div class="services-list">
                                    ${(section.services || []).map(service => `
                                        <div class="service-item">
                                            <span class="service-name">${service.name}</span>
                                            <span class="service-price">£${service.price}</span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        `;
                    } else {
                        return `
                            <div class="change-section">
                                <h3>${section.title || 'Untitled Section'}</h3>
                                <p>${section.description || 'No description'}</p>
                                ${section.images ? `<p>${section.images.length} images</p>` : ''}
                            </div>
                        `;
                    }
                }).join('') || 'No content'}
            </div>
        </div>
    `;
}

// Add styles for services in changes view
const style = document.createElement('style');
style.textContent = `
    .services-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        margin-top: 1rem;
    }

    .service-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.75rem;
        background: #eeeeee;
        border-radius: 4px;
        border: 1px solid #ddd;
    }

    .service-name {
        font-weight: 500;
    }

    .service-price {
        color: #666;
    }

    .change-section {
        background: #eeeeee;
        padding: 1rem;
        border-radius: 4px;
        border: 1px solid #ddd;
        margin-bottom: 1rem;
    }

    .change-card {
        background: #eeeeee;
        border: 1px solid #ddd;
        border-radius: 4px;
        padding: 1rem;
        margin-bottom: 1rem;
    }

    .section-comparison {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
        background: #eeeeee;
        padding: 1rem;
        border-radius: 4px;
    }

    .previous-version,
    .new-version {
        background: #eeeeee;
        padding: 1rem;
        border-radius: 4px;
        border: 1px solid #ddd;
    }
`;
document.head.appendChild(style);

// Add styles for feature image
const featureImageStyle = document.createElement('style');
featureImageStyle.textContent = `
    .preview-feature-image {
        width: 100%;
        margin-bottom: 2rem;
    }

    .preview-feature-image .feature-image {
        width: 100%;
        height: auto;
        max-height: 400px;
        object-fit: cover;
        border-radius: 4px;
    }

    .feature-image-section {
        margin-bottom: 2rem;
        padding: 1rem;
        background: #eeeeee;
        border-radius: 4px;
    }

    .feature-image-comparison {
        margin-top: 1rem;
    }

    .feature-image-comparison .feature-image {
        width: 100%;
        height: auto;
        max-height: 200px;
        object-fit: cover;
        border-radius: 4px;
    }
`;
document.head.appendChild(featureImageStyle);

async function handleApprove(changeId, change) {
    try {
        // Update or create the artist page with new content
        const artistRef = doc(db, 'artistPages', change.artistName);
        const artistDoc = await getDoc(artistRef);
        
        if (artistDoc.exists()) {
            // Update existing artist page
            await updateDoc(artistRef, {
                sections: change.proposedState.sections,
                featureImage: change.proposedState.featureImage,
                lastUpdated: new Date().toISOString()
            });
        } else {
            // Create new artist page
            await setDoc(artistRef, {
                name: change.artistName,
                sections: change.proposedState.sections,
                featureImage: change.proposedState.featureImage,
                lastUpdated: new Date().toISOString()
            });
        }

        // Mark change as approved
        const changeRef = doc(db, 'pendingChanges', changeId);
        await updateDoc(changeRef, {
            status: 'approved',
            approvedAt: new Date().toISOString()
        });

        // Create notification for the artist
        const notificationRef = collection(db, 'notifications');
        await addDoc(notificationRef, {
            userId: change.artistName,
            type: 'change_approved',
            message: 'Your page changes have been approved',
            timestamp: new Date().toISOString(),
            read: false,
            artistName: change.artistName,
            changeId: changeId
        });

        // Refresh the changes list
        loadPendingChanges();
    } catch (error) {
        console.error('Error approving changes:', error);
        alert('Error approving changes. Please try again.');
    }
}

async function handleReject(changeId, change) {
    try {
        // Only try to restore previous state if the artist page exists
        const artistRef = doc(db, 'artistPages', change.artistName);
        const artistDoc = await getDoc(artistRef);
        
        if (artistDoc.exists() && change.previousState) {
            await updateDoc(artistRef, {
                sections: change.previousState.sections,
                lastUpdated: new Date().toISOString()
            });
        }

        // Mark change as rejected
        const changeRef = doc(db, 'pendingChanges', changeId);
        await updateDoc(changeRef, {
            status: 'rejected',
            rejectedAt: new Date().toISOString()
        });

        // Create notification for the artist
        const notificationRef = collection(db, 'notifications');
        await addDoc(notificationRef, {
            userId: change.artistName,
            type: 'change_rejected',
            message: 'Your page changes have been rejected',
            timestamp: new Date().toISOString(),
            read: false,
            artistName: change.artistName,
            changeId: changeId
        });

        // Refresh the changes list
        loadPendingChanges();
    } catch (error) {
        console.error('Error rejecting changes:', error);
        alert('Error rejecting changes. Please try again.');
    }
} 