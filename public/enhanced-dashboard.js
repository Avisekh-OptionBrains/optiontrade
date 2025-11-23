// Enhanced Dashboard JavaScript
class EpicriseDashboard {
    constructor() {
        console.log('EpicriseDashboard constructor called');
        this.charts = {};
        this.refreshInterval = null;
        this.websocket = null;
        this.init();
    }

    init() {
        console.log('EpicriseDashboard init called');
        this.setupEventListeners();
        this.initializeCharts();

        // Add a delay to ensure DOM is fully loaded
        setTimeout(() => {
            console.log('Starting delayed dashboard data load...');
            this.loadDashboardData();
        }, 1000);

        this.startAutoRefresh();
        this.initializeWebSocket();
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.sidebar .nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.switchSection(e.target.dataset.section);
            });
        });

        // Refresh button
        window.refreshData = () => this.loadDashboardData();
    }

    switchSection(sectionName) {
        // Update active nav link
        document.querySelectorAll('.sidebar .nav-link').forEach(link => {
            link.classList.remove('active');
        });
        document.querySelector(`[data-section="${sectionName}"]`).classList.add('active');

        // Show/hide sections
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.add('d-none');
        });
        document.getElementById(`${sectionName}-section`).classList.remove('d-none');
    }

    async loadDashboardData() {
        try {
            console.log('Loading dashboard data...');
            this.showLoading();

            const response = await AUTH_HELPER.authenticatedFetch('/api/enhanced-dashboard/data');
            console.log('Dashboard API response status:', response.status);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('Dashboard data received:', data);

            // Update statistics with proper error checking
            if (data.statistics) {
                console.log('Statistics data found:', data.statistics);
                this.updateStatistics(data.statistics);
            } else {
                console.warn('No statistics data in response');
            }

            // Update orders table
            if (data.recentOrders) {
                console.log('Recent orders found:', data.recentOrders.length);
                this.updateOrdersTable(data.recentOrders);
            } else {
                console.warn('No recent orders in response');
            }

            // Update charts
            this.updateCharts(data);

            this.hideLoading();
            console.log('Dashboard data loading completed successfully');
        } catch (error) {
            console.error('Error loading dashboard data:', error);
            this.showError('Failed to load dashboard data: ' + error.message);
            this.hideLoading();
        }
    }

    updateStatistics(stats) {
        console.log('updateStatistics called with:', stats);

        if (!stats) {
            console.error('No stats provided to updateStatistics');
            return;
        }

        const elements = {
            totalMessages: document.getElementById('totalMessages'),
            successfulOrders: document.getElementById('successfulOrders'),
            failedOrders: document.getElementById('failedOrders'),
            totalOrders: document.getElementById('totalOrders')
        };

        console.log('Found elements:', {
            totalMessages: !!elements.totalMessages,
            successfulOrders: !!elements.successfulOrders,
            failedOrders: !!elements.failedOrders,
            totalOrders: !!elements.totalOrders
        });

        // Update elements directly with the correct values from stats
        if (elements.totalMessages) {
            const value = stats.totalMessages || 0;
            elements.totalMessages.textContent = value;
            console.log(`✅ Updated totalMessages to ${value}`);
        } else {
            console.error('❌ totalMessages element not found');
        }

        if (elements.successfulOrders) {
            const value = stats.successful || 0;
            elements.successfulOrders.textContent = value;
            console.log(`✅ Updated successfulOrders to ${value}`);
        } else {
            console.error('❌ successfulOrders element not found');
        }

        if (elements.failedOrders) {
            const value = stats.failed || 0;
            elements.failedOrders.textContent = value;
            console.log(`✅ Updated failedOrders to ${value}`);
        } else {
            console.error('❌ failedOrders element not found');
        }

        if (elements.totalOrders) {
            const value = stats.total || 0;
            elements.totalOrders.textContent = value;
            console.log(`✅ Updated totalOrders to ${value}`);
        } else {
            console.error('❌ totalOrders element not found');
        }
    }

    animateNumber(element, targetValue) {
        const currentValue = parseInt(element.textContent) || 0;
        const increment = Math.ceil((targetValue - currentValue) / 20);
        
        if (currentValue < targetValue) {
            element.textContent = currentValue + increment;
            setTimeout(() => this.animateNumber(element, targetValue), 50);
        } else {
            element.textContent = targetValue;
        }
    }

    updateOrdersTable(orders) {
        const tbody = document.getElementById('ordersTableBody');
        
        if (!orders || orders.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center py-4 text-muted">
                        <i class="fas fa-inbox fa-2x mb-2"></i><br>
                        No orders found
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = orders.map(order => `
            <tr class="animate__animated animate__fadeInUp">
                <td>${this.formatDateTime(order.timestamp)}</td>
                <td>
                    <div class="d-flex align-items-center">
                        <div class="avatar-sm bg-primary rounded-circle d-flex align-items-center justify-content-center me-2">
                            <i class="fas fa-user text-white"></i>
                        </div>
                        ${order.clientName}
                    </div>
                </td>
                <td>
                    <span class="fw-bold text-primary">${order.symbol}</span>
                </td>
                <td>
                    <span class="badge ${order.transactionType === 'BUY' ? 'bg-success' : 'bg-danger'}">
                        ${order.transactionType}
                    </span>
                </td>
                <td>${order.quantity}</td>
                <td>₹${order.price.toFixed(2)}</td>
                <td>
                    <span class="status-badge ${this.getStatusClass(order.status)}">
                        ${order.status}
                    </span>
                </td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary" onclick="dashboard.viewOrderDetails('${order._id}')">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-outline-secondary" onclick="dashboard.downloadOrder('${order._id}')">
                            <i class="fas fa-download"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    getStatusClass(status) {
        const statusClasses = {
            'SUCCESS': 'status-success',
            'FAILED': 'status-danger',
            'PENDING': 'status-warning'
        };
        return statusClasses[status] || 'status-info';
    }

    formatDateTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    initializeCharts() {
        // Order Trends Chart
        const orderTrendsCtx = document.getElementById('orderTrendsChart').getContext('2d');
        this.charts.orderTrends = new Chart(orderTrendsCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Successful Orders',
                    data: [],
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    tension: 0.4,
                    fill: true
                }, {
                    label: 'Failed Orders',
                    data: [],
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        }
                    },
                    x: {
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        }
                    }
                }
            }
        });

        // Success Rate Chart
        const successRateCtx = document.getElementById('successRateChart').getContext('2d');
        this.charts.successRate = new Chart(successRateCtx, {
            type: 'doughnut',
            data: {
                labels: ['Successful', 'Failed'],
                datasets: [{
                    data: [0, 0],
                    backgroundColor: ['#10b981', '#ef4444'],
                    borderWidth: 0,
                    cutout: '70%'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                    }
                }
            }
        });
    }

    updateCharts(data) {
        // Update success rate chart
        const successful = data.statistics.successful || 0;
        const failed = data.statistics.failed || 0;
        
        this.charts.successRate.data.datasets[0].data = [successful, failed];
        this.charts.successRate.update();

        // Update order trends chart (mock data for now)
        const hours = Array.from({length: 24}, (_, i) => `${i}:00`);
        const successData = Array.from({length: 24}, () => Math.floor(Math.random() * 10));
        const failedData = Array.from({length: 24}, () => Math.floor(Math.random() * 3));

        this.charts.orderTrends.data.labels = hours;
        this.charts.orderTrends.data.datasets[0].data = successData;
        this.charts.orderTrends.data.datasets[1].data = failedData;
        this.charts.orderTrends.update();
    }

    showLoading() {
        // Add loading state to refresh button
        const refreshBtn = document.querySelector('[onclick="refreshData()"]');
        if (refreshBtn) {
            refreshBtn.innerHTML = '<div class="loading-spinner me-2"></div>Loading...';
            refreshBtn.disabled = true;
        }
    }

    hideLoading() {
        // Remove loading state from refresh button
        const refreshBtn = document.querySelector('[onclick="refreshData()"]');
        if (refreshBtn) {
            refreshBtn.innerHTML = '<i class="fas fa-sync-alt me-2"></i>Refresh';
            refreshBtn.disabled = false;
        }
    }

    showError(message) {
        // Create toast notification
        const toast = document.createElement('div');
        toast.className = 'toast align-items-center text-white bg-danger border-0 position-fixed top-0 end-0 m-3';
        toast.style.zIndex = '9999';
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        `;
        
        document.body.appendChild(toast);
        const bsToast = new bootstrap.Toast(toast);
        bsToast.show();
        
        // Remove toast after it's hidden
        toast.addEventListener('hidden.bs.toast', () => {
            document.body.removeChild(toast);
        });
    }

    startAutoRefresh() {
        // Refresh data every 30 seconds
        this.refreshInterval = setInterval(() => {
            this.loadDashboardData();
        }, 30000);
    }

    initializeWebSocket() {
        // WebSocket for real-time updates (if available)
        try {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/ws`;
            
            this.websocket = new WebSocket(wsUrl);
            
            this.websocket.onopen = () => {
                console.log('WebSocket connected');
            };
            
            this.websocket.onmessage = (event) => {
                const data = JSON.parse(event.data);
                this.handleWebSocketMessage(data);
            };
            
            this.websocket.onerror = (error) => {
                console.log('WebSocket error:', error);
            };
            
            this.websocket.onclose = () => {
                console.log('WebSocket disconnected');
                // Attempt to reconnect after 5 seconds
                setTimeout(() => this.initializeWebSocket(), 5000);
            };
        } catch (error) {
            console.log('WebSocket not available');
        }
    }

    handleWebSocketMessage(data) {
        switch (data.type) {
            case 'new_order':
                this.loadDashboardData(); // Refresh data
                this.showNotification('New order received', 'success');
                break;
            case 'order_update':
                this.loadDashboardData(); // Refresh data
                break;
            default:
                console.log('Unknown WebSocket message:', data);
        }
    }

    showNotification(message, type = 'info') {
        const colors = {
            success: 'bg-success',
            error: 'bg-danger',
            warning: 'bg-warning',
            info: 'bg-info'
        };
        
        const toast = document.createElement('div');
        toast.className = `toast align-items-center text-white ${colors[type]} border-0 position-fixed top-0 end-0 m-3`;
        toast.style.zIndex = '9999';
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">
                    ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        `;
        
        document.body.appendChild(toast);
        const bsToast = new bootstrap.Toast(toast);
        bsToast.show();
        
        toast.addEventListener('hidden.bs.toast', () => {
            document.body.removeChild(toast);
        });
    }

    // Action methods
    viewOrderDetails(orderId) {
        // TODO: Implement order details modal
        console.log('View order details:', orderId);
    }

    downloadOrder(orderId) {
        // TODO: Implement order download
        console.log('Download order:', orderId);
    }

    destroy() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        if (this.websocket) {
            this.websocket.close();
        }
        Object.values(this.charts).forEach(chart => chart.destroy());
    }
}

// Orders Management Functions
function refreshOrders() {
    const tbody = document.getElementById('ordersManagementTableBody');
    tbody.innerHTML = '<tr><td colspan="10" class="text-center py-4"><div class="loading-spinner me-2"></div>Loading orders...</td></tr>';

    fetch('/api/enhanced-dashboard/orders')
        .then(response => response.json())
        .then(data => {
            displayOrdersTable(data.orders || data);
        })
        .catch(error => {
            console.error('Error loading orders:', error);
            tbody.innerHTML = '<tr><td colspan="10" class="text-center py-4 text-danger">Error loading orders</td></tr>';
        });
}

function displayOrdersTable(orders) {
    const tbody = document.getElementById('ordersManagementTableBody');
    if (!orders || orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="text-center py-4">No orders found</td></tr>';
        return;
    }

    tbody.innerHTML = orders.map(order => `
        <tr>
            <td><code>${order.orderId || 'N/A'}</code></td>
            <td>${new Date(order.timestamp).toLocaleString()}</td>
            <td>${order.clientName || 'N/A'}</td>
            <td><span class="badge bg-info">${order.broker}</span></td>
            <td><strong>${order.symbol}</strong></td>
            <td><span class="badge ${order.action === 'BUY' ? 'bg-success' : 'bg-danger'}">${order.action}</span></td>
            <td>${order.quantity}</td>
            <td>₹${order.price}</td>
            <td><span class="badge ${getStatusBadgeClass(order.status)}">${order.status}</span></td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="viewOrderDetails('${order.orderId}')">
                    <i class="fas fa-eye"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function exportOrders() {
    window.open('/api/enhanced-dashboard/orders/export', '_blank');
}

function viewOrderDetails(orderId) {
    alert(`Order details for ${orderId} - Feature coming soon!`);
}

// Messages Functions
function testMessage() {
    fetch('/api/enhanced-dashboard/test-message', { method: 'POST' })
        .then(response => response.json())
        .then(data => {
            alert('Test message sent successfully!');
            loadMessagesData();
        })
        .catch(error => {
            console.error('Error sending test message:', error);
            alert('Error sending test message');
        });
}

function loadMessagesData() {
    AUTH_HELPER.authenticatedFetch('/api/enhanced-dashboard/messages/stats')
        .then(response => response.json())
        .then(data => {
            document.getElementById('totalMessagesCount').textContent = data.total || 0;
            document.getElementById('processedMessagesCount').textContent = data.processed || 0;
            document.getElementById('todayMessagesCount').textContent = data.today || 0;
        })
        .catch(error => console.error('Error loading message stats:', error));

    fetch('/api/enhanced-dashboard/messages/recent')
        .then(response => response.json())
        .then(data => {
            displayMessagesTable(data);
        })
        .catch(error => {
            console.error('Error loading messages:', error);
            document.getElementById('messagesTableBody').innerHTML =
                '<tr><td colspan="6" class="text-center py-4 text-danger">Error loading messages</td></tr>';
        });
}

function displayMessagesTable(messages) {
    const tbody = document.getElementById('messagesTableBody');
    if (!messages || messages.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4">No recent messages</td></tr>';
        return;
    }

    tbody.innerHTML = messages.map(msg => `
        <tr>
            <td>${new Date(msg.timestamp).toLocaleString()}</td>
            <td><strong>${msg.symbol}</strong></td>
            <td><span class="badge ${msg.action === 'BUY' ? 'bg-success' : 'bg-danger'}">${msg.action}</span></td>
            <td>₹${msg.price}</td>
            <td>₹${msg.stopLoss || 'N/A'}</td>
            <td><span class="badge ${getStatusBadgeClass(msg.status)}">${msg.status}</span></td>
        </tr>
    `).join('');
}

// Clients Functions
function loadClientsData() {
    AUTH_HELPER.authenticatedFetch('/api/enhanced-dashboard/clients/stats')
        .then(response => response.json())
        .then(data => {
            document.getElementById('clientsTotal').textContent = data.total || 0;
            document.getElementById('clientsActive').textContent = data.active || 0;
            document.getElementById('angelClientsCount').textContent = data.angel || 0;
            document.getElementById('motilalClientsCount').textContent = data.motilal || 0;
        })
        .catch(error => console.error('Error loading client stats:', error));

    AUTH_HELPER.authenticatedFetch('/api/enhanced-dashboard/clients/recent')
        .then(response => response.json())
        .then(data => {
            displayClientsTable(data);
        })
        .catch(error => {
            console.error('Error loading clients:', error);
            document.getElementById('clientsTableBody').innerHTML =
                '<tr><td colspan="5" class="text-center py-4 text-danger">Error loading clients</td></tr>';
        });
}

function displayClientsTable(clients) {
    const tbody = document.getElementById('clientsTableBody');
    if (!clients || clients.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4">No clients found</td></tr>';
        return;
    }

    tbody.innerHTML = clients.map(client => `
        <tr>
            <td><strong>${client.name}</strong></td>
            <td><span class="badge bg-info">${client.broker}</span></td>
            <td>₹${client.capital?.toLocaleString() || 'N/A'}</td>
            <td><span class="badge ${client.isActive ? 'bg-success' : 'bg-secondary'}">${client.isActive ? 'Active' : 'Inactive'}</span></td>
            <td>${client.lastActive ? new Date(client.lastActive).toLocaleString() : 'Never'}</td>
        </tr>
    `).join('');
}

// Analytics Functions
function refreshAnalytics() {
    loadAnalyticsData();
}

function loadAnalyticsData() {
    const timeframe = document.getElementById('analyticsTimeframe')?.value || '24h';

    fetch(`/api/enhanced-dashboard/analytics/symbols?timeframe=${timeframe}`)
        .then(response => response.json())
        .then(data => {
            displayTopSymbolsTable(data);
        })
        .catch(error => {
            console.error('Error loading analytics:', error);
            document.getElementById('topSymbolsTableBody').innerHTML =
                '<tr><td colspan="5" class="text-center py-4 text-danger">Error loading analytics</td></tr>';
        });
}

function displayTopSymbolsTable(symbols) {
    const tbody = document.getElementById('topSymbolsTableBody');
    if (!symbols || symbols.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4">No data available</td></tr>';
        return;
    }

    tbody.innerHTML = symbols.map(symbol => `
        <tr>
            <td><strong>${symbol.symbol}</strong></td>
            <td>${symbol.totalOrders}</td>
            <td><span class="badge ${symbol.successRate > 80 ? 'bg-success' : symbol.successRate > 60 ? 'bg-warning' : 'bg-danger'}">${symbol.successRate}%</span></td>
            <td>₹${symbol.avgPrice}</td>
            <td>₹${symbol.totalVolume?.toLocaleString()}</td>
        </tr>
    `).join('');
}

// Settings Functions
function saveSettings() {
    const settings = {
        defaultStopLoss: document.getElementById('defaultStopLoss')?.value,
        autoTrading: document.getElementById('autoTrading')?.checked,
        riskManagement: document.getElementById('riskManagement')?.checked,
        refreshInterval: document.getElementById('refreshInterval')?.value,
        logLevel: document.getElementById('logLevel')?.value,
        notifications: document.getElementById('notifications')?.checked
    };

    fetch('/api/enhanced-dashboard/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
    })
    .then(response => response.json())
    .then(data => {
        alert('Settings saved successfully!');
    })
    .catch(error => {
        console.error('Error saving settings:', error);
        alert('Error saving settings');
    });
}

function loadSystemStatus() {
    fetch('/api/enhanced-dashboard/system/status')
        .then(response => response.json())
        .then(data => {
            const uptimeElement = document.getElementById('serverUptime');
            if (uptimeElement) {
                uptimeElement.textContent = data.uptime || 'Unknown';
            }
        })
        .catch(error => console.error('Error loading system status:', error));
}

// Helper Functions
function getStatusBadgeClass(status) {
    switch(status?.toUpperCase()) {
        case 'SUCCESS': return 'bg-success';
        case 'FAILED': return 'bg-danger';
        case 'PENDING': return 'bg-warning';
        case 'PROCESSED': return 'bg-info';
        default: return 'bg-secondary';
    }
}

// Simple working functions based on test-dashboard.html
async function loadDashboardDataSimple() {
    try {
        console.log('Loading dashboard data (simple approach)...');

        const response = await fetch('/api/enhanced-dashboard/data');
        console.log('Response status:', response.status);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Data received:', data);

        // Update statistics - direct approach like test dashboard
        if (data.statistics) {
            const totalMessagesEl = document.getElementById('totalMessages');
            const successfulOrdersEl = document.getElementById('successfulOrders');
            const failedOrdersEl = document.getElementById('failedOrders');
            const totalOrdersEl = document.getElementById('totalOrders');

            if (totalMessagesEl) {
                totalMessagesEl.textContent = data.statistics.totalMessages || 0;
                console.log('✅ Updated totalMessages to', data.statistics.totalMessages || 0);
            }
            if (successfulOrdersEl) {
                successfulOrdersEl.textContent = data.statistics.successful || 0;
                console.log('✅ Updated successfulOrders to', data.statistics.successful || 0);
            }
            if (failedOrdersEl) {
                failedOrdersEl.textContent = data.statistics.failed || 0;
                console.log('✅ Updated failedOrders to', data.statistics.failed || 0);
            }
            if (totalOrdersEl) {
                totalOrdersEl.textContent = data.statistics.total || 0;
                console.log('✅ Updated totalOrders to', data.statistics.total || 0);
            }
        }

        console.log('Dashboard data loading completed successfully');

    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
}

// Test function to manually update statistics (for debugging)
window.testUpdateStats = function() {
    console.log('Testing manual stats update...');
    loadDashboardDataSimple();
};

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded - initializing dashboard');

    // Use simple approach first to get statistics working
    setTimeout(() => {
        console.log('Loading dashboard data with simple approach...');
        loadDashboardDataSimple();
    }, 1000);

    // Initialize the main dashboard class for other features
    setTimeout(() => {
        console.log('Initializing full dashboard...');
        window.dashboard = new EpicriseDashboard();

        // Load additional section data
        console.log('Loading additional section data');
        loadMessagesData();
        loadClientsData();
        loadAnalyticsData();
        loadSystemStatus();
    }, 2000);

    // Set up auto-refresh using the simple approach
    setInterval(() => {
        console.log('Auto-refreshing dashboard data...');
        loadDashboardDataSimple();
    }, 30000);
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.dashboard) {
        window.dashboard.destroy();
    }
});
