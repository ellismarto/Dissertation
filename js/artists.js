import { db } from './firebase-config.js';
import { collection, getDocs, query, where } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';

// DOM Elements
const artistsList = document.getElementById('artists-list');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadArtists();
});

// Load artists from Firestore
async function loadArtists() {
    try {
        const submissionsRef = collection(db, 'submissions');
        const querySnapshot = await getDocs(query(
            submissionsRef,
            where('status', '==', 'approved')
        ));
        
        if (querySnapshot.empty) {
            artistsList.innerHTML = '<div class="no-artists">No artists found.</div>';
            return;
        }

        const artists = new Map(); // Use Map to avoid duplicates
        querySnapshot.forEach(doc => {
            const data = doc.data();
            if (!artists.has(data.name)) {
                artists.set(data.name, {
                    name: data.name,
                    categories: [data.category]
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
        const sortedArtists = Array.from(artists.values()).sort((a, b) => a.name.localeCompare(b.name));

        displayArtists(sortedArtists);
    } catch (error) {
        console.error('Error loading artists:', error);
        artistsList.innerHTML = '<div class="no-artists">Error loading artists. Please try again later.</div>';
    }
}

// Display artists in list
function displayArtists(artists) {
    const artistsHTML = artists.map(artist => `
        <a href="artist.html?name=${encodeURIComponent(artist.name)}" class="artist-link">
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