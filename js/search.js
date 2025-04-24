import { getFirestore, collection, query, where, getDocs, orderBy } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';

const db = getFirestore();

document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('nav-search-input');
    const searchResults = document.getElementById('nav-search-results');
    let searchTimeout;

    // Function to perform the search
    const performSearch = async (searchTerm) => {
        if (searchTerm.length < 2) {
            searchResults.classList.remove('active');
            return;
        }

        try {
            // Get all approved submissions
            const submissionsRef = collection(db, 'submissions');
            const q = query(submissionsRef, where('status', '==', 'approved'));
            const snapshot = await getDocs(q);
            
            // Use Map to deduplicate by artist name
            const artistMap = new Map();
            
            snapshot.forEach(doc => {
                const data = doc.data();
                const name = data.name?.toLowerCase() || '';
                const category = data.category?.toLowerCase() || '';
                
                // Check if name or category matches search term
                if (name.includes(searchTerm.toLowerCase()) || 
                    category.includes(searchTerm.toLowerCase())) {
                    // Only add each artist once, using their name as the key
                    if (!artistMap.has(name)) {
                        artistMap.set(name, {
                            name: data.name,
                            category: data.category || 'Other',
                            imageUrl: data.imageUrls?.[0] || 'images/default-profile.jpg'
                        });
                    }
                }
            });

            // Convert Map to array and display results
            const results = [...artistMap.values()];
            displayResults(results);
            
        } catch (error) {
            console.error('Error searching submissions:', error);
            searchResults.innerHTML = '<div class="search-result-item">Error searching. Please try again.</div>';
            searchResults.classList.add('active');
        }
    };

    // Function to display search results
    const displayResults = (results) => {
        if (results.length === 0) {
            searchResults.innerHTML = '<div class="search-result-item">No artists found</div>';
        } else {
            searchResults.innerHTML = results.map(artist => {
                // Create URL-safe version of name for the artist page
                const nameParam = encodeURIComponent(artist.name);
                return `
                    <a href="artist.html?name=${nameParam}" class="search-result-item">
                        <img src="${artist.imageUrl}" alt="${artist.name}" onerror="this.src='images/default-profile.jpg'">
                        <div class="artist-info">
                            <div class="search-result-name">${artist.name || 'Unnamed Artist'}</div>
                            <div class="artist-category">${artist.category}</div>
                        </div>
                    </a>
                `;
            }).join('');
        }
        searchResults.classList.add('active');
    };

    // Handle search input with debouncing
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const searchTerm = e.target.value.trim();
        
        searchTimeout = setTimeout(() => {
            performSearch(searchTerm);
        }, 300);
    });

    // Close search results when clicking outside
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
            searchResults.classList.remove('active');
        }
    });

    // Handle mobile menu
    const mobileMenu = document.querySelector('.mobile-menu');
    if (mobileMenu) {
        mobileMenu.addEventListener('click', () => {
            const navSearch = document.querySelector('.nav-search');
            navSearch.classList.toggle('mobile-visible');
        });
    }
}); 