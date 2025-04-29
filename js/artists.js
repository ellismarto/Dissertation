import { db } from './firebase-config.js';
import { collection, getDocs, query, where } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';

// DOM Elements
const artistsList = document.getElementById('artists-list');
let currentFilter = 'all';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadArtists();
    setupHoverPreview();
    setupFilterButtons();
});

// Setup filter buttons
function setupFilterButtons() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all buttons
            filterButtons.forEach(btn => btn.classList.remove('active'));
            // Add active class to clicked button
            button.classList.add('active');
            // Update current filter
            currentFilter = button.dataset.filter;
            // Reload artists with new filter
            loadArtists();
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

        const artists = new Map(); // Use Map to avoid duplicates
        submissionsSnapshot.forEach(doc => {
            const data = doc.data();
            if (!artists.has(data.name)) {
                const artistPage = artistPages[data.name] || {};
                artists.set(data.name, {
                    name: data.name,
                    categories: [data.category],
                    featureImage: artistPage.featureImage || null
                });
            } else {
                // Add category if not already present
                const existingArtist = artists.get(data.name);
                if (!existingArtist.categories.includes(data.category)) {
                    existingArtist.categories.push(data.category);
                }
            }
        });

        // Convert Map to array and sort alphabetically
        let sortedArtists = Array.from(artists.values()).sort((a, b) => a.name.localeCompare(b.name));

        // Apply filter if not 'all'
        if (currentFilter !== 'all') {
            sortedArtists = sortedArtists.filter(artist => 
                artist.categories.includes(currentFilter)
            );
        }

        displayArtists(sortedArtists);
    } catch (error) {
        console.error('Error loading artists:', error);
        artistsList.innerHTML = '<div class="no-artists">Error loading artists. Please try again later.</div>';
    }
}

// Display artists in list
function displayArtists(artists) {
    const artistsHTML = artists.map(artist => `
        <a href="artist.html?name=${encodeURIComponent(artist.name)}" 
           class="artist-link"
           data-feature-image="${artist.featureImage || ''}">
            <h2 class="artist-name">${artist.name}</h2>
            ${artist.categories.length > 0 ? `
                <div class="artist-categories">
                    ${artist.categories.map(category => {
                        // Format the category name
                        const formattedCategory = category
                            .split('-')
                            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                            .join(' ');
                        return `<span class="category-tag ${category}">${formattedCategory}</span>`;
                    }).join('')}
                </div>
            ` : ''}
        </a>
    `).join('');

    artistsList.innerHTML = artistsHTML;
}

// Setup hover preview functionality
function setupHoverPreview() {
    const previewImage = document.createElement('img');
    previewImage.className = 'artist-preview-image';
    previewImage.style.display = 'none';
    previewImage.style.position = 'fixed';
    previewImage.style.zIndex = '1000';
    previewImage.style.pointerEvents = 'none';
    previewImage.style.width = '300px';
    previewImage.style.height = 'auto';
    previewImage.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    document.body.appendChild(previewImage);

    // Add hover event listeners to artist links
    document.addEventListener('mouseover', (e) => {
        const artistLink = e.target.closest('.artist-link');
        if (artistLink) {
            const featureImage = artistLink.dataset.featureImage;
            if (featureImage) {
                previewImage.src = featureImage;
                previewImage.style.display = 'block';
            }
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (previewImage.style.display === 'block') {
            const x = e.clientX + 10;
            const y = e.clientY - previewImage.offsetHeight - 10;
            previewImage.style.left = `${x}px`;
            previewImage.style.top = `${y}px`;
        }
    });

    document.addEventListener('mouseout', (e) => {
        const artistLink = e.target.closest('.artist-link');
        if (artistLink) {
            previewImage.style.display = 'none';
        }
    });
} 