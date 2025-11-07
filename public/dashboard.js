// Dashboard JavaScript
let currentPage = 1;
let currentTab = 'orders';
let currentFilters = {};

// Initialize dashboard
document.addEventListener('DOMContentLoaded', function() {
    loadDashboardData();
    setupEventListeners();
});

function setupEventListeners() {
    // Tab switching
    document.querySelectorAll('[data-bs-toggle="tab"]').forEach(tab => {
        tab.addEventListener('shown.bs.tab', function(e) {
            currentTab = e.target.getAttribute('data-bs-target').replace('#', '');
            currentPage = 1;
            if (currentTab === 'orders') {
                loadOrders();
            } else if (currentTab === 'messages') {
                loadMessages();
            }
        });
    });

    // Filter change events
    ['brokerFilter', 'statusFilter', 'startDate', 'endDate'].forEach(id => {
        document.getElementById(id).addEventListener('change', function() {
            currentFilters[id] = this.value;
        });
    });
}

async function loadDashboardData() {
    try {
        showLoading();
        const response = await fetch('/api/dashboard/data');
        const data = await response.json();
        
        updateStatistics(data.statistics);
        updateOrdersTable(data.recentOrders);
        updateMessagesTable(data.recentMessages);
        
        hideLoading();
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showError('Failed to load dashboard data');
    }
}

function updateStatistics(stats) {
    document.getElementById('totalOrders').textContent = stats.total || 0;
    document.getElementById('successfulOrders').textContent = stats.successful || 0;
    document.getElementById('failedOrders').textContent = stats.failed || 0;
    document.getElementById('totalMessages').textContent = stats.totalMessages || 0;
}

function updateOrdersTable(orders) {
    const tbody = document.getElementById('ordersTableBody');
    tbody.innerHTML = '';

    if (!orders || orders.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="text-center py-4">
                    <i class="fas fa-inbox fa-2x text-muted"></i>
                    <p class="mt-2 text-muted">No orders found</p>
                </td>
            </tr>
        `;
        return;
    }

    orders.forEach(order => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatDateTime(order.timestamp)}</td>
            <td>${order.clientName}</td>
            <td><span class="status-badge broker-${order.broker.toLowerCase()}">${order.broker}</span></td>
            <td>${order.symbol}</td>
            <td><span class="badge ${order.transactionType === 'BUY' ? 'bg-success' : 'bg-danger'}">${order.transactionType}</span></td>
            <td><span class="badge bg-info">${order.orderType}</span></td>
            <td>₹${order.price.toFixed(2)}</td>
            <td>${order.quantity}</td>
            <td><span class="status-badge status-${order.status.toLowerCase()}">${order.status}</span></td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="showOrderDetails('${order._id}')">
                    <i class="fas fa-eye"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function updateMessagesTable(messages) {
    const tbody = document.getElementById('messagesTableBody');
    tbody.innerHTML = '';

    if (!messages || messages.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center py-4">
                    <i class="fas fa-inbox fa-2x text-muted"></i>
                    <p class="mt-2 text-muted">No messages found</p>
                </td>
            </tr>
        `;
        return;
    }

    messages.forEach(message => {
        const row = document.createElement('tr');
        const orderType = message.transactionType || 'N/A';
        const orderTypeClass = orderType === 'BUY' ? 'bg-success' : orderType === 'SELL' ? 'bg-danger' : 'bg-secondary';
        
        // Extract stop loss from message content if available
        let stopLoss = 'N/A';
        if (message.message && message.message.includes('Stop Loss: ₹')) {
            const stopLossMatch = message.message.match(/Stop Loss: ₹([\d.]+)/);
            if (stopLossMatch) {
                stopLoss = `₹${parseFloat(stopLossMatch[1]).toFixed(2)}`;
            }
        }
        
        row.innerHTML = `
            <td>${formatDateTime(message.createdAt)}</td>
            <td>SYSTEM</td>
            <td><span class="badge ${orderTypeClass}">${orderType}</span></td>
            <td>Epicrise</td>
            <td>${message.symbol || 'N/A'}</td>
            <td>₹${message.price?.toFixed(2) || 'N/A'}</td>
            <td>${stopLoss}</td>
            <td><span class="status-badge status-success">Success</span></td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="showMessageDetails('${message._id}')">
                    <i class="fas fa-eye"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

async function loadOrders(page = 1) {
    try {
        showLoading();
        const params = new URLSearchParams({
            page: page,
            limit: 50,
            ...currentFilters
        });

        const response = await fetch(`/api/dashboard/orders?${params}`);
        const data = await response.json();
        
        updateOrdersTable(data.orders);
        updatePagination(data.pagination, 'loadOrders');
        
        hideLoading();
    } catch (error) {
        console.error('Error loading orders:', error);
        showError('Failed to load orders');
    }
}

async function loadMessages(page = 1) {
    try {
        showLoading();
        const params = new URLSearchParams({
            page: page,
            limit: 50
        });

        const response = await fetch(`/api/dashboard/messages?${params}`);
        const data = await response.json();
        
        updateMessagesTable(data.messages);
        updatePagination(data.pagination, 'loadMessages');
        
        hideLoading();
    } catch (error) {
        console.error('Error loading messages:', error);
        showError('Failed to load messages');
    }
}

function updatePagination(pagination, loadFunction) {
    const paginationEl = document.getElementById('pagination');
    paginationEl.innerHTML = '';

    if (pagination.pages <= 1) return;

    // Previous button
    const prevLi = document.createElement('li');
    prevLi.className = `page-item ${pagination.page === 1 ? 'disabled' : ''}`;
    prevLi.innerHTML = `
        <a class="page-link" href="#" onclick="${loadFunction}(${pagination.page - 1}); return false;">
            <i class="fas fa-chevron-left"></i>
        </a>
    `;
    paginationEl.appendChild(prevLi);

    // Page numbers
    const startPage = Math.max(1, pagination.page - 2);
    const endPage = Math.min(pagination.pages, pagination.page + 2);

    for (let i = startPage; i <= endPage; i++) {
        const li = document.createElement('li');
        li.className = `page-item ${i === pagination.page ? 'active' : ''}`;
        li.innerHTML = `
            <a class="page-link" href="#" onclick="${loadFunction}(${i}); return false;">${i}</a>
        `;
        paginationEl.appendChild(li);
    }

    // Next button
    const nextLi = document.createElement('li');
    nextLi.className = `page-item ${pagination.page === pagination.pages ? 'disabled' : ''}`;
    nextLi.innerHTML = `
        <a class="page-link" href="#" onclick="${loadFunction}(${pagination.page + 1}); return false;">
            <i class="fas fa-chevron-right"></i>
        </a>
    `;
    paginationEl.appendChild(nextLi);
}

async function showOrderDetails(orderId) {
    try {
        const response = await fetch(`/api/order-responses`);
        const data = await response.json();
        const order = data.data.find(o => o._id === orderId);
        
        if (order) {
            document.getElementById('orderDetails').textContent = JSON.stringify(order, null, 2);
            new bootstrap.Modal(document.getElementById('orderModal')).show();
        }
    } catch (error) {
        console.error('Error loading order details:', error);
        showError('Failed to load order details');
    }
}

async function showMessageDetails(messageId) {
    try {
        const response = await fetch(`/api/dashboard/messages`);
        const data = await response.json();
        const message = data.messages.find(m => m._id === messageId);
        
        if (message) {
            document.getElementById('messageDetails').textContent = JSON.stringify(message, null, 2);
            new bootstrap.Modal(document.getElementById('messageModal')).show();
        }
    } catch (error) {
        console.error('Error loading message details:', error);
        showError('Failed to load message details');
    }
}

function applyFilters() {
    currentPage = 1;
    if (currentTab === 'orders') {
        loadOrders();
    }
}

function clearFilters() {
    document.getElementById('brokerFilter').value = '';
    document.getElementById('statusFilter').value = '';
    document.getElementById('startDate').value = '';
    document.getElementById('endDate').value = '';
    currentFilters = {};
    applyFilters();
}

function refreshDashboard() {
    loadDashboardData();
}

function showLoading() {
    document.querySelectorAll('.loading').forEach(el => {
        el.style.display = 'block';
    });
}

function hideLoading() {
    document.querySelectorAll('.loading').forEach(el => {
        el.style.display = 'none';
    });
}

function showError(message) {
    // Create toast notification
    const toast = document.createElement('div');
    toast.className = 'toast align-items-center text-white bg-danger border-0 position-fixed top-0 end-0 m-3';
    toast.style.zIndex = '9999';
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                <i class="fas fa-exclamation-triangle me-2"></i>${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
    `;
    document.body.appendChild(toast);
    
    const bsToast = new bootstrap.Toast(toast);
    bsToast.show();
    
    setTimeout(() => {
        toast.remove();
    }, 5000);
}

function formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

// Auto-refresh every 30 seconds
setInterval(() => {
    if (document.visibilityState === 'visible') {
        loadDashboardData();
    }
}, 30000);
