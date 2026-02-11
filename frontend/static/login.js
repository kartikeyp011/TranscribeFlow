// ===== LOGIN PAGE JAVASCRIPT =====

// Toggle password visibility
function togglePasswordVisibility() {
    const passwordInput = document.getElementById('password');
    const toggleBtn = document.querySelector('.toggle-password i');

    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleBtn.classList.remove('fa-eye');
        toggleBtn.classList.add('fa-eye-slash');
    } else {
        passwordInput.type = 'password';
        toggleBtn.classList.remove('fa-eye-slash');
        toggleBtn.classList.add('fa-eye');
    }
}

// Mobile menu toggle
document.addEventListener('DOMContentLoaded', function () {
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    const navActions = document.querySelector('.nav-actions');

    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', function () {
            navActions.classList.toggle('show');
        });
    }

    // Adjust nav links for mobile
    function handleResize() {
        if (window.innerWidth <= 768) {
            if (navActions) {
                navActions.style.display = 'none';
                navActions.style.flexDirection = 'column';
                navActions.style.position = 'absolute';
                navActions.style.top = '100%';
                navActions.style.left = '0';
                navActions.style.right = '0';
                navActions.style.background = 'rgba(8, 12, 25, 0.95)';
                navActions.style.backdropFilter = 'blur(20px)';
                navActions.style.padding = '1rem';
                navActions.style.borderTop = '1px solid rgba(94, 234, 212, 0.2)';
                navActions.style.borderBottom = '1px solid rgba(94, 234, 212, 0.2)';
                navActions.style.gap = '0.5rem';
                navActions.style.zIndex = '100';
            }
        } else {
            if (navActions) {
                navActions.style.display = 'flex';
                navActions.style.position = 'relative';
                navActions.style.top = 'auto';
                navActions.style.left = 'auto';
                navActions.style.right = 'auto';
                navActions.style.background = 'transparent';
                navActions.style.backdropFilter = 'none';
                navActions.style.padding = '0';
                navActions.style.borderTop = 'none';
                navActions.style.borderBottom = 'none';
                navActions.style.flexDirection = 'row';
                navActions.style.gap = '1rem';
            }
        }
    }

    // Initial call
    handleResize();

    // Add resize listener
    window.addEventListener('resize', handleResize);
});

// Login form submission
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    const loginBtn = document.getElementById('loginBtn');
    const errorMsg = document.getElementById('errorMessage');
    const errorText = document.getElementById('errorText');
    const successMsg = document.getElementById('successMessage');
    const successText = document.getElementById('successText');

    // Hide previous messages
    errorMsg.style.display = 'none';
    successMsg.style.display = 'none';

    // Show loading state
    loginBtn.classList.add('loading');
    loginBtn.disabled = true;

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            // Store token in localStorage
            localStorage.setItem('access_token', data.access_token);
            localStorage.setItem('token_type', data.token_type);

            // Show success message
            successText.textContent = 'Login successful! Redirecting...';
            successMsg.style.display = 'flex';

            setTimeout(() => {
                window.location.href = '/upload';
            }, 500);
        } else {
            errorText.textContent = data.detail || 'Invalid username or password';
            errorMsg.style.display = 'flex';

            loginBtn.classList.remove('loading');
            loginBtn.disabled = false;
        }
    } catch (error) {
        console.error('Login error:', error);
        errorText.textContent = 'Network error. Please try again.';
        errorMsg.style.display = 'flex';

        loginBtn.classList.remove('loading');
        loginBtn.disabled = false;
    }
});

// Clear any existing tokens on page load
localStorage.removeItem('access_token');
localStorage.removeItem('token_type');

// Demo credentials shortcut (Ctrl+Shift+D)
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        document.getElementById('username').value = 'demo@transcribeflow.com';
        document.getElementById('password').value = 'demo123';
    }
});