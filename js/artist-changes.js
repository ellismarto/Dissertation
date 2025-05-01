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
        max-width: 2200px;
        max-height: 90vh;
        margin: 2rem auto;
        background: #eeeeee;
        padding: 2rem 0;
        overflow-y: auto;
    }

    .preview-header {
        margin-bottom: 2rem;
        text-align: left;
        position: relative;
        padding-top: 6rem;
        background: #eeeeee !important;
    }

    .preview-title {
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

    .version-floating-title {
        position: absolute;
        top: 2rem;
        right: 2rem;
        color: white;
        padding: 0.5rem 1rem;
        font-size: 0.9rem;
        font-weight: 400;
        letter-spacing: -0.02em;
        border-radius: 4px;
        z-index: 1;
    }

    .version-floating-title.previous {
        background: #ff8383;
    }

    .version-floating-title.new {
        background: #7baf76;
    }

    .close-preview {
        position: absolute;
        top: 2rem;
        right: 2rem;
        background: none;
        border: none;
        font-size: 1.5rem;
        cursor: pointer;
        padding: 0.5rem;
        color: #666;
        z-index: 2;
    }

    .preview-sections {
        padding: 0 2rem;
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
        }
        
        .artist-category {
            font-size: 1.8rem;
        }

        .preview-content {
            margin: 1rem;
            padding: 1rem 0;
        }

        .version-floating-title {
            top: 1rem;
            right: 1rem;
        }

        .close-preview {
            top: 1rem;
            right: 1rem;
        }
    }
`;
document.head.appendChild(previewStyle);

function showPreview(version, data, artistName) {
    const modal = document.getElementById('preview-modal');
    const previewContent = modal.querySelector('.preview-content');

    // Clear existing content
    previewContent.innerHTML = `
        <button class="close-preview">&times;</button>
        <div class="preview-header">
            <div class="artist-header-container">
                <h2 class="preview-title">${artistName}</h2>
                ${data.category ? `<div class="artist-category">${formatCategory(data.category)}</div>` : ''}
            </div>
        </div>
        <div class="preview-sections"></div>
    `;

    // Add version indicator
    const versionTitle = document.createElement('div');
    versionTitle.className = `version-floating-title ${version.toLowerCase()}`;
    versionTitle.textContent = `${version} version`;
    previewContent.querySelector('.preview-header').appendChild(versionTitle);

    // Setup close button
    const closeBtn = previewContent.querySelector('.close-preview');
    closeBtn.addEventListener('click', () => {
        modal.classList.remove('active');
    });

    // Add feature image if it exists
    const previewSections = previewContent.querySelector('.preview-sections');
    let featureImageHtml = '';
    if (data.featureImage) {
        featureImageHtml = `
            <div class="preview-feature-image">
                <img src="${data.featureImage}" alt="Feature image" class="feature-image">
            </div>
        `;
    }
    
    previewSections.innerHTML = featureImageHtml + data.sections.map(section => {
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

// Helper function to format category name
function formatCategory(category) {
    return category
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

// Helper function to format relative time
function formatRelativeTime(timestamp) {
    const now = new Date();
    const date = new Date(timestamp);
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) {
        return 'just now';
    }
    
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
        return `${diffInMinutes} ${diffInMinutes === 1 ? 'min' : 'mins'} ago`;
    }
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
        return `${diffInHours} ${diffInHours === 1 ? 'hour' : 'hours'} ago`;
    }
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) {
        return `${diffInDays} ${diffInDays === 1 ? 'day' : 'days'} ago`;
    }
    
    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInWeeks < 4) {
        return `${diffInWeeks} ${diffInWeeks === 1 ? 'week' : 'weeks'} ago`;
    }
    
    const diffInMonths = Math.floor(diffInDays / 30);
    if (diffInMonths < 12) {
        return `${diffInMonths} ${diffInMonths === 1 ? 'month' : 'months'} ago`;
    }
    
    const diffInYears = Math.floor(diffInDays / 365);
    return `${diffInYears} ${diffInYears === 1 ? 'year' : 'years'} ago`;
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
    // Create the card element from scratch instead of using template
    const cardElement = document.createElement('div');
    cardElement.className = 'change-card';
    cardElement.dataset.changeId = changeId;

    cardElement.innerHTML = `
        <div class="change-header">
            <div class="change-info">
                <div class="change-artist">${change.artistName}</div>
                <div class="change-timestamp">${formatRelativeTime(change.timestamp)}</div>
            </div>
            <div class="change-actions">
                <button class="view-previous-btn">View Previous</button>
                <button class="view-new-btn">View New</button>
                <button class="approve-btn">Approve</button>
                <button class="reject-btn">Reject</button>
            </div>
        </div>
        <div class="change-content">
            ${createSectionComparison(change.previousState, change.proposedState)}
        </div>
        <div class="rejection-reason-container">
            <textarea class="rejection-reason-input" placeholder="Enter reason for rejection..."></textarea>
            <div class="rejection-buttons">
                <button class="cancel-rejection-btn">Cancel</button>
                <button class="confirm-rejection-btn">Confirm Rejection</button>
            </div>
        </div>
    `;

    // Add event listeners
    const viewPreviousBtn = cardElement.querySelector('.view-previous-btn');
    const viewNewBtn = cardElement.querySelector('.view-new-btn');
    const approveBtn = cardElement.querySelector('.approve-btn');
    const rejectBtn = cardElement.querySelector('.reject-btn');
    const rejectionContainer = cardElement.querySelector('.rejection-reason-container');
    const cancelRejectBtn = cardElement.querySelector('.cancel-rejection-btn');
    const confirmRejectBtn = cardElement.querySelector('.confirm-rejection-btn');
    const rejectionInput = cardElement.querySelector('.rejection-reason-input');

    viewPreviousBtn.addEventListener('click', () => {
        window.location.href = `artist.html?name=${encodeURIComponent(change.artistName)}&version=previous`;
    });

    viewNewBtn.addEventListener('click', () => {
        window.location.href = `artist.html?name=${encodeURIComponent(change.artistName)}&version=new`;
    });

    approveBtn.addEventListener('click', () => handleApprove(changeId, change));

    rejectBtn.addEventListener('click', () => {
        rejectionContainer.classList.add('active');
        // Wait a tiny bit for the container to become visible before scrolling
        setTimeout(() => {
            rejectionContainer.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center'
            });
            rejectionInput.focus();
        }, 50);
    });

    cancelRejectBtn.addEventListener('click', () => {
        rejectionContainer.classList.remove('active');
        rejectionInput.value = '';
    });

    confirmRejectBtn.addEventListener('click', () => {
        const reason = rejectionInput.value.trim();
        if (!reason) {
            alert('Please provide a reason for rejection');
            return;
        }
        handleReject(changeId, change, reason);
    });

    return cardElement;
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
                    <h3 class="feature-image-title">Feature Image</h3>
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
                    <h3 class="feature-image-title">Feature Image</h3>
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
        background: #2f2f2f;
        border-radius: 32px;
        padding: 2rem;
        margin-bottom: 1rem;
    }

    .section-comparison {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
        background: #2f2f2f;
        border-radius: 4px;
    }

    .previous-version,
    .new-version {
        background: #eeeeee;
        padding: 1rem;
        border-radius: 20px;
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
        padding-top: 4rem;
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

async function handleReject(changeId, change, rejectionReason) {
    try {
        // Get the change document first to ensure it exists
        const changeRef = doc(db, 'pendingChanges', changeId);
        const changeDoc = await getDoc(changeRef);

        if (!changeDoc.exists()) {
            throw new Error('Change document not found');
        }

        const changeData = changeDoc.data();

        // Update the change document with rejection status and reason
        await updateDoc(changeRef, {
            status: 'rejected',
            rejectionReason: rejectionReason
        });

        // Create notification for the artist
        await addDoc(collection(db, 'notifications'), {
            userId: changeData.artistName,
            type: 'change_rejected',
            message: `Your page changes were not approved.\n\nReason: ${rejectionReason}`,
            timestamp: new Date(),
            read: false,
            changeId: changeId
        });

        // Remove the card from the UI
        const card = document.querySelector(`[data-change-id="${changeId}"]`);
        if (card) {
            card.remove();
        }

        // Show success message
        showMessage('Changes rejected');
    } catch (error) {
        console.error('Error rejecting change:', error);
        showMessage('Error rejecting changes', true);
    }
}

function showMessage(message, isError = false) {
    // Remove any existing messages first
    const existingMessages = document.querySelectorAll('.message');
    existingMessages.forEach(msg => msg.remove());

    const messageContainer = document.createElement('div');
    messageContainer.className = `message ${isError ? 'error' : ''}`;
    messageContainer.textContent = message;
    document.body.appendChild(messageContainer);

    // Add animation end cleanup
    messageContainer.addEventListener('animationend', () => {
        setTimeout(() => {
            messageContainer.style.animation = 'fadeOut 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
            messageContainer.addEventListener('animationend', () => {
                messageContainer.remove();
            });
        }, 2000);
    });
}

// Add fadeOut animation style
const messageStyle = document.createElement('style');
messageStyle.textContent = `
    @keyframes fadeOut {
        from {
            transform: translate(-50%, 0);
            opacity: 1;
        }
        to {
            transform: translate(-50%, -100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(messageStyle); 