import { db, storage } from './firebase-config.js';
import { collection, query, orderBy, getDocs, doc, updateDoc, deleteDoc, getDoc, addDoc } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';
import { ref, getDownloadURL } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-storage.js';

// State management
let allSubmissions = [];
let currentFilter = 'all';
let currentSort = 'newest';
let searchTerm = '';
let currentCategory = 'all';
let selectedMessages = new Set();

// Helper function to format dates
function formatDate(date) {
    if (!date) return 'Unknown date';
    
    const now = new Date();
    const diff = now - date;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 7) {
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } else if (days > 0) {
        return `${days} day${days > 1 ? 's' : ''} ago`;
    } else if (hours > 0) {
        return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else if (minutes > 0) {
        return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else {
        return 'Just now';
    }
}

// DOM Elements
const submissionsList = document.getElementById('messages-list');
const searchInput = document.getElementById('search-input');
const filterButtons = document.querySelectorAll('.filter-btn');
const sortSelect = document.getElementById('sort-select');
const categorySelect = document.getElementById('category-select');
const totalSubmissionsElement = document.getElementById('total-messages');
const pendingCountElement = document.getElementById('pending-count');
const todayCountElement = document.getElementById('today-count');
const bulkActionsBar = document.getElementById('bulk-actions');
const selectAllCheckbox = document.getElementById('select-all');
const selectedCountSpan = document.getElementById('selected-count');
const deleteSelectedButton = document.getElementById('delete-selected');

// Event Listeners
searchInput.addEventListener('input', (e) => {
    searchTerm = e.target.value.toLowerCase();
    renderSubmissions();
});

filterButtons.forEach(button => {
    button.addEventListener('click', () => {
        filterButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        currentFilter = button.dataset.filter;
        renderSubmissions();
    });
});

categorySelect.addEventListener('change', (e) => {
    currentCategory = e.target.value;
    renderSubmissions();
});

sortSelect.addEventListener('change', (e) => {
    currentSort = e.target.value;
    renderSubmissions();
});

// Event Listeners for selection
selectAllCheckbox?.addEventListener('change', () => {
    const checkboxes = document.querySelectorAll('.message-select');
    checkboxes.forEach(checkbox => {
        checkbox.checked = selectAllCheckbox.checked;
        handleMessageSelection(checkbox);
    });
});

deleteSelectedButton?.addEventListener('click', async () => {
    if (confirm('Are you sure you want to delete the selected submissions?')) {
        await deleteSelectedMessages();
    }
});

// Selection handling
function handleMessageSelection(checkbox) {
    const messageId = checkbox.dataset.messageId;
    if (checkbox.checked) {
        selectedMessages.add(messageId);
    } else {
        selectedMessages.delete(messageId);
    }
    updateBulkActionsVisibility();
}

function updateBulkActionsVisibility() {
    const selectedCount = selectedMessages.size;
    if (selectedCount > 0) {
        bulkActionsBar.classList.add('visible');
        selectedCountSpan.textContent = `${selectedCount} selected`;
        selectAllCheckbox.checked = document.querySelectorAll('.message-select').length === selectedCount;
    } else {
        bulkActionsBar.classList.remove('visible');
        selectAllCheckbox.checked = false;
    }
}

// Delete functionality
async function deleteSelectedMessages() {
    try {
        const deletePromises = Array.from(selectedMessages).map(messageId => 
            deleteDoc(doc(db, 'submissions', messageId))
        );
        
        await Promise.all(deletePromises);
        
        // Remove deleted messages from allSubmissions
        allSubmissions = allSubmissions.filter(msg => !selectedMessages.has(msg.id));
        selectedMessages.clear();
        updateBulkActionsVisibility();
        updateStats();
        renderSubmissions();
    } catch (error) {
        console.error('Error deleting submissions:', error);
        alert('Error deleting submissions. Please try again.');
    }
}

// Update submission status
async function updateSubmissionStatus(submissionId, newStatus, rejectionReason = '') {
    try {
        const submissionRef = doc(db, 'submissions', submissionId);
        const submissionDoc = await getDoc(submissionRef);
        const submissionData = submissionDoc.data();

        // Update submission status
        await updateDoc(submissionRef, {
            status: newStatus,
            reviewedAt: new Date(),
            ...(newStatus === 'rejected' && rejectionReason ? { rejectionReason } : {})
        });
        
        // Create notification based on status
        await addDoc(collection(db, 'notifications'), {
            type: newStatus === 'approved' ? 'submission_approved' : 'submission_rejected',
            message: newStatus === 'approved' 
                ? `Your submission has been approved! Your artist page is now live.`
                : `Your submission has been reviewed but was not approved at this time.${rejectionReason ? `\n\nReason: ${rejectionReason}` : ''}`,
            timestamp: new Date(),
            read: false,
            submissionId: submissionId
        });
        
        // Update local state
        const submission = allSubmissions.find(s => s.id === submissionId);
        if (submission) {
            submission.status = newStatus;
            submission.reviewedAt = new Date();
            if (newStatus === 'rejected' && rejectionReason) {
                submission.rejectionReason = rejectionReason;
            }
        }
        
        updateStats();
        renderSubmissions();
    } catch (error) {
        console.error('Error updating submission status:', error);
        alert('Error updating submission status. Please try again.');
    }
}

// Show rejection reason input
function showRejectionReason(submissionId) {
    const submissionCard = document.querySelector(`.message-card[data-id="${submissionId}"]`);
    if (!submissionCard) return;

    const rejectionContainer = submissionCard.querySelector('.rejection-reason-container');
    if (rejectionContainer) {
        rejectionContainer.classList.add('visible');
        rejectionContainer.querySelector('.rejection-reason-input').focus();
    }
}

// Hide rejection reason input
function hideRejectionReason(submissionId) {
    const submissionCard = document.querySelector(`.message-card[data-id="${submissionId}"]`);
    if (!submissionCard) return;

    const rejectionContainer = submissionCard.querySelector('.rejection-reason-container');
    if (rejectionContainer) {
        rejectionContainer.classList.remove('visible');
        rejectionContainer.querySelector('.rejection-reason-input').value = '';
    }
}

// Handle rejection confirmation
function confirmRejection(submissionId) {
    const submissionCard = document.querySelector(`.message-card[data-id="${submissionId}"]`);
    if (!submissionCard) return;

    const rejectionInput = submissionCard.querySelector('.rejection-reason-input');
    const rejectionReason = rejectionInput.value.trim();
    
    if (rejectionReason) {
        updateSubmissionStatus(submissionId, 'rejected', rejectionReason);
    } else {
        alert('Please provide a reason for rejection.');
        rejectionInput.focus();
    }
}

// Update statistics
function updateStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const stats = {
        total: allSubmissions.length,
        pending: allSubmissions.filter(sub => sub.status === 'pending').length,
        today: allSubmissions.filter(sub => {
            const subDate = new Date(sub.timestamp.seconds * 1000);
            return subDate >= today;
        }).length
    };

    totalSubmissionsElement.textContent = stats.total;
    pendingCountElement.textContent = stats.pending;
    todayCountElement.textContent = stats.today;
}

// Filter and sort submissions
function filterAndSortSubmissions() {
    let filtered = [...allSubmissions];

    // Apply status filter
    if (currentFilter !== 'all') {
        filtered = filtered.filter(sub => sub.status === currentFilter);
    }

    // Apply category filter
    if (currentCategory !== 'all') {
        filtered = filtered.filter(sub => (sub.category || 'other') === currentCategory);
    }

    // Apply search
    if (searchTerm) {
        filtered = filtered.filter(sub =>
            sub.name?.toLowerCase().includes(searchTerm) ||
            sub.email?.toLowerCase().includes(searchTerm) ||
            sub.description?.toLowerCase().includes(searchTerm)
        );
    }

    // Apply sort
    filtered.sort((a, b) => {
        let dateA = a.timestamp;
        let dateB = b.timestamp;
        
        // Convert timestamps to comparable values
        if (dateA?.seconds) dateA = dateA.seconds * 1000;
        else if (dateA instanceof Date) dateA = dateA.getTime();
        else if (dateA) dateA = new Date(dateA).getTime();
        else dateA = 0;
        
        if (dateB?.seconds) dateB = dateB.seconds * 1000;
        else if (dateB instanceof Date) dateB = dateB.getTime();
        else if (dateB) dateB = new Date(dateB).getTime();
        else dateB = 0;
        
        return currentSort === 'newest' ? dateB - dateA : dateA - dateB;
    });

    return filtered;
}

// Render submissions to DOM
async function renderSubmissions() {
    const filtered = filterAndSortSubmissions();
    
    if (filtered.length === 0) {
        submissionsList.innerHTML = '<div class="no-results">No submissions found</div>';
        return;
    }

    submissionsList.innerHTML = '';
    
    for (const data of filtered) {
        // Handle different timestamp formats
        let date;
        if (data.timestamp?.seconds) {
            date = new Date(data.timestamp.seconds * 1000);
        } else if (data.timestamp instanceof Date) {
            date = data.timestamp;
        } else if (data.timestamp) {
            date = new Date(data.timestamp);
        } else {
            date = new Date();
        }

        const category = data.category || 'other';
        
        const submissionCard = document.createElement('div');
        submissionCard.className = `message-card ${data.status || 'pending'}`;
        
        // Get status display text
        const statusText = {
            'pending': 'Pending',
            'approved': 'Approved',
            'rejected': 'Rejected'
        }[data.status || 'pending'];

        // Format category display text
        const categoryText = data.category ? data.category
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ') 
            : 'Other';

        // Create header with status tag
        const headerHTML = `
            <div class="message-header">
                <div class="message-info">
                    <div class="artist-details">
                        <div class="artist-name">
                            ${data.status === 'approved' 
                                ? `<a href="artist.html?name=${encodeURIComponent(data.name || 'Unnamed Artist')}" class="artist-link">${data.name || 'Unnamed Artist'} <span class="link-arrow">↗</span></a>`
                                : data.name || 'Unnamed Artist'
                            }
                        </div>
                        <div class="artist-category">${categoryText}</div>
                    </div>
                </div>
                <div class="message-meta">
                    <span class="submission-status status-${data.status || 'pending'}">${statusText}</span>
                    <div class="message-date">${formatDate(date)}</div>
                </div>
            </div>
        `;
        
        // Create image preview HTML
        let imagesHTML = '<div class="artwork-preview">';
        
        // Check for both imageUrls and images arrays
        const imageArray = data.imageUrls || data.images || [];
        if (Array.isArray(imageArray) && imageArray.length > 0) {
            for (const imageRef of imageArray) {
                try {
                    // If it's already a URL, use it directly
                    if (typeof imageRef === 'string' && imageRef.startsWith('http')) {
                        imagesHTML += `<img src="${imageRef}" alt="Artwork preview" class="artwork-image">`;
                    } else {
                        // If it's a storage reference, get the URL
                        const url = await getDownloadURL(ref(storage, imageRef));
                        imagesHTML += `<img src="${url}" alt="Artwork preview" class="artwork-image">`;
                    }
                } catch (error) {
                    console.error('Error loading image:', error, imageRef);
                    imagesHTML += '<div class="artwork-image" style="background: #eee;">Image not available</div>';
                }
            }
        } else {
            imagesHTML += '<div class="artwork-image" style="background: #eee;">No images available</div>';
        }
        imagesHTML += '</div>';
        
        submissionCard.setAttribute('data-id', data.id);
        
        submissionCard.innerHTML = `
            ${headerHTML}
            <div class="message-content">
                ${data.description || 'No description provided'}
            </div>
            ${imagesHTML}
            ${data.status === 'pending' ? `
                <div class="action-buttons">
                    <button class="approve-btn" onclick="updateSubmissionStatus('${data.id}', 'approved')">Approve</button>
                    <button class="reject-btn" onclick="showRejectionReason('${data.id}')">Reject</button>
                </div>
                <div class="rejection-reason-container">
                    <textarea class="rejection-reason-input" placeholder="Please provide a reason for rejection..."></textarea>
                    <div class="rejection-actions">
                        <button class="cancel-rejection-btn" onclick="hideRejectionReason('${data.id}')">Cancel</button>
                        <button class="confirm-rejection-btn" onclick="confirmRejection('${data.id}')">Confirm Rejection</button>
                    </div>
                </div>
            ` : data.status === 'rejected' ? `
                <div class="action-buttons">
                    <button class="delete-btn" onclick="deleteSubmission('${data.id}')">Delete Submission</button>
                </div>
                ${data.rejectionReason ? `
                    <div class="rejection-reason-container visible">
                        <div class="rejection-reason-input" style="background: transparent; cursor: default;">${data.rejectionReason}</div>
                    </div>
                ` : ''}
            ` : ''}
        `;
        
        submissionsList.appendChild(submissionCard);
    }
}

// Load submissions from Firestore
async function loadSubmissions() {
    try {
        const submissionsRef = collection(db, 'submissions');
        const q = query(submissionsRef, orderBy('timestamp', 'desc'));
        const querySnapshot = await getDocs(q);
        
        allSubmissions = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        updateStats();
        renderSubmissions();
    } catch (error) {
        console.error('Error loading submissions:', error);
        submissionsList.innerHTML = '<div class="no-results">Error loading submissions. Please try again later.</div>';
    }
}

// Add delete submission function
async function deleteSubmission(submissionId) {
    if (confirm('Are you sure you want to delete this submission? This action cannot be undone.')) {
        try {
            await deleteDoc(doc(db, 'submissions', submissionId));
            
            // Remove deleted message from allSubmissions
            allSubmissions = allSubmissions.filter(msg => msg.id !== submissionId);
            updateStats();
            renderSubmissions();
        } catch (error) {
            console.error('Error deleting submission:', error);
            alert('Error deleting submission. Please try again.');
        }
    }
}

// Make functions available globally
window.updateSubmissionStatus = updateSubmissionStatus;
window.deleteSubmission = deleteSubmission;
window.showRejectionReason = showRejectionReason;
window.hideRejectionReason = hideRejectionReason;
window.confirmRejection = confirmRejection;

// Initialize
loadSubmissions(); 