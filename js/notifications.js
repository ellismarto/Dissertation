import { db } from './firebase-config.js';
import { collection, query, orderBy, limit, onSnapshot, updateDoc, doc, where, writeBatch, deleteDoc } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';

// DOM Elements
const notificationBell = document.querySelector('.notification-bell');
const notificationBadge = document.querySelector('.notification-badge');
const notificationDropdown = document.querySelector('.notification-dropdown');
const messagesDropdown = document.querySelector('.messages-dropdown');

// State
let unsubscribeNotifications = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupNotifications();
    setupClickHandlers();
    hideBadgeByDefault();
    checkForNewNotifications();
});

// Setup click handlers
function setupClickHandlers() {
    // Toggle dropdown
    notificationBell.addEventListener('click', (e) => {
        e.stopPropagation();
        notificationDropdown.classList.toggle('active');
        // Close messages dropdown if open
        if (messagesDropdown) {
            messagesDropdown.classList.remove('active');
        }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!notificationDropdown.contains(e.target) && !notificationBell.contains(e.target)) {
            notificationDropdown.classList.remove('active');
        }
    });

    // Prevent dropdown from closing when clicking inside
    notificationDropdown.addEventListener('click', (e) => {
        e.stopPropagation();
    });
}

// Setup real-time notifications
function setupNotifications() {
    // Unsubscribe from previous listener if it exists
    if (unsubscribeNotifications) {
        unsubscribeNotifications();
    }

    // Query all notifications without limit
    const notificationsQuery = query(
        collection(db, 'notifications'),
        orderBy('timestamp', 'desc')
    );

    unsubscribeNotifications = onSnapshot(notificationsQuery, (snapshot) => {
        const notifications = [];
        let unreadCount = 0;

        snapshot.forEach((doc) => {
            const data = doc.data();
            notifications.push({
                id: doc.id,
                ...data
            });
            if (!data.read) unreadCount++;
        });

        updateBadge(unreadCount);
        displayNotifications(notifications);
    });
}

// Update badge
function updateBadge(count) {
    if (count > 0) {
        notificationBadge.style.display = 'flex';
        notificationBadge.textContent = count;
    } else {
        notificationBadge.style.display = 'none';
    }
}

// Display notifications
function displayNotifications(notifications) {
    if (notifications.length === 0) {
        notificationDropdown.innerHTML = '<div class="no-notifications">No notifications</div>';
        return;
    }

    // Defensive sort: newest first, regardless of query order or timestamp format
    notifications.sort((a, b) => {
        let aTime = a.timestamp;
        let bTime = b.timestamp;
        if (aTime?.seconds) aTime = aTime.seconds * 1000;
        else if (aTime instanceof Date) aTime = aTime.getTime();
        else if (typeof aTime === 'string') aTime = new Date(aTime).getTime();
        else aTime = 0;
        if (bTime?.seconds) bTime = bTime.seconds * 1000;
        else if (bTime instanceof Date) bTime = bTime.getTime();
        else if (typeof bTime === 'string') bTime = new Date(bTime).getTime();
        else bTime = 0;
        return bTime - aTime;
    });

    const notificationsHTML = `
        <div class="notification-header">
            <span>Notifications</span>
            <button class="delete-all-btn">Delete All</button>
        </div>
        <div class="notifications-scroll-container">
            ${notifications.map(notification => {
                // Split message into main message and reason
                const [mainMessage, reason] = notification.message.split('\n\nReason:');
                
                return `
                    <div class="notification-item ${notification.read ? '' : 'unread'}" data-id="${notification.id}">
                        <div class="notification-title">${getNotificationTitle(notification.type)}</div>
                        <div class="notification-message">${mainMessage}</div>
                        ${reason ? `<div class="notification-reason">${reason}</div>` : ''}
                        <div class="notification-time">${formatTime(notification.timestamp)}</div>
                        <button class="delete-notification-btn" data-id="${notification.id}">×</button>
                    </div>
                `;
            }).join('')}
        </div>
    `;

    notificationDropdown.innerHTML = notificationsHTML;

    // Add click handlers to delete buttons
    document.querySelectorAll('.delete-notification-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const notificationId = btn.dataset.id;
            deleteNotification(notificationId);
        });
    });

    // Add click handler to delete all button
    const deleteAllBtn = notificationDropdown.querySelector('.delete-all-btn');
    if (deleteAllBtn) {
        deleteAllBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteAllNotifications(notifications);
        });
    }
}

// Get notification title based on type
function getNotificationTitle(type) {
    switch (type) {
        case 'submission_received':
            return 'New Submission';
        case 'submission_approved':
            return 'Submission Approved';
        case 'submission_rejected':
            return 'Submission Rejected';
        case 'change_submitted':
            return 'Page Changes Submitted';
        case 'change_approved':
            return 'Changes Approved';
        case 'change_rejected':
            return 'Changes Rejected';
        case 'artist_deleted':
            return 'Artist Page Deleted';
        default:
            return 'Notification';
    }
}

// Format timestamp
function formatTime(timestamp) {
    const now = new Date();
    let notificationTime;
    
    if (timestamp instanceof Date) {
        notificationTime = timestamp;
    } else if (timestamp?.toDate instanceof Function) {
        notificationTime = timestamp.toDate();
    } else if (typeof timestamp === 'string') {
        notificationTime = new Date(timestamp);
    } else {
        return 'Unknown time';
    }

    const diffInMinutes = Math.floor((now - notificationTime) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} hours ago`;
    return `${Math.floor(diffInMinutes / 1440)} days ago`;
}

// Delete a single notification
async function deleteNotification(notificationId) {
    try {
        await deleteDoc(doc(db, 'notifications', notificationId));
    } catch (error) {
        console.error('Error deleting notification:', error);
    }
}

// Delete all notifications
async function deleteAllNotifications(notifications) {
    try {
        const batch = writeBatch(db);
        
        for (const notification of notifications) {
            const notificationRef = doc(db, 'notifications', notification.id);
            batch.delete(notificationRef);
        }

        await batch.commit();
        updateNotificationBadge(0);
        notificationDropdown.innerHTML = '<div class="no-notifications">No notifications</div>';
    } catch (error) {
        console.error('Error deleting notifications:', error);
    }
}

// Function to update notification badge
function updateNotificationBadge(count) {
    const badge = document.querySelector('.notification-badge');
    if (badge) {
        if (count > 0) {
            badge.textContent = count;
            badge.style.display = 'block';
        } else {
            badge.style.display = 'none';
        }
    }
}

// Function to check for new notifications
async function checkForNewNotifications() {
    try {
        const auth = getAuth();
        const user = auth.currentUser;
        if (!user) return;

        const notificationsRef = collection(db, 'notifications');
        const q = query(
            notificationsRef,
            where('userId', '==', user.uid),
            where('read', '==', false)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const count = snapshot.size;
            updateNotificationBadge(count);
        });

        return unsubscribe;
    } catch (error) {
        console.error('Error checking notifications:', error);
    }
}

// Hide badge by default
function hideBadgeByDefault() {
    const badge = document.querySelector('.notification-badge');
    if (badge) {
        badge.style.display = 'none';
    }
}

// Add styles for scrollable notifications
const style = document.createElement('style');
style.textContent = `
    .notification-dropdown {
        position: absolute;
        top: 100%;
        right: 0;
        width: 300px;
        background: white;
        border-radius: 4px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        display: none;
        flex-direction: column;
        max-height: 80vh;
        z-index: 1000;
    }

    .notification-dropdown.active {
        display: flex;
    }

    .notification-header {
        position: sticky;
        top: 0;
        background: white;
        z-index: 1;
        padding: 1rem;
        border-bottom: 1px solid #eee;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-radius: 4px 4px 0 0;
    }

    .notifications-scroll-container {
        max-height: calc(80vh - 60px);
        overflow-y: auto;
        scrollbar-width: thin;
        scrollbar-color: #888 #f1f1f1;
    }

    .notifications-scroll-container::-webkit-scrollbar {
        width: 6px;
    }

    .notifications-scroll-container::-webkit-scrollbar-track {
        background: #f1f1f1;
    }

    .notifications-scroll-container::-webkit-scrollbar-thumb {
        background: #888;
        border-radius: 3px;
    }

    .notifications-scroll-container::-webkit-scrollbar-thumb:hover {
        background: #555;
    }

    .notification-item {
        padding: 1rem;
        border-bottom: 1px solid #eee;
        background: white;
    }

    .notification-item:last-child {
        border-bottom: none;
        border-radius: 0 0 4px 4px;
    }

    .notification-item.unread {
        background: #f8f8f8;
    }

    .no-notifications {
        padding: 1rem;
        text-align: center;
        color: #666;
    }

    .delete-all-btn {
        padding: 0.5rem;
        background: none;
        border: none;
        color: #666;
        cursor: pointer;
        font-size: 0.9rem;
    }

    .delete-all-btn:hover {
        color: #000;
    }

    .delete-notification-btn {
        position: absolute;
        right: 0.5rem;
        top: 0.5rem;
        background: none;
        border: none;
        color: #666;
        cursor: pointer;
        font-size: 1.2rem;
        padding: 0.2rem 0.5rem;
    }

    .delete-notification-btn:hover {
        color: #000;
    }
`;
document.head.appendChild(style); 