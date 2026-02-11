// Results Page JavaScript
class ResultsPage {
    constructor() {
        this.currentData = null;
        this.audioPlayer = null;
        this.searchMatches = [];
        this.currentMatchIndex = -1;
        this.playbackSpeed = 1.0;
        this.isLooping = false;

        this.checkAuthentication();
        this.initializeElements();
        this.setupEventListeners();
        this.loadResults();
    }

    checkAuthentication() {
        const token = localStorage.getItem('access_token');
        if (!token) {
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
            'Authorization': `Bearer ${token}`
        };

        try {
            const response = await fetch(url, { ...options, headers });

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

    initializeElements() {
        this.elements = {
            // File Info
            fileInfoName: document.getElementById('fileInfoName'),
            fileInfoSize: document.getElementById('fileInfoSize'),
            fileInfoTime: document.getElementById('fileInfoTime'),
            fileInfoLanguage: document.getElementById('fileInfoLanguage'),

            // Audio Player
            audioPlayer: document.getElementById('audioPlayer'),
            playPause: document.getElementById('playPause'),
            progressBar: document.getElementById('progressBar'),
            currentTime: document.getElementById('currentTime'),
            duration: document.getElementById('duration'),
            volumeBar: document.getElementById('volumeBar'),
            speedControl: document.getElementById('speedControl'),
            skipBack: document.getElementById('skipBack'),
            skipForward: document.getElementById('skipForward'),
            downloadAudio: document.getElementById('downloadAudio'),
            loopToggleBtn: document.getElementById('loopToggleBtn'),

            // Transcript
            transcript: document.getElementById('transcript'),
            searchPanel: document.getElementById('searchPanel'),
            toggleSearchPanel: document.getElementById('toggleSearchPanel'),
            closeSearchPanel: document.getElementById('closeSearchPanel'),
            searchInput: document.getElementById('searchInput'),
            searchResults: document.getElementById('searchResults'),
            searchNext: document.getElementById('searchNext'),
            searchPrev: document.getElementById('searchPrev'),
            clearSearch: document.getElementById('clearSearch'),
            copyTranscript: document.getElementById('copyTranscript'),
            exportTxt: document.getElementById('exportTxt'),

            // Translation
            translatePanel: document.getElementById('translatePanel'),
            toggleTranslatePanel: document.getElementById('toggleTranslatePanel'),
            closeTranslatePanel: document.getElementById('closeTranslatePanel'),
            targetLanguage: document.getElementById('targetLanguage'),
            translateBtn: document.getElementById('translateBtn'),
            translatedTranscriptCard: document.getElementById('translatedTranscriptCard'),
            translatedTranscript: document.getElementById('translatedTranscript'),
            closeTranslation: document.getElementById('closeTranslation'),
            speakTranscript: document.getElementById('speakTranscript'),
            copyTranslated: document.getElementById('copyTranslated'),
            exportTranslated: document.getElementById('exportTranslated'),
            copyTranslatedSummary: document.getElementById('copyTranslatedSummary'),
            exportTranslatedSummary: document.getElementById('exportTranslatedSummary'),

            // Summary
            summary: document.getElementById('summary'),
            copySummary: document.getElementById('copySummary'),
            exportSummaryTxt: document.getElementById('exportSummaryTxt'),

            // Toast
            toastContainer: document.getElementById('toastContainer')
        };

        this.audioPlayer = this.elements.audioPlayer;
    }

    setupEventListeners() {
        // Audio Player Controls
        if (this.elements.playPause) {
            this.elements.playPause.addEventListener('click', () => this.togglePlayPause());
        }

        if (this.audioPlayer) {
            this.audioPlayer.addEventListener('timeupdate', () => this.updateProgress());
            this.audioPlayer.addEventListener('loadedmetadata', () => this.updateDuration());
            this.audioPlayer.addEventListener('ended', () => this.handleAudioEnded());
        }

        if (this.elements.progressBar) {
            this.elements.progressBar.addEventListener('input', (e) => this.seekAudio(e));
        }

        if (this.elements.volumeBar) {
            this.elements.volumeBar.addEventListener('input', (e) => this.changeVolume(e));
        }

        if (this.elements.speedControl) {
            this.elements.speedControl.addEventListener('click', () => this.cycleSpeed());
        }

        if (this.elements.skipBack) {
            this.elements.skipBack.addEventListener('click', () => this.skip(-10));
        }

        if (this.elements.skipForward) {
            this.elements.skipForward.addEventListener('click', () => this.skip(10));
        }

        if (this.elements.downloadAudio) {
            this.elements.downloadAudio.addEventListener('click', () => this.downloadAudio());
        }

        if (this.elements.loopToggleBtn) {
            this.elements.loopToggleBtn.addEventListener('click', () => this.toggleLoop());
        }

        // Search Panel
        if (this.elements.toggleSearchPanel) {
            this.elements.toggleSearchPanel.addEventListener('click', () => this.togglePanel('search'));
        }

        if (this.elements.closeSearchPanel) {
            this.elements.closeSearchPanel.addEventListener('click', () => this.closePanel('search'));
        }

        if (this.elements.searchInput) {
            this.elements.searchInput.addEventListener('input', (e) => this.searchTranscript(e.target.value));
        }

        if (this.elements.searchNext) {
            this.elements.searchNext.addEventListener('click', () => this.navigateSearch(1));
        }

        if (this.elements.searchPrev) {
            this.elements.searchPrev.addEventListener('click', () => this.navigateSearch(-1));
        }

        if (this.elements.clearSearch) {
            this.elements.clearSearch.addEventListener('click', () => this.clearSearch());
        }

        // Translation Panel
        if (this.elements.toggleTranslatePanel) {
            this.elements.toggleTranslatePanel.addEventListener('click', () => this.togglePanel('translate'));
        }

        if (this.elements.closeTranslatePanel) {
            this.elements.closeTranslatePanel.addEventListener('click', () => this.closePanel('translate'));
        }

        if (this.elements.translateBtn) {
            this.elements.translateBtn.addEventListener('click', () => this.translateTranscript());
        }

        if (this.elements.closeTranslation) {
            this.elements.closeTranslation.addEventListener('click', () => this.hideTranslation());
        }

        // Speak transcript aloud
        if (this.elements.speakTranscript) {
            this.elements.speakTranscript.addEventListener('click', () => this.speakText());
        }

        // Copy/Export Translated Content
        if (this.elements.copyTranslated) {
            this.elements.copyTranslated.addEventListener('click', () => this.copyToClipboard('translatedTranscript'));
        }

        if (this.elements.exportTranslated) {
            this.elements.exportTranslated.addEventListener('click', () => this.exportText('translatedTranscript'));
        }

        if (this.elements.copyTranslatedSummary) {
            this.elements.copyTranslatedSummary.addEventListener('click', () => this.copyToClipboard('translatedSummary'));
        }

        if (this.elements.exportTranslatedSummary) {
            this.elements.exportTranslatedSummary.addEventListener('click', () => this.exportText('translatedSummary'));
        }

        // Copy/Export Buttons
        if (this.elements.copyTranscript) {
            this.elements.copyTranscript.addEventListener('click', () => this.copyToClipboard('transcript'));
        }

        if (this.elements.exportTxt) {
            this.elements.exportTxt.addEventListener('click', () => this.exportText('transcript'));
        }

        if (this.elements.copySummary) {
            this.elements.copySummary.addEventListener('click', () => this.copyToClipboard('summary'));
        }

        if (this.elements.exportSummaryTxt) {
            this.elements.exportSummaryTxt.addEventListener('click', () => this.exportText('summary'));
        }
    }

    async loadResults() {
        try {
            // Get file ID from URL or sessionStorage
            const urlParams = new URLSearchParams(window.location.search);
            const fileId = urlParams.get('id');

            console.log('🔍 Loading results for file ID:', fileId);

            if (fileId) {
                // Fetch from API
                console.log('Fetching from API: /api/files/' + fileId);
                const response = await this.fetchWithAuth(`/api/files/${fileId}`);

                if (!response || !response.ok) {
                    throw new Error('Failed to load results from API');
                }

                this.currentData = await response.json();
                console.log('✅ Data loaded from API:', this.currentData);
            } else {
                // Try to load from sessionStorage
                console.log('No file ID in URL, checking sessionStorage...');
                const storedData = sessionStorage.getItem('transcribeResults');

                if (storedData) {
                    this.currentData = JSON.parse(storedData);
                    console.log('✅ Data loaded from sessionStorage:', this.currentData);
                } else {
                    throw new Error('No results found in URL or sessionStorage');
                }
            }

            // Log all available properties
            console.log('📋 Available properties in currentData:', Object.keys(this.currentData));
            console.log('📏 File size field value:', {
                file_size: this.currentData.file_size,
                size: this.currentData.size,
                fileSize: this.currentData.fileSize,
                audio_size: this.currentData.audio_size
            });

            // Display the data
            this.displayFileInfo();
            this.displayTranscript();
            this.displaySummary();
            this.setupAudioPlayer();

        } catch (error) {
            console.error('❌ Error loading results:', error);
            this.showToast('Failed to load results: ' + error.message, 'error');
        }
    }

    displayFileInfo() {
        if (!this.currentData) return;

        console.log('📊 Displaying file info from data:', this.currentData);

        if (this.elements.fileInfoName) {
            this.elements.fileInfoName.textContent = this.currentData.filename ||
                this.currentData.name ||
                this.currentData.original_filename ||
                'Unknown';
        }

        if (this.elements.fileInfoSize) {
            // Try multiple possible field names for file size
            const size = this.currentData.file_size ||
                this.currentData.size ||
                this.currentData.fileSize ||
                this.currentData.audio_size ||
                0;

            console.log('File size value:', size, 'bytes');

            if (size > 0) {
                this.elements.fileInfoSize.textContent = this.formatFileSize(size);
            } else {
                // If size is not available, try to get it from audio file
                this.elements.fileInfoSize.textContent = 'Calculating...';
                this.fetchAudioFileSize();
            }
        }

        if (this.elements.fileInfoTime) {
            const time = this.currentData.created_at ||
                this.currentData.timestamp ||
                this.currentData.createdAt ||
                new Date().toISOString();
            this.elements.fileInfoTime.textContent = this.formatDate(time);
        }

        if (this.elements.fileInfoLanguage) {
            const lang = this.currentData.language ||
                this.currentData.source_language ||
                sessionStorage.getItem('sourceLanguage') ||
                'en';
            this.elements.fileInfoLanguage.textContent = this.getLanguageName(lang);
        }
    }

    // Add this new method to fetch audio file size
    async fetchAudioFileSize() {
        try {
            const audioUrl = this.currentData.audio_url ||
                this.currentData.file_url ||
                this.currentData.audioUrl;

            if (!audioUrl) {
                console.log('No audio URL found');
                if (this.elements.fileInfoSize) {
                    this.elements.fileInfoSize.textContent = 'Unknown';
                }
                return;
            }

            console.log('Fetching file size from:', audioUrl);

            // Use HEAD request to get file size without downloading the file
            const response = await fetch(audioUrl, { method: 'HEAD' });

            if (response.ok) {
                const contentLength = response.headers.get('content-length');

                if (contentLength) {
                    const sizeInBytes = parseInt(contentLength, 10);
                    console.log('File size from HEAD request:', sizeInBytes, 'bytes');

                    if (this.elements.fileInfoSize) {
                        this.elements.fileInfoSize.textContent = this.formatFileSize(sizeInBytes);
                    }

                    // Store it back to currentData
                    this.currentData.file_size = sizeInBytes;
                } else {
                    console.log('Content-Length header not found');
                    if (this.elements.fileInfoSize) {
                        this.elements.fileInfoSize.textContent = 'Unknown';
                    }
                }
            } else {
                console.log('Failed to fetch file size:', response.status);
                if (this.elements.fileInfoSize) {
                    this.elements.fileInfoSize.textContent = 'Unknown';
                }
            }
        } catch (error) {
            console.error('Error fetching file size:', error);
            if (this.elements.fileInfoSize) {
                this.elements.fileInfoSize.textContent = 'Unknown';
            }
        }
    }

    displayTranscript() {
        if (!this.currentData || !this.elements.transcript) return;

        const transcript = this.currentData.transcription || this.currentData.transcript || '';

        if (transcript) {
            this.elements.transcript.innerHTML = `<div class="transcript-text">${this.formatTranscript(transcript)}</div>`;
        } else {
            this.elements.transcript.innerHTML = `
                <div class="transcript-placeholder-results">
                    <div class="placeholder-icon-results">
                        <i class="fas fa-exclamation-circle"></i>
                    </div>
                    <h4>No Transcript Available</h4>
                    <p>The transcript could not be loaded.</p>
                </div>
            `;
        }
    }

    displaySummary() {
        if (!this.currentData || !this.elements.summary) return;

        const summary = this.currentData.summary || '';

        if (summary) {
            this.elements.summary.innerHTML = `<div class="summary-text">${this.formatSummary(summary)}</div>`;
        } else {
            this.elements.summary.innerHTML = `
                <div class="summary-placeholder-results">
                    <i class="fas fa-exclamation-circle placeholder-icon-results"></i>
                    <p>No summary available</p>
                </div>
            `;
        }
    }

    setupAudioPlayer() {
        if (!this.currentData || !this.audioPlayer) return;

        const audioUrl = this.currentData.audio_url || this.currentData.file_url;

        if (audioUrl) {
            this.audioPlayer.src = audioUrl;
        } else {
            console.warn('No audio URL found');
        }
    }

    formatTranscript(text) {
        // Format transcript with paragraphs
        return text.split('\n').filter(line => line.trim()).map(line => `<p>${line}</p>`).join('');
    }

    formatSummary(text) {
        // Convert markdown-style bold **text** to <strong>text</strong>
        const parseBold = (str) => str.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

        // Pre-process: normalize garbled Unicode bullet/dash characters
        // These appear when UTF-8 bullets (•, –, —) get encoding-corrupted
        text = text
            .replace(/â€¢/g, '•')       // garbled bullet •
            .replace(/â€"/g, '—')       // garbled em-dash —
            .replace(/â€"/g, '–')       // garbled en-dash –
            .replace(/â\s*-/g, '- ')    // â- pattern (corrupted bullet)
            .replace(/â¢/g, '•')        // another garbled bullet variant
            .replace(/[^\x00-\x7F]+-\s/g, '- ')  // any non-ASCII char(s) followed by "- "
            .replace(/[^\x00-\x7F]+\.\s/g, '- '); // any non-ASCII char(s) followed by ". "

        const lines = text.split('\n').filter(line => line.trim());
        let html = '';
        let inList = false;

        for (const line of lines) {
            const trimmed = line.trim();

            // Check if it's a bullet point:
            // - Standard: *, •, -, –, —
            // - Lettered: a-, a., a)
            // - Numbered: 1., 1), 1-
            const bulletMatch = trimmed.match(/^(?:[*•–—\-]|\d+[.\-)]|[a-zA-Z][.\-)])\s+(.*)/);

            if (bulletMatch) {
                if (!inList) {
                    html += '<ul>';
                    inList = true;
                }
                html += `<li>${parseBold(bulletMatch[1])}</li>`;
            } else {
                // Close any open list
                if (inList) {
                    html += '</ul>';
                    inList = false;
                }

                // Check if it's a standalone heading like "**Key Points:**"
                const headingMatch = trimmed.match(/^\*\*(.+?)\*\*:?\s*$/);
                if (headingMatch) {
                    html += `<h4 class="summary-heading">${headingMatch[1]}</h4>`;
                } else if (trimmed.match(/^(Here are|The following|Below are|Summary)/i)) {
                    // Skip filler intro lines like "Here are 3-5 bullet points..."
                    continue;
                } else {
                    html += `<p>${parseBold(trimmed)}</p>`;
                }
            }
        }

        // Close any remaining open list
        if (inList) {
            html += '</ul>';
        }

        return html || `<p>${parseBold(text)}</p>`;
    }

    // Audio Player Methods
    togglePlayPause() {
        if (!this.audioPlayer) return;

        if (this.audioPlayer.paused) {
            this.audioPlayer.play();
            this.elements.playPause.innerHTML = '<i class="fas fa-pause"></i>';
        } else {
            this.audioPlayer.pause();
            this.elements.playPause.innerHTML = '<i class="fas fa-play"></i>';
        }
    }

    updateProgress() {
        if (!this.audioPlayer || !this.elements.progressBar) return;

        const progress = (this.audioPlayer.currentTime / this.audioPlayer.duration) * 100;
        this.elements.progressBar.value = progress || 0;

        if (this.elements.currentTime) {
            this.elements.currentTime.textContent = this.formatTime(this.audioPlayer.currentTime);
        }
    }

    updateDuration() {
        if (!this.audioPlayer || !this.elements.duration) return;

        this.elements.duration.textContent = this.formatTime(this.audioPlayer.duration);
    }

    seekAudio(e) {
        if (!this.audioPlayer) return;

        const time = (e.target.value / 100) * this.audioPlayer.duration;
        this.audioPlayer.currentTime = time;
    }

    changeVolume(e) {
        if (!this.audioPlayer) return;

        this.audioPlayer.volume = e.target.value / 100;
    }

    cycleSpeed() {
        const speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
        const currentIndex = speeds.indexOf(this.playbackSpeed);
        const nextIndex = (currentIndex + 1) % speeds.length;
        this.playbackSpeed = speeds[nextIndex];

        if (this.audioPlayer) {
            this.audioPlayer.playbackRate = this.playbackSpeed;
        }

        if (this.elements.speedControl) {
            this.elements.speedControl.querySelector('span').textContent = `${this.playbackSpeed}x`;
        }

        this.showToast(`Playback speed: ${this.playbackSpeed}x`, 'info');
    }

    skip(seconds) {
        if (!this.audioPlayer) return;

        this.audioPlayer.currentTime += seconds;
    }

    toggleLoop() {
        this.isLooping = !this.isLooping;

        if (this.audioPlayer) {
            this.audioPlayer.loop = this.isLooping;
        }

        if (this.elements.loopToggleBtn) {
            this.elements.loopToggleBtn.classList.toggle('active', this.isLooping);
        }

        this.showToast(this.isLooping ? 'Loop enabled' : 'Loop disabled', 'info');
    }

    handleAudioEnded() {
        if (!this.isLooping && this.elements.playPause) {
            this.elements.playPause.innerHTML = '<i class="fas fa-play"></i>';
        }
    }

    downloadAudio() {
        if (!this.currentData) return;

        const audioUrl = this.currentData.audio_url || this.currentData.file_url;
        if (audioUrl) {
            const a = document.createElement('a');
            a.href = audioUrl;
            a.download = this.currentData.filename || 'audio.mp3';
            a.click();
            this.showToast('Downloading audio...', 'success');
        }
    }

    // Search Methods
    togglePanel(panel) {
        const panelElement = panel === 'search' ? this.elements.searchPanel : this.elements.translatePanel;
        if (panelElement) {
            panelElement.classList.toggle('hidden');
        }
    }

    closePanel(panel) {
        const panelElement = panel === 'search' ? this.elements.searchPanel : this.elements.translatePanel;
        if (panelElement) {
            panelElement.classList.add('hidden');
        }
    }

    searchTranscript(query) {
        // Implementation for search functionality
        if (!query || !this.elements.transcript) {
            this.clearSearch();
            return;
        }

        const transcriptText = this.elements.transcript.textContent;
        const regex = new RegExp(query, 'gi');
        const matches = transcriptText.match(regex);

        if (matches) {
            this.searchMatches = matches;
            this.currentMatchIndex = 0;

            if (this.elements.searchResults) {
                this.elements.searchResults.textContent = `${matches.length} matches`;
            }

            // Highlight matches in transcript
            this.highlightMatches(query);
        } else {
            if (this.elements.searchResults) {
                this.elements.searchResults.textContent = '0 matches';
            }
        }
    }

    highlightMatches(query) {
        const transcriptText = this.currentData.transcription || this.currentData.transcript || '';
        const regex = new RegExp(`(${query})`, 'gi');
        const highlighted = transcriptText.replace(regex, '<mark>$1</mark>');

        if (this.elements.transcript) {
            this.elements.transcript.innerHTML = `<div class="transcript-text">${this.formatTranscript(highlighted)}</div>`;
        }
    }

    navigateSearch(direction) {
        if (this.searchMatches.length === 0) return;

        this.currentMatchIndex += direction;

        if (this.currentMatchIndex < 0) {
            this.currentMatchIndex = this.searchMatches.length - 1;
        } else if (this.currentMatchIndex >= this.searchMatches.length) {
            this.currentMatchIndex = 0;
        }

        // Scroll to match (simplified)
        const marks = this.elements.transcript.querySelectorAll('mark');
        if (marks[this.currentMatchIndex]) {
            marks[this.currentMatchIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    clearSearch() {
        this.searchMatches = [];
        this.currentMatchIndex = -1;

        if (this.elements.searchInput) {
            this.elements.searchInput.value = '';
        }

        if (this.elements.searchResults) {
            this.elements.searchResults.textContent = '0 matches';
        }

        // Restore original transcript
        this.displayTranscript();
    }

    // Translation Methods
    async translateTranscript() {
        const targetLang = this.elements.targetLanguage?.value;

        if (!targetLang) {
            this.showToast('Please select a target language', 'error');
            return;
        }

        const transcriptText = this.currentData?.transcription || this.currentData?.transcript || '';
        if (!transcriptText) {
            this.showToast('No transcript available to translate', 'error');
            return;
        }

        // Show loading state on button
        const translateBtn = this.elements.translateBtn;
        const originalBtnHTML = translateBtn ? translateBtn.innerHTML : '';
        if (translateBtn) {
            translateBtn.disabled = true;
            translateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Translating...';
        }

        try {
            // Translate transcript
            const response = await this.fetchWithAuth('/api/translate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: transcriptText,
                    source_lang: 'auto',
                    target_lang: targetLang
                })
            });

            if (!response || !response.ok) {
                throw new Error('Translation request failed');
            }

            const result = await response.json();

            if (result.success === false) {
                throw new Error(result.error || 'Translation failed');
            }

            // Display translated transcript
            const langName = this.getLanguageName(targetLang);
            this.lastTranslatedText = result.translated;
            this.lastTranslatedLang = langName;

            if (this.elements.translatedTranscriptCard) {
                this.elements.translatedTranscriptCard.classList.remove('hidden');
            }

            const translationInfo = document.getElementById('translationInfo');
            if (translationInfo) {
                translationInfo.textContent = `Translated to ${langName}`;
            }

            if (this.elements.translatedTranscript) {
                this.elements.translatedTranscript.innerHTML =
                    `<div class="transcript-text">${this.formatTranscript(result.translated)}</div>`;
            }

            // Also translate summary if available
            const summaryText = this.currentData?.summary || '';
            if (summaryText) {
                try {
                    const summaryResponse = await this.fetchWithAuth('/api/translate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            text: summaryText,
                            source_lang: 'auto',
                            target_lang: targetLang
                        })
                    });

                    if (summaryResponse && summaryResponse.ok) {
                        const summaryResult = await summaryResponse.json();
                        if (summaryResult.success !== false) {
                            this.lastTranslatedSummary = summaryResult.translated;

                            const translatedSummaryCard = document.getElementById('translatedSummaryCard');
                            if (translatedSummaryCard) {
                                translatedSummaryCard.classList.remove('hidden');
                            }

                            const translatedSummaryEl = document.getElementById('translatedSummary');
                            if (translatedSummaryEl) {
                                translatedSummaryEl.innerHTML =
                                    `<div class="summary-text">${this.formatSummary(summaryResult.translated)}</div>`;
                            }
                        }
                    }
                } catch (summaryError) {
                    console.warn('Summary translation failed:', summaryError);
                    // Non-critical, don't block the main translation
                }
            }

            this.showToast(`Translated to ${langName} successfully!`, 'success');

            // Hide the translate panel after successful translation
            this.closePanel('translate');

        } catch (error) {
            console.error('Translation error:', error);
            this.showToast('Translation failed: ' + error.message, 'error');
        } finally {
            // Restore button state
            if (translateBtn) {
                translateBtn.disabled = false;
                translateBtn.innerHTML = originalBtnHTML;
            }
        }
    }

    hideTranslation() {
        if (this.elements.translatedTranscriptCard) {
            this.elements.translatedTranscriptCard.classList.add('hidden');
        }
        const translatedSummaryCard = document.getElementById('translatedSummaryCard');
        if (translatedSummaryCard) {
            translatedSummaryCard.classList.add('hidden');
        }
        this.lastTranslatedText = null;
        this.lastTranslatedSummary = null;
        this.lastTranslatedLang = null;
    }

    speakText() {
        // Use translated text if available, otherwise original transcript
        const text = this.lastTranslatedText || this.currentData?.transcription || this.currentData?.transcript || '';
        if (!text) {
            this.showToast('No text available to read aloud', 'error');
            return;
        }

        if (window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
            this.showToast('Speech stopped', 'info');
            return;
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;

        utterance.onend = () => {
            this.showToast('Finished reading', 'info');
        };

        utterance.onerror = () => {
            this.showToast('Speech synthesis failed', 'error');
        };

        window.speechSynthesis.speak(utterance);
        this.showToast('Reading aloud... Click again to stop', 'info');
    }

    // Copy/Export Methods
    copyToClipboard(type) {
        let text = '';
        let label = type;

        if (type === 'transcript') {
            text = this.currentData?.transcription || this.currentData?.transcript || '';
        } else if (type === 'summary') {
            text = this.currentData?.summary || '';
        } else if (type === 'translatedTranscript') {
            text = this.lastTranslatedText || '';
            label = 'Translated transcript';
        } else if (type === 'translatedSummary') {
            text = this.lastTranslatedSummary || '';
            label = 'Translated summary';
        }

        if (text) {
            navigator.clipboard.writeText(text).then(() => {
                this.showToast(`${label.charAt(0).toUpperCase() + label.slice(1)} copied to clipboard`, 'success');
            }).catch(() => {
                this.showToast('Failed to copy', 'error');
            });
        } else {
            this.showToast('No text available to copy', 'error');
        }
    }

    exportText(type) {
        let text = '';
        let filename = '';
        let label = type;

        if (type === 'transcript') {
            text = this.currentData?.transcription || this.currentData?.transcript || '';
            filename = `transcript_${Date.now()}.txt`;
        } else if (type === 'summary') {
            text = this.currentData?.summary || '';
            filename = `summary_${Date.now()}.txt`;
        } else if (type === 'translatedTranscript') {
            text = this.lastTranslatedText || '';
            const lang = this.lastTranslatedLang || 'translated';
            filename = `transcript_${lang}_${Date.now()}.txt`;
            label = 'Translated transcript';
        } else if (type === 'translatedSummary') {
            text = this.lastTranslatedSummary || '';
            const lang = this.lastTranslatedLang || 'translated';
            filename = `summary_${lang}_${Date.now()}.txt`;
            label = 'Translated summary';
        }

        if (text) {
            const blob = new Blob([text], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);

            this.showToast(`${label.charAt(0).toUpperCase() + label.slice(1)} exported`, 'success');
        } else {
            this.showToast('No text available to export', 'error');
        }
    }

    // Utility Methods
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleString();
    }

    formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';

        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
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
}

// Initialize Results Page
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (!window.resultsPage) {
            console.log('📄 Initializing results page...');
            window.resultsPage = new ResultsPage();
        }
    });
} else {
    if (!window.resultsPage) {
        console.log('✅ Document ready, initializing results page now...');
        window.resultsPage = new ResultsPage();
    }
}
// Dropdown functionality
document.addEventListener('DOMContentLoaded', function () {
    // Search dropdown
    const searchTrigger = document.getElementById('searchDropdownTrigger');
    const searchDropdown = document.getElementById('searchDropdown');

    if (searchTrigger && searchDropdown) {
        searchTrigger.addEventListener('click', function (e) {
            e.stopPropagation();
            searchDropdown.classList.toggle('show');

            // Close other dropdowns
            if (translateDropdown) translateDropdown.classList.remove('show');
        });
    }

    // Translate dropdown
    const translateTrigger = document.getElementById('translateDropdownTrigger');
    const translateDropdown = document.getElementById('translateDropdown');

    if (translateTrigger && translateDropdown) {
        translateTrigger.addEventListener('click', function (e) {
            e.stopPropagation();
            translateDropdown.classList.toggle('show');

            // Close other dropdowns
            if (searchDropdown) searchDropdown.classList.remove('show');
        });
    }

    // Close dropdowns when clicking outside
    document.addEventListener('click', function (e) {
        if (!e.target.closest('.dropdown-container')) {
            document.querySelectorAll('.dropdown-menu').forEach(menu => {
                menu.classList.remove('show');
            });
        }
    });
});