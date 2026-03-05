/**
 * TranscribeFlow — Shared Sidebar Navigation
 * Include this script on every app page (upload, dashboard, results, user).
 * The sidebar HTML is injected dynamically so each page only needs:
 *   <script src="/static/sidebar.js"></script>
 */

(function () {
    'use strict';

    // ── Navigation items ──────────────────────────────────────────────
    /**
     * Configuration for sidebar navigation links.
     * Each object defines the icon (Font Awesome class),
     * label text, destination URL, and tooltip text.
     */
    const NAV_ITEMS = [
        { icon: 'fas fa-home', label: 'Home', href: '/', tooltip: 'Home' },
        { icon: 'fas fa-cloud-upload-alt', label: 'Upload', href: '/upload', tooltip: 'Upload Audio' },
        { icon: 'fas fa-chart-pie', label: 'Dashboard', href: '/dashboard', tooltip: 'Dashboard' },
        { icon: 'fas fa-history', label: 'History', href: '/history', tooltip: 'File History' },
    ];

    // ── Inject sidebar HTML ───────────────────────────────────────────
    /**
     * Dynamically constructs and inserts the sidebar into the page.
     * This ensures that all pages share the same navigation structure
     * without duplicating HTML across multiple templates.
     */
    function buildSidebar() {

        // Create sidebar container
        const sidebar = document.createElement('aside');
        sidebar.className = 'sidebar';
        sidebar.id = 'appSidebar';

        // Create backdrop overlay (used when sidebar expands)
        const backdrop = document.createElement('div');
        backdrop.className = 'sidebar-backdrop';
        backdrop.id = 'sidebarBackdrop';

        // Determine current path to highlight active navigation item
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

            /**
             * Determines if a navigation item should be highlighted
             * as active based on the current page URL.
             */
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

          <!-- Link to profile editing page -->
          <a href="/user" class="sidebar-footer-link${currentPath === '/user' ? ' active' : ''}" data-tooltip="Edit Profile">
            <span class="sidebar-link-icon"><i class="fas fa-cog"></i></span>
            <span class="sidebar-link-text">Edit Profile</span>
          </a>

          <!-- Logout button -->
          <button class="sidebar-footer-link logout-btn" id="sidebarLogout" data-tooltip="Logout">
            <span class="sidebar-link-icon"><i class="fas fa-sign-out-alt"></i></span>
            <span class="sidebar-link-text">Logout</span>
          </button>

        </div>
      </div>
    `;

        // Insert sidebar and backdrop as first elements in the body
        document.body.prepend(backdrop);
        document.body.prepend(sidebar);

        /**
         * If the page contains a main container element,
         * attach a class to adjust layout spacing for the sidebar.
         */
        const appContainer = document.querySelector('.app-container');
        if (appContainer) {
            appContainer.classList.add('has-sidebar');
        }

        return { sidebar, backdrop };
    }

    // ── Toggle expand / collapse ──────────────────────────────────────
    /**
     * Initializes sidebar expand/collapse interactions.
     * Handles clicking the sidebar, clicking the backdrop,
     * and closing the sidebar via the Escape key.
     */
    function initToggle(sidebar, backdrop) {

        // Expand sidebar
        function expand() {
            sidebar.classList.add('expanded');
            backdrop.classList.add('visible');
        }

        // Collapse sidebar
        function collapse(e) {
            // Prevent event bubbling if triggered internally
            if (e) e.stopPropagation();

            sidebar.classList.remove('expanded');
            backdrop.classList.remove('visible');
        }

        // Toggle sidebar state
        function toggle() {
            if (sidebar.classList.contains('expanded')) {
                collapse();
            } else {
                expand();
            }
        }

        /**
         * Clicking anywhere on the collapsed sidebar expands it.
         * This improves usability for narrow sidebar layouts.
         */
        sidebar.addEventListener('click', (e) => {
            if (!sidebar.classList.contains('expanded')) {
                expand();
            }
        });

        // Clicking the backdrop closes the sidebar
        backdrop.addEventListener('click', collapse);

        /**
         * Allow users to close the sidebar using the Escape key.
         */
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && sidebar.classList.contains('expanded')) {
                collapse();
            }
        });
    }

    // ── Fetch and display username ────────────────────────────────────
    /**
     * Retrieves the logged-in user's username from the backend
     * using the stored JWT access token.
     * Updates the sidebar user display accordingly.
     */
    async function loadUsername() {
        const el = document.getElementById('sidebarUsername');
        const token = localStorage.getItem('access_token');

        // If user is not logged in, show Guest
        if (!token) {
            if (el) el.textContent = 'Guest';
            return;
        }

        try {
            const res = await fetch('/api/auth/me', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            // If token is invalid or expired
            if (res.status === 401) {
                if (el) el.textContent = 'Guest';
                return;
            }

            const data = await res.json();

            if (el) el.textContent = data.username || 'User';

            /**
             * Also update legacy username element if present
             * for backward compatibility with older templates.
             */
            const legacy = document.getElementById('currentUsername');
            if (legacy) legacy.textContent = data.username || 'User';

        } catch {
            // Fallback display if API request fails
            if (el) el.textContent = 'User';
        }
    }

    // ── Logout ────────────────────────────────────────────────────────
    /**
     * Initializes logout functionality.
     * Removes authentication token and redirects user to login page.
     */
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
    /**
     * Global helper for making authenticated API requests.
     * Automatically attaches the JWT token in the Authorization header.
     * If the request returns 401 (unauthorized), the user is logged out.
     */
    if (typeof window.fetchWithAuth === 'undefined') {
        window.fetchWithAuth = async function (url, options = {}) {

            const token = localStorage.getItem('access_token');

            const headers = {
                ...options.headers,
                'Authorization': `Bearer ${token}`
            };

            const response = await fetch(url, { ...options, headers });

            // Automatically handle expired tokens
            if (response.status === 401) {
                localStorage.removeItem('access_token');
                window.location.href = '/login';
                return;
            }

            return response;
        };
    }

    // Expose logout globally too
    /**
     * Global logout utility that can be called from any script.
     */
    if (typeof window.logout === 'undefined') {
        window.logout = function () {
            localStorage.removeItem('access_token');
            window.location.href = '/login';
        };
    }

    // ── Init ──────────────────────────────────────────────────────────
    /**
     * Initializes the sidebar system:
     * 1. Builds and injects sidebar HTML
     * 2. Enables sidebar toggle behavior
     * 3. Loads username
     * 4. Enables logout button
     */
    function init() {
        const { sidebar, backdrop } = buildSidebar();
        initToggle(sidebar, backdrop);
        initLogout();
        loadUsername();
    }

    /**
     * Ensure initialization runs after the DOM is ready.
     */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();