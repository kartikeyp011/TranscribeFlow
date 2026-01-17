// transcribe.js - Updated for real WebSocket logs
let currentFile = null;
let audioReady = false;
let isProcessing = false;
let ws = null;
let requestId = null;

// DOM Elements (same as before)
const elements = {
    uploadForm: document.getElementById('uploadForm'),
    audioFileInput: document.getElementById('audioFile'),
    dropzoneText: document.getElementById('dropzoneText'),
    fileNameDisplay: document.getElementById('fileName'),
    processBtn: document.getElementById('processBtn'),
    processBtnText: document.getElementById('processBtnText'),
    processBtnIcon: document.getElementById('processBtnIcon'),
    processingSpinner: document.getElementById('processingSpinner'),
    loadingIndicator: document.getElementById('loading'),
    processingStatus: document.getElementById('processingStatus'),
    errorMsgDiv: document.getElementById('errorMsg'),
    fileInfoSection: document.getElementById('fileInfoSection'),
    resultsSection: document.getElementById('results'),
    transcriptDiv: document.getElementById('transcript'),
    summaryDiv: document.getElementById('summary'),
    audioPlayer: document.getElementById('audioPlayer'),
    playPauseBtn: document.getElementById('playPause'),
    skipBackBtn: document.getElementById('skipBack'),
    skipForwardBtn: document.getElementById('skipForward'),
    progressBar: document.getElementById('progressBar'),
    currentTimeEl: document.getElementById('currentTime'),
    durationEl: document.getElementById('duration'),
    fontSizeSelect: document.getElementById('fontSize'),
    searchInput: document.getElementById('searchInput'),
    searchResults: document.getElementById('searchResults'),
    copyTranscriptBtn: document.getElementById('copyTranscript'),
    exportTxtBtn: document.getElementById('exportTxt'),
    copySummaryBtn: document.getElementById('copySummary'),
    exportSummaryTxtBtn: document.getElementById('exportSummaryTxt'),
    clearAllBtn: document.getElementById('clearAllBtn'),
    volumeBar: document.getElementById('volumeBar'),
    fileInfoName: document.getElementById('fileInfoName'),
    fileInfoSize: document.getElementById('fileInfoSize'),
    fileInfoTime: document.getElementById('fileInfoTime'),
    processingLogs: document.getElementById('processingLogs'),
    logsContent: document.getElementById('logsContent'),
    closeLogs: document.getElementById('closeLogs'),
    copyAllBtn: document.getElementById('copyAllBtn'),
    exportAllBtn: document.getElementById('exportAllBtn')
};

// 🔥 REAL API INTEGRATION - Upload Handler
elements.uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const file = elements.audioFileInput.files[0];

    if (!file || isProcessing) {
        showError('Please select an audio file');
        return;
    }

    await processAudioFile(file);
});

elements.audioFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
        elements.fileNameDisplay.textContent = `${file.name} (${sizeMB} MB)`;
        elements.dropzoneText.textContent = "File selected ✓";
    }
});

// 🔥 REAL AI PROCESSING PIPELINE
async function processAudioFile(file) {
    isProcessing = true;
    setProcessingButtonState(true);
    showProcessing();
    clearLogs();
    showLogs();
    
    // Generate unique request ID
    requestId = generateRequestId();
    
    try {
        const formData = new FormData();
        formData.append('file', file);

        // Add initial log
        addLog(`📤 Uploading ${file.name} (${(file.size/(1024*1024)).toFixed(1)} MB)...`, 'info');
        updateProcessingStage(0, 'Uploading audio...');

        // Connect to WebSocket for real-time logs
        // connectWebSocket(requestId);

        // Make the API call
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `Server error: ${response.status}`);
        }

        const data = await response.json();
        
        // Store request_id from response for WebSocket
        if (data.request_id) {
            requestId = data.request_id;
        }

        currentFile = data;
        await displayRealResults(data);

        addLog('🎉 Processing completed successfully!', 'success');
        updateProcessingStage(2, 'Complete!');

    } catch (error) {
        addLog(`❌ Error: ${error.message}`, 'error');
        showError(`AI Processing failed: ${error.message}`);
        console.error('Processing error:', error);
    } finally {
        isProcessing = false;
        setProcessingButtonState(false);
        hideProcessing();
        // Close WebSocket after delay
        setTimeout(() => {
            // if (ws) {
            //     ws.close();
            //     ws = null;
            // }
        }, 5000);
    }
}

// 🔥 WEBSOCKET CONNECTION FOR REAL LOGS
function connectWebSocket(requestId) {
    // Close existing connection if any
    if (ws) {
        ws.close();
    }
    
    // Determine WebSocket URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/logs/${requestId}`;
    
    ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
        console.log('✅ WebSocket connected for real-time logs');
        // Start ping to keep connection alive
        startWebSocketPing();
    };
    
    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.type === 'log') {
                // Parse and format the log message
                const formattedLog = formatLogMessage(data.message);
                addLog(formattedLog.text, formattedLog.type);
                
                // Update processing stage based on log content
                updateProcessingStageFromLog(data.message);
            } else if (data.type === 'pong') {
                // Ping response, do nothing
            }
        } catch (e) {
            console.error('Failed to parse WebSocket message:', e);
        }
    };
    
    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        addLog('⚠️ Real-time logging connection failed. Showing simulated progress...', 'warning');
        // Fallback to simulated logs
        startSimulatedLogs();
    };
    
    ws.onclose = () => {
        console.log('WebSocket disconnected');
        stopWebSocketPing();
    };
}

// Parse and format log messages
function formatLogMessage(logMessage) {
    // Remove INFO: prefixes and parse the message
    let cleanMessage = logMessage.replace(/^INFO:[^:]*:/, '').trim();
    
    // Determine log type based on content
    let type = 'info';
    if (cleanMessage.includes('✅') || cleanMessage.includes('complete') || cleanMessage.includes('loaded')) {
        type = 'success';
    } else if (cleanMessage.includes('❌') || cleanMessage.includes('error') || cleanMessage.includes('Error') || cleanMessage.includes('failed')) {
        type = 'error';
    } else if (cleanMessage.includes('⚠️') || cleanMessage.includes('warning') || cleanMessage.includes('Warning')) {
        type = 'warning';
    } else if (cleanMessage.includes('🎙️') || cleanMessage.includes('🔄')) {
        type = 'info';
    }
    
    return {
        text: cleanMessage,
        type: type
    };
}

// Update processing stage based on log content
function updateProcessingStageFromLog(logMessage) {
    const lowerLog = logMessage.toLowerCase();
    
    if (lowerLog.includes('processing audio with duration') || lowerLog.includes('detected language')) {
        updateProcessingStage(1, 'Transcribing audio...');
    } else if (lowerLog.includes('transcribed:')) {
        updateProcessingStage(1, 'Transcription complete!');
    } else if (lowerLog.includes('summarization') || lowerLog.includes('t5')) {
        updateProcessingStage(2, 'Generating summary...');
    } else if (lowerLog.includes('complete')) {
        updateProcessingStage(2, 'Complete!');
    }
}

// WebSocket ping to keep connection alive
let pingInterval = null;
function startWebSocketPing() {
    if (pingInterval) clearInterval(pingInterval);
    pingInterval = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send('ping');
        }
    }, 30000); // Ping every 30 seconds
}

function stopWebSocketPing() {
    if (pingInterval) {
        clearInterval(pingInterval);
        pingInterval = null;
    }
}

// Fallback simulated logs if WebSocket fails
function startSimulatedLogs() {
    const simulatedLogs = [
        { delay: 1000, message: '🎙️ Processing audio file...', type: 'info' },
        { delay: 3000, message: '🔍 Analyzing audio format and quality...', type: 'info' },
        { delay: 6000, message: '🎯 Detecting speech segments...', type: 'info' },
        { delay: 9000, message: '📝 Converting speech to text...', type: 'info' },
        { delay: 12000, message: '✍️ Formatting transcript...', type: 'info' },
        { delay: 15000, message: '🧠 Analyzing content for key points...', type: 'info' },
        { delay: 18000, message: '✨ Generating AI summary...', type: 'info' }
    ];
    
    simulatedLogs.forEach(log => {
        setTimeout(() => {
            if (isProcessing) {
                addLog(log.message, log.type);
                // Update stage based on simulated log
                if (log.message.includes('Converting speech')) {
                    updateProcessingStage(1, 'Transcribing audio...');
                } else if (log.message.includes('Generating AI summary')) {
                    updateProcessingStage(2, 'Generating summary...');
                }
            }
        }, log.delay);
    });
}

// Generate unique request ID
function generateRequestId() {
    return 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// 🔥 REAL RESULTS DISPLAY (same as before)
async function displayRealResults(data) {
    // File info
    elements.fileInfoName.textContent = data.filename;
    elements.fileInfoSize.textContent = `${data.size_mb} MB`;
    elements.fileInfoTime.textContent = new Date(data.uploaded).toLocaleString();
    elements.fileInfoSection.classList.remove('hidden');

    // 🔥 REAL TRANSCRIPT & SUMMARY FROM AI
    elements.transcriptDiv.textContent = data.transcript || 'No transcript generated';
    
    // Format summary based on data type
    if (typeof data.summary === 'string') {
        // If summary is a string, display it directly
        if (data.summary.includes('\n') || data.summary.includes('-') || data.summary.includes('•')) {
            // Format with bullet points
            const summaryLines = data.summary.split('\n').filter(line => line.trim());
            const formattedSummary = summaryLines.map(line => {
                const cleanLine = line.replace(/^[-\*•]\s*/, '').trim();
                return `<li><i class="fas fa-check success"></i> ${cleanLine}</li>`;
            }).join('');
            
            elements.summaryDiv.innerHTML = `
                <div class="summary-header">
                    <i class="fas fa-file-contract"></i>
                    <h4>AI Summary</h4>
                </div>
                <ul class="summary-list">${formattedSummary}</ul>
            `;
        } else {
            // Single paragraph summary
            elements.summaryDiv.innerHTML = `
                <div class="summary-header">
                    <i class="fas fa-file-contract"></i>
                    <h4>AI Summary</h4>
                </div>
                <p>${data.summary}</p>
            `;
        }
    } else {
        elements.summaryDiv.textContent = data.summary || 'No summary generated';
    }

    // Audio
    if (data.audio_url) {
        elements.audioPlayer.src = data.audio_url;
        elements.audioPlayer.load();
    }

    // Show results
    elements.resultsSection.classList.remove('hidden');
    elements.resultsSection.scrollIntoView({ behavior: 'smooth' });

    showToast('✅ AI transcription complete!');
}

// 🔥 PROCESSING UI (same as before)
function setProcessingButtonState(processing) {
    if (processing) {
        elements.processBtn.disabled = true;
        elements.processBtnText.textContent = 'Processing Audio...';
        elements.processBtnIcon.classList.add('hidden');
        elements.processingSpinner.classList.remove('hidden');
    } else {
        elements.processBtn.disabled = false;
        elements.processBtnText.textContent = 'Process Audio';
        elements.processBtnIcon.classList.remove('hidden');
        elements.processingSpinner.classList.add('hidden');
    }
}

function showProcessing() {
    elements.processingStatus.classList.remove('hidden');
}

function hideProcessing() {
    elements.processingStatus.classList.add('hidden');
}

function updateProcessingStage(stage, message) {
    const stages = elements.processingStatus.querySelectorAll('.status-stage');
    stages.forEach((s, i) => {
        s.classList.toggle('active', i <= stage);
        if (i === stage) s.querySelector('span').textContent = message;
    });
}

// 🔥 LOGS MANAGEMENT (same as before)
function showLogs() {
    elements.processingLogs.classList.remove('hidden');
}

function hideLogs() {
    elements.processingLogs.classList.add('hidden');
}

function clearLogs() {
    elements.logsContent.innerHTML = '';
}

function addLog(message, type = 'info') {
    const logEntry = document.createElement('div');
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    const iconMap = {
        'info': '🔵',
        'success': '🟢',
        'warning': '🟡',
        'error': '🔴'
    };
    
    logEntry.innerHTML = `<span class="log-timestamp">[${timestamp}]</span> ${iconMap[type] || '⚪'} ${message}`;
    logEntry.className = `log-${type}`;
    
    elements.logsContent.appendChild(logEntry);
    elements.logsContent.scrollTop = elements.logsContent.scrollHeight;
}

// 🔥 BULLETPROOF AUDIO CONTROLS
elements.playPauseBtn.addEventListener('click', () => {
    if (elements.audioPlayer.paused) {
        elements.audioPlayer.play().catch(console.error);
        elements.playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
    } else {
        elements.audioPlayer.pause();
        elements.playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
    }
});

// FIXED Skip buttons
elements.skipBackBtn.addEventListener('click', () => {
    const newTime = Math.max(0, elements.audioPlayer.currentTime - 10);
    elements.audioPlayer.currentTime = newTime;
});

elements.skipForwardBtn.addEventListener('click', () => {
    const newTime = Math.min(elements.audioPlayer.duration || Infinity, elements.audioPlayer.currentTime + 10);
    elements.audioPlayer.currentTime = newTime;
});

// Audio events
elements.audioPlayer.addEventListener('loadedmetadata', () => {
    if (!isNaN(elements.audioPlayer.duration) && elements.audioPlayer.duration > 0) {
        elements.durationEl.textContent = formatTime(elements.audioPlayer.duration);
    }
});

elements.audioPlayer.addEventListener('timeupdate', () => {
    if (elements.audioPlayer.duration) {
        const progress = (elements.audioPlayer.currentTime / elements.audioPlayer.duration) * 100;
        elements.progressBar.value = progress;
        elements.currentTimeEl.textContent = formatTime(elements.audioPlayer.currentTime);
    }
});

elements.audioPlayer.addEventListener('ended', () => {
    elements.playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
    elements.progressBar.value = 0;
});

// Progress bar
elements.progressBar.addEventListener('input', (e) => {
    if (elements.audioPlayer.duration) {
        elements.audioPlayer.currentTime = (e.target.value / 100) * elements.audioPlayer.duration;
    }
});

// Volume
if (elements.volumeBar) {
    elements.volumeBar.addEventListener('input', (e) => {
        elements.audioPlayer.volume = e.target.value / 100;
    });
}

// Font size control for both transcript and summary
elements.fontSizeSelect.addEventListener('change', (e) => {
    const fontSize = e.target.value + 'px';
    elements.transcriptDiv.style.fontSize = fontSize;
    elements.summaryDiv.style.fontSize = fontSize;
});

// Search
elements.searchInput.addEventListener('input', performSearch);

function performSearch() {
    const query = elements.searchInput.value;
    const text = elements.transcriptDiv.textContent;

    if (!query) {
        elements.transcriptDiv.innerHTML = text.replace(/<\/?mark>/g, '');
        elements.searchResults.textContent = '';
        return;
    }

    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const highlighted = text.replace(regex, '<mark>$1</mark>');
    elements.transcriptDiv.innerHTML = highlighted;
    elements.searchResults.textContent = `Found ${(text.match(regex) || []).length} matches`;
}

// Copy/Export (REAL data)
elements.copyTranscriptBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(elements.transcriptDiv.textContent)
        .then(() => showToast('Transcript copied to clipboard!'))
        .catch(() => showToast('Failed to copy transcript'));
});

elements.copySummaryBtn.addEventListener('click', () => {
    const text = elements.summaryDiv.textContent || elements.summaryDiv.innerText;
    navigator.clipboard.writeText(text)
        .then(() => showToast('Summary copied to clipboard!'))
        .catch(() => showToast('Failed to copy summary'));
});

elements.copyAllBtn.addEventListener('click', () => {
    const transcript = elements.transcriptDiv.textContent;
    const summary = elements.summaryDiv.textContent || elements.summaryDiv.innerText;
    const content = `TRANSCRIPT:\n\n${transcript}\n\n\nSUMMARY:\n\n${summary}`;
    navigator.clipboard.writeText(content)
        .then(() => showToast('All content copied to clipboard!'))
        .catch(() => showToast('Failed to copy content'));
});

elements.exportTxtBtn.addEventListener('click', () => {
    if (currentFile) {
        const content = `TranscribeFlow AI Transcript\n${'='.repeat(50)}\n\n${elements.transcriptDiv.textContent}`;
        downloadFile(content, `${currentFile.filename.replace(/\.[^/.]+$/, '')}_transcript.txt`);
        showToast('Transcript downloaded!');
    }
});

elements.exportSummaryTxtBtn.addEventListener('click', () => {
    if (currentFile) {
        const text = elements.summaryDiv.textContent || elements.summaryDiv.innerText;
        const content = `TranscribeFlow AI Summary\n${'='.repeat(50)}\n\n${text}`;
        downloadFile(content, `${currentFile.filename.replace(/\.[^/.]+$/, '')}_summary.txt`);
        showToast('Summary downloaded!');
    }
});

elements.exportAllBtn.addEventListener('click', () => {
    if (currentFile) {
        const transcript = elements.transcriptDiv.textContent;
        const summary = elements.summaryDiv.textContent || elements.summaryDiv.innerText;
        const content = `TranscribeFlow AI Results\n${'='.repeat(60)}\n\nTRANSCRIPT:\n\n${transcript}\n\n${'='.repeat(60)}\n\nSUMMARY:\n\n${summary}`;
        downloadFile(content, `${currentFile.filename.replace(/\.[^/.]+$/, '')}_complete.txt`);
        showToast('Complete results downloaded!');
    }
});

// Clear all
elements.clearAllBtn.addEventListener('click', async () => {
    if (confirm('Clear all uploaded files and results? This will remove all uploaded audio files and clear the current results.')) {
        try {
            const response = await fetch('/api/clear-all', { method: 'DELETE' });
            if (response.ok) {
                resetApp();
                showToast('All files cleared successfully!');
            } else {
                showToast('Failed to clear files on server');
            }
        } catch (e) {
            showToast('Cleared locally only (server unreachable)');
            resetApp();
        }
    }
});

// Close logs
elements.closeLogs.addEventListener('click', () => {
    hideLogs();
});

// Health check on load
async function checkBackendHealth() {
    try {
        const response = await fetch('/api/health');
        if (response.ok) {
            console.log('✅ Backend is healthy');
        }
    } catch (e) {
        console.warn('⚠️ Backend health check failed - continuing in offline mode');
    }
}

function resetApp() {
    currentFile = null;
    elements.audioPlayer.src = '';
    elements.fileInfoSection.classList.add('hidden');
    elements.resultsSection.classList.add('hidden');
    elements.processingLogs.classList.add('hidden');
    elements.audioFileInput.value = '';
    elements.fileNameDisplay.textContent = '';
    elements.dropzoneText.textContent = "Click to select or drag & drop audio file";
    elements.transcriptDiv.textContent = 'Upload audio to see real AI transcription...';
    elements.summaryDiv.innerHTML = 'AI summary will appear here after processing.';
    elements.searchInput.value = '';
    elements.searchResults.textContent = '';
    clearLogs();
    isProcessing = false;
    setProcessingButtonState(false);
    stopSimulatedProgress();
}

// Utilities
function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function downloadFile(content, filename) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function showError(message) {
    elements.errorMsgDiv.textContent = message;
    elements.errorMsgDiv.classList.remove('hidden');
    setTimeout(() => elements.errorMsgDiv.classList.add('hidden'), 5000);
}

function showToast(message) {
    // Remove existing toasts
    document.querySelectorAll('.toast').forEach(toast => toast.remove());

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<i class="fas fa-check"></i> ${message}`;

    // Add minimal toast styling
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--success);
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: var(--shadow-lg);
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 10px;
        font-weight: 600;
        animation: slideIn 0.3s ease;
    `;

    // Add keyframes for animation
    if (!document.querySelector('#toast-style')) {
        const style = document.createElement('style');
        style.id = 'toast-style';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    switch(e.code) {
        case 'Space':
            e.preventDefault();
            if (elements.audioPlayer.src) elements.playPauseBtn.click();
            break;
        case 'ArrowLeft':
            e.preventDefault();
            if (elements.audioPlayer.src) elements.skipBackBtn.click();
            break;
        case 'ArrowRight':
            e.preventDefault();
            if (elements.audioPlayer.src) elements.skipForwardBtn.click();
            break;
        case 'Escape':
            e.preventDefault();
            hideLogs();
            break;
    }
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    resetApp();
    checkBackendHealth();
});
