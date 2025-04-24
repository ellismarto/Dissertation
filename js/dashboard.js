import { db } from './firebase-config.js';
import { collection, query, orderBy, getDocs } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';

const submissionsGrid = document.getElementById('submissions-grid');

async function loadSubmissions() {
    try {
        const submissionsQuery = query(
            collection(db, 'submissions'),
            orderBy('timestamp', 'desc')
        );

        const querySnapshot = await getDocs(submissionsQuery);
        submissionsGrid.innerHTML = ''; // Clear existing content

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const date = data.timestamp ? new Date(data.timestamp.seconds * 1000) : new Date();
            
            const submissionCard = document.createElement('div');
            submissionCard.className = 'submission-card';
            submissionCard.innerHTML = `
                <img src="${data.photoUrl}" alt="Submission by ${data.name}">
                <div class="submission-info">
                    <h3>${data.name}</h3>
                    <div class="submission-date">${date.toLocaleDateString()}</div>
                </div>
            `;
            
            submissionsGrid.appendChild(submissionCard);
        });

    } catch (error) {
        console.error('Error loading submissions:', error);
        submissionsGrid.innerHTML = '<p>Error loading submissions. Please try again later.</p>';
    }
}

// Load submissions when the page loads
loadSubmissions(); 