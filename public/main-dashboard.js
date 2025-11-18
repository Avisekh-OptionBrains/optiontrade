const API_BASE = window.location.origin;

// Initialize dashboard on load
document.addEventListener('DOMContentLoaded', () => {
    loadDashboard();
});

// Page Navigation
function showPage(pageName) {
    if (pageName === 'users' || pageName === 'subscriptions') {
        window.location.href = '/subscription-manager.html';
        return;
    }

    // Hide all pages
    document.querySelectorAll('.page-content').forEach(page => {
        page.classList.remove('active');
    });

    // Remove active class from all nav links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });

    // Show selected page
    const page = document.getElementById(`${pageName}-page`);
    if (page) {
        page.classList.add('active');
    }

    // Add active class to clicked nav link
    const activeLink = document.querySelector(`a[onclick="showPage('${pageName}')"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }

    // Load page content
    if (pageName === 'dashboard') {
        loadDashboard();
    } else if (pageName === 'trades') {
        loadTradesPage();
    } else if (pageName === 'settings') {
        loadSettingsPage();
    }
}

// Load Dashboard Data
async function loadDashboard() {
    try {
        // Fetch users with authentication
        const usersResponse = await AUTH_HELPER.authenticatedFetch(`${API_BASE}/api/users/iifl`);
        const users = await usersResponse.json();
        document.getElementById('total-users').textContent = users.length;

        // Fetch subscriptions with authentication
        const [epicrise, optiontrade, banknifty] = await Promise.all([
            AUTH_HELPER.authenticatedFetch(`${API_BASE}/api/subscriptions/epicrise`).then(r => r.json()),
            AUTH_HELPER.authenticatedFetch(`${API_BASE}/api/subscriptions/optiontrade`).then(r => r.json()),
            AUTH_HELPER.authenticatedFetch(`${API_BASE}/api/subscriptions/banknifty`).then(r => r.json())
        ]);

        const totalSubs = epicrise.length + optiontrade.length + banknifty.length;
        document.getElementById('total-subscriptions').textContent = totalSubs;

        // Load recent activity
        loadRecentActivity();

    } catch (error) {
        console.error('Error loading dashboard:', error);
        // Error handling is done in AUTH_HELPER.authenticatedFetch
    }
}

// Refresh Dashboard
function refreshDashboard() {
    loadDashboard();
    alert('Dashboard refreshed!');
}

// Load Recent Activity
async function loadRecentActivity() {
    const activityDiv = document.getElementById('recent-activity');

    try {
        const usersResponse = await AUTH_HELPER.authenticatedFetch(`${API_BASE}/api/users/iifl`);
        const users = await usersResponse.json();

        if (users.length === 0) {
            activityDiv.innerHTML = '<p class="text-muted">No users registered yet</p>';
            return;
        }

        let html = '<div style="display: flex; flex-direction: column; gap: 15px;">';
        users.slice(0, 5).forEach(user => {
            html += `
                <div style="display: flex; align-items: center; gap: 15px; padding: 15px; background: #f9fafb; border-radius: 10px;">
                    <i class="fas fa-user" style="color: #667eea; font-size: 1.5rem;"></i>
                    <div style="flex: 1;">
                        <strong>${user.clientName}</strong>
                        <div style="color: #666; font-size: 0.9rem;">${user.userID}</div>
                    </div>
                    <span class="badge badge-success">Active</span>
                </div>
            `;
        });
        html += '</div>';
        
        activityDiv.innerHTML = html;
    } catch (error) {
        activityDiv.innerHTML = '<p class="text-danger">Error loading activity</p>';
    }
}

// Load Trades Page
function loadTradesPage() {
    const page = document.getElementById('trades-page');
    page.innerHTML = `
        <div class="page-header">
            <h1><i class="fas fa-exchange-alt"></i> Trade History</h1>
            <p>View all trades across all strategies</p>
        </div>
        <div class="card">
            <div class="card-body">
                <p class="text-muted" style="text-align: center; padding: 40px;">
                    <i class="fas fa-chart-line" style="font-size: 3rem; color: #667eea; margin-bottom: 20px;"></i><br>
                    Trade history feature coming soon...<br>
                    <small>This will show all trades from Epicrise, OptionTrade, and BankNifty strategies</small>
                </p>
            </div>
        </div>
    `;
}

// Load Settings Page
function loadSettingsPage() {
    const page = document.getElementById('settings-page');
    page.innerHTML = `
        <div class="page-header">
            <h1><i class="fas fa-cog"></i> Settings</h1>
            <p>Configure your trading platform</p>
        </div>
        <div class="card">
            <div class="card-body">
                <p class="text-muted" style="text-align: center; padding: 40px;">
                    <i class="fas fa-cog" style="font-size: 3rem; color: #667eea; margin-bottom: 20px;"></i><br>
                    Settings page coming soon...<br>
                    <small>Configure API keys, notifications, and other settings here</small>
                </p>
            </div>
        </div>
    `;
}

