// Authentication Helper
// Include this file in all protected HTML pages

const AUTH_HELPER = {
    // Get auth token from localStorage or cookie
    getToken() {
        return localStorage.getItem('authToken') || this.getCookie('authToken');
    },

    // Get cookie value
    getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
    },

    // Check if user is authenticated
    isAuthenticated() {
        return !!this.getToken();
    },

    // Redirect to login page
    redirectToLogin() {
        window.location.href = '/login.html';
    },

    // Make authenticated fetch request
    async authenticatedFetch(url, options = {}) {
        const token = this.getToken();

        if (!token) {
            console.error('❌ No authentication token found');
            this.redirectToLogin();
            throw new Error('Not authenticated');
        }

        // Add Authorization header
        const headers = {
            ...options.headers,
            'Authorization': `Bearer ${token}`
        };

        const response = await fetch(url, {
            ...options,
            headers
        });

        // Check if unauthorized
        if (response.status === 401) {
            console.error('❌ Authentication token expired or invalid');
            // Clear invalid token
            localStorage.removeItem('authToken');
            document.cookie = 'authToken=; path=/; max-age=0';
            this.redirectToLogin();
            throw new Error('Authentication failed');
        }

        return response;
    },

    // Logout
    async logout() {
        const token = this.getToken();

        if (token) {
            try {
                await fetch('/api/auth/logout', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
            } catch (error) {
                console.error('Error during logout:', error);
            }
        }

        // Clear token
        localStorage.removeItem('authToken');
        localStorage.removeItem('userEmail');
        document.cookie = 'authToken=; path=/; max-age=0';

        // Redirect to login
        this.redirectToLogin();
    },

    // Check authentication on page load
    checkAuth() {
        // Skip check if already on login page
        if (window.location.pathname === '/login.html') {
            return;
        }

        if (!this.isAuthenticated()) {
            console.warn('⚠️ Not authenticated, redirecting to login...');
            this.redirectToLogin();
        }
    }
};

// Check authentication when page loads
window.addEventListener('DOMContentLoaded', () => {
    AUTH_HELPER.checkAuth();
});

// Export for use in other scripts
window.AUTH_HELPER = AUTH_HELPER;

