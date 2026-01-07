/**
 * TranscribeFlow - Frontend JavaScript
 * Handles file upload, API communication, and UI updates
 */

// API endpoint configuration
// Update this URL to match your backend server address
const API_URL = 'http://localhost:8000/api/upload';

// Get DOM element references
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

/**
 * Event listener for file input change
 * Displays the selected filename to the user
 */
audioFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        // Show selected filename with file size
        const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
        fileNameDisplay.textContent = `Selected: ${file.name} (${fileSizeMB} MB)`;
    } else {
        fileNameDisplay.textContent = '';
    }
});

/**
 * Event listener for form submission
 * Handles file upload and API communication
 */
uploadForm.addEventListener('submit', async (e) => {
    // Prevent default form submission behavior
    e.preventDefault();
    
    // Get selected file
    const file = audioFileInput.files[0];
    
    // Validate that a file was selected
    if (!file) {
        showError('Please select an audio file');
        return;
    }
    
    // Hide previous results and errors
    hideError();
    hideResults();
    
    // Show loading indicator and disable upload button
    showLoading();
    
    try {
        // Create FormData object to send file to backend
        const formData = new FormData();
        formData.append('file', file);
        
        // Send POST request to backend API
        const response = await fetch(API_URL, {
            method: 'POST',
            body: formData
        });
        
        // Parse JSON response
        const data = await response.json();
        
        // Check if request was successful
        if (!response.ok) {
            throw new Error(data.detail || 'Upload failed');
        }
        
        // Display results to user
        displayResults(data);
        
    } catch (error) {
        // Handle and display any errors
        showError(error.message || 'An error occurred during upload');
    } finally {
        // Hide loading indicator and re-enable upload button
        hideLoading();
    }
});

/**
 * Display transcription and summary results
 * @param {Object} data - Response data from API containing transcript and summary
 */
function displayResults(data) {
    // Populate transcript and summary divs with response data
    transcriptDiv.textContent = data.transcript;
    summaryDiv.textContent = data.summary;
    statusMsg.textContent = data.message || 'Processing complete!';
    
    // Show results section
    resultsSection.classList.remove('hidden');
    
    // Smooth scroll to results
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/**
 * Show loading indicator
 */
function showLoading() {
    loadingIndicator.classList.remove('hidden');
    uploadBtn.disabled = true;
}

/**
 * Hide loading indicator
 */
function hideLoading() {
    loadingIndicator.classList.add('hidden');
    uploadBtn.disabled = false;
}

/**
 * Show error message to user
 * @param {string} message - Error message to display
 */
function showError(message) {
    errorMsgDiv.textContent = `❌ Error: ${message}`;
    errorMsgDiv.classList.remove('hidden');
}

/**
 * Hide error message
 */
function hideError() {
    errorMsgDiv.classList.add('hidden');
}

/**
 * Hide results section
 */
function hideResults() {
    resultsSection.classList.add('hidden');
}
