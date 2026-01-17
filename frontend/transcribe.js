// TranscribeFlow - Modern Audio Transcription App
// Enhanced with real WebSocket logging and improved UX

class TranscribeFlow {
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
            // Upload Section
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
            
            // File Info & Audio Player
            fileInfoSection: document.getElementById('fileInfoSection'),
            fileInfoName: document.getElementById('fileInfoName'),
            fileInfoSize: document.getElementById('fileInfoSize'),
            fileInfoTime: document.getElementById('fileInfoTime'),
            
            audioPlayer: document.getElementById('audioPlayer'),
            playPauseBtn: document.getElementById('playPause'),
            skipBackBtn: document.getElementById('skipBack'),
            skipForwardBtn: document.getElementById('skipForward'),
            progressBar: document.getElementById('progressBar'),
            currentTimeEl: document.getElementById('currentTime'),
            durationEl: document.getElementById('duration'),
            volumeBar: document.getElementById('volumeBar'),
            
            // Results Section
            resultsSection: document.getElementById('results'),
            emptyState: document.getElementById('emptyState'),
            transcriptDiv: document.getElementById('transcript'),
            summaryDiv: document.getElementById('summary'),
            fontSizeSelect: document.getElementById('fontSize'),
            searchInput: document.getElementById('searchInput'),
            searchResults: document.getElementById('searchResults'),
            
            // Control Buttons
            copyTranscriptBtn: document.getElementById('copyTranscript'),
            exportTxtBtn: document.getElementById('exportTxt'),
            copySummaryBtn: document.getElementById('copySummary'),
            exportSummaryTxtBtn: document.getElementById('exportSummaryTxt'),
            copyAllBtn: document.getElementById('copyAllBtn'),
            exportAllBtn: document.getElementById('exportAllBtn'),
            clearAllBtn: document.getElementById('clearAllBtn'),
            
            // Logs
            logsContent: document.getElementById('logsContent'),
            clearLogsBtn: document.getElementById('clearLogsBtn'),
            
            // Toast Container
            toastContainer: document.getElementById('toastContainer')
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
        
        // Audio Controls
        this.elements.playPauseBtn.addEventListener('click', () => this.togglePlayPause());
        this.elements.skipBackBtn.addEventListener('click', () => this.skip(-10));
        this.elements.skipForwardBtn.addEventListener('click', () => this.skip(10));
        this.elements.progressBar.addEventListener('input', (e) => this.seekAudio(e));
        this.elements.volumeBar.addEventListener('input', (e) => this.adjustVolume(e));
        
        // Audio Events
        this.elements.audioPlayer.addEventListener('loadedmetadata', () => this.updateAudioDuration());
        this.elements.audioPlayer.addEventListener('timeupdate', () => this.updateAudioProgress());
        this.elements.audioPlayer.addEventListener('ended', () => this.handleAudioEnd());
        
        // Text Controls
        this.elements.fontSizeSelect.addEventListener('change', (e) => this.adjustFontSize(e));
        this.elements.searchInput.addEventListener('input', () => this.performSearch());
        
        // Copy/Export Buttons
        this.elements.copyTranscriptBtn.addEventListener('click', () => this.copyTranscript());
        this.elements.exportTxtBtn.addEventListener('click', () => this.exportTranscript());
        this.elements.copySummaryBtn.addEventListener('click', () => this.copySummary());
        this.elements.exportSummaryTxtBtn.addEventListener('click', () => this.exportSummary());
        this.elements.copyAllBtn.addEventListener('click', () => this.copyAll());
        this.elements.exportAllBtn.addEventListener('click', () => this.exportAll());
        
        // Clear All
        this.elements.clearAllBtn.addEventListener('click', () => this.clearAll());
        
        // Logs
        this.elements.clearLogsBtn.addEventListener('click', () => this.clearLogs());
        
        // Keyboard Shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
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
        this.elements.dropzone.style.transform = 'translateY(-2px)';
        this.elements.dropzone.style.boxShadow = 'var(--shadow-lg), var(--shadow-glow)';
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
        const validTypes = ['audio/mp3', 'audio/wav', 'audio/m4a', 'audio/ogg', 'audio/x-m4a'];
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
        
        // Generate request ID for WebSocket
        this.requestId = this.generateRequestId();
        
        try {
            const formData = new FormData();
            formData.append('file', file);
            
            this.addLog(`📤 Uploading "${file.name}"...`, 'info');
            this.updateProgress(10);
            
            // Connect to WebSocket for real-time logs
            this.connectWebSocket(this.requestId);
            
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
            
            // Use request_id from response if available
            if (data.request_id) {
                this.requestId = data.request_id;
            }
            
            this.currentFile = data;
            this.updateProgress(50);
            
            this.addLog('✅ File uploaded successfully', 'success');
            this.addLog('🎙️ Processing audio with AI...', 'info');
            
            // Display results
            await this.displayResults(data);
            
            this.updateProgress(100);
            this.addLog('🎉 Processing completed!', 'success');
            
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
            }, 5000);
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
        
        // Parse and format the message
        const formatted = this.formatLogMessage(message);
        
        // Add to logs
        this.addLog(formatted.text, level);
        
        // Update progress based on log content
        if (message.includes('transcribing') || message.includes('Transcribing')) {
            this.updateProgress(60);
        } else if (message.includes('summarizing') || message.includes('Summarizing')) {
            this.updateProgress(80);
        } else if (message.includes('complete') || message.includes('Complete')) {
            this.updateProgress(95);
        }
    }

    formatLogMessage(message) {
        // Clean up common prefixes
        let cleanMessage = message
            .replace(/^INFO:[^:]*:/, '')
            .replace(/^DEBUG:[^:]*:/, '')
            .replace(/^ERROR:[^:]*:/, '')
            .trim();
        
        // Add emojis based on content
        if (cleanMessage.includes('upload') || cleanMessage.includes('Upload')) {
            cleanMessage = `📤 ${cleanMessage}`;
        } else if (cleanMessage.includes('transcri') || cleanMessage.includes('Transcri')) {
            cleanMessage = `🎙️ ${cleanMessage}`;
        } else if (cleanMessage.includes('summar') || cleanMessage.includes('Summar')) {
            cleanMessage = `🧠 ${cleanMessage}`;
        } else if (cleanMessage.includes('complete') || cleanMessage.includes('Complete')) {
            cleanMessage = `✅ ${cleanMessage}`;
        } else if (cleanMessage.includes('error') || cleanMessage.includes('Error')) {
            cleanMessage = `❌ ${cleanMessage}`;
        } else if (cleanMessage.includes('warning') || cleanMessage.includes('Warning')) {
            cleanMessage = `⚠️ ${cleanMessage}`;
        }
        
        return { text: cleanMessage };
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

    // Results Display
    async displayResults(data) {
        // Show results, hide empty state
        this.elements.resultsSection.classList.remove('hidden');
        this.elements.emptyState.classList.add('hidden');
        
        // File Info
        this.elements.fileInfoName.textContent = data.filename;
        this.elements.fileInfoSize.textContent = `${data.size_mb} MB`;
        this.elements.fileInfoTime.textContent = new Date(data.uploaded).toLocaleString();
        this.elements.fileInfoSection.classList.remove('hidden');
        
        // Transcript
        this.elements.transcriptDiv.textContent = data.transcript || 'No transcript generated';
        
        // Summary
        this.formatSummary(data.summary);
        
        // Audio Player
        if (data.audio_url) {
            this.elements.audioPlayer.src = data.audio_url;
            this.elements.audioPlayer.load();
        }
        
        // Scroll to results smoothly
        setTimeout(() => {
            this.elements.resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }

    formatSummary(summary) {
        if (!summary) {
            this.elements.summaryDiv.innerHTML = `
                <div class="summary-placeholder">
                    <i class="fas fa-exclamation-circle placeholder-icon"></i>
                    <p>No summary generated</p>
                </div>
            `;
            return;
        }
        
        if (typeof summary === 'string') {
            if (summary.includes('**') || summary.includes('-') || summary.includes('•') || summary.includes('\n')) {
                // Format markdown-like content
                let formatted = summary
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    .replace(/\n\s*[-•]\s*/g, '\n• ')
                    .split('\n')
                    .filter(line => line.trim())
                    .map(line => {
                        if (line.startsWith('• ') || line.startsWith('- ')) {
                            return `<li>${line.substring(2)}</li>`;
                        }
                        return `<p>${line}</p>`;
                    })
                    .join('');
                
                if (formatted.includes('<li>')) {
                    formatted = `<ul class="summary-list">${formatted}</ul>`;
                }
                
                this.elements.summaryDiv.innerHTML = formatted;
            } else {
                this.elements.summaryDiv.innerHTML = `<p>${summary}</p>`;
            }
        } else {
            this.elements.summaryDiv.textContent = summary;
        }
    }

    // Audio Controls
    togglePlayPause() {
        if (this.elements.audioPlayer.paused) {
            this.elements.audioPlayer.play();
            this.elements.playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
        } else {
            this.elements.audioPlayer.pause();
            this.elements.playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
        }
    }

    skip(seconds) {
        this.elements.audioPlayer.currentTime += seconds;
    }

    seekAudio(e) {
        if (this.elements.audioPlayer.duration) {
            this.elements.audioPlayer.currentTime = (e.target.value / 100) * this.elements.audioPlayer.duration;
        }
    }

    adjustVolume(e) {
        this.elements.audioPlayer.volume = e.target.value / 100;
    }

    updateAudioDuration() {
        if (!isNaN(this.elements.audioPlayer.duration) && this.elements.audioPlayer.duration > 0) {
            this.elements.durationEl.textContent = this.formatTime(this.elements.audioPlayer.duration);
        }
    }

    updateAudioProgress() {
        if (this.elements.audioPlayer.duration) {
            const progress = (this.elements.audioPlayer.currentTime / this.elements.audioPlayer.duration) * 100;
            this.elements.progressBar.value = progress;
            this.elements.currentTimeEl.textContent = this.formatTime(this.elements.audioPlayer.currentTime);
        }
    }

    handleAudioEnd() {
        this.elements.playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
        this.elements.progressBar.value = 0;
        this.elements.currentTimeEl.textContent = '0:00';
    }

    // Text Controls
    adjustFontSize(e) {
        const fontSize = e.target.value + 'px';
        this.elements.transcriptDiv.style.fontSize = fontSize;
        this.elements.summaryDiv.style.fontSize = fontSize;
    }

    performSearch() {
        const query = this.elements.searchInput.value.trim();
        const text = this.elements.transcriptDiv.textContent;
        
        if (!query) {
            this.elements.transcriptDiv.innerHTML = text.replace(/<\/?mark>/g, '');
            this.elements.searchResults.textContent = '';
            return;
        }
        
        const regex = new RegExp(`(${this.escapeRegExp(query)})`, 'gi');
        const matches = (text.match(regex) || []).length;
        const highlighted = text.replace(regex, '<mark>$1</mark>');
        
        this.elements.transcriptDiv.innerHTML = highlighted;
        this.elements.searchResults.textContent = `${matches} match${matches !== 1 ? 'es' : ''}`;
    }

    escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // Copy/Export Functions
    async copyTranscript() {
        try {
            await navigator.clipboard.writeText(this.elements.transcriptDiv.textContent);
            this.showToast('Transcript copied to clipboard!', 'success');
        } catch (err) {
            this.showToast('Failed to copy transcript', 'error');
        }
    }

    async copySummary() {
        try {
            const text = this.elements.summaryDiv.textContent || this.elements.summaryDiv.innerText;
            await navigator.clipboard.writeText(text);
            this.showToast('Summary copied to clipboard!', 'success');
        } catch (err) {
            this.showToast('Failed to copy summary', 'error');
        }
    }

    async copyAll() {
        try {
            const transcript = this.elements.transcriptDiv.textContent;
            const summary = this.elements.summaryDiv.textContent || this.elements.summaryDiv.innerText;
            const content = `TRANSCRIPT:\n\n${transcript}\n\n\nSUMMARY:\n\n${summary}`;
            
            await navigator.clipboard.writeText(content);
            this.showToast('All content copied to clipboard!', 'success');
        } catch (err) {
            this.showToast('Failed to copy content', 'error');
        }
    }

    exportTranscript() {
        if (!this.currentFile) return;
        
        const content = `TranscribeFlow - AI Transcript\n${'='.repeat(50)}\n\n${this.elements.transcriptDiv.textContent}`;
        const filename = `${this.currentFile.filename.replace(/\.[^/.]+$/, '')}_transcript.txt`;
        
        this.downloadFile(content, filename);
        this.showToast('Transcript downloaded!', 'success');
    }

    exportSummary() {
        if (!this.currentFile) return;
        
        const text = this.elements.summaryDiv.textContent || this.elements.summaryDiv.innerText;
        const content = `TranscribeFlow - AI Summary\n${'='.repeat(50)}\n\n${text}`;
        const filename = `${this.currentFile.filename.replace(/\.[^/.]+$/, '')}_summary.txt`;
        
        this.downloadFile(content, filename);
        this.showToast('Summary downloaded!', 'success');
    }

    exportAll() {
        if (!this.currentFile) return;
        
        const transcript = this.elements.transcriptDiv.textContent;
        const summary = this.elements.summaryDiv.textContent || this.elements.summaryDiv.innerText;
        const content = `TranscribeFlow - AI Results\n${'='.repeat(60)}\n\nTRANSCRIPT:\n\n${transcript}\n\n${'='.repeat(60)}\n\nSUMMARY:\n\n${summary}`;
        const filename = `${this.currentFile.filename.replace(/\.[^/.]+$/, '')}_complete.txt`;
        
        this.downloadFile(content, filename);
        this.showToast('Complete results downloaded!', 'success');
    }

    downloadFile(content, filename) {
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
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
                this.resetApp();
                this.showToast('All files cleared successfully!', 'success');
                this.addLog('Cleared all uploaded files and results', 'info');
            } else {
                throw new Error('Server responded with error');
            }
        } catch (error) {
            console.warn('Could not clear server files:', error);
            this.resetApp();
            this.showToast('Cleared local data only', 'warning');
        }
    }

    resetApp() {
        this.currentFile = null;
        this.isProcessing = false;
        
        // Reset file input
        this.elements.audioFileInput.value = '';
        this.elements.fileNameDisplay.textContent = '';
        this.elements.dropzoneText.textContent = 'Click to select or drag & drop';
        
        // Hide sections
        this.elements.fileInfoSection.classList.add('hidden');
        this.elements.resultsSection.classList.add('hidden');
        this.elements.emptyState.classList.remove('hidden');
        
        // Reset audio player
        this.elements.audioPlayer.src = '';
        this.elements.audioPlayer.pause();
        this.elements.playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
        this.elements.progressBar.value = 0;
        this.elements.currentTimeEl.textContent = '0:00';
        
        // Reset text content
        this.elements.transcriptDiv.textContent = 'Upload audio to see AI transcription...';
        this.elements.summaryDiv.innerHTML = `
            <div class="summary-placeholder">
                <i class="fas fa-brain placeholder-icon"></i>
                <p>AI summary will appear here after processing</p>
            </div>
        `;
        
        // Reset search
        this.elements.searchInput.value = '';
        this.elements.searchResults.textContent = '';
        
        // Reset font size
        this.elements.fontSizeSelect.value = '14';
        this.adjustFontSize({ target: this.elements.fontSizeSelect });
        
        // Reset processing state
        this.setProcessingState(false);
        this.hideProcessing();
        
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
            this.elements.processBtnText.textContent = 'Process Audio';
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
    formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

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

    // Keyboard Shortcuts
    handleKeyboardShortcuts(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
            return;
        }
        
        switch(e.key) {
            case ' ':
                e.preventDefault();
                if (this.elements.audioPlayer.src) {
                    this.togglePlayPause();
                }
                break;
                
            case 'ArrowLeft':
                e.preventDefault();
                if (this.elements.audioPlayer.src) {
                    this.skip(-10);
                }
                break;
                
            case 'ArrowRight':
                e.preventDefault();
                if (this.elements.audioPlayer.src) {
                    this.skip(10);
                }
                break;
                
            case 'Escape':
                e.preventDefault();
                this.elements.searchInput.blur();
                break;
                
            case 'f':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    this.elements.searchInput.focus();
                }
                break;
        }
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

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.transcribeFlow = new TranscribeFlow();
});
