/**
 * TranscribeFlow — Shared Sidebar Navigation
 * Include this script on every app page (upload, dashboard, results, user).
 * The sidebar HTML is injected dynamically so each page only needs:
 *   <script src="/static/sidebar.js"></script>
 */

(function () {
    'use strict';

    // ── Navigation items ──────────────────────────────────────────────
    const NAV_ITEMS = [
        { icon: 'fas fa-home', label: 'Home', href: '/', tooltip: 'Home' },
        { icon: 'fas fa-cloud-upload-alt', label: 'Upload', href: '/upload', tooltip: 'Upload Audio' },
        { icon: 'fas fa-chart-pie', label: 'Dashboard', href: '/dashboard', tooltip: 'Dashboard' },
        { icon: 'fas fa-history', label: 'History', href: '/history', tooltip: 'File History' },
    ];

    // ── Inject sidebar HTML ───────────────────────────────────────────
    function buildSidebar() {
        // Sidebar
        const sidebar = document.createElement('aside');
        sidebar.className = 'sidebar';
        sidebar.id = 'appSidebar';

        // Backdrop
        const backdrop = document.createElement('div');
        backdrop.className = 'sidebar-backdrop';
        backdrop.id = 'sidebarBackdrop';

        // Current path for active highlighting
        const currentPath = window.location.pathname.replace(/\/+$/, '') || '/';

        // Build inner HTML
        sidebar.innerHTML = `
      <!-- Header -->
      <div class="sidebar-header">
        <div class="sidebar-brand">
          <div class="brand-icon"><i class="fas fa-wave-square"></i></div>
          <span class="brand-text">Transcribe<span class="brand-accent">Flow</span></span>
        </div>
      </div>

      <!-- Navigation -->
      <nav class="sidebar-nav">
        <div class="sidebar-section-label">Navigation</div>
        ${NAV_ITEMS.map(item => {
            const isActive = currentPath === item.href ||
                (item.href !== '/' && currentPath.startsWith(item.href));
            return `
            <a href="${item.href}"
               class="sidebar-link${isActive ? ' active' : ''}"
               data-tooltip="${item.tooltip}">
              <span class="sidebar-link-icon"><i class="${item.icon}"></i></span>
              <span class="sidebar-link-text">${item.label}</span>
            </a>`;
        }).join('')}
      </nav>

      <!-- Footer / User Section -->
      <div class="sidebar-footer">
        <div class="sidebar-user">
          <div class="sidebar-user-avatar"><i class="fas fa-user-circle"></i></div>
          <div class="sidebar-user-info">
            <span class="sidebar-user-name" id="sidebarUsername">Loading...</span>
            <span class="sidebar-user-role">Member</span>
          </div>
        </div>
        <div class="sidebar-footer-links">
          <a href="/user" class="sidebar-footer-link${currentPath === '/user' ? ' active' : ''}" data-tooltip="Edit Profile">
            <span class="sidebar-link-icon"><i class="fas fa-cog"></i></span>
            <span class="sidebar-link-text">Edit Profile</span>
          </a>
          <button class="sidebar-footer-link logout-btn" id="sidebarLogout" data-tooltip="Logout">
            <span class="sidebar-link-icon"><i class="fas fa-sign-out-alt"></i></span>
            <span class="sidebar-link-text">Logout</span>
          </button>
        </div>
      </div>
    `;

        // Insert sidebar and backdrop as first children of body
        document.body.prepend(backdrop);
        document.body.prepend(sidebar);

        // Add sidebar class to app container
        const appContainer = document.querySelector('.app-container');
        if (appContainer) {
            appContainer.classList.add('has-sidebar');
        }

        return { sidebar, backdrop };
    }

    // ── Toggle expand / collapse ──────────────────────────────────────
    function initToggle(sidebar, backdrop) {

        function expand() {
            sidebar.classList.add('expanded');
            backdrop.classList.add('visible');
        }

        function collapse(e) {
            // Prevent event bubbling if triggered from internal click
            if (e) e.stopPropagation();
            sidebar.classList.remove('expanded');
            backdrop.classList.remove('visible');
        }

        function toggle() {
            if (sidebar.classList.contains('expanded')) {
                collapse();
            } else {
                expand();
            }
        }

        // Click anywhere on sidebar opens it if it's collapsed
        sidebar.addEventListener('click', (e) => {
            // If sidebar is NOT expanded, expand it
            if (!sidebar.classList.contains('expanded')) {
                expand();
            }
        });

        // Clicking backdrop closes sidebar
        backdrop.addEventListener('click', collapse);

        // Calculate if we need to close based on internal clicks?
        // Actually, request says "make the sidebar open when user clicks anywhere on the colapsed sidebar."
        // Usually, when expanded, we might want to keep it open unless backdrop is clicked.
        // But if user clicks a link, they navigate away anyway.

        // Escape key closes sidebar
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && sidebar.classList.contains('expanded')) {
                collapse();
            }
        });
    }

    // ── Fetch and display username ────────────────────────────────────
    async function loadUsername() {
        const el = document.getElementById('sidebarUsername');
        const token = localStorage.getItem('access_token');
        if (!token) {
            if (el) el.textContent = 'Guest';
            return;
        }

        try {
            const res = await fetch('/api/auth/me', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.status === 401) {
                if (el) el.textContent = 'Guest';
                return;
            }

            const data = await res.json();
            if (el) el.textContent = data.username || 'User';

            // Also update any legacy #currentUsername element on the page
            const legacy = document.getElementById('currentUsername');
            if (legacy) legacy.textContent = data.username || 'User';
        } catch {
            if (el) el.textContent = 'User';
        }
    }

    // ── Logout ────────────────────────────────────────────────────────
    function initLogout() {
        const logoutBtn = document.getElementById('sidebarLogout');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                localStorage.removeItem('access_token');
                window.location.href = '/login';
            });
        }
    }

    // ── Shared fetchWithAuth (can be used by other scripts) ───────────
    // Expose globally so page-specific JS can use it
    if (typeof window.fetchWithAuth === 'undefined') {
        window.fetchWithAuth = async function (url, options = {}) {
            const token = localStorage.getItem('access_token');
            const headers = {
                ...options.headers,
                'Authorization': `Bearer ${token}`
            };

            const response = await fetch(url, { ...options, headers });

            if (response.status === 401) {
                localStorage.removeItem('access_token');
                window.location.href = '/login';
                return;
            }

            return response;
        };
    }

    // Expose logout globally too
    if (typeof window.logout === 'undefined') {
        window.logout = function () {
            localStorage.removeItem('access_token');
            window.location.href = '/login';
        };
    }

    // ── Init ──────────────────────────────────────────────────────────
    function init() {
        const { sidebar, backdrop } = buildSidebar();
        initToggle(sidebar, backdrop);
        initLogout();
        loadUsername();
    }

    // Run after DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
