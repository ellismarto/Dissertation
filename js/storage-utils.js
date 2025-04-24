import { storage } from './firebase-config.js';
import { ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-storage.js';

/**
 * Uploads a file to Firebase Storage
 * @param {File} file - The file to upload
 * @param {string} path - The path in storage where the file should be saved
 * @returns {Promise<string>} - The download URL of the uploaded file
 */
export async function uploadFile(file, path) {
    try {
        // Create a storage reference
        const storageRef = ref(storage, path);
        
        // Upload the file
        const snapshot = await uploadBytes(storageRef, file);
        console.log('File uploaded successfully');
        
        // Get the download URL
        const downloadURL = await getDownloadURL(snapshot.ref);
        return downloadURL;
    } catch (error) {
        console.error('Error uploading file:', error);
        throw error;
    }
}

/**
 * Generates a unique filename with timestamp
 * @param {string} originalFilename - The original filename
 * @returns {string} - A unique filename
 */
export function generateUniqueFilename(originalFilename) {
    const timestamp = Date.now();
    const extension = originalFilename.split('.').pop();
    return `${timestamp}.${extension}`;
}

/**
 * Validates file type and size
 * @param {File} file - The file to validate
 * @param {Array<string>} allowedTypes - Array of allowed MIME types
 * @param {number} maxSizeMB - Maximum file size in megabytes
 * @returns {boolean} - Whether the file is valid
 */
export function validateFile(file, allowedTypes = ['image/jpeg', 'image/png', 'image/gif'], maxSizeMB = 5) {
    if (!allowedTypes.includes(file.type)) {
        throw new Error(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`);
    }
    
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
        throw new Error(`File size too large. Maximum size: ${maxSizeMB}MB`);
    }
    
    return true;
} 