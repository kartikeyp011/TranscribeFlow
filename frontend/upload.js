// Upload Page JavaScript
class UploadPage {
    constructor() {
        this.currentFile = null;
        this.isProcessing = false;
        this.ws = null;
        this.requestId = null;
        this.logs = [];

        this.initializeElements();
        this.setupEventListeners();
        this.setupWebSocketFallback();
        this.initializeApp();
    }

    // DOM Elements
    initializeElements() {
        this.elements = {
            // Upload Form
            uploadForm: document.getElementById('uploadForm'),
            audioFileInput: document.getElementById('audioFile'),
            dropzone: document.getElementById('dropzone'),
            dropzoneText: document.getElementById('dropzoneText'),
            fileNameDisplay: document.getElementById('fileName'),
            processBtn: document.getElementById('processBtn'),
            processBtnText: document.getElementById('processBtnText'),
            processingSpinner: document.getElementById('processingSpinner'),
            loadingIndicator: document.getElementById('loading'),
            errorMsgDiv: document.getElementById('errorMsg'),
            progressFill: document.getElementById('progressFill'),

            // Results Ready Section
            resultsReady: document.getElementById('resultsReady'),
            viewResultsBtn: document.getElementById('viewResultsBtn'),
            processAnotherBtn: document.getElementById('processAnotherBtn'),

            // Logs
            logsContent: document.getElementById('logsContent'),
            clearLogsBtn: document.getElementById('clearLogsBtn'),

            // Toast Container
            toastContainer: document.getElementById('toastContainer'),

            // Clear All
            clearAllBtn: document.getElementById('clearAllBtn')
        };
    }

    // Event Listeners
    setupEventListeners() {
        // Upload Form
        this.elements.uploadForm.addEventListener('submit', (e) => this.handleUpload(e));
        this.elements.audioFileInput.addEventListener('change', (e) => this.handleFileSelect(e));

        // Dropzone
        this.elements.dropzone.addEventListener('click', () => this.elements.audioFileInput.click());
        this.elements.dropzone.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.elements.dropzone.addEventListener('drop', (e) => this.handleDrop(e));

        // Results Actions
        this.elements.viewResultsBtn.addEventListener('click', () => this.viewResults());
        this.elements.processAnotherBtn.addEventListener('click', () => this.processAnother());

        // Logs
        this.elements.clearLogsBtn.addEventListener('click', () => this.clearLogs());

        // Clear All
        this.elements.clearAllBtn.addEventListener('click', () => this.clearAll());
    }

    // File Handling
    handleFileSelect(e) {
        const file = e.target.files[0];
        if (!file) return;

        if (!this.validateFile(file)) {
            this.showError('Please select a valid audio file (MP3, WAV, M4A, OGG, max 25MB)');
            return;
        }

        const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
        this.elements.fileNameDisplay.textContent = `${file.name} • ${sizeMB} MB`;
        this.elements.dropzoneText.textContent = "File selected ✓";

        this.addLog(`📁 Selected: ${file.name} (${sizeMB} MB)`, 'info');
    }

    handleDragOver(e) {
        e.preventDefault();
        this.elements.dropzone.style.borderColor = 'var(--accent-primary)';
        this.elements.dropzone.style.transform = 'translateY(-4px)';
        this.elements.dropzone.style.boxShadow = 'var(--shadow-xl), var(--shadow-glow)';
    }

    handleDrop(e) {
        e.preventDefault();
        this.elements.dropzone.style.borderColor = '';
        this.elements.dropzone.style.transform = '';
        this.elements.dropzone.style.boxShadow = '';

        const file = e.dataTransfer.files[0];
        if (file && this.validateFile(file)) {
            this.elements.audioFileInput.files = e.dataTransfer.files;
            this.handleFileSelect({ target: this.elements.audioFileInput });
        }
    }

    validateFile(file) {
        const validTypes = ['audio/mp3', 'audio/wav', 'audio/m4a', 'audio/ogg', 'audio/x-m4a', 'audio/mpeg'];
        const maxSize = 25 * 1024 * 1024; // 25MB

        return validTypes.includes(file.type) && file.size <= maxSize;
    }

    // Upload and Processing
    async handleUpload(e) {
        e.preventDefault();
        const file = this.elements.audioFileInput.files[0];

        if (!file) {
            this.showError('Please select an audio file first');
            return;
        }

        if (this.isProcessing) return;

        await this.processAudioFile(file);
    }

    async processAudioFile(file) {
        this.isProcessing = true;
        this.setProcessingState(true);
        this.showProcessing();
        this.clearLogs();
        this.hideResultsReady();

        // Get selected language
        const selectedLanguage = document.getElementById('inputLanguage').value;

        // Generate request ID and connect WebSocket BEFORE uploading
        this.requestId = this.generateRequestId();
        this.connectWebSocket(this.requestId);

        // Wait a bit for WebSocket to connect
        await new Promise(resolve => setTimeout(resolve, 200));

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('language', selectedLanguage);

            this.addLog(`📤 Uploading ${file.name} (Language: ${selectedLanguage})...`, 'info');
            this.updateProgress(10);

            // Upload file
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `Upload failed: ${response.status}`);
            }

            const data = await response.json();
            this.currentFile = data;

            // Store results in session storage for results page when upload completes
            sessionStorage.setItem('transcribeResults', JSON.stringify(data));
            sessionStorage.setItem('sourceLanguage', selectedLanguage);  // Add this


            this.updateProgress(100);
            this.addLog('✅ Processing complete! Click "View Results" to see transcript and summary.', 'success');
            this.showResultsReady();

            this.showToast('Audio processing complete!', 'success');

        } catch (error) {
            console.error('Processing error:', error);
            this.addLog(`❌ Error: ${error.message}`, 'error');
            this.showError(`Processing failed: ${error.message}`);

        } finally {
            this.isProcessing = false;
            this.setProcessingState(false);
            this.hideProcessing();

            // Close WebSocket after delay
            setTimeout(() => {
                if (this.ws) {
                    this.ws.close();
                    this.ws = null;
                }
            }, 2000);
        }
    }

    // WebSocket Implementation
    connectWebSocket(requestId) {
        // Close existing connection
        if (this.ws) {
            this.ws.close();
        }

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/logs/${requestId}`;

        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            console.log('✅ WebSocket connected');
            this.addLog('🔗 Connected to real-time logging', 'info');
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.type === 'log') {
                    this.handleLogMessage(data);
                } else if (data.type === 'progress') {
                    this.updateProgress(data.value);
                }
            } catch (e) {
                console.error('Failed to parse WebSocket message:', e);
            }
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.addLog('⚠️ Real-time logging disconnected', 'warning');
            // Start fallback logs
            this.startFallbackLogs();
        };

        this.ws.onclose = () => {
            console.log('WebSocket disconnected');
        };
    }

    handleLogMessage(data) {
        const { message, level = 'info' } = data;

        // Add to logs directly
        this.addLog(message, level);

        // Update progress based on log content
        if (message.includes('Processing') && (message.includes('.wav') || message.includes('.mp3') || message.includes('.m4a'))) {
            this.updateProgress(30);
        } else if (message.includes('Processing audio with duration')) {
            this.updateProgress(50);
        } else if (message.includes('Detected language')) {
            this.updateProgress(60);
        } else if (message.includes('Transcribed')) {
            this.updateProgress(75);
        } else if (message.includes('Summary generated')) {
            this.updateProgress(90);
        } else if (message.includes('Processing complete')) {
            this.updateProgress(95);
        }
    }

    setupWebSocketFallback() {
        this.fallbackLogs = [
            { delay: 1000, message: '🎙️ Processing audio file...', level: 'info' },
            { delay: 3000, message: '🔍 Analyzing audio quality...', level: 'info' },
            { delay: 6000, message: '🎯 Detecting speech segments...', level: 'info' },
            { delay: 9000, message: '📝 Converting speech to text...', level: 'info' },
            { delay: 12000, message: '✍️ Formatting transcript...', level: 'info' },
            { delay: 15000, message: '🧠 Analyzing content...', level: 'info' },
            { delay: 18000, message: '✨ Generating AI summary...', level: 'info' }
        ];
    }

    startFallbackLogs() {
        this.fallbackLogs.forEach(log => {
            setTimeout(() => {
                if (this.isProcessing) {
                    this.addLog(log.message, log.level);
                }
            }, log.delay);
        });
    }

    // Results Ready Section
    showResultsReady() {
        this.elements.resultsReady.classList.remove('hidden');
        // Scroll to results ready section
        setTimeout(() => {
            this.elements.resultsReady.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
    }

    hideResultsReady() {
        this.elements.resultsReady.classList.add('hidden');
    }

    viewResults() {
        if (this.currentFile) {
            // Navigate to results page
            window.location.href = 'results.html';
        }
    }

    processAnother() {
        // Reset form and show upload section
        this.elements.uploadForm.reset();
        this.elements.fileNameDisplay.textContent = '';
        this.elements.dropzoneText.textContent = 'Click to select or drag & drop audio file';
        this.hideResultsReady();
        this.clearLogs();
        this.addLog('Ready to upload another audio file', 'info');
        
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Logs Management
    addLog(message, level = 'info') {
        const logEntry = document.createElement('div');
        const timestamp = new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        logEntry.className = `log-entry log-${level}`;
        logEntry.innerHTML = `
            <span class="log-time">[${timestamp}]</span>
            <span class="log-message">${message}</span>
        `;

        this.elements.logsContent.appendChild(logEntry);
        this.elements.logsContent.scrollTop = this.elements.logsContent.scrollHeight;

        // Store log
        this.logs.push({ timestamp: new Date(), message, level });

        // Limit logs to 100 entries
        if (this.logs.length > 100) {
            this.logs.shift();
            if (this.elements.logsContent.children.length > 100) {
                this.elements.logsContent.removeChild(this.elements.logsContent.firstChild);
            }
        }
    }

    clearLogs() {
        this.elements.logsContent.innerHTML = '';
        this.logs = [];
        this.addLog('Logs cleared', 'info');
    }

    // Clear All
    async clearAll() {
        if (!confirm('Clear all uploaded files and results? This action cannot be undone.')) {
            return;
        }

        try {
            const response = await fetch('/api/clear-all', {
                method: 'DELETE'
            });

            if (response.ok) {
                this.resetUploadPage();
                this.showToast('All files cleared successfully!', 'success');
                this.addLog('Cleared all uploaded files and results', 'info');
            } else {
                throw new Error('Server responded with error');
            }
        } catch (error) {
            console.warn('Could not clear server files:', error);
            this.resetUploadPage();
            this.showToast('Cleared local data only', 'warning');
        }
    }

    resetUploadPage() {
        this.currentFile = null;
        this.isProcessing = false;

        // Reset file input
        this.elements.uploadForm.reset();
        this.elements.fileNameDisplay.textContent = '';
        this.elements.dropzoneText.textContent = 'Click to select or drag & drop audio file';

        // Hide results ready
        this.hideResultsReady();

        // Reset processing state
        this.setProcessingState(false);
        this.hideProcessing();

        // Clear session storage
        sessionStorage.removeItem('transcribeResults');
        sessionStorage.removeItem('selectedLanguage');

        // Close WebSocket
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    // UI State Management
    setProcessingState(processing) {
        this.elements.processBtn.disabled = processing;

        if (processing) {
            this.elements.processBtnText.textContent = 'Processing...';
            this.elements.processingSpinner.classList.remove('hidden');
        } else {
            this.elements.processBtnText.textContent = 'Upload & Process Audio';
            this.elements.processingSpinner.classList.add('hidden');
        }
    }

    showProcessing() {
        this.elements.loadingIndicator.classList.remove('hidden');
        this.updateProgress(0);
    }

    hideProcessing() {
        this.elements.loadingIndicator.classList.add('hidden');
    }

    updateProgress(percentage) {
        this.elements.progressFill.style.width = `${percentage}%`;
    }

    // Utilities
    generateRequestId() {
        return 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Toast Notifications
    showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icon = type === 'success' ? 'fa-check-circle' :
            type === 'error' ? 'fa-exclamation-circle' :
                type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle';

        toast.innerHTML = `
            <i class="fas ${icon}"></i>
            <span>${message}</span>
        `;

        this.elements.toastContainer.appendChild(toast);

        // Remove toast after 3 seconds
        setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }

    showError(message) {
        this.elements.errorMsgDiv.textContent = message;
        this.elements.errorMsgDiv.classList.remove('hidden');

        setTimeout(() => {
            this.elements.errorMsgDiv.classList.add('hidden');
        }, 5000);
    }

    // Initialization
    async initializeApp() {
        // Check backend health
        await this.checkBackendHealth();

        // Add welcome log
        this.addLog('TranscribeFlow ready. Upload an audio file to begin.', 'info');
    }

    async checkBackendHealth() {
        try {
            const response = await fetch('/api/health');
            if (response.ok) {
                this.addLog('✅ Backend connected successfully', 'success');
            }
        } catch (error) {
            console.warn('Backend health check failed:', error);
            this.addLog('⚠️ Backend connection failed - some features may be limited', 'warning');
        }
    }
}

// Initialize the upload page
document.addEventListener('DOMContentLoaded', () => {
    window.uploadPage = new UploadPage();
});
