import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-storage.js';
import { getFirestore, collection, addDoc } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';

const storage = getStorage();
const db = getFirestore();
const auth = getAuth();

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('submission-form');
    const categoryButtons = document.querySelectorAll('.category-button');
    const selectedCategoryInput = document.getElementById('selected-category');
    const workInput = document.getElementById('work');
    const previewContainer = document.getElementById('preview-container');
    const uploadProgress = document.getElementById('upload-progress');
    const statusMessage = document.getElementById('status-message');

    // Handle category selection
    categoryButtons.forEach(button => {
        button.addEventListener('click', () => {
            const isSelected = button.classList.contains('selected');
            
            // Remove selection from all buttons
            categoryButtons.forEach(btn => btn.classList.remove('selected'));
            
            // If the clicked button wasn't selected, select it
            if (!isSelected) {
                button.classList.add('selected');
                selectedCategoryInput.value = button.dataset.category;
            } else {
                // If it was selected, clear the input
                selectedCategoryInput.value = '';
            }
        });
    });

    // Handle file selection and preview
    workInput.addEventListener('change', () => {
        previewContainer.innerHTML = '';
        const files = workInput.files;

        if (files.length > 5) {
            statusMessage.textContent = 'Please select a maximum of 5 files.';
            statusMessage.className = 'status-message error';
            workInput.value = '';
            return;
        }

        Array.from(files).forEach(file => {
            if (file.size > 5 * 1024 * 1024) {
                statusMessage.textContent = 'One or more files exceed the 5MB limit.';
                statusMessage.className = 'status-message error';
                workInput.value = '';
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                const img = document.createElement('img');
                img.src = e.target.result;
                img.className = 'preview-image';
                previewContainer.appendChild(img);
            };
            reader.readAsDataURL(file);
        });
    });

    // Handle form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!selectedCategoryInput.value) {
            statusMessage.textContent = 'Please select a creative category.';
            statusMessage.className = 'status-message error';
            return;
        }

        const files = workInput.files;
        if (!files.length) {
            statusMessage.textContent = 'Please select at least one file.';
            statusMessage.className = 'status-message error';
            return;
        }

        try {
            uploadProgress.classList.add('visible');
            statusMessage.className = 'status-message';
            statusMessage.textContent = 'Uploading your work...';

            // Upload all files and get their URLs
            const uploadPromises = Array.from(files).map(async (file) => {
                const fileRef = storageRef(storage, `submissions/${Date.now()}_${file.name}`);
                await uploadBytes(fileRef, file);
                return getDownloadURL(fileRef);
            });

            const imageUrls = await Promise.all(uploadPromises);

            // Save submission data to Firestore
            const submissionRef = await addDoc(collection(db, 'submissions'), {
                name: form.name.value,
                email: form.email.value,
                category: selectedCategoryInput.value,
                description: form.description.value,
                imageUrls: imageUrls,
                status: 'pending',
                timestamp: new Date()
            });

            // Create notification for all users
            await addDoc(collection(db, 'notifications'), {
                type: 'submission_received',
                message: `New submission from ${form.name.value}: ${form.description.value.substring(0, 50)}...`,
                timestamp: new Date(),
                read: false,
                submissionId: submissionRef.id
            });

            // Reset form and show success message
            form.reset();
            previewContainer.innerHTML = '';
            uploadProgress.classList.remove('visible');
            statusMessage.textContent = 'Your work has been submitted successfully!';
            statusMessage.className = 'status-message success';
            categoryButtons.forEach(btn => btn.classList.remove('selected'));

        } catch (error) {
            console.error('Error submitting work:', error);
            uploadProgress.classList.remove('visible');
            statusMessage.textContent = 'An error occurred while submitting your work. Please try again.';
            statusMessage.className = 'status-message error';
        }
    });
}); 