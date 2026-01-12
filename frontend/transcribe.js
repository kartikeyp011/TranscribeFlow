// State
let currentFile = null;
let audioMatches = [];
let searchIndex = -1;

// DOM Elements
const uploadForm = document.getElementById('uploadForm');
const audioFileInput = document.getElementById('audioFile');
const dropzoneText = document.getElementById('dropzoneText');
const dropzoneHint = document.getElementById('dropzoneHint');
const fileNameDisplay = document.getElementById('fileName');
const uploadBtn = uploadForm.querySelector('button[type="submit"]');
const loadingIndicator = document.getElementById('loading');
const errorMsgDiv = document.getElementById('errorMsg');
const fileInfoSection = document.getElementById('fileInfoSection');
const resultsSection = document.getElementById('results');
const transcriptDiv = document.getElementById('transcript');
const summaryDiv = document.getElementById('summary');
const audioPlayer = document.getElementById('audioPlayer');

// File info elements
const fileInfoName = document.getElementById('fileInfoName');
const fileInfoSize = document.getElementById('fileInfoSize');
const fileInfoTime = document.getElementById('fileInfoTime');

// Player controls
const playPauseBtn = document.getElementById('playPause');
const skipBackBtn = document.getElementById('skipBack');
const skipForwardBtn = document.getElementById('skipForward');
const progressBar = document.getElementById('progressBar');
const currentTimeEl = document.getElementById('currentTime');
const durationEl = document.getElementById('duration');

// Transcript controls
const fontSizeSelect = document.getElementById('fontSize');
const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');
const copyTranscriptBtn = document.getElementById('copyTranscript');
const exportTxtBtn = document.getElementById('exportTxt');

// Summary controls
const summaryFontSizeSelect = document.getElementById('summaryFontSize');
const copySummaryBtn = document.getElementById('copySummary');
const exportSummaryTxtBtn = document.getElementById('exportSummaryTxt');

// Clear button
const clearAllBtn = document.getElementById('clearAllBtn');

// Static transcript and summary data
const staticTranscript = `Welcome to our meeting. Today we're discussing the quarterly results. 
Our revenue increased by 15% compared to last quarter. The marketing 
campaign has been successful. We've onboarded 25 new clients. The 
engineering team completed the new feature rollout. Customer satisfaction 
scores are at 92%. Next quarter we plan to expand into European markets. 
The budget has been approved for additional hiring.`;

const staticSummary = `<strong>Meeting Summary:</strong><br><br>
• Quarterly revenue increased by 15%<br>
• 25 new clients onboarded<br>
• Marketing campaign successful<br>
• Customer satisfaction at 92%<br>
• Engineering features deployed<br>
• European expansion planned for next quarter<br>
• Budget approved for additional hires`;

// Initialize static data
transcriptDiv.textContent = staticTranscript;
summaryDiv.innerHTML = staticSummary;

// File selection handler - SHOW FILENAME
audioFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
        fileNameDisplay.textContent = `${file.name} (${sizeMB} MB)`;
        fileNameDisplay.style.display = 'block';
        dropzoneText.textContent = "File selected";
        dropzoneHint.textContent = "Click to change file";
    } else {
        fileNameDisplay.textContent = '';
        fileNameDisplay.style.display = 'none';
        dropzoneText.textContent = "Select audio file";
        dropzoneHint.textContent = "Max 25MB";
    }
});

// File upload simulation
uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const file = audioFileInput.files[0];
    
    if (!file) {
        showError('Please select an audio file');
        return;
    }
    
    showLoading();
    
    // Simulate API delay
    setTimeout(() => {
        // Create mock file data
        currentFile = {
            filename: file.name,
            size_mb: (file.size / (1024 * 1024)).toFixed(2),
            uploaded: new Date().toISOString(),
            audio_url: URL.createObjectURL(file)
        };
        
        displayFileInfo(currentFile);
        showResults();
        hideLoading();
        showToast('File processed successfully');
        
    }, 1500);
});

// Display file info
function displayFileInfo(data) {
    fileInfoName.textContent = data.filename;
    fileInfoSize.textContent = `${data.size_mb} MB`;
    
    // Format date
    const date = new Date(data.uploaded);
    fileInfoTime.textContent = date.toLocaleString();
    
    // Set audio source
    audioPlayer.src = data.audio_url;
    audioPlayer.load();
    
    // Show file info section
    fileInfoSection.classList.remove('hidden');
}

// Show results
function showResults() {
    resultsSection.classList.remove('hidden');
    resultsSection.scrollIntoView({ behavior: 'smooth' });
}

// Audio player controls
playPauseBtn.addEventListener('click', () => {
    if (audioPlayer.paused) {
        audioPlayer.play();
        playPauseBtn.textContent = '⏸️';
    } else {
        audioPlayer.pause();
        playPauseBtn.textContent = '▶️';
    }
});

skipBackBtn.addEventListener('click', () => {
    audioPlayer.currentTime = Math.max(0, audioPlayer.currentTime - 10);
    skipBackBtn.textContent = '⏳';
    setTimeout(() => skipBackBtn.textContent = '⏮ 10s', 300);
});

skipForwardBtn.addEventListener('click', () => {
    audioPlayer.currentTime = Math.min(audioPlayer.duration, audioPlayer.currentTime + 10);
    skipForwardBtn.textContent = '⏳';
    setTimeout(() => skipForwardBtn.textContent = '10s ⏭', 300);
});

// Audio events
audioPlayer.addEventListener('loadedmetadata', () => {
    durationEl.textContent = formatTime(audioPlayer.duration);
    progressBar.max = 100;
});

audioPlayer.addEventListener('timeupdate', () => {
    if (audioPlayer.duration) {
        const progress = (audioPlayer.currentTime / audioPlayer.duration) * 100;
        progressBar.value = progress;
        currentTimeEl.textContent = formatTime(audioPlayer.currentTime);
    }
});

audioPlayer.addEventListener('ended', () => {
    playPauseBtn.textContent = '▶️';
    progressBar.value = 0;
    currentTimeEl.textContent = '0:00';
});

// Progress bar seeking
progressBar.addEventListener('input', (e) => {
    if (audioPlayer.duration) {
        const seekTime = (e.target.value / 100) * audioPlayer.duration;
        audioPlayer.currentTime = seekTime;
        currentTimeEl.textContent = formatTime(seekTime);
    }
});

// Format time helper
function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Font size controls
fontSizeSelect.addEventListener('change', (e) => {
    transcriptDiv.style.fontSize = e.target.value + 'px';
});

summaryFontSizeSelect.addEventListener('change', (e) => {
    summaryDiv.style.fontSize = e.target.value + 'px';
});

// Search functionality
searchInput.addEventListener('input', performSearch);

function performSearch() {
    const query = searchInput.value.toLowerCase();
    const text = transcriptDiv.textContent.toLowerCase();
    
    audioMatches = [];
    if (query) {
        let startIndex = 0;
        while (startIndex < text.length) {
            const index = text.indexOf(query, startIndex);
            if (index === -1) break;
            audioMatches.push(index);
            startIndex = index + 1;
        }
    }
    
    searchIndex = -1;
    searchResults.textContent = audioMatches.length ? 
        `${audioMatches.length} matches found` : '';
    
    highlightSearch();
}

function highlightSearch() {
    const query = searchInput.value;
    if (!query) {
        transcriptDiv.textContent = staticTranscript;
        return;
    }
    
    const regex = new RegExp(`(${query})`, 'gi');
    transcriptDiv.innerHTML = staticTranscript.replace(regex, '<mark>$1</mark>');
}

// Copy buttons
copyTranscriptBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(transcriptDiv.textContent)
        .then(() => showToast('Transcript copied to clipboard'))
        .catch(err => console.error('Copy failed:', err));
});

copySummaryBtn.addEventListener('click', () => {
    // Extract text from HTML for copy
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = summaryDiv.innerHTML;
    const textContent = tempDiv.textContent || tempDiv.innerText || '';
    
    navigator.clipboard.writeText(textContent)
        .then(() => showToast('Summary copied to clipboard'))
        .catch(err => console.error('Copy failed:', err));
});

// Export TXT buttons
exportTxtBtn.addEventListener('click', () => {
    if (!currentFile) return;
    
    const content = `TranscribeFlow Transcript\n${'='.repeat(40)}\n\n${transcriptDiv.textContent}`;
    downloadFile(content, `${currentFile.filename.replace(/\.[^/.]+$/, '')}_transcript.txt`);
    showToast('Transcript downloaded as TXT');
});

exportSummaryTxtBtn.addEventListener('click', () => {
    if (!currentFile) return;
    
    // Extract text from HTML for export
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = summaryDiv.innerHTML;
    const textContent = tempDiv.textContent || tempDiv.innerText || '';
    
    const content = `TranscribeFlow Summary\n${'='.repeat(40)}\n\n${textContent}`;
    downloadFile(content, `${currentFile.filename.replace(/\.[^/.]+$/, '')}_summary.txt`);
    showToast('Summary downloaded as TXT');
});

// Download file helper
function downloadFile(content, filename) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

// Clear all files
clearAllBtn.addEventListener('click', () => {
    if (confirm('Clear all files?')) {
        currentFile = null;
        audioPlayer.src = '';
        audioPlayer.load();
        fileInfoSection.classList.add('hidden');
        resultsSection.classList.add('hidden');
        audioFileInput.value = '';
        fileNameDisplay.textContent = '';
        fileNameDisplay.style.display = 'none';
        dropzoneText.textContent = "Select audio file";
        dropzoneHint.textContent = "Max 25MB";
        searchInput.value = '';
        searchResults.textContent = '';
        transcriptDiv.textContent = staticTranscript;
        transcriptDiv.style.fontSize = '16px';
        fontSizeSelect.value = '16';
        summaryDiv.innerHTML = staticSummary;
        summaryDiv.style.fontSize = '16px';
        summaryFontSizeSelect.value = '16';
        showToast('All files cleared');
    }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    
    switch(e.code) {
        case 'Space':
            e.preventDefault();
            playPauseBtn.click();
            break;
        case 'ArrowLeft':
            e.preventDefault();
            skipBackBtn.click();
            break;
        case 'ArrowRight':
            e.preventDefault();
            skipForwardBtn.click();
            break;
        case 'KeyF':
            if (e.ctrlKey) {
                e.preventDefault();
                searchInput.focus();
                searchInput.select();
            }
            break;
    }
});

// Utility functions
function showLoading() {
    loadingIndicator.classList.remove('hidden');
    uploadBtn.disabled = true;
}

function hideLoading() {
    loadingIndicator.classList.add('hidden');
    uploadBtn.disabled = false;
}

function showError(message) {
    errorMsgDiv.textContent = message;
    errorMsgDiv.classList.remove('hidden');
    setTimeout(() => errorMsgDiv.classList.add('hidden'), 5000);
}

function showToast(message) {
    // Create toast
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: var(--bg-card);
        color: var(--text-primary);
        padding: 12px 20px;
        border-radius: 6px;
        border: 1px solid var(--border-color);
        z-index: 1000;
        font-weight: 500;
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Initialize
audioPlayer.src = ''; // Clear initial audio source
