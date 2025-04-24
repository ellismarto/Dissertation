import { db } from './firebase-config.js';
import { collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';

const form = document.getElementById('contact-form');
const categoryButtons = document.querySelectorAll('.category-button');
const selectedCategoryInput = document.getElementById('selected-category');

// Handle category selection
categoryButtons.forEach(button => {
    button.addEventListener('click', () => {
        // Remove selected class from all buttons
        categoryButtons.forEach(btn => btn.classList.remove('selected'));
        // Add selected class to clicked button
        button.classList.add('selected');
        // Update hidden input value
        selectedCategoryInput.value = button.dataset.category;
    });
});

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!selectedCategoryInput.value) {
        alert('Please select a creative category');
        return;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Sending...';

    try {
        // Get form data
        const formData = {
            name: document.getElementById('name').value,
            email: document.getElementById('email').value,
            category: selectedCategoryInput.value,
            subject: document.getElementById('subject').value,
            message: document.getElementById('message').value,
            timestamp: serverTimestamp(),
            status: 'unread' // You can use this to track which messages you've read
        };

        console.log('Attempting to save data:', formData);

        // Add to Firestore
        const docRef = await addDoc(collection(db, 'messages'), formData);
        console.log('Document written with ID: ', docRef.id);

        // Show success message
        alert('Thank you for your message! We will get back to you soon.');
        form.reset();
        // Reset category selection
        categoryButtons.forEach(btn => btn.classList.remove('selected'));
        selectedCategoryInput.value = '';

    } catch (error) {
        console.error('Error sending message:', error);
        alert('Error sending message. Please try again. Error: ' + error.message);
    }

    submitButton.disabled = false;
    submitButton.textContent = 'Send Message';
}); 