// Dashboard JavaScript

// Global state
let allFiles = [];
let filteredFiles = [];
let currentPage = 1;
let filesPerPage = 12;
let currentFilter = 'all';
let currentView = 'grid';
let fileToDelete = null;

// Initialize dashboard
document.addEventListener('DOMContentLoaded', async function () {
    console.log('✅ Dashboard loaded');

    // Load user info
    await loadUserInfo();

    // Load files
    await loadFiles();

    // Setup event listeners
    setupEventListeners();
});

// Load user information
async function loadUserInfo() {
    try {
        const response = await fetchWithAuth('/api/auth/me');
        if (response && response.ok) {
            const user = await response.json();
            document.getElementById('currentUsername').textContent = user.username || 'User';
        }
    } catch (error) {
        console.error('Failed to load user info:', error);
    }
}

// Load all files
async function loadFiles() {
    showLoading();

    try {
        const response = await fetchWithAuth('/api/files?limit=100');

        if (response && response.ok) {
            const data = await response.json();
            allFiles = data.files || [];

            updateStats();
            applyFilters();
            renderFiles();

            hideLoading();
        } else {
            throw new Error('Failed to load files');
        }
    } catch (error) {
        console.error('Error loading files:', error);
        showToast('Failed to load files', 'error');
        hideLoading();
        showEmptyState();
    }
}

// Update statistics
function updateStats() {
    const totalFiles = allFiles.length;
    const starredFiles = allFiles.filter(f => f.is_starred).length;

    // Count unique languages
    const languages = new Set(allFiles.map(f => f.language));
    const languagesCount = languages.size;

    // Calculate total storage
    const totalStorage = allFiles.reduce((sum, f) => sum + (f.size_mb || 0), 0);

    document.getElementById('totalFiles').textContent = totalFiles;
    document.getElementById('starredFiles').textContent = starredFiles;
    document.getElementById('languagesCount').textContent = languagesCount;
    document.getElementById('totalStorage').textContent = totalStorage.toFixed(1) + ' MB';
}

// Apply filters
function applyFilters() {
    let filtered = [...allFiles];

    // Apply filter type
    if (currentFilter === 'starred') {
        filtered = filtered.filter(f => f.is_starred);
    } else if (currentFilter === 'pinned') {
        filtered = filtered.filter(f => f.is_pinned);
    }

    // Apply search
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    if (searchTerm) {
        filtered = filtered.filter(f =>
            f.filename.toLowerCase().includes(searchTerm)
        );
    }

    filteredFiles = filtered;
    currentPage = 1;
}

// Render files
function renderFiles() {
    const grid = document.getElementById('filesGrid');
    const emptyState = document.getElementById('emptyState');

    if (filteredFiles.length === 0) {
        grid.classList.add('hidden');
        emptyState.classList.remove('hidden');
        document.getElementById('pagination').classList.add('hidden');
        return;
    }

    emptyState.classList.add('hidden');
    grid.classList.remove('hidden');

    // Apply view mode
    if (currentView === 'list') {
        grid.classList.add('list-view');
    } else {
        grid.classList.remove('list-view');
    }

    // Calculate pagination
    const startIndex = (currentPage - 1) * filesPerPage;
    const endIndex = startIndex + filesPerPage;
    const pageFiles = filteredFiles.slice(startIndex, endIndex);

    // Render file cards
    grid.innerHTML = pageFiles.map(file => createFileCard(file)).join('');

    // Update pagination
    updatePagination();

    // Attach event listeners to file cards
    attachFileCardListeners();
}

// Create file card HTML
function createFileCard(file) {
    const date = new Date(file.created_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });

    const languages = {
        'en': 'English', 'hi': 'Hindi', 'es': 'Spanish', 'fr': 'French',
        'de': 'German', 'zh': 'Chinese', 'ja': 'Japanese', 'ko': 'Korean'
    };

    const languageName = languages[file.language] || file.language;

    return `
        <div class="file-card ${file.is_pinned ? 'pinned' : ''}" data-file-id="${file.id}">
            <div class="file-card-header">
                <div class="file-info">
                    <div class="file-name" title="${file.filename}">${file.filename}</div>
                    <div class="file-meta">
                        <span class="file-meta-item">
                            <i class="fas fa-hdd"></i>
                            ${file.size_mb} MB
                        </span>
                        <span class="file-meta-item">
                            <i class="fas fa-language"></i>
                            ${languageName}
                        </span>
                    </div>
                </div>
                <div class="file-actions">
                    <button class="action-btn star-btn ${file.is_starred ? 'starred' : ''}" 
                            data-file-id="${file.id}" 
                            title="${file.is_starred ? 'Unstar' : 'Star'}">
                        <i class="fas fa-star"></i>
                    </button>
                    <button class="action-btn pin-btn ${file.is_pinned ? 'pinned' : ''}" 
                            data-file-id="${file.id}" 
                            title="${file.is_pinned ? 'Unpin' : 'Pin'}">
                        <i class="fas fa-thumbtack"></i>
                    </button>
                </div>
            </div>
            
            <div class="file-card-footer">
                <div class="file-date">
                    <i class="fas fa-clock"></i>
                    ${date}
                </div>
                <div class="file-card-actions">
                    <button class="btn-small view-btn" data-file-id="${file.id}">
                        <i class="fas fa-eye"></i>
                        View
                    </button>
                    <button class="btn-small danger delete-btn" data-file-id="${file.id}">
                        <i class="fas fa-trash"></i>
                        Delete
                    </button>
                </div>
            </div>
        </div>
    `;
}

// Attach event listeners to file cards
function attachFileCardListeners() {
    // Star buttons
    document.querySelectorAll('.star-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const fileId = btn.dataset.fileId;
            const isStarred = btn.classList.contains('starred');
            toggleStar(fileId, !isStarred);
        });
    });

    // Pin buttons
    document.querySelectorAll('.pin-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const fileId = btn.dataset.fileId;
            const isPinned = btn.classList.contains('pinned');
            togglePin(fileId, !isPinned);
        });
    });

    // View buttons
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const fileId = btn.dataset.fileId;
            viewFile(fileId);
        });
    });

    // Delete buttons
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const fileId = btn.dataset.fileId;
            const file = allFiles.find(f => f.id === fileId);
            showDeleteModal(fileId, file.filename);
        });
    });

    // Card click to view
    document.querySelectorAll('.file-card').forEach(card => {
        card.addEventListener('click', () => {
            const fileId = card.dataset.fileId;
            viewFile(fileId);
        });
    });
}

// Toggle star
async function toggleStar(fileId, starred) {
    try {
        const response = await fetchWithAuth(`/api/files/${fileId}/star`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ starred })
        });

        if (response && response.ok) {
            // Update local data
            const file = allFiles.find(f => f.id === fileId);
            if (file) {
                file.is_starred = starred;
            }

            updateStats();
            applyFilters();
            renderFiles();

            showToast(starred ? '⭐ Starred' : 'Unstarred', 'success');
        }
    } catch (error) {
        console.error('Failed to toggle star:', error);
        showToast('Failed to update', 'error');
    }
}

// Toggle pin
async function togglePin(fileId, pinned) {
    try {
        const response = await fetchWithAuth(`/api/files/${fileId}/pin`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pinned })
        });

        if (response && response.ok) {
            // Update local data
            const file = allFiles.find(f => f.id === fileId);
            if (file) {
                file.is_pinned = pinned;
            }

            applyFilters();
            renderFiles();

            showToast(pinned ? '📌 Pinned' : 'Unpinned', 'success');
        }
    } catch (error) {
        console.error('Failed to toggle pin:', error);
        showToast('Failed to update', 'error');
    }
}

// View file
function viewFile(fileId) {
    const file = allFiles.find(f => f.id === fileId);
    if (file) {
        // Store in session storage
        sessionStorage.setItem('transcribeResults', JSON.stringify(file));
        sessionStorage.setItem('selectedLanguage', file.language);

        // Navigate to results page
        window.location.href = `/results?id=${fileId}`;
    }
}

// Show delete modal
function showDeleteModal(fileId, filename) {
    fileToDelete = fileId;
    document.getElementById('deleteFileName').textContent = filename;
    document.getElementById('deleteModal').classList.remove('hidden');
}

// Close delete modal
function closeDeleteModal() {
    fileToDelete = null;
    document.getElementById('deleteModal').classList.add('hidden');
}

// Confirm delete
async function confirmDelete() {
    if (!fileToDelete) return;

    try {
        const response = await fetchWithAuth(`/api/files/${fileToDelete}`, {
            method: 'DELETE'
        });

        if (response && response.ok) {
            // Remove from local data
            allFiles = allFiles.filter(f => f.id !== fileToDelete);

            updateStats();
            applyFilters();
            renderFiles();

            closeDeleteModal();
            showToast('🗑️ File deleted', 'success');
        } else {
            throw new Error('Delete failed');
        }
    } catch (error) {
        console.error('Failed to delete file:', error);
        showToast('Failed to delete file', 'error');
    }
}

// Update pagination
function updatePagination() {
    const totalPages = Math.ceil(filteredFiles.length / filesPerPage);

    document.getElementById('prevBtn').disabled = currentPage === 1;
    document.getElementById('nextBtn').disabled = currentPage === totalPages;
    document.getElementById('pageInfo').textContent = `Page ${currentPage} of ${totalPages}`;

    if (totalPages > 1) {
        document.getElementById('pagination').classList.remove('hidden');
    } else {
        document.getElementById('pagination').classList.add('hidden');
    }
}

// Setup event listeners
function setupEventListeners() {
    // Search input
    document.getElementById('searchInput').addEventListener('input', () => {
        applyFilters();
        renderFiles();
    });

    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            currentFilter = btn.dataset.filter;
            applyFilters();
            renderFiles();
        });
    });

    // View toggle
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            currentView = btn.dataset.view;
            renderFiles();
        });
    });

    // Pagination
    document.getElementById('prevBtn').addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderFiles();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });

    document.getElementById('nextBtn').addEventListener('click', () => {
        const totalPages = Math.ceil(filteredFiles.length / filesPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            renderFiles();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });

    // Refresh button
    document.getElementById('refreshBtn').addEventListener('click', () => {
        loadFiles();
        showToast('🔄 Refreshed', 'success');
    });
}

// UI Helper functions
function showLoading() {
    document.getElementById('loadingState').classList.remove('hidden');
    document.getElementById('filesGrid').classList.add('hidden');
    document.getElementById('emptyState').classList.add('hidden');
}

function hideLoading() {
    document.getElementById('loadingState').classList.add('hidden');
}

function showEmptyState() {
    document.getElementById('emptyState').classList.remove('hidden');
    document.getElementById('filesGrid').classList.add('hidden');
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icons = {
        success: 'check-circle',
        error: 'exclamation-circle',
        warning: 'exclamation-triangle',
        info: 'info-circle'
    };

    toast.innerHTML = `
        <i class="fas fa-${icons[type] || 'info-circle'}"></i>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 10);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}