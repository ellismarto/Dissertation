document.addEventListener('DOMContentLoaded', () => {
    const submissionsGrid = document.querySelector('.submissions-grid');

    // Sample data (will be replaced with Firebase data)
    const sampleSubmissions = [
        {
            id: 1,
            title: 'Sunset Over Mountains',
            description: 'A beautiful landscape painting capturing the essence of nature.',
            imageUrl: 'https://via.placeholder.com/300x200'
        },
        {
            id: 2,
            title: 'Abstract Thoughts',
            description: 'An exploration of color and form in abstract expressionism.',
            imageUrl: 'https://via.placeholder.com/300x200'
        }
    ];

    // Function to create submission card
    function createSubmissionCard(submission) {
        const card = document.createElement('div');
        card.className = 'submission-card';
        card.innerHTML = `
            <img src="${submission.imageUrl}" alt="${submission.title}">
            <div class="submission-info">
                <h3>${submission.title}</h3>
                <p>${submission.description}</p>
                <div class="submission-actions">
                    <button class="approve-btn" data-id="${submission.id}">Approve</button>
                    <button class="reject-btn" data-id="${submission.id}">Reject</button>
                </div>
            </div>
        `;
        return card;
    }

    // Function to load submissions
    function loadSubmissions() {
        submissionsGrid.innerHTML = '';
        sampleSubmissions.forEach(submission => {
            const card = createSubmissionCard(submission);
            submissionsGrid.appendChild(card);
        });

        // Add event listeners to buttons
        document.querySelectorAll('.approve-btn').forEach(btn => {
            btn.addEventListener('click', handleApprove);
        });

        document.querySelectorAll('.reject-btn').forEach(btn => {
            btn.addEventListener('click', handleReject);
        });
    }

    // Handle approve action
    function handleApprove(e) {
        const submissionId = e.target.getAttribute('data-id');
        // TODO: Connect to Firebase to update submission status
        console.log('Approving submission:', submissionId);
        alert('Submission approved!');
    }

    // Handle reject action
    function handleReject(e) {
        const submissionId = e.target.getAttribute('data-id');
        // TODO: Connect to Firebase to update submission status
        console.log('Rejecting submission:', submissionId);
        alert('Submission rejected!');
    }

    // Initial load
    loadSubmissions();
}); 