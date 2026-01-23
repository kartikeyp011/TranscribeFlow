// TranscribeFlow - Modern Audio Transcription App
// Enhanced with improved transcript UI/UX

class TranscribeFlow {
    constructor() {
        this.currentFile = null;
        this.isProcessing = false;
        this.ws = null;
        this.requestId = null;
        this.logs = [];
        this.playbackSpeed = 1.0;
        this.searchResults = [];
        this.currentSearchIndex = -1;
        this.isReading = false;
        this.speechSynthesis = window.speechSynthesis;

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
            fileInfoLanguage: document.getElementById('fileInfoLanguage'),
            playerEmptyState: document.getElementById('playerEmptyState'),

            // Audio Player Elements
            audioPlayer: document.getElementById('audioPlayer'),
            playPauseBtn: document.getElementById('playPause'),
            skipBackBtn: document.getElementById('skipBack'),
            skipForwardBtn: document.getElementById('skipForward'),
            progressBar: document.getElementById('progressBar'),
            currentTimeEl: document.getElementById('currentTime'),
            durationEl: document.getElementById('duration'),
            volumeBar: document.getElementById('volumeBar'),
            speedControlBtn: document.getElementById('speedControl'),
            downloadAudioBtn: document.getElementById('downloadAudio'),

            // Results Section
            resultsSection: document.getElementById('results'),
            emptyState: document.getElementById('emptyState'),
            transcriptDiv: document.getElementById('transcript'),
            summaryDiv: document.getElementById('summary'),
            fontSizeSelect: document.getElementById('fontSize'),
            searchInput: document.getElementById('searchInput'),
            searchResults: document.getElementById('searchResults'),
            wordCount: document.getElementById('wordCount'),

            // Search Controls
            searchPrevBtn: document.getElementById('searchPrev'),
            searchNextBtn: document.getElementById('searchNext'),
            clearSearchBtn: document.getElementById('clearSearch'),

            // Scroll Controls
            scrollToTopBtn: document.getElementById('scrollToTop'),
            scrollToBottomBtn: document.getElementById('scrollToBottom'),

            // Read Aloud
            speakTranscriptBtn: document.getElementById('speakTranscript'),

            // Translation Elements
            targetLanguageSelect: document.getElementById('targetLanguage'),
            translateBtn: document.getElementById('translateBtn'),
            translatedTranscriptCard: document.getElementById('translatedTranscriptCard'),
            translatedTranscript: document.getElementById('translatedTranscript'),
            translatedSummaryCard: document.getElementById('translatedSummaryCard'),
            translatedSummary: document.getElementById('translatedSummary'),
            copyTranslatedBtn: document.getElementById('copyTranslated'),
            closeTranslationBtn: document.getElementById('closeTranslation'),
            copyTranslatedSummaryBtn: document.getElementById('copyTranslatedSummary'),
            translationInfo: document.getElementById('translationInfo'),

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
        this.elements.speedControlBtn.addEventListener('click', () => this.togglePlaybackSpeed());
        this.elements.downloadAudioBtn.addEventListener('click', () => this.downloadAudio());

        // Audio Events
        this.elements.audioPlayer.addEventListener('loadedmetadata', () => this.updateAudioDuration());
        this.elements.audioPlayer.addEventListener('timeupdate', () => this.updateAudioProgress());
        this.elements.audioPlayer.addEventListener('ended', () => this.handleAudioEnd());
        this.elements.audioPlayer.addEventListener('play', () => this.updatePlayPauseButton(true));
        this.elements.audioPlayer.addEventListener('pause', () => this.updatePlayPauseButton(false));

        // Font Size Control - Apply to whole page
        this.elements.fontSizeSelect.addEventListener('change', (e) => this.adjustGlobalFontSize(e));

        // Search Controls
        this.elements.searchInput.addEventListener('input', () => this.performSearch());
        this.elements.searchPrevBtn.addEventListener('click', () => this.navigateSearch(-1));
        this.elements.searchNextBtn.addEventListener('click', () => this.navigateSearch(1));
        this.elements.clearSearchBtn.addEventListener('click', () => this.clearSearch());

        // Scroll Controls
        this.elements.scrollToTopBtn.addEventListener('click', () => this.scrollToTop());
        this.elements.scrollToBottomBtn.addEventListener('click', () => this.scrollToBottom());

        // Read Aloud
        this.elements.speakTranscriptBtn.addEventListener('click', () => this.toggleReadAloud());

        // Translation Controls
        this.elements.translateBtn.addEventListener('click', () => this.translateContent());
        this.elements.copyTranslatedBtn.addEventListener('click', () => this.copyTranslated());
        this.elements.closeTranslationBtn.addEventListener('click', () => this.closeTranslation());
        this.elements.copyTranslatedSummaryBtn.addEventListener('click', () => this.copyTranslatedSummary());

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

        // Text selection in transcript
        this.elements.transcriptDiv.addEventListener('click', (e) => this.handleTranscriptClick(e));
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
        this.clearSearch();

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

            // Display results
            await this.displayResults(data);

            this.updateProgress(100);
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

    // Results Display
    async displayResults(data) {
        // Show results, hide empty state
        this.elements.resultsSection.classList.remove('hidden');
        this.elements.emptyState.classList.add('hidden');

        // File Info
        this.elements.fileInfoName.textContent = data.filename;
        this.elements.fileInfoSize.textContent = `${data.size_mb} MB`;
        this.elements.fileInfoTime.textContent = new Date(data.uploaded).toLocaleString();
        
        // Get selected language name
        const inputLanguageSelect = document.getElementById('inputLanguage');
        const selectedOption = inputLanguageSelect.options[inputLanguageSelect.selectedIndex];
        this.elements.fileInfoLanguage.textContent = selectedOption ? selectedOption.text.split(' (')[0] : 'Unknown';
        
        // Show file info, hide empty state for player
        this.elements.fileInfoSection.classList.remove('hidden');
        this.elements.playerEmptyState.classList.add('hidden');

        // Transcript
        if (data.transcript) {
            this.elements.transcriptDiv.innerHTML = this.formatTranscript(data.transcript);
            this.updateWordCount(data.transcript);
        } else {
            this.elements.transcriptDiv.innerHTML = `
                <div class="transcript-placeholder">
                    <div class="placeholder-icon">
                        <i class="fas fa-exclamation-circle"></i>
                    </div>
                    <h4>No Transcript Generated</h4>
                    <p>The audio file was processed but no transcript was generated.</p>
                </div>
            `;
            this.elements.wordCount.textContent = '0 words';
        }

        // Summary
        this.formatSummary(data.summary);

        // Audio Player
        if (data.audio_url) {
            this.elements.audioPlayer.src = data.audio_url;
            this.elements.audioPlayer.load();
            // Reset playback speed to 1.0
            this.playbackSpeed = 1.0;
            this.elements.audioPlayer.playbackRate = 1.0;
            this.elements.speedControlBtn.innerHTML = '<i class="fas fa-tachometer-alt"></i><span>1.0x</span>';
        }

        // Scroll to results smoothly
        setTimeout(() => {
            this.elements.resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }

    formatTranscript(text) {
        // Remove HTML tags if any
        text = text.replace(/<[^>]*>/g, '');
        
        // Split into paragraphs
        const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());
        
        // Format each paragraph
        return paragraphs.map(paragraph => {
            const lines = paragraph.split('\n').filter(line => line.trim());
            if (lines.length === 1) {
                return `<p class="transcript-paragraph">${lines[0].trim()}</p>`;
            } else {
                return lines.map(line => 
                    `<p class="transcript-line">${line.trim()}</p>`
                ).join('');
            }
        }).join('');
    }

    updateWordCount(text) {
        const words = text.trim().split(/\s+/).filter(word => word.length > 0);
        const wordCount = words.length;
        this.elements.wordCount.textContent = `${wordCount.toLocaleString()} words`;
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
        } else {
            this.elements.audioPlayer.pause();
        }
    }

    updatePlayPauseButton(isPlaying) {
        if (isPlaying) {
            this.elements.playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
        } else {
            this.elements.playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
        }
    }

    skip(seconds) {
        if (this.elements.audioPlayer.duration) {
            this.elements.audioPlayer.currentTime += seconds;
            this.showToast(`Skipped ${seconds > 0 ? 'forward' : 'back'} ${Math.abs(seconds)} seconds`, 'info');
        }
    }

    seekAudio(e) {
        if (this.elements.audioPlayer.duration) {
            const seekTime = (e.target.value / 100) * this.elements.audioPlayer.duration;
            this.elements.audioPlayer.currentTime = seekTime;
        }
    }

    adjustVolume(e) {
        this.elements.audioPlayer.volume = e.target.value / 100;
    }

    togglePlaybackSpeed() {
        const speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
        const currentIndex = speeds.indexOf(this.playbackSpeed);
        const nextIndex = (currentIndex + 1) % speeds.length;
        this.playbackSpeed = speeds[nextIndex];
        
        this.elements.audioPlayer.playbackRate = this.playbackSpeed;
        this.elements.speedControlBtn.innerHTML = `<i class="fas fa-tachometer-alt"></i><span>${this.playbackSpeed.toFixed(2)}x</span>`;
        
        this.showToast(`Playback speed: ${this.playbackSpeed.toFixed(2)}x`, 'info');
    }

    downloadAudio() {
        if (!this.currentFile || !this.currentFile.audio_url) {
            this.showToast('No audio file available to download', 'warning');
            return;
        }

        const a = document.createElement('a');
        a.href = this.currentFile.audio_url;
        a.download = this.currentFile.filename || 'audio_file';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        this.showToast('Audio file downloaded!', 'success');
    }

    updateAudioDuration() {
        if (!isNaN(this.elements.audioPlayer.duration) && this.elements.audioPlayer.duration > 0) {
            this.elements.durationEl.textContent = this.formatTime(this.elements.audioPlayer.duration);
        }
    }

    updateAudioProgress() {
        const audio = this.elements.audioPlayer;

        if (!Number.isFinite(audio.duration) || audio.duration <= 0) {
            this.elements.currentTimeEl.textContent = '0:00';
            this.elements.durationEl.textContent = '0:00';
            return;
        }

        const progress = (audio.currentTime / audio.duration) * 100;

        if (Number.isFinite(progress)) {
            this.elements.progressBar.value = progress;
        }

        this.elements.currentTimeEl.textContent = this.formatTime(audio.currentTime);
        this.elements.durationEl.textContent = this.formatTime(audio.duration);
    }

    handleAudioEnd() {
        this.elements.playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
        this.elements.progressBar.value = 0;
        this.elements.currentTimeEl.textContent = '0:00';
    }

    // Text Controls
    adjustGlobalFontSize(e) {
        const fontSize = e.target.value + 'px';
        // Apply to the entire document
        document.documentElement.style.fontSize = fontSize;
        this.showToast(`Font size set to ${e.target.selectedOptions[0].text}`, 'success');
    }

    // Search Functionality
    performSearch() {
        const query = this.elements.searchInput.value.trim();
        const transcriptContent = this.elements.transcriptDiv.textContent;

        if (!query) {
            this.clearSearch();
            return;
        }

        try {
            const regex = new RegExp(this.escapeRegExp(query), 'gi');
            const matches = transcriptContent.match(regex) || [];
            
            if (matches.length === 0) {
                this.searchResults = [];
                this.currentSearchIndex = -1;
                this.elements.searchResults.textContent = '0 matches';
                this.showToast('No matches found', 'info');
                return;
            }

            // Store search results
            this.searchResults = [];
            let match;
            while ((match = regex.exec(transcriptContent)) !== null) {
                this.searchResults.push({
                    index: match.index,
                    length: match[0].length
                });
            }

            this.currentSearchIndex = 0;
            this.elements.searchResults.textContent = `${this.searchResults.length} match${this.searchResults.length !== 1 ? 'es' : ''}`;
            
            // Highlight all matches and scroll to first
            this.highlightSearchResults();
            this.navigateToSearchResult(0);

        } catch (error) {
            console.error('Search error:', error);
            this.showToast('Invalid search pattern', 'error');
        }
    }

    escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    highlightSearchResults() {
        const query = this.elements.searchInput.value.trim();
        if (!query) return;

        const transcriptContent = this.elements.transcriptDiv.textContent;
        const regex = new RegExp(`(${this.escapeRegExp(query)})`, 'gi');
        
        let highlighted = transcriptContent;
        let offset = 0;
        
        this.searchResults.forEach((result, index) => {
            const start = result.index + offset;
            const end = start + result.length;
            const before = highlighted.substring(0, start);
            const match = highlighted.substring(start, end);
            const after = highlighted.substring(end);
            
            const highlightClass = index === this.currentSearchIndex ? 'current-highlight' : 'highlight';
            highlighted = before + `<span class="${highlightClass}">${match}</span>` + after;
            
            // Account for added HTML length
            offset += `<span class="${highlightClass}">${match}</span>`.length - match.length;
        });

        this.elements.transcriptDiv.innerHTML = highlighted;
    }

    navigateSearch(direction) {
        if (this.searchResults.length === 0) return;

        this.currentSearchIndex += direction;
        
        if (this.currentSearchIndex < 0) {
            this.currentSearchIndex = this.searchResults.length - 1;
        } else if (this.currentSearchIndex >= this.searchResults.length) {
            this.currentSearchIndex = 0;
        }

        this.highlightSearchResults();
        this.navigateToSearchResult(this.currentSearchIndex);
    }

    navigateToSearchResult(index) {
        if (this.searchResults.length === 0 || index < 0 || index >= this.searchResults.length) return;

        const result = this.searchResults[index];
        const element = this.elements.transcriptDiv.querySelector(`.current-highlight`);
        
        if (element) {
            element.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }

        this.elements.searchResults.textContent = `${index + 1} of ${this.searchResults.length} match${this.searchResults.length !== 1 ? 'es' : ''}`;
    }

    clearSearch() {
        this.elements.searchInput.value = '';
        this.searchResults = [];
        this.currentSearchIndex = -1;
        
        // Restore original transcript
        const originalText = this.elements.transcriptDiv.textContent;
        this.elements.transcriptDiv.innerHTML = this.formatTranscript(originalText);
        
        this.elements.searchResults.textContent = '0 matches';
    }

    // Scroll Controls
    scrollToTop() {
        this.elements.transcriptDiv.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }

    scrollToBottom() {
        this.elements.transcriptDiv.scrollTo({
            top: this.elements.transcriptDiv.scrollHeight,
            behavior: 'smooth'
        });
    }

    // Read Aloud
    toggleReadAloud() {
        if (this.isReading) {
            this.stopReadAloud();
        } else {
            this.startReadAloud();
        }
    }

    startReadAloud() {
        const text = this.elements.transcriptDiv.textContent;
        if (!text || text.includes('No Transcript Yet') || text.includes('No Transcript Generated')) {
            this.showToast('No transcript to read', 'warning');
            return;
        }

        if (this.speechSynthesis.speaking) {
            this.speechSynthesis.cancel();
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        utterance.lang = 'en-US';

        utterance.onstart = () => {
            this.isReading = true;
            this.elements.speakTranscriptBtn.innerHTML = '<i class="fas fa-stop"></i>';
            this.showToast('Reading transcript aloud...', 'info');
        };

        utterance.onend = () => {
            this.isReading = false;
            this.elements.speakTranscriptBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
            this.showToast('Finished reading transcript', 'success');
        };

        utterance.onerror = (event) => {
            console.error('Speech synthesis error:', event);
            this.isReading = false;
            this.elements.speakTranscriptBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
            this.showToast('Error reading transcript', 'error');
        };

        this.speechSynthesis.speak(utterance);
    }

    stopReadAloud() {
        if (this.speechSynthesis.speaking) {
            this.speechSynthesis.cancel();
            this.isReading = false;
            this.elements.speakTranscriptBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
            this.showToast('Stopped reading', 'info');
        }
    }

    // Transcript Click Handling
    handleTranscriptClick(e) {
        if (e.target.classList.contains('transcript-paragraph') || 
            e.target.classList.contains('transcript-line')) {
            const selection = window.getSelection();
            selection.selectAllChildren(e.target);
        }
    }

    // Translation Methods
    async translateContent() {
        const targetLang = this.elements.targetLanguageSelect.value;

        if (!targetLang) {
            this.showToast('Please select a target language', 'warning');
            return;
        }

        const transcript = this.elements.transcriptDiv.textContent;
        const summary = this.elements.summaryDiv.textContent || this.elements.summaryDiv.innerText;

        if ((!transcript || transcript.includes('No Transcript Yet') || transcript.includes('No Transcript Generated')) &&
            (!summary || summary.includes('AI summary will appear here after processing'))) {
            this.showToast('No content to translate', 'warning');
            return;
        }

        // Show loading state
        this.elements.translatedTranscriptCard.classList.remove('hidden');
        this.elements.translatedSummaryCard.classList.remove('hidden');
        
        this.elements.translatedTranscript.innerHTML = '<div class="loading-spinner"></div><p>Translating transcript...</p>';
        this.elements.translatedSummary.innerHTML = '<div class="loading-spinner"></div><p>Translating summary...</p>';
        
        this.elements.translateBtn.disabled = true;

        try {
            // Translate transcript
            const transcriptResponse = await fetch('/api/translate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: transcript,
                    source_lang: 'auto',
                    target_lang: targetLang
                })
            });

            // Translate summary
            const summaryResponse = await fetch('/api/translate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: summary,
                    source_lang: 'auto',
                    target_lang: targetLang
                })
            });

            if (!transcriptResponse.ok || !summaryResponse.ok) {
                throw new Error('Translation failed');
            }

            const transcriptData = await transcriptResponse.json();
            const summaryData = await summaryResponse.json();

            if (transcriptData.success && summaryData.success) {
                this.elements.translatedTranscript.textContent = transcriptData.translated;
                this.elements.translatedSummary.textContent = summaryData.translated;
                
                const langName = this.elements.targetLanguageSelect.selectedOptions[0].text;
                this.elements.translationInfo.textContent = `Translated to ${langName}`;
                this.showToast(`Translated to ${langName}!`, 'success');

                // Scroll to translated sections
                setTimeout(() => {
                    this.elements.translatedTranscriptCard.scrollIntoView({
                        behavior: 'smooth',
                        block: 'nearest'
                    });
                }, 100);
            } else {
                throw new Error(transcriptData.error || summaryData.error || 'Translation failed');
            }

        } catch (error) {
            console.error('Translation error:', error);
            this.elements.translatedTranscript.innerHTML = `
                <div class="translation-placeholder">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>Translation failed: ${error.message}</p>
                </div>
            `;
            this.elements.translatedSummary.innerHTML = `
                <div class="translation-placeholder">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>Translation failed: ${error.message}</p>
                </div>
            `;
            this.showToast('Translation failed', 'error');
        } finally {
            this.elements.translateBtn.disabled = false;
        }
    }

    async copyTranslated() {
        try {
            await navigator.clipboard.writeText(this.elements.translatedTranscript.textContent);
            this.showToast('Translated transcript copied!', 'success');
        } catch (err) {
            this.showToast('Failed to copy', 'error');
        }
    }

    async copyTranslatedSummary() {
        try {
            await navigator.clipboard.writeText(this.elements.translatedSummary.textContent);
            this.showToast('Translated summary copied!', 'success');
        } catch (err) {
            this.showToast('Failed to copy', 'error');
        }
    }

    closeTranslation() {
        this.elements.translatedTranscriptCard.classList.add('hidden');
        this.elements.translatedSummaryCard.classList.add('hidden');
        this.elements.targetLanguageSelect.value = '';
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
        this.playbackSpeed = 1.0;
        this.searchResults = [];
        this.currentSearchIndex = -1;
        this.isReading = false;

        // Stop speech synthesis if active
        if (this.speechSynthesis.speaking) {
            this.speechSynthesis.cancel();
        }

        // Reset file input
        this.elements.audioFileInput.value = '';
        this.elements.fileNameDisplay.textContent = '';
        this.elements.dropzoneText.textContent = 'Click to select or drag & drop';

        // Reset translation
        this.elements.translatedTranscriptCard.classList.add('hidden');
        this.elements.translatedSummaryCard.classList.add('hidden');
        this.elements.targetLanguageSelect.value = '';
        this.elements.translatedTranscript.innerHTML = `
            <div class="translation-placeholder">
                <i class="fas fa-language"></i>
                <p>Select a language and click translate to see the translation here.</p>
            </div>
        `;
        this.elements.translatedSummary.innerHTML = `
            <div class="translation-placeholder">
                <i class="fas fa-language"></i>
                <p>Select a language and click translate to see the translation here.</p>
            </div>
        `;

        // Hide sections
        this.elements.fileInfoSection.classList.add('hidden');
        this.elements.playerEmptyState.classList.remove('hidden');
        this.elements.resultsSection.classList.add('hidden');
        this.elements.emptyState.classList.remove('hidden');

        // Reset audio player
        this.elements.audioPlayer.src = '';
        this.elements.audioPlayer.pause();
        this.elements.playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
        this.elements.progressBar.value = 0;
        this.elements.currentTimeEl.textContent = '0:00';
        this.elements.durationEl.textContent = '0:00';
        this.elements.volumeBar.value = 100;
        this.elements.speedControlBtn.innerHTML = '<i class="fas fa-tachometer-alt"></i><span>1.0x</span>';

        // Reset metadata
        this.elements.fileInfoName.textContent = '-';
        this.elements.fileInfoSize.textContent = '-';
        this.elements.fileInfoTime.textContent = '-';
        this.elements.fileInfoLanguage.textContent = '-';

        // Reset text content
        this.elements.transcriptDiv.innerHTML = `
            <div class="transcript-placeholder">
                <div class="placeholder-icon">
                    <i class="fas fa-wave-square"></i>
                </div>
                <h4>No Transcript Yet</h4>
                <p>Upload and process an audio file to see the AI-generated transcript here.</p>
            </div>
        `;
        this.elements.summaryDiv.innerHTML = `
            <div class="summary-placeholder">
                <i class="fas fa-brain placeholder-icon"></i>
                <p>AI summary will appear here after processing</p>
            </div>
        `;

        // Reset search
        this.elements.searchInput.value = '';
        this.elements.searchResults.textContent = '0 matches';
        this.elements.wordCount.textContent = '0 words';

        // Reset read aloud button
        this.elements.speakTranscriptBtn.innerHTML = '<i class="fas fa-volume-up"></i>';

        // Reset font size
        this.elements.fontSizeSelect.value = '14';
        document.documentElement.style.fontSize = '16px';

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
        if (!Number.isFinite(seconds) || seconds < 0) {
            return '0:00';
        }

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

        switch (e.key) {
            case ' ':
                e.preventDefault();
                if (this.elements.audioPlayer.src) {
                    this.togglePlayPause();
                }
                break;

            case 'ArrowLeft':
                if (e.ctrlKey) {
                    e.preventDefault();
                    this.navigateSearch(-1);
                } else if (this.elements.audioPlayer.src) {
                    e.preventDefault();
                    this.skip(-10);
                }
                break;

            case 'ArrowRight':
                if (e.ctrlKey) {
                    e.preventDefault();
                    this.navigateSearch(1);
                } else if (this.elements.audioPlayer.src) {
                    e.preventDefault();
                    this.skip(10);
                }
                break;

            case 'Escape':
                e.preventDefault();
                this.elements.searchInput.blur();
                this.clearSearch();
                break;

            case 'f':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    this.elements.searchInput.focus();
                    this.elements.searchInput.select();
                }
                break;

            case 'Home':
                e.preventDefault();
                this.scrollToTop();
                break;

            case 'End':
                e.preventDefault();
                this.scrollToBottom();
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
