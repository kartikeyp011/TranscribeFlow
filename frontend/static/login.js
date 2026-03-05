// ===== LOGIN PAGE JAVASCRIPT =====

/**
 * Toggles visibility of the password field.
 * This allows users to temporarily reveal the password they typed.
 * The function also switches the icon between "eye" and "eye-slash"
 * to reflect the current visibility state.
 */
function togglePasswordVisibility() {
    const passwordInput = document.getElementById('password');
    const toggleBtn = document.querySelector('.toggle-password i');

    if (passwordInput.type === 'password') {
        // Change input type to text to reveal password
        passwordInput.type = 'text';

        // Update icon to indicate password is visible
        toggleBtn.classList.remove('fa-eye');
        toggleBtn.classList.add('fa-eye-slash');
    } else {
        // Revert input type back to password to hide characters
        passwordInput.type = 'password';

        // Update icon to indicate password is hidden
        toggleBtn.classList.remove('fa-eye-slash');
        toggleBtn.classList.add('fa-eye');
    }
}

/**
 * Executes once the DOM has fully loaded.
 * Handles initialization logic for mobile navigation
 * and responsive behavior for navigation actions.
 */
document.addEventListener('DOMContentLoaded', function () {
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    const navActions = document.querySelector('.nav-actions');

    /**
     * Mobile menu toggle.
     * Shows or hides navigation action buttons when the mobile menu icon is clicked.
     */
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', function () {
            navActions.classList.toggle('show');
        });
    }

    /**
     * Adjusts navigation layout based on screen width.
     * For mobile screens (≤768px), navigation becomes a dropdown-style menu.
     * For larger screens, the navigation reverts to a horizontal layout.
     */
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
                // Restore desktop navigation layout
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

    // Run resize logic immediately when page loads
    handleResize();

    // Re-run layout adjustments whenever the window is resized
    window.addEventListener('resize', handleResize);
});

/**
 * Handles login form submission.
 * Sends user credentials to the backend authentication API
 * and manages UI states such as loading indicators,
 * success messages, and error handling.
 */
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault(); // Prevent default browser form submission

    // Retrieve user-entered credentials
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    // UI elements for status updates
    const loginBtn = document.getElementById('loginBtn');
    const errorMsg = document.getElementById('errorMessage');
    const errorText = document.getElementById('errorText');
    const successMsg = document.getElementById('successMessage');
    const successText = document.getElementById('successText');

    // Hide any previous messages before starting a new login attempt
    errorMsg.style.display = 'none';
    successMsg.style.display = 'none';

    // Activate loading state on login button
    loginBtn.classList.add('loading');
    loginBtn.disabled = true;

    try {
        /**
         * Send authentication request to the backend API.
         * Credentials are sent as JSON in the request body.
         */
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        // Parse server response
        const data = await response.json();

        if (response.ok) {
            /**
             * On successful authentication, store the returned
             * access token and token type in localStorage.
             * These tokens will be used for authenticated API requests.
             */
            localStorage.setItem('access_token', data.access_token);
            localStorage.setItem('token_type', data.token_type);

            // Display success message to the user
            successText.textContent = 'Login successful! Redirecting...';
            successMsg.style.display = 'flex';

            /**
             * Redirect user to the upload page after a short delay.
             * This gives time for the success message to appear.
             */
            setTimeout(() => {
                window.location.href = '/upload';
            }, 500);
        } else {
            /**
             * If login fails, display the error message returned
             * by the backend or a default message.
             */
            errorText.textContent = data.detail || 'Invalid username or password';
            errorMsg.style.display = 'flex';

            // Reset button state
            loginBtn.classList.remove('loading');
            loginBtn.disabled = false;
        }
    } catch (error) {
        /**
         * Handle network or unexpected errors during login.
         * Logs the error to the console for debugging and
         * shows a user-friendly error message.
         */
        console.error('Login error:', error);
        errorText.textContent = 'Network error. Please try again.';
        errorMsg.style.display = 'flex';

        // Reset button state
        loginBtn.classList.remove('loading');
        loginBtn.disabled = false;
    }
});

/**
 * Tokens were previously cleared on page load to force fresh login.
 * This behavior has been disabled to allow persistent login sessions.
 */
// localStorage.removeItem('access_token');
// localStorage.removeItem('token_type');

/**
 * Developer shortcut for quickly filling demo credentials.
 * Press Ctrl + Shift + D to auto-populate the login form with demo account data.
 * Useful for testing and demonstrations.
 */
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        document.getElementById('username').value = 'demo@transcribeflow.com';
        document.getElementById('password').value = 'demo123';
    }
});