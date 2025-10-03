// Global state
let characters = [];
let currentUser = null;
const API_BASE = '/api/v1';

// Get authentication token from storage
function getAuthToken() {
    return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
}

// Check authentication
async function checkAuth() {
    const token = getAuthToken();
    if (!token) {
        window.location.href = '/login.html';
        return false;
    }

    // Verify token with server
    try {
        const response = await fetch('/api/v1/auth/me', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const result = await response.json();
            if (result.success && result.data.user) {
                currentUser = result.data.user;
                updateUserUI();
                return true;
            }
        }

        // Token invalid, clear and redirect
        console.error('Auth verification failed');
        localStorage.removeItem('auth_token');
        sessionStorage.removeItem('auth_token');
        window.location.href = '/login.html';
        return false;
    } catch (error) {
        console.error('Token verification failed:', error);
        localStorage.removeItem('auth_token');
        sessionStorage.removeItem('auth_token');
        window.location.href = '/login.html';
        return false;
    }
}

// Update user interface
function updateUserUI() {
    if (!currentUser) return;
    
    const userInitial = currentUser.name.charAt(0).toUpperCase();
    document.getElementById('user-initial').textContent = userInitial;
    document.getElementById('profile-initial').textContent = userInitial;
    document.getElementById('user-name').textContent = currentUser.name;
    document.getElementById('profile-name').textContent = currentUser.name;
    document.getElementById('user-email').textContent = currentUser.email;
    document.getElementById('profile-email').textContent = currentUser.email;
    document.getElementById('credits-count').textContent = currentUser.credits;
    document.getElementById('total-credits').textContent = currentUser.credits;
}

// Page switching
function switchPage(pageId) {
    document.querySelectorAll('.page-content').forEach(page => {
        page.classList.remove('active');
    });
    
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    const targetPage = document.getElementById(`${pageId}-page`);
    if (targetPage) {
        targetPage.classList.add('active');
    }
    
    const targetNav = document.querySelector(`.nav-item[data-page="${pageId}"]`);
    if (targetNav) {
        targetNav.classList.add('active');
    }
    
    const pageTitles = {
        'library': 'Character Gallery',
        'create': 'Character Creation',
        'edit': 'Character Editing',
        'scenes': 'Scene Builder',
        'profile': 'Profile',
        'settings': 'Settings'
    };
    
    document.getElementById('page-title').textContent = pageTitles[pageId] || 'Dashboard';

    // Load page-specific data
    if (pageId === 'library') {
        // Reload characters when switching to gallery
        loadCharacters().then(loadedCharacters => {
            characters = loadedCharacters;
            if (typeof updateCharacterGallery === 'function') {
                updateCharacterGallery();
            }
        });
    } else if (pageId === 'edit') {
        // Initialize Edit page with Step 1
        if (typeof showEditStep1_SelectCharacter === 'function') {
            showEditStep1_SelectCharacter();
        }
    }
}

// Logout
function logout() {
    localStorage.removeItem('auth_token');
    sessionStorage.removeItem('auth_token');
    window.location.href = '/login.html';
}

// Show notification
function showNotification(message, type = 'info') {
    const colors = {
        'success': 'var(--success)',
        'error': 'var(--error)',
        'warning': 'var(--warning)',
        'info': 'var(--primary)'
    };
    
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 2rem;
        right: 2rem;
        background: white;
        color: ${colors[type]};
        padding: 1rem 1.5rem;
        border-radius: var(--radius);
        box-shadow: var(--shadow-lg);
        border-left: 4px solid ${colors[type]};
        z-index: 10000;
        animation: slideInFromLeft 0.3s ease-out;
        max-width: 400px;
    `;
    
    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 1rem;">
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'fadeOut 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Load characters
async function loadCharacters() {
    try {
        console.log('[Common] Loading characters from API...');
        const response = await fetch(`${API_BASE}/characters`);
        const data = await response.json();

        console.log('[Common] API response:', data);

        if (data.success) {
            // API returns data.data.items (paginated response)
            const loadedCharacters = data.data?.items || [];
            console.log('[Common] Loaded characters:', loadedCharacters.length);
            document.getElementById('total-characters').textContent = loadedCharacters.length;
            return loadedCharacters;
        } else {
            console.warn('[Common] API returned success=false:', data);
            return [];
        }
    } catch (error) {
        console.error('[Common] Failed to load characters:', error);
        return [];
    }
}

// Navigation setup
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', function(e) {
        e.preventDefault();
        const pageId = this.getAttribute('data-page');
        switchPage(pageId);
    });
});

// Mobile menu toggle
document.getElementById('menu-toggle').addEventListener('click', function() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('main-content').classList.toggle('expanded');
});

// Initialize app
// NOTE: Auth check and ALL initialization is handled by app.html DOMContentLoaded listener
// This file ONLY provides utility functions - it should NOT execute anything on load

// Handle clicks outside modal
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.remove();
    }
});
