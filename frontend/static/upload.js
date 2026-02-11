// Upload Page JavaScript - Complete Version with Authentication and File History
class UploadPage {
    constructor() {
        this.currentFile = null;
        this.isProcessing = false;
        this.ws = null;
        this.requestId = null;
        this.logs = [];
        this.lastScrollTop = 0;
        this.isNavHidden = false;

        this.checkAuthentication();
        
        this.initializeElements();
        this.setupEventListeners();
        this.setupNavigationScroll();
        this.initializeApp();
        this.fetchUserInfo();
        this.loadFileHistory();
    }

    checkAuthentication() {
        console.log('🔐 Checking authentication...');
        const token = localStorage.getItem('access_token');
        console.log('Token found:', token ? 'YES' : 'NO');
        
        if (!token) {
            console.log('❌ No token found, redirecting to login...');
            window.location.href = '/login';
        }
    }

    async fetchWithAuth(url, options = {}) {
        const token = localStorage.getItem('access_token');

        if (!token) {
            window.location.href = '/login';
            return null;
        }

        const headers = {
            ...options.headers,
            Authorization: `Bearer ${token}`
        };

        try {
            const response = await fetch(url, {
                ...options,
                headers
            });

            if (response.status === 401) {
                localStorage.removeItem('access_token');
                localStorage.removeItem('token_type');
                window.location.href = '/login';
                return null;
            }

            return response;
        } catch (error) {
            console.error('Fetch error:', error);
            throw error;
        }
    }

    async fetchUserInfo() {
        try {
            const response = await this.fetchWithAuth('/api/auth/me');
            if (!response) return;

            if (response.ok) {
                const user = await response.json();
                const usernameElement = document.getElementById('currentUsername') || 
                                       document.querySelector('.user-name');

                if (usernameElement) {
                    usernameElement.textContent = user.username || user.name || 'User';
                }

                this.addLog(`Welcome back, ${user.username}!`, 'success');
            }
        } catch (error) {
            console.error('Error fetching user info:', error);
        }
    }

    initializeElements() {
        this.elements = {
            uploadForm: document.getElementById('uploadForm'),
            audioFileInput: document.getElementById('audioFile'),
            dropzone: document.getElementById('dropzone'),
            dropzoneText: document.getElementById('dropzoneText'),
            dropzoneHint: document.getElementById('dropzoneHint'),
            fileNameDisplay: document.getElementById('fileName'),
            browseBtn: document.getElementById('browseBtn'),
            processBtn: document.getElementById('processBtn'),
            processBtnText: document.getElementById('processBtnText'),
            processingSpinner: document.getElementById('processingSpinner'),
            loadingIndicator: document.getElementById('loading'),
            progressFill: document.getElementById('progressFill'),
            progressPercent: document.getElementById('progressPercent'),
            progressStatus: document.getElementById('progressStatus'),
            inputLanguage: document.getElementById('inputLanguage'),

            resultsReady: document.getElementById('resultsReady'),
            viewResultsBtn: document.getElementById('viewResultsBtn'),
            processAnotherBtn: document.getElementById('processAnotherBtn'),

            logsContent: document.getElementById('logsContent'),
            clearLogsBtn: document.getElementById('clearLogsBtn'),

            toastContainer: document.getElementById('toastContainer'),

            clearAllBtn: document.getElementById('clearAllBtn'),
            navbar: document.getElementById('mainNav'),
            mobileMenuBtn: document.getElementById('mobileMenuBtn'),
            navActions: document.querySelector('.nav-actions'),
            
            enableDiarization: document.getElementById('enableDiarization'),
            numSpeakers: document.getElementById('numSpeakers'),
            
            fileHistory: document.getElementById('fileHistory') || 
                        document.querySelector('.file-history-list') ||
                        document.querySelector('.files-list')
        };

        if (this.elements.fileNameDisplay) {
            this.elements.fileNameDisplay.style.display = 'none';
        }
    }

    setupEventListeners() {
        if (this.elements.uploadForm) {
            this.elements.uploadForm.addEventListener('submit', (e) => this.handleUpload(e));
        }

        if (this.elements.audioFileInput) {
            this.elements.audioFileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        }

        if (this.elements.dropzone) {
            this.elements.dropzone.addEventListener('click', (e) => {
                if (!e.target.closest('.btn-outline-sm') && e.target !== this.elements.audioFileInput) {
                    this.elements.audioFileInput.click();
                }
            });

            this.elements.dropzone.addEventListener('dragover', (e) => this.handleDragOver(e));
            this.elements.dropzone.addEventListener('dragleave', (e) => this.handleDragLeave(e));
            this.elements.dropzone.addEventListener('drop', (e) => this.handleDrop(e));
        }

        if (this.elements.browseBtn) {
            this.elements.browseBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                this.elements.audioFileInput.click();
            });
        }

        if (this.elements.viewResultsBtn) {
            this.elements.viewResultsBtn.addEventListener('click', () => this.viewResults());
        }

        if (this.elements.processAnotherBtn) {
            this.elements.processAnotherBtn.addEventListener('click', () => this.processAnother());
        }

        if (this.elements.clearLogsBtn) {
            this.elements.clearLogsBtn.addEventListener('click', () => this.clearLogs());
        }

        if (this.elements.clearAllBtn) {
            this.elements.clearAllBtn.addEventListener('click', () => this.clearAll());
        }

        if (this.elements.mobileMenuBtn && this.elements.navActions) {
            this.elements.mobileMenuBtn.addEventListener('click', () => {
                this.elements.navActions.classList.toggle('show');
            });

            document.addEventListener('click', (e) => {
                if (!this.elements.mobileMenuBtn.contains(e.target) &&
                    !this.elements.navActions.contains(e.target) &&
                    this.elements.navActions.classList.contains('show')) {
                    this.elements.navActions.classList.remove('show');
                }
            });
        }
    }

    setupNavigationScroll() {
        const scrollThreshold = 50;

        window.addEventListener('scroll', () => {
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

            if (Math.abs(scrollTop - this.lastScrollTop) > scrollThreshold) {
                if (scrollTop > this.lastScrollTop && scrollTop > 100) {
                    if (!this.isNavHidden && this.elements.navbar) {
                        this.elements.navbar.style.transform = 'translateY(-100%)';
                        this.elements.navbar.style.transition = 'transform 0.3s ease';
                        this.isNavHidden = true;
                    }
                } else {
                    if (this.isNavHidden && this.elements.navbar) {
                        this.elements.navbar.style.transform = 'translateY(0)';
                        this.isNavHidden = false;
                    }
                }
                this.lastScrollTop = scrollTop;
            }
        });
    }

    handleFileSelect(e) {
        const file = e.target.files[0];
        console.log('📁 File selected:', file ? file.name : 'none');
        
        if (!file) return;

        if (!this.validateFile(file)) {
            this.showToast('Invalid file type. Please select MP3, WAV, M4A, or OGG file.', 'error');
            this.resetFileSelection();
            return;
        }

        const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
        const displayName = file.name.length > 30 ? file.name.substring(0, 27) + '...' : file.name;

        this.elements.fileNameDisplay.textContent = `${displayName} • ${sizeMB} MB`;
        this.elements.fileNameDisplay.style.display = 'flex';

        this.elements.dropzoneText.textContent = "File selected ✓";
        this.elements.dropzoneHint.textContent = "Click to change file";

        this.addLog(`📁 Selected: ${file.name} (${sizeMB} MB)`, 'info');
        this.showToast('File selected successfully', 'success');
    }

    handleDragOver(e) {
        e.preventDefault();
        if (this.elements.dropzone) {
            this.elements.dropzone.style.borderColor = '#5eead4';
            this.elements.dropzone.style.background = 'rgba(94, 234, 212, 0.05)';
        }
    }

    handleDragLeave(e) {
        e.preventDefault();
        if (this.elements.dropzone) {
            this.elements.dropzone.style.borderColor = 'rgba(94, 234, 212, 0.3)';
            this.elements.dropzone.style.background = 'var(--bg-tertiary)';
        }
    }

    handleDrop(e) {
        e.preventDefault();
        if (this.elements.dropzone) {
            this.elements.dropzone.style.borderColor = 'rgba(94, 234, 212, 0.3)';
            this.elements.dropzone.style.background = 'var(--bg-tertiary)';
        }

        const file = e.dataTransfer.files[0];
        if (file) {
            this.elements.audioFileInput.files = e.dataTransfer.files;
            this.handleFileSelect({ target: this.elements.audioFileInput });
        }
    }

    validateFile(file) {
        const validTypes = ['audio/mp3', 'audio/wav', 'audio/m4a', 'audio/ogg', 'audio/x-m4a', 'audio/mpeg'];
        const maxSize = 25 * 1024 * 1024;
        const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
        const validExtensions = ['.mp3', '.wav', '.m4a', '.ogg'];

        return (validTypes.includes(file.type) || validExtensions.includes(fileExtension)) && file.size <= maxSize;
    }

    resetFileSelection() {
        if (this.elements.audioFileInput) {
            this.elements.audioFileInput.value = '';
        }
        if (this.elements.fileNameDisplay) {
            this.elements.fileNameDisplay.style.display = 'none';
        }
        if (this.elements.dropzoneText) {
            this.elements.dropzoneText.textContent = "Drag & drop or click to browse";
        }
        if (this.elements.dropzoneHint) {
            this.elements.dropzoneHint.textContent = "Supports all major audio formats";
        }
    }

    async handleUpload(e) {
        e.preventDefault();

        const file = this.elements.audioFileInput.files[0];

        if (!file) {
            this.showToast('Please select an audio file', 'error');
            if (this.elements.dropzone) {
                this.elements.dropzone.style.borderColor = '#ef4444';
                setTimeout(() => {
                    this.elements.dropzone.style.borderColor = 'rgba(94, 234, 212, 0.3)';
                }, 1000);
            }
            return;
        }

        if (this.isProcessing) return;

        await this.processAudioFile(file);
    }

    async processAudioFile(file) {
        this.isProcessing = true;
        this.setProcessingState(true);
        this.showProcessing();
        this.hideResultsReady();

        const selectedLanguage = this.elements.inputLanguage.value;

        this.requestId = this.generateRequestId();
        this.connectWebSocket(this.requestId);

        await new Promise(resolve => setTimeout(resolve, 200));

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('language', selectedLanguage);
            formData.append('summary_mode', 'bullet');

            if (this.elements.enableDiarization && this.elements.enableDiarization.checked) {
                formData.append('enable_diarization', 'true');
                this.addLog('🎤 Speaker diarization enabled', 'info');

                if (this.elements.numSpeakers && this.elements.numSpeakers.value) {
                    formData.append('num_speakers', this.elements.numSpeakers.value);
                    this.addLog(`👥 Expecting ${this.elements.numSpeakers.value} speakers`, 'info');
                } else {
                    this.addLog('👥 Auto-detecting speaker count', 'info');
                }
            } else {
                formData.append('enable_diarization', 'false');
            }

            this.addLog(`📤 Uploading ${file.name}...`, 'info');

            const response = await this.fetchWithAuth('/api/upload', {
                method: 'POST',
                body: formData
            });

            if (!response || !response.ok) {
                const errorData = await response?.json().catch(() => ({}));
                throw new Error(errorData?.detail || 'Upload failed');
            }

            const data = await response.json();
            this.currentFile = data;

            sessionStorage.setItem('transcribeResults', JSON.stringify(data));
            sessionStorage.setItem('sourceLanguage', selectedLanguage);
            localStorage.setItem('lastResultId', data.id);

            this.addLog(`✅ Processing complete!`, 'success');
            this.addLog(`📄 File: ${data.filename}`, 'info');
            this.showResultsReady();
            this.showToast('Audio processed successfully!', 'success');

            this.loadFileHistory();

        } catch (error) {
            console.error('Upload error:', error);
            this.addLog(`❌ Processing failed: ${error.message}`, 'error');
            this.showToast(error.message || 'Failed to process audio', 'error');

        } finally {
            this.isProcessing = false;
            this.setProcessingState(false);
            this.hideProcessing();

            setTimeout(() => {
                if (this.ws) {
                    this.ws.close();
                    this.ws = null;
                }
            }, 2000);
        }
    }

    connectWebSocket(requestId) {
        if (this.ws) this.ws.close();

        const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${location.host}/ws/logs/${requestId}`;

        try {
            this.ws = new WebSocket(wsUrl);

            this.ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.type === 'log') {
                    this.addLog(data.message, data.level);
                }
            };

            this.ws.onerror = (error) => {
                console.warn('WebSocket error:', error);
            };

            this.ws.onclose = () => {
                console.log('WebSocket connection closed');
            };
        } catch (error) {
            console.warn('WebSocket connection failed:', error);
        }
    }

    async loadFileHistory() {
        if (!this.elements.fileHistory) {
            console.log('File history container not found, skipping');
            return;
        }

        try {
            const response = await this.fetchWithAuth('/api/files');

            if (!response || !response.ok) {
                console.error('Failed to load file history');
                return;
            }

            const files = await response.json();
            this.displayFileHistory(files);
            this.addLog(`📊 Loaded ${files.length} file(s)`, 'info');

        } catch (error) {
            console.error('Error loading file history:', error);
        }
    }

    displayFileHistory(files) {
        if (!this.elements.fileHistory) return;

        if (!files || files.length === 0) {
            this.elements.fileHistory.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-folder-open"></i>
                    <p>No files processed yet</p>
                </div>
            `;
            return;
        }

        files.sort((a, b) => new Date(b.created_at || b.timestamp) - new Date(a.created_at || a.timestamp));

        this.elements.fileHistory.innerHTML = files.map(file => this.createFileHistoryItem(file)).join('');

        this.attachFileHistoryHandlers();
    }

    createFileHistoryItem(file) {
        const fileSize = this.formatFileSize(file.file_size || file.size || 0);
        const processedDate = this.formatDate(file.created_at || file.timestamp);
        const fileName = file.filename || file.name || 'Unknown';
        const language = file.language || 'en';

        return `
            <div class="file-history-item" data-file-id="${file.id}">
                <div class="file-info">
                    <div class="file-icon">
                        <i class="fas fa-file-audio"></i>
                    </div>
                    <div class="file-details">
                        <div class="file-name">${fileName}</div>
                        <div class="file-meta">
                            <span class="file-size">
                                <i class="fas fa-database"></i>
                                ${fileSize}
                            </span>
                            <span class="file-language">
                                <i class="fas fa-language"></i>
                                ${this.getLanguageName(language)}
                            </span>
                            <span class="file-date">
                                <i class="fas fa-clock"></i>
                                ${processedDate}
                            </span>
                        </div>
                    </div>
                </div>
                <div class="file-actions">
                    <button class="btn-icon btn-view" data-file-id="${file.id}" title="View Results">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn-icon btn-delete" data-file-id="${file.id}" title="Delete">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </div>
        `;
    }

    attachFileHistoryHandlers() {
        document.querySelectorAll('.btn-view').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const fileId = e.currentTarget.getAttribute('data-file-id');
                window.location.href = `/results?id=${fileId}`;
            });
        });

        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const fileId = e.currentTarget.getAttribute('data-file-id');
                this.deleteFile(fileId);
            });
        });
    }

    async deleteFile(fileId) {
        if (!confirm('Are you sure you want to delete this file?')) return;

        try {
            const response = await this.fetchWithAuth(`/api/files/${fileId}`, {
                method: 'DELETE'
            });

            if (response && response.ok) {
                this.showToast('File deleted successfully', 'success');
                this.addLog('🗑️ File deleted', 'info');
                this.loadFileHistory();
            } else {
                throw new Error('Failed to delete file');
            }
        } catch (error) {
            console.error('Delete error:', error);
            this.showToast('Failed to delete file', 'error');
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    }

    formatDate(dateString) {
        if (!dateString) return 'Unknown';
        
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
        });
    }

    getLanguageName(code) {
        const languages = {
            'en': 'English', 'hi': 'Hindi', 'es': 'Spanish', 'fr': 'French',
            'de': 'German', 'zh': 'Chinese', 'ja': 'Japanese', 'ko': 'Korean',
            'ar': 'Arabic', 'ru': 'Russian', 'pt': 'Portuguese', 'bn': 'Bengali',
            'te': 'Telugu', 'mr': 'Marathi', 'ta': 'Tamil', 'ur': 'Urdu',
            'it': 'Italian', 'nl': 'Dutch', 'tr': 'Turkish', 'vi': 'Vietnamese',
            'th': 'Thai', 'id': 'Indonesian'
        };
        return languages[code] || code.toUpperCase();
    }

    showResultsReady() {
        if (this.elements.resultsReady) {
            this.elements.resultsReady.classList.remove('hidden');
        }
    }

    hideResultsReady() {
        if (this.elements.resultsReady) {
            this.elements.resultsReady.classList.add('hidden');
        }
    }

    viewResults() {
        if (this.currentFile) {
            window.location.href = '/results?id=' + this.currentFile.id;
        } else {
            const resultId = localStorage.getItem('lastResultId');
            if (resultId) {
                window.location.href = '/results?id=' + resultId;
            } else {
                window.location.href = '/results';
            }
        }
    }

    processAnother() {
        if (this.elements.uploadForm) {
            this.elements.uploadForm.reset();
        }
        this.hideResultsReady();
        this.resetFileSelection();
        this.addLog('🔄 Ready for new upload', 'info');
    }

    addLog(message, level = 'info') {
        if (!this.elements.logsContent) return;

        const timestamp = new Date().toLocaleTimeString();
        const iconMap = {
            'success': 'check-circle',
            'error': 'exclamation-circle',
            'warning': 'exclamation-triangle',
            'info': 'info-circle'
        };

        const logEntry = document.createElement('div');
        logEntry.className = `log-entry log-${level}`;
        logEntry.innerHTML = `
            <div class="log-timestamp">[${timestamp}]</div>
            <div class="log-message">
                <i class="fas fa-${iconMap[level] || 'info-circle'} log-icon"></i>
                <span>${message}</span>
            </div>
        `;

        this.elements.logsContent.insertBefore(logEntry, this.elements.logsContent.firstChild);

        while (this.elements.logsContent.children.length > 50) {
            this.elements.logsContent.removeChild(this.elements.logsContent.lastChild);
        }
    }

    clearLogs() {
        if (this.elements.logsContent) {
            const currentTime = new Date().toLocaleTimeString();
            this.elements.logsContent.innerHTML = `
                <div class="log-entry log-info">
                    <div class="log-timestamp">[${currentTime}]</div>
                    <div class="log-message">
                        <i class="fas fa-info-circle log-icon"></i>
                        <span>Logs cleared</span>
                    </div>
                </div>
            `;
        }
    }

    async clearAll() {
        if (!confirm('Are you sure you want to clear all files?')) return;

        try {
            const response = await this.fetchWithAuth('/api/files/clear-all', {
                method: 'DELETE'
            });

            if (response && response.ok) {
                this.showToast('All files cleared successfully', 'success');
                this.addLog('🗑️ All files deleted', 'success');
                this.resetUploadPage();
                this.loadFileHistory();
            } else {
                throw new Error('Failed to clear files');
            }
        } catch (error) {
            console.error('Clear all error:', error);
            this.showToast('Failed to clear files', 'error');
            this.addLog('❌ Failed to clear files: ' + error.message, 'error');
        }
    }

    resetUploadPage() {
        if (this.elements.uploadForm) {
            this.elements.uploadForm.reset();
        }
        this.hideResultsReady();
        this.resetFileSelection();

        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    setProcessingState(processing) {
        if (this.elements.processBtn) {
            this.elements.processBtn.disabled = processing;
        }

        if (processing) {
            if (this.elements.processBtnText) {
                this.elements.processBtnText.textContent = 'Processing...';
            }
            if (this.elements.processingSpinner) {
                this.elements.processingSpinner.classList.remove('hidden');
            }
        } else {
            if (this.elements.processBtnText) {
                this.elements.processBtnText.textContent = 'Process Audio';
            }
            if (this.elements.processingSpinner) {
                this.elements.processingSpinner.classList.add('hidden');
            }
        }
    }

    showProcessing() {
        if (this.elements.loadingIndicator) {
            this.elements.loadingIndicator.classList.remove('hidden');
        }
    }

    hideProcessing() {
        if (this.elements.loadingIndicator) {
            this.elements.loadingIndicator.classList.add('hidden');
        }
    }

    generateRequestId() {
        return 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    showToast(message, type = 'info') {
        if (!this.elements.toastContainer) return;

        const iconMap = {
            'success': 'check-circle',
            'error': 'exclamation-circle',
            'warning': 'exclamation-triangle',
            'info': 'info-circle'
        };

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <i class="fas fa-${iconMap[type] || 'info-circle'}"></i>
            <span>${message}</span>
        `;

        this.elements.toastContainer.appendChild(toast);

        setTimeout(() => toast.classList.add('show'), 100);

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentNode === this.elements.toastContainer) {
                    this.elements.toastContainer.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }

    async initializeApp() {
        const currentTime = new Date().toLocaleTimeString();
        const previousTime = new Date(Date.now() - 7000).toLocaleTimeString();

        if (this.elements.logsContent) {
            this.elements.logsContent.innerHTML = `
                <div class="log-entry log-info">
                    <div class="log-timestamp">[${currentTime}]</div>
                    <div class="log-message">
                        <i class="fas fa-info-circle log-icon"></i>
                        <span>Ready to process audio files</span>
                    </div>
                </div>
                <div class="log-entry log-success">
                    <div class="log-timestamp">[${previousTime}]</div>
                    <div class="log-message">
                        <i class="fas fa-check-circle log-icon"></i>
                        <span>System initialized successfully</span>
                    </div>
                </div>
            `;
        }

        await this.checkBackendHealth();
    }

    async checkBackendHealth() {
        try {
            const response = await this.fetchWithAuth('/api/health');

            if (response && response.ok) {
                this.addLog('✅ Backend connected', 'success');
            }
        } catch (error) {
            this.addLog('⚠️ Backend offline', 'warning');
        }
    }
}

// Initialize ONLY ONCE
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (!window.uploadPage) {
            console.log('📄 Initializing upload page...');
            window.uploadPage = new UploadPage();
        }
    });
} else {
    if (!window.uploadPage) {
        console.log('✅ Document ready, initializing now...');
        window.uploadPage = new UploadPage();
    }
}