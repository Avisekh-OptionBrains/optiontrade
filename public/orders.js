// Orders Page JavaScript
const API_BASE = window.location.origin;

// State
let currentPage = 1;
let totalPages = 1;
let currentFilters = {};

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
    console.log('Orders page loaded');
    setDefaultDates();
    loadOrders();
});

// Set default dates (last 7 days to today)
function setDefaultDates() {
    setDateRange('week');
}

// Set date range based on preset
function setDateRange(range) {
    const today = new Date();
    let startDate = new Date();

    switch(range) {
        case 'today':
            startDate = new Date();
            break;
        case 'yesterday':
            startDate = new Date();
            startDate.setDate(today.getDate() - 1);
            today.setDate(today.getDate() - 1);
            break;
        case 'week':
            startDate.setDate(today.getDate() - 7);
            break;
        case 'month':
            startDate.setDate(today.getDate() - 30);
            break;
        case 'all':
            // Set to a very old date to get all records
            startDate = new Date('2020-01-01');
            break;
    }

    document.getElementById('filter-start-date').value = startDate.toISOString().split('T')[0];
    document.getElementById('filter-end-date').value = new Date().toISOString().split('T')[0];

    // Auto-apply filters when using quick range
    applyFilters();
}

// Load orders from API
async function loadOrders(page = 1) {
    try {
        showLoading(true);
        
        // Build query parameters
        const params = new URLSearchParams({
            page: page,
            limit: 50,
            ...currentFilters
        });

        const response = await fetch(`${API_BASE}/api/enhanced-dashboard/orders?${params}`);
        const data = await response.json();

        if (data.orders) {
            displayOrders(data.orders);
            updatePagination(data.pagination);
            await loadStatistics();
        }
    } catch (error) {
        console.error('Error loading orders:', error);
        showError('Failed to load orders');
    } finally {
        showLoading(false);
    }
}

// Display orders in table
function displayOrders(orders) {
    const tbody = document.getElementById('orders-tbody');
    
    if (orders.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="11" class="text-center text-muted py-4">
                    <i class="fas fa-inbox fa-3x mb-3"></i>
                    <p>No orders found</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = orders.map(order => `
        <tr>
            <td>${formatDateTime(order.timestamp)}</td>
            <td>${order.clientName || 'N/A'}</td>
            <td><span class="broker-badge bg-info text-white">${order.broker}</span></td>
            <td><strong>${order.symbol}</strong></td>
            <td>
                <span class="badge ${order.transactionType === 'BUY' ? 'bg-success' : 'bg-danger'}">
                    ${order.transactionType}
                </span>
            </td>
            <td>${order.orderType}</td>
            <td>${order.quantity}</td>
            <td>₹${order.price.toFixed(2)}</td>
            <td><span class="status-badge status-${order.status.toLowerCase()}">${order.status}</span></td>
            <td><code>${order.orderId || 'N/A'}</code></td>
            <td>${order.message || '-'}</td>
        </tr>
    `).join('');
}

// Load statistics
async function loadStatistics() {
    try {
        const params = new URLSearchParams(currentFilters);
        const response = await fetch(`${API_BASE}/api/order-responses?${params}`);
        const data = await response.json();

        if (data.orders) {
            const total = data.orders.length;
            const success = data.orders.filter(o => o.status === 'SUCCESS').length;
            const failed = data.orders.filter(o => o.status === 'FAILED').length;
            const pending = data.orders.filter(o => o.status === 'PENDING').length;

            document.getElementById('total-orders').textContent = total;
            document.getElementById('success-orders').textContent = success;
            document.getElementById('failed-orders').textContent = failed;
            document.getElementById('pending-orders').textContent = pending;
        }
    } catch (error) {
        console.error('Error loading statistics:', error);
    }
}

// Update pagination controls
function updatePagination(pagination) {
    if (!pagination) return;

    currentPage = pagination.page;
    totalPages = pagination.pages;

    document.getElementById('page-info').textContent = `Page ${currentPage} of ${totalPages}`;
    document.getElementById('pagination-info').textContent = 
        `Showing ${pagination.total > 0 ? ((currentPage - 1) * 50 + 1) : 0} - ${Math.min(currentPage * 50, pagination.total)} of ${pagination.total} orders`;

    document.getElementById('prev-btn').disabled = currentPage <= 1;
    document.getElementById('next-btn').disabled = currentPage >= totalPages;
}

// Apply filters
function applyFilters() {
    currentFilters = {};

    const broker = document.getElementById('filter-broker').value;
    const status = document.getElementById('filter-status').value;
    const startDate = document.getElementById('filter-start-date').value;
    const endDate = document.getElementById('filter-end-date').value;
    const client = document.getElementById('filter-client').value;
    const symbol = document.getElementById('filter-symbol').value;

    if (broker) currentFilters.broker = broker;
    if (status) currentFilters.status = status;
    if (startDate) currentFilters.startDate = startDate;
    if (endDate) currentFilters.endDate = endDate;
    if (client) currentFilters.clientName = client;
    if (symbol) currentFilters.symbol = symbol;

    currentPage = 1;
    loadOrders(currentPage);
}

// Reset filters
function resetFilters() {
    document.getElementById('filter-broker').value = '';
    document.getElementById('filter-status').value = '';
    document.getElementById('filter-client').value = '';
    document.getElementById('filter-symbol').value = '';
    setDefaultDates();
    currentFilters = {};
    currentPage = 1;
    loadOrders(currentPage);
}

// Refresh orders
function refreshOrders() {
    loadOrders(currentPage);
}

// Pagination
function previousPage() {
    if (currentPage > 1) {
        currentPage--;
        loadOrders(currentPage);
    }
}

function nextPage() {
    if (currentPage < totalPages) {
        currentPage++;
        loadOrders(currentPage);
    }
}

// Export orders to CSV
async function exportOrders() {
    try {
        const params = new URLSearchParams(currentFilters);
        params.append('format', 'csv');

        const response = await fetch(`${API_BASE}/api/enhanced-dashboard/export?${params}`);
        const blob = await response.blob();

        // Create download link
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `orders_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        showSuccess('Orders exported successfully!');
    } catch (error) {
        console.error('Error exporting orders:', error);
        showError('Failed to export orders');
    }
}

// Utility functions
function formatDateTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

function showLoading(show) {
    const spinner = document.getElementById('loading-spinner');
    const table = document.querySelector('.table-responsive');

    if (show) {
        spinner.style.display = 'block';
        table.style.opacity = '0.5';
    } else {
        spinner.style.display = 'none';
        table.style.opacity = '1';
    }
}

function showError(message) {
    alert('Error: ' + message);
}

function showSuccess(message) {
    alert('Success: ' + message);
}

