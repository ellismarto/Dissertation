// Initialize Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-storage.js";

const firebaseConfig = {
    apiKey: "AIzaSyChsNcg5mFMSByHFadXhDUg6_qdz52vFaI",
    authDomain: "sonder-7ddd6.firebaseapp.com",
    projectId: "sonder-7ddd6",
    storageBucket: "sonder-7ddd6.firebasestorage.app",
    messagingSenderId: "291676715420",
    appId: "1:291676715420:web:aa4b30a88d15a2f1c7f059",
    measurementId: "G-SNYV2BRF56"
};

// Initialize Firebase
console.log('Initializing Firebase...');
const app = initializeApp(firebaseConfig);
console.log('Firebase initialized');

console.log('Getting Firestore instance...');
const db = getFirestore(app);
console.log('Firestore instance ready');

const auth = getAuth(app);
const storage = getStorage(app);

// Initialize Firestore with persistence
getFirestore(app, {
    cacheSizeBytes: 5242880, // 5MB
    experimentalForceLongPolling: true,
    ignoreUndefinedProperties: true
});

export { db, auth, storage }; 