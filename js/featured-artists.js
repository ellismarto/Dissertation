import { db } from './firebase-config.js';
import { collection, query, getDocs, where } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';

// DOM Elements
const featuredArtistsGrid = document.getElementById('featured-artists-grid');

// Create floating text element
const floatingText = document.createElement('div');
floatingText.className = 'floating-text';
floatingText.textContent = 'Click to View Artist';
document.body.appendChild(floatingText);

// Load featured artists
async function loadFeaturedArtists() {
    try {
        // First, get all approved submissions
        const submissionsRef = collection(db, 'submissions');
        const submissionsQuery = query(
            submissionsRef,
            where('status', '==', 'approved')
        );
        const submissionsSnapshot = await getDocs(submissionsQuery);

        // Create a map to track unique artists and their first submission
        const uniqueArtists = new Map();
        submissionsSnapshot.forEach(doc => {
            const data = doc.data();
            // Convert Firestore timestamp to milliseconds for comparison
            const timestamp = data.timestamp?.toMillis() || 0;
            if (!uniqueArtists.has(data.name) || timestamp > uniqueArtists.get(data.name).timestamp) {
                uniqueArtists.set(data.name, {
                    name: data.name,
                    timestamp: timestamp,
                    imageUrl: data.imageUrls?.[0] || null
                });
            }
        });

        // Convert to array and get the two most recent
        const recentArtists = Array.from(uniqueArtists.values())
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 2);

        if (recentArtists.length === 0) {
            featuredArtistsGrid.innerHTML = '<div class="no-artists">No featured artists available.</div>';
            return;
        }

        // Get their artist pages for additional info
        const artistPagesRef = collection(db, 'artistPages');
        const artistPagesSnapshot = await getDocs(artistPagesRef);
        const artistPages = {};
        artistPagesSnapshot.forEach(doc => {
            artistPages[doc.data().name] = doc.data();
        });

        const artistsHTML = recentArtists.map(artist => {
            const artistPage = artistPages[artist.name] || {};
            return `
                <article class="work-card" onclick="window.location.href='artist.html?name=${encodeURIComponent(artist.name)}'">
                    <div class="work-image">
                        <img src="${artistPage.featureImage || artist.imageUrl || 'images/default-profile.jpg'}" 
                             alt="${artist.name}'s feature image"
                             onerror="this.src='images/default-profile.jpg'">
                    </div>
                    <div class="work-info">
                        <h3>${artist.name}</h3>
                        <a href="artist.html?name=${encodeURIComponent(artist.name)}" class="show-details-btn">View Profile</a>
                    </div>
                </article>
            `;
        }).join('');

        featuredArtistsGrid.innerHTML = artistsHTML;

        // Add mouse move event listener to work images
        document.querySelectorAll('.work-image').forEach(image => {
            image.addEventListener('mousemove', (e) => {
                const rect = image.getBoundingClientRect();
                floatingText.style.left = `${e.clientX + 10}px`;
                floatingText.style.top = `${e.clientY + 10}px`;
                floatingText.classList.add('visible');
            });

            image.addEventListener('mouseleave', () => {
                floatingText.classList.remove('visible');
            });
        });
    } catch (error) {
        console.error('Error loading featured artists:', error);
        featuredArtistsGrid.innerHTML = '<div class="no-artists">Error loading featured artists. Please try again later.</div>';
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadFeaturedArtists();
});