import { getFirestore, collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';

const db = getFirestore();

// Function to track a page visit
async function trackPageVisit() {
    try {
        const visitsRef = collection(db, 'pageVisits');
        await addDoc(visitsRef, {
            timestamp: serverTimestamp(),
            page: window.location.pathname,
            userAgent: navigator.userAgent
        });
    } catch (error) {
        console.error('Error tracking page visit:', error);
    }
}

// Track visit when page loads
document.addEventListener('DOMContentLoaded', trackPageVisit); 