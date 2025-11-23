// API Base URL
const API_BASE = window.location.origin;

// Current active tab
let currentTab = 'users';

// Switch between tabs
function switchTab(tabName) {
    currentTab = tabName;
    
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');
    
    // Load data for the tab
    loadTabData(tabName);
}

// Load data based on active tab
async function loadTabData(tabName) {
    switch(tabName) {
        case 'users':
            await loadUsers();
            break;
        case 'epicrise':
            await loadSubscriptions('Epicrise');
            break;
        case 'optiontrade':
            await loadSubscriptions('OptionTrade');
            break;
        case 'banknifty':
            await loadSubscriptions('BankNifty');
            break;
    }
}

// Load all IIFL users
async function loadUsers() {
    try {
        const response = await AUTH_HELPER.authenticatedFetch(`${API_BASE}/api/users/iifl`);
        const users = await response.json();
        
        document.getElementById('users-loading').style.display = 'none';
        document.getElementById('users-content').style.display = 'block';
        
        // Update stats
        const liveUsers = users.filter(u => u.state === 'live').length;
        const pausedUsers = users.filter(u => u.state === 'paused').length;
        
        document.getElementById('users-stats').innerHTML = `
            <div class="stat-card">
                <h3>${users.length}</h3>
                <p>Total Users</p>
            </div>
            <div class="stat-card">
                <h3>${liveUsers}</h3>
                <p>Live Users</p>
            </div>
            <div class="stat-card">
                <h3>${pausedUsers}</h3>
                <p>Paused Users</p>
            </div>
        `;
        
        // Update table
        const tbody = document.getElementById('users-tbody');
        tbody.innerHTML = users.map(user => `
            <tr>
                <td><strong>${user.clientName}</strong></td>
                <td>${user.userID}</td>
                <td>${user.email}</td>
                <td>${user.phoneNumber}</td>
                <td>
                    <span class="badge ${user.state === 'live' ? 'badge-success' : 'badge-warning'}">
                        ${user.state.toUpperCase()}
                    </span>
                </td>
                <td>
                    <span class="badge ${user.token ? 'badge-success' : 'badge-danger'}">
                        ${user.token ? '✓ Active' : '✗ Missing'}
                    </span>
                </td>
                <td>
                    <button class="btn btn-primary" onclick="viewSubscriptions('${user.userID}')">
                        View Subscriptions
                    </button>
                </td>
                <td>
                    <button class="btn btn-warning" onclick="toggleUserState('${user.userID}', '${user.state}')">
                        ${user.state === 'live' ? 'Pause' : 'Activate'}
                    </button>
                    <button class="btn btn-danger" onclick="deleteUser('${user.userID}')">Delete</button>
                </td>
            </tr>
        `).join('');
        
    } catch (error) {
        console.error('Error loading users:', error);
        showAlert('error', 'Failed to load users');
    }
}

// Load subscriptions for a strategy
async function loadSubscriptions(strategy) {
    const strategyLower = strategy.toLowerCase();

    try {
        const response = await AUTH_HELPER.authenticatedFetch(`${API_BASE}/api/subscriptions/${strategyLower}`);
        const subscriptions = await response.json();
        
        document.getElementById(`${strategyLower}-loading`).style.display = 'none';
        document.getElementById(`${strategyLower}-content`).style.display = 'block';
        
        const tbody = document.getElementById(`${strategyLower}-tbody`);
        
        if (subscriptions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px;">No subscriptions found</td></tr>';
            return;
        }
        
        tbody.innerHTML = subscriptions.map(sub => {
            let specificCols = '';
            
            if (strategy === 'Epicrise') {
                specificCols = `
                    <td>₹${sub.capital.toLocaleString()}</td>
                `;
            } else if (strategy === 'OptionTrade') {
                const qty = sub.lotSize * 75; // NIFTY lot size
                specificCols = `
                    <td>${sub.lotSize} lots</td>
                    <td>${qty} qty</td>
                `;
            } else if (strategy === 'BankNifty') {
                const qty = sub.lotSize * 35; // BankNifty lot size
                specificCols = `
                    <td>${sub.lotSize} lots</td>
                    <td>${qty} qty</td>
                `;
            }
            
            return `
                <tr>
                    <td><strong>${sub.clientName || sub.userID}</strong></td>
                    <td>${sub.userID}</td>
                    ${specificCols}
                    <td>
                        <span class="badge ${sub.enabled ? 'badge-success' : 'badge-danger'}">
                            ${sub.enabled ? 'Active' : 'Disabled'}
                        </span>
                    </td>
                    <td>${sub.totalTrades || 0}</td>
                    <td>
                        <button class="btn btn-warning" onclick="toggleSubscription('${strategy}', '${sub.userID}', ${sub.enabled})">
                            ${sub.enabled ? 'Disable' : 'Enable'}
                        </button>
                        <button class="btn btn-primary" onclick="editSubscription('${strategy}', '${sub.userID}')">Edit</button>
                        <button class="btn btn-danger" onclick="deleteSubscription('${strategy}', '${sub.userID}')">Delete</button>
                    </td>
                </tr>
            `;
        }).join('');
        
    } catch (error) {
        console.error(`Error loading ${strategy} subscriptions:`, error);
        showAlert('error', `Failed to load ${strategy} subscriptions`);
    }
}

// Show alert message
function showAlert(type, message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    
    document.querySelector('.container').insertBefore(alertDiv, document.querySelector('.tabs'));
    
    setTimeout(() => alertDiv.remove(), 5000);
}

// Toggle user state (live/paused)
async function toggleUserState(userID, currentState) {
    const newState = currentState === 'live' ? 'paused' : 'live';

    if (!confirm(`Are you sure you want to ${newState === 'live' ? 'activate' : 'pause'} this user?`)) {
        return;
    }

    try {
        const response = await AUTH_HELPER.authenticatedFetch(`${API_BASE}/api/users/iifl/${userID}/state`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ state: newState })
        });

        if (response.ok) {
            showAlert('success', `User ${newState === 'live' ? 'activated' : 'paused'} successfully`);
            loadUsers();
        } else {
            showAlert('error', 'Failed to update user state');
        }
    } catch (error) {
        console.error('Error updating user state:', error);
        showAlert('error', 'Failed to update user state');
    }
}

// Delete user
async function deleteUser(userID) {
    if (!confirm('Are you sure you want to delete this user? This will also delete all their subscriptions.')) {
        return;
    }

    try {
        const response = await AUTH_HELPER.authenticatedFetch(`${API_BASE}/api/users/iifl/${userID}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showAlert('success', 'User deleted successfully');
            loadUsers();
        } else {
            showAlert('error', 'Failed to delete user');
        }
    } catch (error) {
        console.error('Error deleting user:', error);
        showAlert('error', 'Failed to delete user');
    }
}

// View user subscriptions
async function viewSubscriptions(userID) {
    // Create modal to show all subscriptions for this user
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    `;

    modal.innerHTML = `
        <div class="card" style="max-width: 800px; max-height: 80vh; overflow-y: auto;">
            <h2>Subscriptions for User: ${userID}</h2>
            <div id="modal-content">Loading...</div>
            <button class="btn btn-danger" onclick="this.closest('div[style*=fixed]').remove()">Close</button>
        </div>
    `;

    document.body.appendChild(modal);

    // Load subscriptions
    try {
        console.log('Loading subscriptions for user:', userID);

        const [epicrise, optiontrade, banknifty] = await Promise.all([
            AUTH_HELPER.authenticatedFetch(`${API_BASE}/api/subscriptions/epicrise/${userID}`)
                .then(r => {
                    console.log('Epicrise response:', r.status);
                    return r.ok ? r.json() : null;
                })
                .catch(err => {
                    console.error('Epicrise error:', err);
                    return null;
                }),
            AUTH_HELPER.authenticatedFetch(`${API_BASE}/api/subscriptions/optiontrade/${userID}`)
                .then(r => {
                    console.log('OptionTrade response:', r.status);
                    return r.ok ? r.json() : null;
                })
                .catch(err => {
                    console.error('OptionTrade error:', err);
                    return null;
                }),
            AUTH_HELPER.authenticatedFetch(`${API_BASE}/api/subscriptions/banknifty/${userID}`)
                .then(r => {
                    console.log('BankNifty response:', r.status);
                    return r.ok ? r.json() : null;
                })
                .catch(err => {
                    console.error('BankNifty error:', err);
                    return null;
                })
        ]);

        console.log('Loaded subscriptions:', { epicrise, optiontrade, banknifty });

        let content = '<div class="grid">';

        if (epicrise) {
            content += `
                <div class="card">
                    <h3>📈 Epicrise</h3>
                    <p><strong>Status:</strong> ${epicrise.enabled ? '✅ Active' : '❌ Disabled'}</p>
                    <p><strong>Capital:</strong> ₹${epicrise.capital.toLocaleString()}</p>
                    <p><strong>Total Trades:</strong> ${epicrise.totalTrades || 0}</p>
                    <button class="btn btn-primary" onclick="editSubscription('Epicrise', '${userID}')">Edit</button>
                </div>
            `;
        } else {
            content += `
                <div class="card">
                    <h3>📈 Epicrise</h3>
                    <p>Not subscribed</p>
                    <button class="btn btn-success" onclick="showAddSubscription('Epicrise', '${userID}')">Subscribe</button>
                </div>
            `;
        }

        if (optiontrade) {
            content += `
                <div class="card">
                    <h3>🎯 Option Trade</h3>
                    <p><strong>Status:</strong> ${optiontrade.enabled ? '✅ Active' : '❌ Disabled'}</p>
                    <p><strong>Lot Size:</strong> ${optiontrade.lotSize} lots (${optiontrade.lotSize * 75} qty)</p>
                    <p><strong>Total Trades:</strong> ${optiontrade.totalTrades || 0}</p>
                    <button class="btn btn-primary" onclick="editSubscription('OptionTrade', '${userID}')">Edit</button>
                </div>
            `;
        } else {
            content += `
                <div class="card">
                    <h3>🎯 Option Trade</h3>
                    <p>Not subscribed</p>
                    <button class="btn btn-success" onclick="showAddSubscription('OptionTrade', '${userID}')">Subscribe</button>
                </div>
            `;
        }

        if (banknifty) {
            content += `
                <div class="card">
                    <h3>💰 Bank Nifty</h3>
                    <p><strong>Status:</strong> ${banknifty.enabled ? '✅ Active' : '❌ Disabled'}</p>
                    <p><strong>Lot Size:</strong> ${banknifty.lotSize} lots (${banknifty.lotSize * 35} qty)</p>
                    <p><strong>Total Trades:</strong> ${banknifty.totalTrades || 0}</p>
                    <button class="btn btn-primary" onclick="editSubscription('BankNifty', '${userID}')">Edit</button>
                </div>
            `;
        } else {
            content += `
                <div class="card">
                    <h3>💰 Bank Nifty</h3>
                    <p>Not subscribed</p>
                    <button class="btn btn-success" onclick="showAddSubscription('BankNifty', '${userID}')">Subscribe</button>
                </div>
            `;
        }

        content += '</div>';

        document.getElementById('modal-content').innerHTML = content;

    } catch (error) {
        console.error('Error loading subscriptions:', error);
        const modalContent = document.getElementById('modal-content');
        if (modalContent) {
            modalContent.innerHTML = `
                <div style="padding: 20px; background: #fee2e2; border-radius: 10px; color: #991b1b;">
                    <strong>Failed to load subscriptions</strong><br>
                    <small>${error.message || 'Unknown error'}</small>
                </div>
            `;
        }
    }
}

// Toggle subscription enabled/disabled
async function toggleSubscription(strategy, userID, currentEnabled) {
    const newEnabled = !currentEnabled;
    const strategyLower = strategy.toLowerCase();

    try {
        const response = await AUTH_HELPER.authenticatedFetch(`${API_BASE}/api/subscriptions/${strategyLower}/${userID}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled: newEnabled })
        });

        if (response.ok) {
            showAlert('success', `Subscription ${newEnabled ? 'enabled' : 'disabled'} successfully`);
            loadSubscriptions(strategy);
        } else {
            showAlert('error', 'Failed to update subscription');
        }
    } catch (error) {
        console.error('Error updating subscription:', error);
        showAlert('error', 'Failed to update subscription');
    }
}

// Show add subscription modal
async function showAddSubscription(strategy, userID = null) {
    const strategyLower = strategy.toLowerCase().replace(' ', '');

    // Get all users for dropdown
    const response = await AUTH_HELPER.authenticatedFetch(`${API_BASE}/api/users/iifl`);
    const users = await response.json();

    if (users.length === 0) {
        showAlert('error', 'No users found. Please add a user first.');
        return;
    }

    // Create modal HTML based on strategy
    let formFields = '';

    if (strategyLower === 'epicrise') {
        formFields = `
            <div class="form-group">
                <label>Capital (₹)</label>
                <input type="number" id="modal-capital" class="form-control" value="100000" min="1000" required>
            </div>
        `;
    } else {
        // OptionTrade or BankNifty
        const lotMultiplier = strategyLower === 'optiontrade' ? 75 : 35;
        formFields = `
            <div class="form-group">
                <label>Lot Size (1 lot = ${lotMultiplier} qty)</label>
                <input type="number" id="modal-lotsize" class="form-control" value="1" min="1" max="100" required>
                <small class="form-text">Quantity will be: <span id="qty-preview">${lotMultiplier}</span></small>
            </div>
        `;
    }

    const modalHTML = `
        <div class="modal-overlay" id="add-subscription-modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Add ${strategy} Subscription</h3>
                    <button class="close-btn" onclick="closeModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="add-subscription-form">
                        <div class="form-group">
                            <label>Select User</label>
                            <select id="modal-userid" class="form-control" required>
                                <option value="">-- Select User --</option>
                                ${users.map(u => `<option value="${u.userID}">${u.clientName} (${u.userID})</option>`).join('')}
                            </select>
                        </div>
                        ${formFields}
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="closeModal()">Cancel</button>
                    <button class="btn-primary" onclick="submitAddSubscription('${strategyLower}')">Add Subscription</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Add event listener for lot size preview
    const lotSizeInput = document.getElementById('modal-lotsize');
    if (lotSizeInput) {
        const lotMultiplier = strategyLower === 'optiontrade' ? 75 : 35;
        lotSizeInput.addEventListener('input', (e) => {
            const qty = e.target.value * lotMultiplier;
            document.getElementById('qty-preview').textContent = qty;
        });
    }
}

// Submit add subscription
async function submitAddSubscription(strategy) {
    const userID = document.getElementById('modal-userid').value;

    if (!userID) {
        showAlert('error', 'Please select a user');
        return;
    }

    let data = {
        userID: userID,
        enabled: true
    };

    if (strategy === 'epicrise') {
        data.capital = parseInt(document.getElementById('modal-capital').value);
    } else {
        data.lotSize = parseInt(document.getElementById('modal-lotsize').value);
    }

    try {
        const response = await AUTH_HELPER.authenticatedFetch(`${API_BASE}/api/subscriptions/${strategy}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            showAlert('success', 'Subscription added successfully!');
            closeModal();
            loadSubscriptions(strategy.charAt(0).toUpperCase() + strategy.slice(1));
        } else {
            const error = await response.json();
            showAlert('error', error.message || 'Failed to add subscription');
        }
    } catch (error) {
        showAlert('error', 'Error adding subscription: ' + error.message);
    }
}

// Close modal
function closeModal() {
    const modal = document.getElementById('add-subscription-modal') || document.getElementById('edit-subscription-modal');
    if (modal) {
        modal.remove();
    }
}

// Edit subscription
async function editSubscription(strategy, userID) {
    const strategyLower = strategy.toLowerCase().replace(' ', '');

    // Fetch existing subscription
    const response = await AUTH_HELPER.authenticatedFetch(`${API_BASE}/api/subscriptions/${strategyLower}/${userID}`);
    const subscription = await response.json();

    if (!subscription) {
        showAlert('error', 'Subscription not found');
        return;
    }

    // Create modal HTML based on strategy
    let formFields = '';

    if (strategyLower === 'epicrise') {
        formFields = `
            <div class="form-group">
                <label>Capital (₹)</label>
                <input type="number" id="modal-capital" class="form-control" value="${subscription.capital}" min="1000" required>
            </div>
        `;
    } else {
        const lotMultiplier = strategyLower === 'optiontrade' ? 75 : 35;
        const currentQty = subscription.lotSize * lotMultiplier;
        formFields = `
            <div class="form-group">
                <label>Lot Size (1 lot = ${lotMultiplier} qty)</label>
                <input type="number" id="modal-lotsize" class="form-control" value="${subscription.lotSize}" min="1" max="100" required>
                <small class="form-text">Quantity will be: <span id="qty-preview">${currentQty}</span></small>
            </div>
        `;
    }

    const modalHTML = `
        <div class="modal-overlay" id="edit-subscription-modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Edit ${strategy} Subscription</h3>
                    <button class="close-btn" onclick="closeModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="edit-subscription-form">
                        <div class="form-group">
                            <label>User ID</label>
                            <input type="text" class="form-control" value="${userID}" disabled>
                        </div>
                        ${formFields}
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="closeModal()">Cancel</button>
                    <button class="btn-primary" onclick="submitEditSubscription('${strategyLower}', '${userID}')">Update Subscription</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Add event listener for lot size preview
    const lotSizeInput = document.getElementById('modal-lotsize');
    if (lotSizeInput) {
        const lotMultiplier = strategyLower === 'optiontrade' ? 75 : 35;
        lotSizeInput.addEventListener('input', (e) => {
            const qty = e.target.value * lotMultiplier;
            document.getElementById('qty-preview').textContent = qty;
        });
    }
}

// Submit edit subscription
async function submitEditSubscription(strategy, userID) {
    let data = {};

    if (strategy === 'epicrise') {
        data.capital = parseInt(document.getElementById('modal-capital').value);
    } else {
        data.lotSize = parseInt(document.getElementById('modal-lotsize').value);
    }

    try {
        const response = await AUTH_HELPER.authenticatedFetch(`${API_BASE}/api/subscriptions/${strategy}/${userID}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            showAlert('success', 'Subscription updated successfully!');
            closeModal();
            loadSubscriptions(strategy.charAt(0).toUpperCase() + strategy.slice(1));
        } else {
            const error = await response.json();
            showAlert('error', error.message || 'Failed to update subscription');
        }
    } catch (error) {
        showAlert('error', 'Error updating subscription: ' + error.message);
    }
}

// Delete subscription
async function deleteSubscription(strategy, userID) {
    if (!confirm('Are you sure you want to delete this subscription?')) {
        return;
    }

    const strategyLower = strategy.toLowerCase();

    try {
        const response = await AUTH_HELPER.authenticatedFetch(`${API_BASE}/api/subscriptions/${strategyLower}/${userID}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showAlert('success', 'Subscription deleted successfully');
            loadSubscriptions(strategy);
        } else {
            showAlert('error', 'Failed to delete subscription');
        }
    } catch (error) {
        console.error('Error deleting subscription:', error);
        showAlert('error', 'Failed to delete subscription');
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    loadUsers();

    // Auto-trim inputs on blur to remove spaces
    const credentialFields = ['userID', 'appKey', 'appSecret', 'totpSecret', 'password'];
    credentialFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.addEventListener('blur', function() {
                this.value = this.value.trim();
            });
            // Also trim on paste
            field.addEventListener('paste', function(e) {
                setTimeout(() => {
                    this.value = this.value.trim();
                }, 10);
            });
        }
    });

    // Clear form button
    const clearFormBtn = document.getElementById('clear-form-btn');
    if (clearFormBtn) {
        clearFormBtn.addEventListener('click', () => {
            document.getElementById('add-user-form').reset();
            document.getElementById('login-test-result').style.display = 'none';
        });
    }

    // Test login button
    const testLoginBtn = document.getElementById('test-login-btn');
    if (testLoginBtn) {
        testLoginBtn.addEventListener('click', async () => {
            const form = document.getElementById('add-user-form');

            // Validate form first
            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }

            const formData = new FormData(form);
            const userData = Object.fromEntries(formData.entries());

            // Trim all credential fields
            credentialFields.forEach(field => {
                if (userData[field]) {
                    userData[field] = userData[field].trim();
                }
            });

            const resultDiv = document.getElementById('login-test-result');
            resultDiv.style.display = 'block';
            resultDiv.style.background = '#fff3cd';
            resultDiv.style.border = '1px solid #ffc107';
            resultDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Testing login credentials...';

            try {
                const response = await AUTH_HELPER.authenticatedFetch(`${API_BASE}/api/iifl/test-login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(userData)
                });

                const result = await response.json();

                if (response.ok && result.success) {
                    resultDiv.style.background = '#d4edda';
                    resultDiv.style.border = '1px solid #28a745';
                    resultDiv.innerHTML = `
                        <i class="fas fa-check-circle" style="color: #28a745;"></i>
                        <strong>Login Test Successful!</strong><br>
                        <small>Token: ${result.token ? result.token.substring(0, 30) + '...' : 'Generated'}</small><br>
                        <small>You can now add this user.</small>
                    `;
                } else {
                    resultDiv.style.background = '#f8d7da';
                    resultDiv.style.border = '1px solid #dc3545';
                    resultDiv.innerHTML = `
                        <i class="fas fa-times-circle" style="color: #dc3545;"></i>
                        <strong>Login Test Failed!</strong><br>
                        <small>${result.error || 'Invalid credentials'}</small><br>
                        <small>Please check your credentials and try again.</small>
                    `;
                }
            } catch (error) {
                console.error('Error testing login:', error);
                resultDiv.style.background = '#f8d7da';
                resultDiv.style.border = '1px solid #dc3545';
                resultDiv.innerHTML = `
                    <i class="fas fa-times-circle" style="color: #dc3545;"></i>
                    <strong>Test Failed!</strong><br>
                    <small>${error.message}</small>
                `;
            }
        });
    }

    // Add user form submission
    document.getElementById('add-user-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = new FormData(e.target);
        const userData = Object.fromEntries(formData.entries());

        // Trim all credential fields before submission
        credentialFields.forEach(field => {
            if (userData[field]) {
                userData[field] = userData[field].trim();
            }
        });

        // Additional validation
        if (userData.userID.includes(' ')) {
            showAlert('error', 'User ID cannot contain spaces');
            return;
        }

        if (userData.phoneNumber && !userData.phoneNumber.match(/^[+0-9]+$/)) {
            showAlert('error', 'Phone number can only contain + and numbers');
            return;
        }

        try {
            const response = await AUTH_HELPER.authenticatedFetch(`${API_BASE}/api/iifl/add-user`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userData)
            });

            const result = await response.json();

            if (response.ok) {
                showAlert('success', 'User added successfully!');
                e.target.reset();
                document.getElementById('login-test-result').style.display = 'none';
                switchTab('users');
            } else {
                showAlert('error', result.error || 'Failed to add user');
            }
        } catch (error) {
            console.error('Error adding user:', error);
            showAlert('error', 'Failed to add user');
        }
    });
});

