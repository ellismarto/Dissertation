import { db } from './firebase-config.js';
import { collection, addDoc, query, orderBy, onSnapshot, deleteDoc, doc } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';

// DOM Elements
const messagesBell = document.querySelector('.messages-bell');
const messagesBadge = document.querySelector('.messages-badge');
const messagesDropdown = document.querySelector('.messages-dropdown');
const notificationDropdown = document.querySelector('.notification-dropdown');

// State
let unsubscribeMessages = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupMessages();
    setupClickHandlers();
    hideBadgeByDefault();
});

// Setup click handlers
function setupClickHandlers() {
    // Toggle dropdown
    messagesBell.addEventListener('click', (e) => {
        e.stopPropagation();
        messagesDropdown.classList.toggle('active');
        // Close notifications dropdown if open
        if (notificationDropdown) {
            notificationDropdown.classList.remove('active');
        }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!messagesDropdown.contains(e.target) && !messagesBell.contains(e.target)) {
            messagesDropdown.classList.remove('active');
        }
    });

    // Prevent dropdown from closing when clicking inside
    messagesDropdown.addEventListener('click', (e) => {
        e.stopPropagation();
    });
}

// Setup messages listener
function setupMessages() {
    const messagesQuery = query(
        collection(db, 'messages'),
        orderBy('timestamp', 'desc')
    );

    unsubscribeMessages = onSnapshot(messagesQuery, (snapshot) => {
        const messages = [];
        let unreadCount = 0;

        snapshot.forEach((doc) => {
            const data = doc.data();
            messages.push({
                id: doc.id,
                ...data
            });
            if (!data.read) unreadCount++;
        });

        updateBadge(unreadCount);
        displayMessages(messages);
    });
}

// Update badge
function updateBadge(count) {
    if (count > 0) {
        messagesBadge.style.display = 'flex';
        messagesBadge.textContent = count;
    } else {
        messagesBadge.style.display = 'none';
    }
}

// Display messages
function displayMessages(messages) {
    if (messages.length === 0) {
        messagesDropdown.innerHTML = '<div class="no-messages">No messages</div>';
        return;
    }

    const messagesHTML = `
        <div class="messages-header">
            <span>Messages</span>
            <button class="delete-all-messages-btn">Clear All</button>
        </div>
        <div class="messages-scroll-container">
            ${messages.map(message => `
                <div class="message-item ${message.read ? '' : 'unread'}" data-id="${message.id}">
                    <button class="delete-message-btn" data-id="${message.id}" title="Delete message">×</button>
                    <div class="message-sender">${message.name}</div>
                    <div class="message-subject">${message.subject}</div>
                    <div class="message-content">${message.message}</div>
                    <div class="message-time">${formatTime(message.timestamp)}</div>
                </div>
            `).join('')}
        </div>
    `;

    messagesDropdown.innerHTML = messagesHTML;

    // Add click handlers to delete buttons
    document.querySelectorAll('.delete-message-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const messageId = btn.dataset.id;
            await deleteMessage(messageId);
        });
    });

    // Add click handler to delete all button
    const deleteAllBtn = document.querySelector('.delete-all-messages-btn');
    if (deleteAllBtn) {
        deleteAllBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await deleteAllMessages(messages);
        });
    }
}

// Delete message
async function deleteMessage(messageId) {
    try {
        await deleteDoc(doc(db, 'messages', messageId));
    } catch (error) {
        console.error('Error deleting message:', error);
    }
}

// Delete all messages
async function deleteAllMessages(messages) {
    try {
        const promises = messages.map(message => deleteMessage(message.id));
        await Promise.all(promises);
    } catch (error) {
        console.error('Error deleting all messages:', error);
    }
}

// Format time
function formatTime(timestamp) {
    if (!timestamp) return '';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
}

// Hide badge by default
function hideBadgeByDefault() {
    messagesBadge.style.display = 'none';
}

// Cleanup
window.addEventListener('beforeunload', () => {
    if (unsubscribeMessages) {
        unsubscribeMessages();
    }
}); 