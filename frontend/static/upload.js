// Upload Page JavaScript - Complete Version with Authentication and File History

/**
 * Main controller class for the audio upload page
 * Handles file selection, batch uploads, WebSocket logs, and file history
 */
class UploadPage {
    constructor() {
        this.currentFile = null;              // Currently processed file data
        this.selectedFiles = [];               // Batch file tracking
        this.isProcessing = false;              // Processing state flag
        this.ws = null;                         // WebSocket connection for real-time logs
        this.requestId = null;                   // Unique request ID for WebSocket connection
        this.logs = [];                          // Array of log entries
        this.lastScrollTop = 0;                  // Track scroll position for navbar hide/show
        this.isNavHidden = false;                 // Navbar visibility state

        this.checkAuthentication();

        this.initializeElements();
        this.setupEventListeners();
        this.setupNavigationScroll();
        this.initializeApp();
        this.fetchUserInfo();
        this.loadFileHistory();
    }

    /**
     * Verify user authentication status
     * Redirects to login if no valid token found
     */
    checkAuthentication() {
        console.log('🔐 Checking authentication...');
        const token = localStorage.getItem('access_token');
        console.log('Token found:', token ? 'YES' : 'NO');

        if (!token) {
            console.log('❌ No token found, redirecting to login...');
            window.location.href = '/login';
        }
    }

    /**
     * Wrapper for authenticated API requests
     * Automatically adds auth token and handles 401 responses
     * @param {string} url - API endpoint URL
     * @param {Object} options - Fetch options
     * @returns {Promise<Response|null>} Fetch response or null if unauthorized
     */
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

    /**
     * Fetch and display current user information
     */
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

    /**
     * Cache DOM elements for frequent access
     */
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
            summaryMode: document.getElementById('summaryMode'),

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
            diarizationOptions: document.getElementById('diarizationOptions'),

            // Batch elements
            batchFileList: document.getElementById('batchFileList'),
            batchResultsReady: document.getElementById('batchResultsReady'),
            batchResultsSummary: document.getElementById('batchResultsSummary'),
            batchResultsList: document.getElementById('batchResultsList'),
            batchDashboardBtn: document.getElementById('batchDashboardBtn'),
            batchAnotherBtn: document.getElementById('batchAnotherBtn'),

            fileHistory: document.getElementById('fileHistory') ||
                document.querySelector('.file-history-list') ||
                document.querySelector('.files-list')
        };

        if (this.elements.fileNameDisplay) {
            this.elements.fileNameDisplay.style.display = 'none';
        }
    }

    /**
     * Initialize all event listeners for user interactions
     */
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

        // Diarization toggle - show/hide options panel
        if (this.elements.enableDiarization) {
            this.elements.enableDiarization.addEventListener('change', () => {
                const optionsPanel = this.elements.diarizationOptions;
                if (optionsPanel) {
                    if (this.elements.enableDiarization.checked) {
                        optionsPanel.classList.remove('hidden');
                    } else {
                        optionsPanel.classList.add('hidden');
                        // Reset speaker count when disabled
                        if (this.elements.numSpeakers) {
                            this.elements.numSpeakers.value = '';
                        }
                    }
                }
            });
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

        // Batch action buttons
        if (this.elements.batchDashboardBtn) {
            this.elements.batchDashboardBtn.addEventListener('click', () => {
                window.location.href = '/dashboard';
            });
        }

        if (this.elements.batchAnotherBtn) {
            this.elements.batchAnotherBtn.addEventListener('click', () => this.processAnother());
        }
    }

    /**
     * Setup scroll behavior to hide/show navigation bar
     */
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

    /**
     * Handle file selection from input or drop
     * @param {Event} e - Change event from file input
     */
    handleFileSelect(e) {
        const files = Array.from(e.target.files);
        console.log('📁 Files selected:', files.length);

        if (!files.length) return;

        // Validate each file
        const validFiles = [];
        for (const file of files) {
            if (!this.validateFile(file)) {
                this.showToast(`Invalid file: ${file.name}. Skipped.`, 'warning');
                continue;
            }
            validFiles.push(file);
        }

        if (validFiles.length === 0) {
            this.showToast('No valid files selected.', 'error');
            this.resetFileSelection();
            return;
        }

        if (validFiles.length > 10) {
            this.showToast('Maximum 10 files per batch. Only first 10 will be used.', 'warning');
            validFiles.splice(10);
        }

        this.selectedFiles = validFiles;

        if (validFiles.length === 1) {
            // Single file mode
            const file = validFiles[0];
            const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
            const displayName = file.name.length > 30 ? file.name.substring(0, 27) + '...' : file.name;
            this.elements.fileNameDisplay.textContent = `${displayName} • ${sizeMB} MB`;
            this.elements.fileNameDisplay.style.display = 'flex';
            this.elements.dropzoneText.textContent = "File selected ✓";
            this.elements.dropzoneHint.textContent = "Click to change file";
            this.hideBatchFileList();
            this.addLog(`📁 Selected: ${file.name} (${sizeMB} MB)`, 'info');
            this.showToast('File selected successfully', 'success');
        } else {
            // Batch mode
            this.elements.fileNameDisplay.style.display = 'none';
            this.elements.dropzoneText.textContent = `${validFiles.length} files selected ✓`;
            this.elements.dropzoneHint.textContent = "Click to change files";
            this.renderBatchFileList();
            const totalSize = validFiles.reduce((sum, f) => sum + f.size, 0);
            this.addLog(`📁 Batch: ${validFiles.length} files (${(totalSize / (1024 * 1024)).toFixed(1)} MB total)`, 'info');
            this.showToast(`${validFiles.length} files selected`, 'success');
        }
    }

    /**
     * Handle drag over event for dropzone
     * @param {DragEvent} e - Drag event
     */
    handleDragOver(e) {
        e.preventDefault();
        if (this.elements.dropzone) {
            this.elements.dropzone.style.borderColor = '#5eead4';
            this.elements.dropzone.style.background = 'rgba(94, 234, 212, 0.05)';
        }
    }

    /**
     * Handle drag leave event for dropzone
     * @param {DragEvent} e - Drag event
     */
    handleDragLeave(e) {
        e.preventDefault();
        if (this.elements.dropzone) {
            this.elements.dropzone.style.borderColor = 'rgba(94, 234, 212, 0.3)';
            this.elements.dropzone.style.background = 'var(--bg-tertiary)';
        }
    }

    /**
     * Handle file drop event
     * @param {DragEvent} e - Drop event
     */
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

    /**
     * Validate file type and size
     * @param {File} file - File to validate
     * @returns {boolean} True if file is valid
     */
    validateFile(file) {
        const validTypes = ['audio/mp3', 'audio/wav', 'audio/m4a', 'audio/ogg', 'audio/x-m4a', 'audio/mpeg'];
        const maxSize = 25 * 1024 * 1024;
        const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
        const validExtensions = ['.mp3', '.wav', '.m4a', '.ogg'];

        return (validTypes.includes(file.type) || validExtensions.includes(fileExtension)) && file.size <= maxSize;
    }

    /**
     * Reset file selection UI and state
     */
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
        this.selectedFiles = [];
        this.hideBatchFileList();
    }

    // ==========================================
    // Batch File List Display
    // ==========================================

    /**
     * Render the list of selected files for batch upload
     */
    renderBatchFileList() {
        if (!this.elements.batchFileList) return;

        this.elements.batchFileList.classList.remove('hidden');
        this.elements.batchFileList.innerHTML = this.selectedFiles.map((file, idx) => {
            const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
            const ext = file.name.split('.').pop().toUpperCase();
            return `
                <div class="batch-file-item" data-index="${idx}">
                    <div class="batch-file-info">
                        <div class="batch-file-icon">
                            <i class="fas fa-file-audio"></i>
                        </div>
                        <div class="batch-file-details">
                            <span class="batch-file-name">${file.name}</span>
                            <span class="batch-file-meta">${ext} • ${sizeMB} MB</span>
                        </div>
                    </div>
                    <div class="batch-file-actions">
                        <label class="batch-diarization-toggle" title="Speaker Diarization">
                            <input type="checkbox" class="batch-diarization-cb" data-index="${idx}">
                            <i class="fas fa-users"></i>
                        </label>
                        <button type="button" class="batch-file-remove" data-index="${idx}" title="Remove file">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        // Attach remove handlers
        this.elements.batchFileList.querySelectorAll('.batch-file-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(e.currentTarget.dataset.index);
                this.removeFileFromBatch(idx);
            });
        });
    }

    /**
     * Remove a file from the batch selection
     * @param {number} index - Index of file to remove
     */
    removeFileFromBatch(index) {
        this.selectedFiles.splice(index, 1);

        if (this.selectedFiles.length === 0) {
            this.resetFileSelection();
        } else if (this.selectedFiles.length === 1) {
            // Switch to single file mode
            const file = this.selectedFiles[0];
            const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
            const displayName = file.name.length > 30 ? file.name.substring(0, 27) + '...' : file.name;
            this.elements.fileNameDisplay.textContent = `${displayName} • ${sizeMB} MB`;
            this.elements.fileNameDisplay.style.display = 'flex';
            this.elements.dropzoneText.textContent = "File selected ✓";
            this.elements.dropzoneHint.textContent = "Click to change file";
            this.hideBatchFileList();
        } else {
            this.elements.dropzoneText.textContent = `${this.selectedFiles.length} files selected ✓`;
            this.renderBatchFileList();
        }

        this.addLog(`🗑️ Removed file, ${this.selectedFiles.length} remaining`, 'info');
    }

    /**
     * Hide the batch file list
     */
    hideBatchFileList() {
        if (this.elements.batchFileList) {
            this.elements.batchFileList.classList.add('hidden');
            this.elements.batchFileList.innerHTML = '';
        }
    }

    /**
     * Handle form submission for upload
     * @param {Event} e - Submit event
     */
    async handleUpload(e) {
        e.preventDefault();

        // Use selectedFiles array
        if (this.selectedFiles.length === 0) {
            // Fallback to DOM input
            const domFiles = Array.from(this.elements.audioFileInput.files);
            if (domFiles.length > 0) {
                this.selectedFiles = domFiles;
            } else {
                this.showToast('Please select an audio file', 'error');
                if (this.elements.dropzone) {
                    this.elements.dropzone.style.borderColor = '#ef4444';
                    setTimeout(() => {
                        this.elements.dropzone.style.borderColor = 'rgba(94, 234, 212, 0.3)';
                    }, 1000);
                }
                return;
            }
        }

        if (this.isProcessing) return;

        if (this.selectedFiles.length === 1) {
            // Single file — existing flow
            await this.processAudioFile(this.selectedFiles[0]);
        } else {
            // Batch upload
            await this.handleBatchUpload();
        }
    }

    /**
     * Process a single audio file
     * @param {File} file - Audio file to process
     */
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
            formData.append('summary_mode', this.elements.summaryMode ? this.elements.summaryMode.value : 'bullet');

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

    // ==========================================
    // Batch Upload
    // ==========================================

    /**
     * Handle batch upload of multiple files
     * Processes files sequentially with individual progress tracking
     */
    async handleBatchUpload() {
        this.isProcessing = true;
        this.setProcessingState(true);
        this.showProcessing();
        this.hideResultsReady();
        this.hideBatchResults();

        const selectedLanguage = this.elements.inputLanguage.value;
        this.requestId = this.generateRequestId();
        this.connectWebSocket(this.requestId);

        await new Promise(resolve => setTimeout(resolve, 200));

        // Collect per-file diarization settings from checkboxes
        const diarizationSettings = [];
        this.elements.batchFileList.querySelectorAll('.batch-diarization-cb').forEach(cb => {
            diarizationSettings.push(cb.checked);
        });

        const numSpeakersVal = this.elements.numSpeakers ? this.elements.numSpeakers.value : '';

        const totalFiles = this.selectedFiles.length;
        const results = [];
        let successCount = 0;
        let errorCount = 0;
        let lastSuccessData = null;

        this.addLog(`📤 Processing ${totalFiles} files...`, 'info');

        // Show initial batch results with all files as "pending"
        this.showBatchResultsProgress(this.selectedFiles, results);

        for (let i = 0; i < totalFiles; i++) {
            const file = this.selectedFiles[i];
            const fileDiarization = diarizationSettings[i] || false;

            this.addLog(`📄 [${i + 1}/${totalFiles}] Processing: ${file.name}`, 'info');

            try {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('language', selectedLanguage);
                formData.append('summary_mode', this.elements.summaryMode ? this.elements.summaryMode.value : 'bullet');
                formData.append('enable_diarization', fileDiarization ? 'true' : 'false');

                if (fileDiarization && numSpeakersVal) {
                    formData.append('num_speakers', numSpeakersVal);
                }

                if (fileDiarization) {
                    this.addLog(`🎤 Diarization enabled for ${file.name}`, 'info');
                }

                const response = await this.fetchWithAuth('/api/upload', {
                    method: 'POST',
                    body: formData
                });

                if (!response || !response.ok) {
                    const errorData = await response?.json().catch(() => ({}));
                    throw new Error(errorData?.detail || 'Upload failed');
                }

                const data = await response.json();
                lastSuccessData = data;
                successCount++;

                results.push({
                    filename: file.name,
                    status: 'success',
                    id: data.id
                });

                this.addLog(`✅ [${i + 1}/${totalFiles}] Complete: ${file.name}`, 'success');

            } catch (error) {
                errorCount++;
                results.push({
                    filename: file.name,
                    status: 'error',
                    error: error.message
                });

                this.addLog(`❌ [${i + 1}/${totalFiles}] Failed: ${file.name} — ${error.message}`, 'error');
            }

            // Update results display after each file
            this.showBatchResultsProgress(this.selectedFiles, results);
        }

        // All done
        this.hideProcessing();
        this.isProcessing = false;
        this.setProcessingState(false);

        // Store last successful result for "View Results"
        if (lastSuccessData) {
            this.currentFile = lastSuccessData;
            sessionStorage.setItem('transcribeResults', JSON.stringify(lastSuccessData));
            localStorage.setItem('lastResultId', lastSuccessData.id);
        }

        // Show final completion
        this.showBatchComplete(results, successCount, errorCount, totalFiles);
        this.loadFileHistory();

        this.addLog(`🎉 Batch complete: ${successCount} succeeded, ${errorCount} failed out of ${totalFiles}`,
            errorCount === 0 ? 'success' : 'warning');
        this.showToast(
            `All files processed! ${successCount} succeeded${errorCount > 0 ? `, ${errorCount} failed` : ''}.`,
            errorCount === 0 ? 'success' : 'warning'
        );

        setTimeout(() => {
            if (this.ws) {
                this.ws.close();
                this.ws = null;
            }
        }, 2000);
    }

    /**
     * Display batch processing progress in real-time
     * @param {Array} allFiles - All files in the batch
     * @param {Array} completedResults - Results for completed files
     */
    showBatchResultsProgress(allFiles, completedResults) {
        if (!this.elements.batchResultsReady) return;

        const totalFiles = allFiles.length;
        const doneCount = completedResults.length;

        if (this.elements.batchResultsSummary) {
            this.elements.batchResultsSummary.textContent =
                `Processing ${doneCount}/${totalFiles} files...`;
        }

        if (this.elements.batchResultsList) {
            this.elements.batchResultsList.innerHTML = allFiles.map((file, idx) => {
                const result = completedResults[idx];
                let icon, statusClass, statusText;

                if (!result) {
                    // Pending
                    icon = 'clock';
                    statusClass = 'batch-result-pending';
                    statusText = 'Waiting...';
                } else if (result.status === 'success') {
                    icon = 'check-circle';
                    statusClass = 'batch-result-success';
                    statusText = 'Transcription complete';
                } else {
                    icon = 'exclamation-circle';
                    statusClass = 'batch-result-error';
                    statusText = result.error || 'Failed';
                }

                // Currently processing?
                if (idx === doneCount && doneCount < totalFiles) {
                    icon = 'spinner fa-spin';
                    statusClass = 'batch-result-processing';
                    statusText = 'Processing...';
                }

                return `
                    <div class="batch-result-item ${statusClass}">
                        <div class="batch-result-icon">
                            <i class="fas fa-${icon}"></i>
                        </div>
                        <div class="batch-result-info">
                            <span class="batch-result-name">${file.name}</span>
                            <span class="batch-result-status">${statusText}</span>
                        </div>
                    </div>
                `;
            }).join('');
        }

        this.elements.batchResultsReady.classList.remove('hidden');
    }

    /**
     * Display final batch completion status
     * @param {Array} results - Array of file results
     * @param {number} successCount - Number of successful files
     * @param {number} errorCount - Number of failed files
     * @param {number} totalFiles - Total number of files
     */
    showBatchComplete(results, successCount, errorCount, totalFiles) {
        if (!this.elements.batchResultsReady) return;

        if (this.elements.batchResultsSummary) {
            if (errorCount === 0) {
                this.elements.batchResultsSummary.textContent =
                    `✅ All ${totalFiles} files processed successfully!`;
            } else {
                this.elements.batchResultsSummary.textContent =
                    `${successCount} succeeded, ${errorCount} failed out of ${totalFiles} files.`;
            }
        }

        // Update header text
        const headerEl = this.elements.batchResultsReady.querySelector('h3');
        if (headerEl) {
            headerEl.textContent = errorCount === 0 ? 'All Transcriptions Complete!' : 'Batch Processing Complete';
        }

        // Final list with success/error states
        if (this.elements.batchResultsList) {
            this.elements.batchResultsList.innerHTML = results.map(result => {
                const isError = result.status === 'error';
                const icon = isError ? 'exclamation-circle' : 'check-circle';
                const statusClass = isError ? 'batch-result-error' : 'batch-result-success';
                const statusText = isError ? (result.error || 'Failed') : 'Transcription complete';

                return `
                    <div class="batch-result-item ${statusClass}">
                        <div class="batch-result-icon">
                            <i class="fas fa-${icon}"></i>
                        </div>
                        <div class="batch-result-info">
                            <span class="batch-result-name">${result.filename}</span>
                            <span class="batch-result-status">${statusText}</span>
                        </div>
                    </div>
                `;
            }).join('');
        }

        this.elements.batchResultsReady.classList.remove('hidden');
    }

    /**
     * Hide batch results panel
     */
    hideBatchResults() {
        if (this.elements.batchResultsReady) {
            this.elements.batchResultsReady.classList.add('hidden');
        }
    }

    /**
     * Establish WebSocket connection for real-time logs
     * @param {string} requestId - Unique request ID for this upload session
     */
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

    /**
     * Load user's file history from API
     */
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

    /**
     * Display file history in the UI
     * @param {Array} files - Array of file objects from API
     */
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

    /**
     * Create HTML for a file history item
     * @param {Object} file - File object from API
     * @returns {string} HTML string
     */
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

    /**
     * Attach event handlers to file history items
     */
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

    /**
     * Delete a file from history
     * @param {string} fileId - ID of file to delete
     */
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

    /**
     * Format file size bytes to human readable string
     * @param {number} bytes - Size in bytes
     * @returns {string} Formatted size
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    }

    /**
     * Format date for display with relative time
     * @param {string} dateString - ISO date string
     * @returns {string} Formatted date
     */
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

    /**
     * Convert language code to display name
     * @param {string} code - Language code
     * @returns {string} Language display name
     */
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

    /**
     * Show the results ready panel
     */
    showResultsReady() {
        if (this.elements.resultsReady) {
            this.elements.resultsReady.classList.remove('hidden');
        }
    }

    /**
     * Hide the results ready panel
     */
    hideResultsReady() {
        if (this.elements.resultsReady) {
            this.elements.resultsReady.classList.add('hidden');
        }
    }

    /**
     * Navigate to results page for the processed file
     */
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

    /**
     * Reset the page for another upload
     */
    processAnother() {
        if (this.elements.uploadForm) {
            this.elements.uploadForm.reset();
        }
        this.hideResultsReady();
        this.hideBatchResults();
        this.resetFileSelection();
        this.addLog('🔄 Ready for new upload', 'info');
    }

    /**
     * Add a log entry to the logs panel
     * @param {string} message - Log message
     * @param {string} level - Log level (info, success, error, warning)
     */
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

    /**
     * Clear all log entries
     */
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

    /**
     * Clear all files from the user's account
     */
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

    /**
     * Reset the entire upload page to initial state
     */
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

    /**
     * Update UI for processing state
     * @param {boolean} processing - Whether processing is active
     */
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

    /**
     * Show processing indicator
     */
    showProcessing() {
        if (this.elements.loadingIndicator) {
            this.elements.loadingIndicator.classList.remove('hidden');
        }
    }

    /**
     * Hide processing indicator
     */
    hideProcessing() {
        if (this.elements.loadingIndicator) {
            this.elements.loadingIndicator.classList.add('hidden');
        }
    }

    /**
     * Generate a unique request ID for WebSocket connection
     * @returns {string} Unique request ID
     */
    generateRequestId() {
        return 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Display a toast notification
     * @param {string} message - Message to display
     * @param {string} type - Toast type (success, error, warning, info)
     */
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

    /**
     * Initialize the application with default logs
     */
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

    /**
     * Check if the backend API is healthy
     */
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