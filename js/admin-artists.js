import { db } from './firebase-config.js';
import { collection, query, where, getDocs, orderBy, doc, deleteDoc, addDoc, getDoc, writeBatch } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';

// DOM Elements
const artistsGrid = document.getElementById('artists-grid');
const searchInput = document.getElementById('search-input');
const filterButtons = document.querySelectorAll('.filter-btn');
const totalArtistsElement = document.getElementById('total-artists');
const activeArtistsElement = document.getElementById('active-artists');
const newArtistsElement = document.getElementById('new-artists');

// State
let currentFilter = 'all';
let currentSearch = '';
let artists = [];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadArtists();
    setupEventListeners();
});

// Event Listeners
function setupEventListeners() {
    // Search input
    searchInput.addEventListener('input', (e) => {
        currentSearch = e.target.value.toLowerCase();
        filterAndDisplayArtists();
    });

    // Filter buttons
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            currentFilter = button.dataset.filter;
            filterAndDisplayArtists();
        });
    });
}

// Load artists from Firestore
async function loadArtists() {
    try {
        const submissionsRef = collection(db, 'submissions');
        const artistPagesRef = collection(db, 'artistPages');
        
        // Get approved submissions
        const submissionsQuery = query(
            submissionsRef,
            where('status', '==', 'approved')
        );
        const submissionsSnapshot = await getDocs(submissionsQuery);

        // Get all artist pages
        const artistPagesSnapshot = await getDocs(artistPagesRef);
        const artistPages = {};
        artistPagesSnapshot.forEach(doc => {
            artistPages[doc.data().name] = doc.data();
        });

        artists = [];
        const now = new Date();
        const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30));
        let newArtistsCount = 0;

        submissionsSnapshot.forEach((doc) => {
            const data = doc.data();
            // Only add unique artists
            if (!artists.some(a => a.name === data.name)) {
                const artistPage = artistPages[data.name] || {};
                
                artists.push({
                    id: doc.id,
                    name: data.name,
                    categories: [data.category],
                    works: [{
                        title: data.title || 'Untitled Work',
                        description: data.description,
                        imageUrls: data.imageUrls || [],
                        date: data.timestamp
                    }],
                    status: 'active',
                    previewImage: data.imageUrls ? data.imageUrls[0] : null,
                    sections: artistPage.sections || []
                });
            } else {
                // If artist exists, add the work to their existing works
                const existingArtist = artists.find(a => a.name === data.name);
                if (existingArtist) {
                    existingArtist.works.push({
                        title: data.title || 'Untitled Work',
                        description: data.description,
                        imageUrls: data.imageUrls || [],
                        date: data.timestamp
                    });
                    // Add category if not already present
                    if (!existingArtist.categories.includes(data.category)) {
                        existingArtist.categories.push(data.category);
                    }
                    // Update preview image if not set
                    if (!existingArtist.previewImage && data.imageUrls && data.imageUrls.length > 0) {
                        existingArtist.previewImage = data.imageUrls[0];
                    }
                }
            }
        });

        // Sort artists by name after collecting them
        artists.sort((a, b) => a.name.localeCompare(b.name));

        // Update stats with number and dots
        const dotsHTML = Array(artists.length).fill('<div class="stat-dot"></div>').join('');
        totalArtistsElement.innerHTML = `
            ${artists.length}
            <div class="stat-dots">${dotsHTML}</div>
        `;

        filterAndDisplayArtists();
    } catch (error) {
        console.error('Error loading artists:', error);
        artistsGrid.innerHTML = '<div class="no-artists">Error loading artist pages. Please try again later.</div>';
    }
}

// Filter and display artists
function filterAndDisplayArtists() {
    let filteredArtists = artists;

    // Apply search filter
    if (currentSearch) {
        filteredArtists = filteredArtists.filter(artist => 
            artist.name.toLowerCase().includes(currentSearch) ||
            artist.categories.some(cat => cat.toLowerCase().includes(currentSearch))
        );
    }

    // Apply category filter
    if (currentFilter !== 'all') {
        filteredArtists = filteredArtists.filter(artist => 
            artist.categories.includes(currentFilter)
        );
    }

    displayArtists(filteredArtists);
}

// Display artists in grid
function displayArtists(artistsToDisplay) {
    if (artistsToDisplay.length === 0) {
        artistsGrid.innerHTML = '<div class="no-artists">No artist pages found.</div>';
        return;
    }

    const artistsHTML = artistsToDisplay.map(artist => `
        <div class="artist-card" onclick="window.location.href='artist.html?name=${encodeURIComponent(artist.name)}'">
            <img src="${artist.previewImage || 'images/placeholder.jpg'}" alt="${artist.name}" class="artist-preview">
            <div class="artist-info">
                <h3 class="artist-name">${artist.name}</h3>
                <div class="artist-categories">
                    ${artist.categories.map(category => {
                        const formattedCategory = category
                            .split('-')
                            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                            .join(' ');
                        return `<span class="category-tag ${category}">${formattedCategory}</span>`;
                    }).join('')}
                </div>
                <div class="artist-meta">
                    <p>${artist.sections?.length || 0} works</p>
                    <p>Status: ${artist.status || 'pending'}</p>
                </div>
                <div class="artist-actions">
                    <button class="view-btn">View Page</button>
                    <button class="delete-btn" onclick="event.stopPropagation(); deleteArtist('${artist.id}')">Delete</button>
                </div>
            </div>
        </div>
    `).join('');

    artistsGrid.innerHTML = artistsHTML;
}

// Edit artist
async function editArtist(artistId) {
    // TODO: Implement edit functionality
    console.log('Edit artist:', artistId);
}

// Delete artist
async function deleteArtist(artistId) {
    if (confirm('Are you sure you want to delete this artist page? This action cannot be undone.')) {
        try {
            // Find the artist in our local array first
            const artist = artists.find(a => a.id === artistId);
            if (!artist) {
                throw new Error('Artist not found');
            }

            // Delete from artistPages collection
            await deleteDoc(doc(db, 'artistPages', artist.name));
            
            // Delete all submissions for this artist
            const submissionsRef = collection(db, 'submissions');
            const submissionsQuery = query(submissionsRef, where('name', '==', artist.name));
            const submissionsSnapshot = await getDocs(submissionsQuery);
            
            const batch = writeBatch(db);
            
            // Delete all submissions
            submissionsSnapshot.forEach((doc) => {
                batch.delete(doc.ref);
            });
            
            // Delete any pending changes
            const changesRef = collection(db, 'artistChanges');
            const changesQuery = query(changesRef, where('artistName', '==', artist.name));
            const changesSnapshot = await getDocs(changesQuery);
            
            changesSnapshot.forEach((doc) => {
                batch.delete(doc.ref);
            });
            
            // Commit all deletions
            await batch.commit();
            
            // Create notification for artist page deletion
            await addDoc(collection(db, 'notifications'), {
                userId: artist.name,
                type: 'artist_deleted',
                message: `Your artist page has been deleted by an admin.`,
                timestamp: new Date(),
                read: false,
                artistName: artist.name
            });
            
            // Remove from local array and refresh display
            artists = artists.filter(a => a.id !== artistId);
            filterAndDisplayArtists();
            
            alert('Artist page deleted successfully');
        } catch (error) {
            console.error('Error deleting artist:', error);
            alert('Error deleting artist page. Please try again.');
        }
    }
}

// Make functions available globally
window.deleteArtist = deleteArtist;
window.editArtist = editArtist; 