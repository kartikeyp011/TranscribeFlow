/* Results Page JavaScript */
document.addEventListener('DOMContentLoaded', function() {
    console.log('Results page loaded');
    
    // Initialize with default data for testing
    const defaultData = {
        filename: 'sample-audio.mp3',
        size_mb: 2.5,
        uploaded: new Date().toISOString(),
        audio_url: '/api/stream/sample-audio',
        transcript: 'This is a sample transcript text. It demonstrates how the transcript will appear in the results page. The audio file has been successfully processed and this is the transcription result.',
        summary: '**Key Points:**\n• This is a sample AI summary\n• Sample point one\n• Sample point two\n• Sample point three',
        language: 'en'
    };

    // Load results from session storage or use default
    function loadResults() {
        try {
            const resultsData = sessionStorage.getItem('transcribeResults');
            const selectedLanguage = sessionStorage.getItem('selectedLanguage');
            let data = defaultData;
            
            if (resultsData) {
                data = JSON.parse(resultsData);
                console.log('Loaded data from session storage:', data);
            } else {
                console.log('Using default data for demonstration');
                showToast('Using demonstration data. Upload a file for real results.', 'info');
            }
            
            displayResults(data, selectedLanguage);
        } catch (error) {
            console.error('Error loading results:', error);
            displayResults(defaultData, 'en');
        }
    }

    // Display results in the UI
    function displayResults(data, selectedLanguage) {
        // File Info
        const fileNameEl = document.getElementById('fileInfoName');
        const fileSizeEl = document.getElementById('fileInfoSize');
        const fileTimeEl = document.getElementById('fileInfoTime');
        const fileLanguageEl = document.getElementById('fileInfoLanguage');
        
        if (fileNameEl) fileNameEl.textContent = data.filename || '-';
        if (fileSizeEl) fileSizeEl.textContent = data.size_mb ? `${data.size_mb} MB` : '-';
        if (fileTimeEl) fileTimeEl.textContent = data.uploaded ? new Date(data.uploaded).toLocaleString() : '-';
        
        // Language mapping
        const languages = {
            'en': 'English', 'hi': 'Hindi', 'es': 'Spanish', 'fr': 'French',
            'de': 'German', 'zh': 'Chinese', 'ja': 'Japanese', 'ko': 'Korean',
            'ar': 'Arabic', 'ru': 'Russian', 'pt': 'Portuguese', 'bn': 'Bengali',
            'te': 'Telugu', 'mr': 'Marathi', 'ta': 'Tamil', 'ur': 'Urdu',
            'it': 'Italian', 'nl': 'Dutch', 'tr': 'Turkish', 'vi': 'Vietnamese',
            'th': 'Thai', 'id': 'Indonesian'
        };
        
        const lang = selectedLanguage || data.language || 'en';
        if (fileLanguageEl) fileLanguageEl.textContent = languages[lang] || lang;
        
        // Transcript
        const transcriptEl = document.getElementById('transcript');
        if (transcriptEl && data.transcript) {
            transcriptEl.innerHTML = formatTranscript(data.transcript);
        }
        
        // Summary
        const summaryEl = document.getElementById('summary');
        if (summaryEl && data.summary) {
            summaryEl.innerHTML = formatSummary(data.summary);
        }
        
        // Audio Player
        const audioPlayer = document.getElementById('audioPlayer');
        if (audioPlayer && data.audio_url) {
            audioPlayer.src = data.audio_url;
            audioPlayer.load();
        }
        
        setupAudioPlayer();
    }

    function formatTranscript(text) {
        if (!text) return `<div class="transcript-placeholder-results"><div class="placeholder-icon-results"><i class="fas fa-wave-square"></i></div><h4>No Transcript</h4><p>Transcript will appear here.</p></div>`;
        
        // Split into paragraphs
        const paragraphs = text.split('\n\n').filter(p => p.trim());
        return paragraphs.map(p => `<p>${p.trim()}</p>`).join('');
    }

    function formatSummary(text) {
        if (!text) return `<div class="summary-placeholder"><i class="fas fa-clipboard-list"></i><p>Summary will appear here.</p></div>`;
        
        // Convert markdown-style formatting
        let formatted = text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/^• /gm, '<li>')
            .replace(/\n• /g, '</li><li>')
            .replace(/<li>/g, '<ul><li>')
            .replace(/<\/li>(?!<li>)/g, '</li></ul>');
        
        return formatted;
    }

    // Audio Player Setup
    function setupAudioPlayer() {
        const audioPlayer = document.getElementById('audioPlayer');
        const playPauseBtn = document.getElementById('playPause');
        const progressBar = document.getElementById('progressBar');
        const currentTimeEl = document.getElementById('currentTime');
        const durationEl = document.getElementById('duration');
        const volumeBar = document.getElementById('volumeBar');
        const skipBackBtn = document.getElementById('skipBack');
        const skipForwardBtn = document.getElementById('skipForward');
        const speedControlBtn = document.getElementById('speedControl');
        
        if (!audioPlayer || !playPauseBtn) return;
        
        let playbackSpeed = 1.0;
        
        // Update duration when loaded
        audioPlayer.addEventListener('loadedmetadata', function() {
            if (durationEl && !isNaN(audioPlayer.duration)) {
                durationEl.textContent = formatTime(audioPlayer.duration);
            }
        });
        
        // Play/Pause button
        playPauseBtn.addEventListener('click', function() {
            if (audioPlayer.paused) {
                audioPlayer.play();
                playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
            } else {
                audioPlayer.pause();
                playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
            }
        });
        
        // Update progress
        audioPlayer.addEventListener('timeupdate', function() {
            if (!isNaN(audioPlayer.duration)) {
                const progress = (audioPlayer.currentTime / audioPlayer.duration) * 100;
                if (progressBar) progressBar.value = progress;
                if (currentTimeEl) currentTimeEl.textContent = formatTime(audioPlayer.currentTime);
                if (durationEl) durationEl.textContent = formatTime(audioPlayer.duration);
            }
        });
        
        // Seek audio
        if (progressBar) {
            progressBar.addEventListener('input', function() {
                if (!isNaN(audioPlayer.duration)) {
                    const seekTime = (this.value / 100) * audioPlayer.duration;
                    audioPlayer.currentTime = seekTime;
                }
            });
        }
        
        // Volume control
        if (volumeBar) {
            volumeBar.addEventListener('input', function() {
                audioPlayer.volume = this.value / 100;
            });
        }
        
        // Skip buttons
        if (skipBackBtn) {
            skipBackBtn.addEventListener('click', function() {
                audioPlayer.currentTime = Math.max(0, audioPlayer.currentTime - 10);
            });
        }
        
        if (skipForwardBtn) {
            skipForwardBtn.addEventListener('click', function() {
                audioPlayer.currentTime = Math.min(audioPlayer.duration, audioPlayer.currentTime + 10);
            });
        }
        
        // Speed control
        if (speedControlBtn) {
            speedControlBtn.addEventListener('click', function() {
                const speeds = [1.0, 1.25, 1.5, 1.75, 2.0];
                const currentIndex = speeds.indexOf(playbackSpeed);
                playbackSpeed = speeds[(currentIndex + 1) % speeds.length];
                audioPlayer.playbackRate = playbackSpeed;
                this.textContent = `${playbackSpeed}x`;
                showToast(`Playback speed: ${playbackSpeed}x`, 'info');
            });
        }
    }

    // Search functionality
    function setupSearch() {
        const toggleSearchPanelBtn = document.getElementById('toggleSearchPanel');
        const closeSearchPanelBtn = document.getElementById('closeSearchPanel');
        const searchPanel = document.getElementById('searchPanel');
        const searchInput = document.getElementById('searchInput');
        const searchPrevBtn = document.getElementById('searchPrev');
        const searchNextBtn = document.getElementById('searchNext');
        const clearSearchBtn = document.getElementById('clearSearch');
        const searchResultsEl = document.getElementById('searchResults');
        const transcriptEl = document.getElementById('transcript');
        
        if (!searchInput || !transcriptEl) return;
        
        let searchResults = [];
        let currentSearchIndex = -1;
        
        // Toggle search panel
        if (toggleSearchPanelBtn) {
            toggleSearchPanelBtn.addEventListener('click', function() {
                const isHidden = searchPanel.classList.contains('hidden');
                if (isHidden) {
                    closeAllPanels(searchPanel);
                    searchPanel.classList.remove('hidden');
                    setTimeout(() => searchInput.focus(), 100);
                } else {
                    searchPanel.classList.add('hidden');
                }
            });
        }
        
        if (closeSearchPanelBtn) {
            closeSearchPanelBtn.addEventListener('click', function() {
                searchPanel.classList.add('hidden');
                clearSearch();
            });
        }
        
        searchInput.addEventListener('input', performSearch);
        if (searchPrevBtn) searchPrevBtn.addEventListener('click', () => navigateSearch(-1));
        if (searchNextBtn) searchNextBtn.addEventListener('click', () => navigateSearch(1));
        if (clearSearchBtn) clearSearchBtn.addEventListener('click', clearSearch);
        
        function performSearch() {
            const query = searchInput.value.trim();
            const transcriptContent = transcriptEl.textContent;
            
            if (!query) {
                clearSearch();
                return;
            }
            
            try {
                const regex = new RegExp(escapeRegExp(query), 'gi');
                const matches = transcriptContent.match(regex);
                
                if (!matches || matches.length === 0) {
                    searchResults = [];
                    currentSearchIndex = -1;
                    if (searchResultsEl) searchResultsEl.textContent = '0 matches';
                    showToast('No matches found', 'info');
                    return;
                }
                
                // Store search results
                searchResults = [];
                let match;
                const execRegex = new RegExp(escapeRegExp(query), 'gi');
                while ((match = execRegex.exec(transcriptContent)) !== null) {
                    searchResults.push({ index: match.index, length: match[0].length });
                }
                
                currentSearchIndex = 0;
                if (searchResultsEl) {
                    searchResultsEl.textContent = `${searchResults.length} match${searchResults.length !== 1 ? 'es' : ''}`;
                }
                
                highlightSearchResults();
                navigateToSearchResult(0);
            } catch (error) {
                console.error('Search error:', error);
                showToast('Invalid search pattern', 'error');
            }
        }
        
        function escapeRegExp(string) {
            return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }
        
        function highlightSearchResults() {
            const query = searchInput.value.trim();
            if (!query) return;
            
            const transcriptContent = transcriptEl.textContent;
            const regex = new RegExp(escapeRegExp(query), 'gi');
            
            let highlighted = transcriptContent;
            let offset = 0;
            
            searchResults.forEach((result, index) => {
                const start = result.index + offset;
                const end = start + result.length;
                const before = highlighted.substring(0, start);
                const match = highlighted.substring(start, end);
                const after = highlighted.substring(end);
                const highlightClass = index === currentSearchIndex ? 'current-highlight' : 'highlight';
                
                highlighted = before + `<span class="${highlightClass}">${match}</span>` + after;
                offset += `<span class="${highlightClass}">${match}</span>`.length - match.length;
            });
            
            transcriptEl.innerHTML = highlighted;
        }
        
        function navigateSearch(direction) {
            if (searchResults.length === 0) return;
            
            currentSearchIndex += direction;
            if (currentSearchIndex < 0) {
                currentSearchIndex = searchResults.length - 1;
            } else if (currentSearchIndex >= searchResults.length) {
                currentSearchIndex = 0;
            }
            
            highlightSearchResults();
            navigateToSearchResult(currentSearchIndex);
        }
        
        function navigateToSearchResult(index) {
            if (searchResults.length === 0 || index < 0 || index >= searchResults.length) return;
            
            const element = transcriptEl.querySelector('.current-highlight');
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            
            if (searchResultsEl) {
                searchResultsEl.textContent = `${index + 1} of ${searchResults.length} match${searchResults.length !== 1 ? 'es' : ''}`;
            }
        }
        
        function clearSearch() {
            searchInput.value = '';
            searchResults = [];
            currentSearchIndex = -1;
            
            // Restore original transcript
            const originalText = transcriptEl.textContent;
            transcriptEl.innerHTML = formatTranscript(originalText);
            
            if (searchResultsEl) searchResultsEl.textContent = '0 matches';
        }
    }

    // Translation functionality - NOW CONNECTED TO BACKEND API
    function setupTranslation() {
        const toggleTranslatePanelBtn = document.getElementById('toggleTranslatePanel');
        const closeTranslatePanelBtn = document.getElementById('closeTranslatePanel');
        const translatePanel = document.getElementById('translatePanel');
        const translateBtn = document.getElementById('translateBtn');
        const targetLanguage = document.getElementById('targetLanguage');
        const transcriptEl = document.getElementById('transcript');
        const summaryEl = document.getElementById('summary');
        const translatedTranscriptCard = document.getElementById('translatedTranscriptCard');
        const translatedTranscript = document.getElementById('translatedTranscript');
        const translatedSummaryCard = document.getElementById('translatedSummaryCard');
        const translatedSummary = document.getElementById('translatedSummary');
        const translationInfo = document.getElementById('translationInfo');
        
        // Toggle translate panel
        if (toggleTranslatePanelBtn) {
            toggleTranslatePanelBtn.addEventListener('click', function() {
                const isHidden = translatePanel.classList.contains('hidden');
                if (isHidden) {
                    closeAllPanels(translatePanel);
                    translatePanel.classList.remove('hidden');
                } else {
                    translatePanel.classList.add('hidden');
                }
            });
        }
        
        if (closeTranslatePanelBtn) {
            closeTranslatePanelBtn.addEventListener('click', function() {
                translatePanel.classList.add('hidden');
            });
        }
        
        // Translate button - ACTUAL API CALL
        if (translateBtn) {
            translateBtn.addEventListener('click', async function() {
                if (!targetLanguage.value) {
                    showToast('Please select a language to translate to', 'warning');
                    return;
                }
                
                if (!transcriptEl || !transcriptEl.textContent.trim()) {
                    showToast('No transcript to translate', 'warning');
                    return;
                }
                
                const languages = {
                    'en': 'English', 'es': 'Spanish', 'fr': 'French', 'de': 'German',
                    'hi': 'Hindi', 'zh-cn': 'Chinese', 'ja': 'Japanese', 'ar': 'Arabic',
                    'ru': 'Russian', 'pt': 'Portuguese', 'it': 'Italian', 'ko': 'Korean'
                };
                
                const languageName = languages[targetLanguage.value] || targetLanguage.value;
                
                // Show loading state
                if (translateBtn) {
                    translateBtn.disabled = true;
                    translateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Translating...';
                }
                showToast(`Translating to ${languageName}...`, 'info');
                
                try {
                    // Get source language from file info
                    const sourceLanguage = sessionStorage.getItem('selectedLanguage') || 'en';
                    
                    // Translate transcript
                    const transcriptText = transcriptEl.textContent.trim();
                    const transcriptResponse = await fetch('/api/translate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            text: transcriptText,
                            source_lang: sourceLanguage,
                            target_lang: targetLanguage.value
                        })
                    });
                    
                    if (!transcriptResponse.ok) {
                        throw new Error('Transcript translation failed');
                    }
                    
                    const transcriptData = await transcriptResponse.json();
                    
                    // Translate summary
                    const summaryText = summaryEl ? summaryEl.textContent.trim() : '';
                    let summaryData = null;
                    
                    if (summaryText) {
                        const summaryResponse = await fetch('/api/translate', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                text: summaryText,
                                source_lang: sourceLanguage,
                                target_lang: targetLanguage.value
                            })
                        });
                        
                        if (summaryResponse.ok) {
                            summaryData = await summaryResponse.json();
                        }
                    }
                    
                    // Display translated transcript
                    if (translatedTranscript && transcriptData.translated) {
                        translatedTranscript.textContent = transcriptData.translated;
                    }
                    
                    // Display translated summary
                    if (translatedSummary && summaryData && summaryData.translated) {
                        translatedSummary.textContent = summaryData.translated;
                    }
                    
                    // Update translation info
                    if (translationInfo) {
                        translationInfo.textContent = `Translated to ${languageName}`;
                    }
                    
                    // Show translated sections
                    if (translatedTranscriptCard) {
                        translatedTranscriptCard.classList.remove('hidden');
                    }
                    if (translatedSummaryCard && summaryData) {
                        translatedSummaryCard.classList.remove('hidden');
                    }
                    
                    // Close translate panel
                    translatePanel.classList.add('hidden');
                    
                    showToast('Translation complete!', 'success');
                    
                } catch (error) {
                    console.error('Translation error:', error);
                    showToast(`Translation failed: ${error.message}`, 'error');
                } finally {
                    // Restore button state
                    if (translateBtn) {
                        translateBtn.disabled = false;
                        translateBtn.innerHTML = '<i class="fas fa-language"></i> Translate';
                    }
                }
            });
        }
        
        // Close translation cards
        const closeTranslationBtn = document.getElementById('closeTranslation');
        if (closeTranslationBtn) {
            closeTranslationBtn.addEventListener('click', function() {
                if (translatedTranscriptCard) translatedTranscriptCard.classList.add('hidden');
                if (translatedSummaryCard) translatedSummaryCard.classList.add('hidden');
            });
        }
        
        // Copy translated content buttons
        const copyTranslatedBtn = document.getElementById('copyTranslated');
        const copyTranslatedSummaryBtn = document.getElementById('copyTranslatedSummary');
        
        if (copyTranslatedBtn && translatedTranscript) {
            copyTranslatedBtn.addEventListener('click', async function() {
                try {
                    await navigator.clipboard.writeText(translatedTranscript.textContent);
                    showToast('Translated transcript copied!', 'success');
                } catch (err) {
                    showToast('Failed to copy', 'error');
                }
            });
        }
        
        if (copyTranslatedSummaryBtn && translatedSummary) {
            copyTranslatedSummaryBtn.addEventListener('click', async function() {
                try {
                    await navigator.clipboard.writeText(translatedSummary.textContent);
                    showToast('Translated summary copied!', 'success');
                } catch (err) {
                    showToast('Failed to copy', 'error');
                }
            });
        }
        
        // Export translated content
        const exportTranslatedBtn = document.getElementById('exportTranslated');
        if (exportTranslatedBtn && translatedTranscript) {
            exportTranslatedBtn.addEventListener('click', function() {
                const text = translatedTranscript.textContent;
                const blob = new Blob([text], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'translated-transcript.txt';
                a.click();
                URL.revokeObjectURL(url);
                showToast('Translated transcript exported!', 'success');
            });
        }

        // Export translated summary
        const exportTranslatedSummaryBtn = document.getElementById('exportTranslatedSummary');
        if (exportTranslatedSummaryBtn && translatedSummary) {
            exportTranslatedSummaryBtn.addEventListener('click', function() {
                const text = translatedSummary.textContent;
                const blob = new Blob([text], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'translated-summary.txt';
                a.click();
                URL.revokeObjectURL(url);
                showToast('Translated summary exported!', 'success');
            });
        }
    }
            
    // Copy buttons setup
    function setupCopyButtons() {
        const copyTranscriptBtn = document.getElementById('copyTranscript');
        const copySummaryBtn = document.getElementById('copySummary');
        const copySummaryBtn2 = document.getElementById('copySummaryBtn');
        const exportSummaryBtn = document.getElementById('exportSummaryBtn');
        const copyAllBtn = document.getElementById('copyAllBtn');
        const exportTxtBtn = document.getElementById('exportTxt');
        
        // Copy transcript
        if (copyTranscriptBtn) {
            copyTranscriptBtn.addEventListener('click', async function() {
                const transcriptEl = document.getElementById('transcript');
                if (transcriptEl) {
                    try {
                        await navigator.clipboard.writeText(transcriptEl.textContent);
                        showToast('Transcript copied to clipboard!', 'success');
                    } catch (err) {
                        showToast('Failed to copy transcript', 'error');
                    }
                }
            });
        }
        
        // Export transcript as TXT
        if (exportTxtBtn) {
            exportTxtBtn.addEventListener('click', function() {
                const transcriptEl = document.getElementById('transcript');
                if (transcriptEl) {
                    const text = transcriptEl.textContent;
                    const blob = new Blob([text], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'transcript.txt';
                    a.click();
                    URL.revokeObjectURL(url);
                    showToast('Transcript exported!', 'success');
                }
            });
        }
        
        // Handle both summary copy buttons
        const handleCopySummary = async () => {
            const summaryEl = document.getElementById('summary');
            if (summaryEl) {
                try {
                    await navigator.clipboard.writeText(summaryEl.textContent);
                    showToast('Summary copied to clipboard!', 'success');
                } catch (err) {
                    showToast('Failed to copy summary', 'error');
                }
            }
        };
        
        if (copySummaryBtn) copySummaryBtn.addEventListener('click', handleCopySummary);
        if (copySummaryBtn2) copySummaryBtn2.addEventListener('click', handleCopySummary);
        
        if (exportSummaryBtn) {
            exportSummaryBtn.addEventListener('click', function() {
                const summaryEl = document.getElementById('summary');
                if (summaryEl) {
                    const text = summaryEl.textContent;
                    const blob = new Blob([text], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'summary.txt';
                    a.click();
                    URL.revokeObjectURL(url);
                    showToast('Summary exported!', 'success');
                }
            });
        }
        
        if (copyAllBtn) {
            copyAllBtn.addEventListener('click', async function() {
                const transcriptEl = document.getElementById('transcript');
                const summaryEl = document.getElementById('summary');
                if (transcriptEl && summaryEl) {
                    const content = `TRANSCRIPT:\n${transcriptEl.textContent}\n\nSUMMARY:\n${summaryEl.textContent}`;
                    try {
                        await navigator.clipboard.writeText(content);
                        showToast('All content copied to clipboard!', 'success');
                    } catch (err) {
                        showToast('Failed to copy content', 'error');
                    }
                }
            });
        }
    }

    // Scroll buttons
    function setupScrollButtons() {
        const scrollToTopBtn = document.getElementById('scrollToTop');
        const scrollToBottomBtn = document.getElementById('scrollToBottom');
        const transcriptEl = document.getElementById('transcript');
        
        if (scrollToTopBtn && transcriptEl) {
            scrollToTopBtn.addEventListener('click', function() {
                transcriptEl.scrollTo({ top: 0, behavior: 'smooth' });
            });
        }
        
        if (scrollToBottomBtn && transcriptEl) {
            scrollToBottomBtn.addEventListener('click', function() {
                transcriptEl.scrollTo({ top: transcriptEl.scrollHeight, behavior: 'smooth' });
            });
        }
    }

    // Text-to-speech
    function setupTextToSpeech() {
        const speakTranscriptBtn = document.getElementById('speakTranscript');
        const transcriptEl = document.getElementById('transcript');
        
        if (speakTranscriptBtn && transcriptEl) {
            speakTranscriptBtn.addEventListener('click', function() {
                if ('speechSynthesis' in window) {
                    const speech = new SpeechSynthesisUtterance(transcriptEl.textContent);
                    speech.rate = 1.0;
                    speech.pitch = 1.0;
                    speech.volume = 1.0;
                    
                    // Check if speech is currently speaking
                    if (speechSynthesis.speaking) {
                        speechSynthesis.cancel();
                        showToast('Speech stopped', 'info');
                    } else {
                        speechSynthesis.speak(speech);
                        showToast('Reading transcript aloud...', 'info');
                    }
                } else {
                    showToast('Text-to-speech not supported in your browser', 'warning');
                }
            });
        }
    }

    // Close all panels helper
    function closeAllPanels(except = null) {
        const searchPanel = document.getElementById('searchPanel');
        const translatePanel = document.getElementById('translatePanel');
        
        if (searchPanel && searchPanel !== except) {
            searchPanel.classList.add('hidden');
        }
        if (translatePanel && translatePanel !== except) {
            translatePanel.classList.add('hidden');
        }
    }

    // Utility functions
    function formatTime(seconds) {
        if (!Number.isFinite(seconds)) seconds = 0;
        if (seconds < 0) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    function showToast(message, type = 'success') {
        const toastContainer = document.getElementById('toastContainer');
        if (!toastContainer) return;
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        `;
        
        toastContainer.appendChild(toast);
        
        setTimeout(() => toast.classList.add('show'), 10);
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // Initialize all features
    loadResults();
    setupSearch();
    setupTranslation();
    setupCopyButtons();
    setupScrollButtons();
    setupTextToSpeech();
});

