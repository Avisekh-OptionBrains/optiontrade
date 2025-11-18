// Login page JavaScript
const API_BASE = window.location.origin;

let userEmail = '';

// Show alert message
function showAlert(message, type = 'info') {
    const alert = document.getElementById('alert');
    alert.className = `alert alert-${type} show`;
    alert.innerHTML = `
        <i class="fas fa-${type === 'error' ? 'exclamation-circle' : type === 'success' ? 'check-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    // Auto-hide after 5 seconds for success messages
    if (type === 'success') {
        setTimeout(() => {
            alert.classList.remove('show');
        }, 5000);
    }
}

// Hide alert
function hideAlert() {
    const alert = document.getElementById('alert');
    alert.classList.remove('show');
}

// Show step
function showStep(stepNumber) {
    document.querySelectorAll('.step').forEach(step => {
        step.classList.remove('active');
    });
    document.getElementById(`step${stepNumber}`).classList.add('active');
    hideAlert();
}

// Set button loading state
function setButtonLoading(button, loading) {
    if (loading) {
        button.disabled = true;
        const originalContent = button.innerHTML;
        button.dataset.originalContent = originalContent;
        button.innerHTML = '<div class="spinner"></div><span>Processing...</span>';
    } else {
        button.disabled = false;
        button.innerHTML = button.dataset.originalContent || button.innerHTML;
    }
}

// Step 1: Verify Email
document.getElementById('emailForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value.trim();
    const btn = document.getElementById('verifyEmailBtn');
    
    setButtonLoading(btn, true);
    hideAlert();
    
    try {
        const response = await fetch(`${API_BASE}/api/auth/verify-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            userEmail = email;
            showAlert('Email verified successfully!', 'success');
            setTimeout(() => showStep(2), 1000);
        } else {
            showAlert(data.error || 'Email verification failed', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showAlert('Network error. Please try again.', 'error');
    } finally {
        setButtonLoading(btn, false);
    }
});

// Step 2: Send OTP
document.getElementById('sendOtpBtn').addEventListener('click', async () => {
    const btn = document.getElementById('sendOtpBtn');
    
    setButtonLoading(btn, true);
    hideAlert();
    
    try {
        const response = await fetch(`${API_BASE}/api/auth/send-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: userEmail })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            showAlert('OTP sent successfully! Check your email.', 'success');
            setTimeout(() => showStep(3), 1500);
        } else {
            showAlert(data.error || 'Failed to send OTP', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showAlert('Network error. Please try again.', 'error');
    } finally {
        setButtonLoading(btn, false);
    }
});

// Step 3: Verify OTP and Login
document.getElementById('otpForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const otp = document.getElementById('otp').value.trim();
    const btn = document.getElementById('loginBtn');
    
    if (otp.length !== 6) {
        showAlert('Please enter a valid 6-digit OTP', 'error');
        return;
    }
    
    setButtonLoading(btn, true);
    hideAlert();
    
    try {
        const response = await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: userEmail, otp })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            // Store token in localStorage and cookie
            localStorage.setItem('authToken', data.token);
            localStorage.setItem('userEmail', data.email);
            document.cookie = `authToken=${data.token}; path=/; max-age=86400`; // 24 hours
            
            showAlert('Login successful! Redirecting...', 'success');
            
            // Redirect to dashboard after 1 second
            setTimeout(() => {
                window.location.href = '/index.html';
            }, 1000);
        } else {
            showAlert(data.error || 'Login failed', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showAlert('Network error. Please try again.', 'error');
    } finally {
        setButtonLoading(btn, false);
    }
});

// Resend OTP
document.getElementById('resendOtpBtn').addEventListener('click', async () => {
    const btn = document.getElementById('resendOtpBtn');
    
    setButtonLoading(btn, true);
    hideAlert();
    
    try {
        const response = await fetch(`${API_BASE}/api/auth/send-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: userEmail })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            showAlert('New OTP sent successfully! Check your email.', 'success');
            document.getElementById('otp').value = '';
        } else {
            showAlert(data.error || 'Failed to resend OTP', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showAlert('Network error. Please try again.', 'error');
    } finally {
        setButtonLoading(btn, false);
    }
});

// Check if already logged in
window.addEventListener('load', () => {
    const token = localStorage.getItem('authToken');
    if (token) {
        // Verify token is still valid
        fetch(`${API_BASE}/api/auth/verify`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                window.location.href = '/index.html';
            }
        })
        .catch(() => {
            // Token invalid, stay on login page
        });
    }
});

