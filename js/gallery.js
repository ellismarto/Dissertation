import { db } from './firebase-config.js';
import { collection, query, orderBy, getDocs } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';

// State
let allSubmissions = [];
let currentFilter = 'all';

// DOM Elements
const galleryGrid = document.getElementById('gallery-grid');
const filterButtons = document.querySelectorAll('.filter-btn');

// Event Listeners
filterButtons.forEach(button => {
    button.addEventListener('click', () => {
        filterButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        currentFilter = button.dataset.status;
        renderSubmissions();
    });
});

// Filter submissions based on current filter
function filterSubmissions() {
    if (currentFilter === 'all') {
        return allSubmissions;
    }
    return allSubmissions.filter(submission => submission.status === currentFilter);
}

// Render submissions to the gallery
function renderSubmissions() {
    const filtered = filterSubmissions();
    
    if (filtered.length === 0) {
        galleryGrid.innerHTML = '<div class="no-submissions">No submissions found</div>';
        return;
    }

    galleryGrid.innerHTML = filtered.map(submission => `
        <div class="gallery-item">
            <img 
                src="${submission.photoURL}" 
                alt="Artwork by ${submission.name}"
                class="gallery-image"
                loading="lazy"
            >
            <div class="gallery-info">
                <div class="gallery-name">By ${submission.name}</div>
                <div class="gallery-date">
                    ${new Date(submission.timestamp.seconds * 1000).toLocaleDateString()}
                </div>
            </div>
        </div>
    `).join('');
}

// Load submissions from Firestore
async function loadSubmissions() {
    try {
        const submissionsQuery = query(
            collection(db, 'submissions'),
            orderBy('timestamp', 'desc')
        );

        const querySnapshot = await getDocs(submissionsQuery);
        allSubmissions = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        renderSubmissions();

    } catch (error) {
        console.error('Error loading submissions:', error);
        galleryGrid.innerHTML = '<div class="no-submissions">Error loading submissions. Please try again later.</div>';
    }
}

// Initialize when DOM is loaded
window.addEventListener('DOMContentLoaded', loadSubmissions); 