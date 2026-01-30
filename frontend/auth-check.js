// Auth Check - Run on every protected page

// Check authentication status
async function checkAuth() {
    try {
        const response = await fetch('/api/auth/check');
        const data = await response.json();
        
        if (!data.authenticated) {
            // Not logged in - redirect to login
            console.log('❌ Not authenticated, redirecting to login...');
            window.location.href = '/login';
            return null;
        }
        
        return data;
    } catch (error) {
        console.error('Auth check failed:', error);
        window.location.href = '/login';
        return null;
    }
}

// Get full user info
async function getUserInfo() {
    try {
        const response = await fetch('/api/auth/me');
        if (!response.ok) {
            throw new Error('Not authenticated');
        }
        return await response.json();
    } catch (error) {
        console.error('Get user info failed:', error);
        window.location.href = '/login';
        return null;
    }
}

// Display user info in navbar
function displayUserInfo(userName, userPicture) {
    const navActions = document.querySelector('.nav-actions');
    if (!navActions) return;
    
    // Keep existing buttons and add user info at the beginning
    const existingHTML = navActions.innerHTML;
    
    navActions.innerHTML = `
        <div class="user-info">
            ${userPicture ? `<img src="${userPicture}" alt="${userName}" class="user-avatar">` : ''}
            <span class="user-name">${userName}</span>
        </div>
        <a href="/dashboard.html" class="nav-cta secondary">
            <i class="fas fa-chart-line"></i>
            <span>Dashboard</span>
        </a>
        <a href="/logout" class="nav-cta secondary">
            <i class="fas fa-sign-out-alt"></i>
            <span>Logout</span>
        </a>
    `;
}

// Show toast notification
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('show');
    }, 100);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Initialize auth protection on page load
function initAuthProtection() {
    return new Promise((resolve, reject) => {
        // Immediately check auth when script loads
        checkAuth().then(authData => {
            if (authData && authData.authenticated) {
                resolve(authData);
            } else {
                // Will redirect, but reject promise
                reject('Not authenticated');
            }
        }).catch(reject);
    });
}