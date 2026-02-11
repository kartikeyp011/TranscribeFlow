/**
 * TranscribeFlow Frontend - Updated for backend-served static files
 * API_URL updated for same-origin requests (no CORS needed for frontend)
 */

// API endpoint at same origin /api/upload (backend-served)
const API_URL = '/api/upload';

// Rest of the JavaScript remains identical (DOM manipulation, form handling, etc.)
// ... (same code as previous app.js - no changes needed)
const uploadForm = document.getElementById('uploadForm');
const audioFileInput = document.getElementById('audioFile');
const fileNameDisplay = document.getElementById('fileName');
const uploadBtn = document.getElementById('uploadBtn');
const loadingIndicator = document.getElementById('loading');
const errorMsgDiv = document.getElementById('errorMsg');
const resultsSection = document.getElementById('results');
const transcriptDiv = document.getElementById('transcript');
const summaryDiv = document.getElementById('summary');
const statusMsg = document.getElementById('statusMsg');

audioFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
        fileNameDisplay.textContent = `Selected: ${file.name} (${fileSizeMB} MB)`;
    } else {
        fileNameDisplay.textContent = '';
    }
});

uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const file = audioFileInput.files[0];
    if (!file) {
        showError('Please select an audio file');
        return;
    }
    hideError();
    hideResults();
    showLoading();
    try {
        const formData = new FormData();
        formData.append('file', file);
        const response = await fetch(API_URL, { method: 'POST', body: formData });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.detail || 'Upload failed');
        }
        displayResults(data);
    } catch (error) {
        showError(error.message || 'An error occurred during upload');
    } finally {
        hideLoading();
    }
});

function displayResults(data) {
    transcriptDiv.textContent = data.transcript;
    summaryDiv.textContent = data.summary;
    statusMsg.textContent = data.message || 'Processing complete!';
    resultsSection.classList.remove('hidden');
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function showLoading() { loadingIndicator.classList.remove('hidden'); uploadBtn.disabled = true; }
function hideLoading() { loadingIndicator.classList.add('hidden'); uploadBtn.disabled = false; }
function showError(message) { errorMsgDiv.textContent = `❌ Error: ${message}`; errorMsgDiv.classList.remove('hidden'); }
function hideError() { errorMsgDiv.classList.add('hidden'); }
function hideResults() { resultsSection.classList.add('hidden'); }
