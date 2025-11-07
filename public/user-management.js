// User Management JavaScript
class UserManagement {
    constructor() {
        this.users = [];
        this.filteredUsers = [];
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadUsers();
        this.loadStatistics();
    }

    setupEventListeners() {
        // Broker selection change
        document.getElementById('brokerSelect').addEventListener('change', (e) => {
            this.toggleBrokerFields(e.target.value);
        });

        // Search and filter inputs
        document.getElementById('searchInput').addEventListener('input', () => {
            this.applyFilters();
        });

        document.getElementById('brokerFilter').addEventListener('change', () => {
            this.applyFilters();
        });

        document.getElementById('statusFilter').addEventListener('change', () => {
            this.applyFilters();
        });

        // Form submission
        document.getElementById('addUserForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveUser();
        });

        // Global functions
        window.applyFilters = () => this.applyFilters();
        window.saveUser = () => this.saveUser();
        window.editUser = (id) => this.editUser(id);
        window.deleteUser = (id) => this.deleteUser(id);
        window.toggleUserStatus = (id) => this.toggleUserStatus(id);
    }

    toggleBrokerFields(broker) {
        const motilalFields = document.getElementById('motilalFields');
        const dhanFields = document.getElementById('dhanFields');
        const shareKhanFields = document.getElementById('shareKhanFields');
        const shareKhanFields2 = document.getElementById('shareKhanFields2');
        const iiflFields = document.getElementById('iiflFields');
        const iiflFields2 = document.getElementById('iiflFields2');
        const iiflFields3 = document.getElementById('iiflFields3');
        const iiflFields4 = document.getElementById('iiflFields4');

        // Hide all broker-specific fields first
        motilalFields.style.display = 'none';
        dhanFields.style.display = 'none';
        shareKhanFields.style.display = 'none';
        shareKhanFields2.style.display = 'none';
        iiflFields.style.display = 'none';
        iiflFields2.style.display = 'none';
        iiflFields3.style.display = 'none';
        iiflFields4.style.display = 'none';

        // Reset all field requirements
        document.getElementById('twoFA').required = false;
        document.getElementById('dhanClientId').required = false;
        document.getElementById('jwtToken').required = false;
        document.getElementById('shareKhanUserId').required = false;
        document.getElementById('shareKhanApiKey').required = false;
        document.getElementById('shareKhanVendorKey').required = false;
        document.getElementById('iiflUserID').required = false;
        document.getElementById('iiflPassword').required = false;
        document.getElementById('iiflAppKey').required = false;
        document.getElementById('iiflAppSecret').required = false;
        document.getElementById('iiflTotpSecret').required = false;

        // Hide/show common fields based on broker
        const commonUserPasswordRow = document.getElementById('commonUserPasswordRow');
        const commonApiTotpRow = document.getElementById('commonApiTotpRow');

        if (broker === 'MOTILAL') {
            motilalFields.style.display = 'block';
            commonUserPasswordRow.style.display = 'block';
            commonApiTotpRow.style.display = 'block';
            document.getElementById('twoFA').required = true;
        } else if (broker === 'ANGEL') {
            commonUserPasswordRow.style.display = 'block';
            commonApiTotpRow.style.display = 'block';
        } else if (broker === 'DHAN') {
            dhanFields.style.display = 'block';
            commonUserPasswordRow.style.display = 'none';
            commonApiTotpRow.style.display = 'none';
            document.getElementById('dhanClientId').required = true;
            document.getElementById('jwtToken').required = true;
        } else if (broker === 'SHAREKHAN') {
            shareKhanFields.style.display = 'block';
            shareKhanFields2.style.display = 'block';
            commonUserPasswordRow.style.display = 'none';
            commonApiTotpRow.style.display = 'none';
            document.getElementById('shareKhanUserId').required = true;
            document.getElementById('shareKhanApiKey').required = true;
        } else if (broker === 'IIFL') {
            iiflFields.style.display = 'block';
            iiflFields2.style.display = 'block';
            iiflFields3.style.display = 'block';
            iiflFields4.style.display = 'block';
            commonUserPasswordRow.style.display = 'none';
            commonApiTotpRow.style.display = 'none';
            document.getElementById('iiflUserID').required = true;
            document.getElementById('iiflPassword').required = true;
            document.getElementById('iiflAppKey').required = true;
            document.getElementById('iiflAppSecret').required = true;
            document.getElementById('iiflTotpSecret').required = true;
        } else {
            // Default case - show common fields
            commonUserPasswordRow.style.display = 'block';
            commonApiTotpRow.style.display = 'block';
        }
    }

    async loadUsers() {
        try {
            // Load Angel users
            const angelResponse = await fetch('/api/users/angel');
            const angelUsers = angelResponse.ok ? await angelResponse.json() : [];

            // Load Motilal users
            const motilalResponse = await fetch('/api/users/motilal');
            const motilalUsers = motilalResponse.ok ? await motilalResponse.json() : [];

            // Load Dhan users
            const dhanResponse = await fetch('/api/users/dhan');
            const dhanUsers = dhanResponse.ok ? await dhanResponse.json() : [];

            // Load ShareKhan users
            const shareKhanResponse = await fetch('/api/users/sharekhan');
            const shareKhanUsers = shareKhanResponse.ok ? await shareKhanResponse.json() : [];

            // Load IIFL users
            const iiflResponse = await fetch('/api/users/iifl');
            const iiflUsers = iiflResponse.ok ? await iiflResponse.json() : [];

            // Combine and format users
            this.users = [
                ...angelUsers.map(user => ({ ...user, broker: 'ANGEL', type: 'angel' })),
                ...motilalUsers.map(user => ({ ...user, broker: 'MOTILAL', type: 'motilal' })),
                ...dhanUsers.map(user => ({ ...user, broker: 'DHAN', type: 'dhan' })),
                ...shareKhanUsers.map(user => ({ ...user, broker: 'SHAREKHAN', type: 'sharekhan' })),
                ...iiflUsers.map(user => ({ ...user, broker: 'IIFL', type: 'iifl' }))
            ];

            this.filteredUsers = [...this.users];
            this.renderUsersTable();
        } catch (error) {
            console.error('Error loading users:', error);
            this.showError('Failed to load users');
        }
    }

    async loadStatistics() {
        try {
            const response = await fetch('/api/users/stats/summary');
            const data = await response.json();

            document.getElementById('totalClients').textContent = data.totalUsers || 0;
            document.getElementById('angelClients').textContent = data.angelUsers || 0;
            document.getElementById('motilalClients').textContent = data.motilalUsers || 0;
            document.getElementById('dhanClients').textContent = data.dhanUsers || 0;
            document.getElementById('shareKhanClients').textContent = data.shareKhanUsers || 0;
            document.getElementById('iiflClients').textContent = data.iiflUsers || 0;
            document.getElementById('activeClients').textContent = data.activeUsers || 0;
        } catch (error) {
            console.error('Error loading statistics:', error);
        }
    }

    applyFilters() {
        const searchTerm = document.getElementById('searchInput').value.toLowerCase();
        const brokerFilter = document.getElementById('brokerFilter').value;
        const statusFilter = document.getElementById('statusFilter').value;

        this.filteredUsers = this.users.filter(user => {
            const matchesSearch = !searchTerm || 
                user.clientName.toLowerCase().includes(searchTerm) ||
                user.userId.toLowerCase().includes(searchTerm);

            const matchesBroker = !brokerFilter || user.broker === brokerFilter;

            const matchesStatus = !statusFilter || 
                (statusFilter === 'active' && this.isUserActive(user)) ||
                (statusFilter === 'inactive' && !this.isUserActive(user));

            return matchesSearch && matchesBroker && matchesStatus;
        });

        this.renderUsersTable();
    }

    isUserActive(user) {
        // Check if user has required tokens/credentials
        if (user.broker === 'ANGEL') {
            return !!(user.jwtToken && user.apiKey);
        } else if (user.broker === 'MOTILAL') {
            return !!(user.authToken && user.apiKey);
        } else if (user.broker === 'DHAN') {
            return !!(user.jwtToken && user.dhanClientId);
        } else if (user.broker === 'SHAREKHAN') {
            return !!(user.accessToken && user.apiKey);
        } else if (user.broker === 'IIFL') {
            return !!(user.token && user.appKey);
        }
        return false;
    }

    renderUsersTable() {
        const tbody = document.getElementById('usersTableBody');

        if (this.filteredUsers.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-4 text-muted">
                        <i class="fas fa-users fa-2x mb-2"></i><br>
                        No clients found
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.filteredUsers.map(user => `
            <tr class="animate__animated animate__fadeInUp">
                <td>
                    <div class="d-flex align-items-center">
                        <div class="avatar-sm bg-primary rounded-circle d-flex align-items-center justify-content-center me-2">
                            <i class="fas fa-user text-white"></i>
                        </div>
                        <div>
                            <div class="fw-bold">${user.clientName}</div>
                            <small class="text-muted">${user.email}</small>
                        </div>
                    </div>
                </td>
                <td>
                    <span class="font-monospace">${user.userId}</span>
                </td>
                <td>
                    <span class="broker-badge ${user.broker === 'ANGEL' ? 'broker-angel' : user.broker === 'DHAN' ? 'broker-dhan' : user.broker === 'SHAREKHAN' ? 'broker-sharekhan' : user.broker === 'IIFL' ? 'broker-iifl' : 'broker-motilal'}">
                        ${user.broker}
                    </span>
                </td>
                <td>
                    <span class="fw-bold text-success">₹${user.capital.toLocaleString()}</span>
                </td>
                <td>
                    <span class="status-badge ${this.isUserActive(user) ? 'status-active' : 'status-inactive'}">
                        ${this.isUserActive(user) ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td>
                    <span class="text-muted">${this.formatDate(user.updatedAt || user.createdAt)}</span>
                </td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary" onclick="editUser('${user._id}')" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-outline-${this.isUserActive(user) ? 'warning' : 'success'}" 
                                onclick="toggleUserStatus('${user._id}')" 
                                title="${this.isUserActive(user) ? 'Deactivate' : 'Activate'}">
                            <i class="fas fa-${this.isUserActive(user) ? 'pause' : 'play'}"></i>
                        </button>
                        <button class="btn btn-outline-danger" onclick="deleteUser('${user._id}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    formatDate(dateString) {
        if (!dateString) return 'Never';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    async saveUser() {
        try {
            const formData = this.getFormData();
            
            if (!this.validateFormData(formData)) {
                return;
            }

            const broker = formData.broker;
            let endpoint;
            if (broker === 'ANGEL') {
                endpoint = '/addAngeluser';
            } else if (broker === 'DHAN') {
                endpoint = '/addDhanuser';
            } else if (broker === 'SHAREKHAN') {
                endpoint = '/addShareKhanuser';
            } else if (broker === 'IIFL') {
                endpoint = '/addIIFLuser';
            } else {
                endpoint = '/api/users/save-auth-token';
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                this.showSuccess('Client added successfully!');
                this.resetForm();
                this.closeModal();
                this.loadUsers();
                this.loadStatistics();
            } else {
                const error = await response.json();
                this.showError(error.error || 'Failed to add client');
            }
        } catch (error) {
            console.error('Error saving user:', error);
            this.showError('Failed to add client');
        }
    }

    getFormData() {
        const broker = document.getElementById('brokerSelect').value;

        // Common fields for all brokers
        const data = {
            broker: broker,
            clientName: document.getElementById('clientName').value,
            email: document.getElementById('email').value,
            phoneNumber: document.getElementById('phoneNumber').value,
            capital: parseInt(document.getElementById('capital').value),
            state: 'live'
        };

        // Add broker-specific fields
        if (broker === 'ANGEL' || broker === 'MOTILAL') {
            data.userId = document.getElementById('userId').value;
            data.password = document.getElementById('password').value;
            data.apiKey = document.getElementById('apiKey').value;
            data.totpKey = document.getElementById('totpKey').value;
            if (broker === 'MOTILAL') {
                data.twoFA = document.getElementById('twoFA').value;
            }
        } else if (broker === 'DHAN') {
            data.dhanClientId = document.getElementById('dhanClientId').value;
            data.jwtToken = document.getElementById('jwtToken').value;
        } else if (broker === 'SHAREKHAN') {
            data.userId = document.getElementById('shareKhanUserId').value;
            data.apiKey = document.getElementById('shareKhanApiKey').value;
            data.vendorKey = document.getElementById('shareKhanVendorKey').value;
        } else if (broker === 'IIFL') {
            data.userID = document.getElementById('iiflUserID').value;
            data.password = document.getElementById('iiflPassword').value;
            data.appKey = document.getElementById('iiflAppKey').value;
            data.appSecret = document.getElementById('iiflAppSecret').value;
            data.totpSecret = document.getElementById('iiflTotpSecret').value;
            data.accessToken = document.getElementById('iiflAccessToken').value;
        }

        return data;
    }

    validateFormData(data) {
        console.log('Validating form data:', data); // Debug log

        if (!data.broker) {
            this.showError('Please select a broker');
            return false;
        }

        // Basic required fields for all brokers
        if (!data.clientName || !data.email || !data.phoneNumber) {
            this.showError('Please fill in all required fields (Client Name, Email, Phone Number)');
            return false;
        }

        // Validate common fields only for brokers that use them (Angel, Motilal)
        if ((data.broker === 'ANGEL' || data.broker === 'MOTILAL') &&
            (!data.userId || !data.password || !data.apiKey || !data.totpKey)) {
            this.showError('Please fill in all required fields (User ID, Password, API Key, TOTP Key)');
            return false;
        }

        if (isNaN(data.capital) || data.capital < 1000) {
            this.showError('Capital must be at least ₹1,000');
            return false;
        }

        if (data.broker === 'MOTILAL' && !data.twoFA) {
            this.showError('2FA is required for Motilal Oswal clients');
            return false;
        }

        if (data.broker === 'DHAN') {
            if (!data.dhanClientId) {
                this.showError('Dhan Client ID is required for Dhan clients');
                return false;
            }
            if (!data.jwtToken) {
                this.showError('JWT Token is required for Dhan clients');
                return false;
            }
        }

        if (data.broker === 'SHAREKHAN') {
            if (!data.userId) {
                this.showError('ShareKhan User ID is required for ShareKhan clients');
                return false;
            }
            if (!data.apiKey) {
                this.showError('ShareKhan API Key is required for ShareKhan clients');
                return false;
            }
            // Vendor key is optional, no validation needed
        }

        if (data.broker === 'IIFL') {
            if (!data.userID) {
                this.showError('IIFL Client ID is required for IIFL clients');
                return false;
            }
            if (!data.password) {
                this.showError('IIFL Password is required for IIFL clients');
                return false;
            }
            if (!data.appKey) {
                this.showError('IIFL App Key is required for IIFL clients');
                return false;
            }
            if (!data.appSecret) {
                this.showError('IIFL App Secret is required for IIFL clients');
                return false;
            }
            if (!data.totpSecret) {
                this.showError('IIFL TOTP Secret is required for IIFL clients');
                return false;
            }
        }

        return true;
    }

    resetForm() {
        document.getElementById('addUserForm').reset();
        this.toggleBrokerFields('');
    }

    closeModal() {
        const modal = bootstrap.Modal.getInstance(document.getElementById('addUserModal'));
        modal.hide();
    }

    editUser(userId) {
        // TODO: Implement edit functionality
        console.log('Edit user:', userId);
        this.showInfo('Edit functionality coming soon');
    }

    async deleteUser(userId) {
        if (!confirm('Are you sure you want to delete this client?')) {
            return;
        }

        try {
            // TODO: Implement delete API
            console.log('Delete user:', userId);
            this.showInfo('Delete functionality coming soon');
        } catch (error) {
            console.error('Error deleting user:', error);
            this.showError('Failed to delete client');
        }
    }

    async toggleUserStatus(userId) {
        try {
            // TODO: Implement status toggle API
            console.log('Toggle status for user:', userId);
            this.showInfo('Status toggle functionality coming soon');
        } catch (error) {
            console.error('Error toggling user status:', error);
            this.showError('Failed to update client status');
        }
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'danger');
    }

    showInfo(message) {
        this.showNotification(message, 'info');
    }

    showNotification(message, type = 'info') {
        const colors = {
            success: 'bg-success',
            danger: 'bg-danger',
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
}

// Initialize user management when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.userManagement = new UserManagement();
});
