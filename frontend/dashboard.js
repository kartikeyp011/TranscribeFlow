// Dashboard Logic

document.addEventListener('DOMContentLoaded', async function() {
    // Check authentication
    const authData = await checkAuth();
    
    if (!authData || !authData.authenticated) {
        return; // Will redirect to login
    }

    console.log('✅ User authenticated:', authData.user_name);

    // Load stats and files
    await loadStats();
    await loadFiles();
});

// Load user statistics
async function loadStats() {
    try {
        const response = await fetch('/api/stats');
        const data = await response.json();

        document.getElementById('totalFiles').textContent = data.total_files;
        document.getElementById('totalMinutes').textContent = data.total_minutes.toFixed(1);

        // Calculate account age in days
        const createdDate = new Date(data.account_created);
        const now = new Date();
        const days = Math.floor((now - createdDate) / (1000 * 60 * 60 * 24));
        document.getElementById('accountAge').textContent = days;

    } catch (error) {
        console.error('Failed to load stats:', error);
        showToast('Failed to load statistics', 'error');
    }
}

// Load user files
async function loadFiles() {
    try {
        const response = await fetch('/api/files?limit=50');
        const data = await response.json();

        const container = document.getElementById('filesContainer');

        if (data.files.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-folder-open"></i>
                    <p>No files yet. Upload your first audio file!</p>
                    <a href="./upload.html" class="nav-cta" style="margin-top: 1rem;">
                        <i class="fas fa-upload"></i>
                        <span>Upload File</span>
                    </a>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <table class="files-table">
                <thead>
                    <tr>
                        <th>Filename</th>
                        <th>Size</th>
                        <th>Language</th>
                        <th>Date</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.files.map(file => `
                        <tr>
                            <td>
                                <i class="fas fa-file-audio" style="color: var(--accent-primary); margin-right: 0.5rem;"></i>
                                ${file.filename}
                            </td>
                            <td>${file.size_mb} MB</td>
                            <td>${file.language || 'auto'}</td>
                            <td>${new Date(file.created_at).toLocaleDateString()}</td>
                            <td>
                                <div class="file-actions">
                                    <button class="btn-icon-small" onclick="viewFile('${file.id}')" title="View">
                                        <i class="fas fa-eye"></i>
                                    </button>
                                    <button class="btn-icon-small" onclick="deleteFile('${file.id}')" title="Delete">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

    } catch (error) {
        console.error('Failed to load files:', error);
        showToast('Failed to load files', 'error');
    }
}

// View file details
async function viewFile(fileId) {
    try {
        const response = await fetch(`/api/files/${fileId}`);
        const file = await response.json();

        // Redirect to results page (you'll need to implement this)
        // For now, just show an alert
        alert(`File: ${file.filename}\n\nTranscript: ${file.transcript.substring(0, 200)}...`);

    } catch (error) {
        console.error('Failed to view file:', error);
        showToast('Failed to load file', 'error');
    }
}

// Delete file
async function deleteFile(fileId) {
    if (!confirm('Are you sure you want to delete this file?')) {
        return;
    }

    try {
        const response = await fetch(`/api/files/${fileId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showToast('File deleted successfully', 'success');
            await loadStats();
            await loadFiles();
        } else {
            throw new Error('Delete failed');
        }

    } catch (error) {
        console.error('Failed to delete file:', error);
        showToast('Failed to delete file', 'error');
    }
}