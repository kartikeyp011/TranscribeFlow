/**
 * TranscribeFlow Frontend - Updated for backend-served static files
 * API_URL updated for same-origin requests (no CORS needed for frontend)
 */

// API endpoint at same origin /api/upload (backend-served)
const API_URL = '/api/upload';

// Rest of the JavaScript remains identical (DOM manipulation, form handling, etc.)
// ... (same code as previous app.js - no changes needed)

/**
 * Cache references to frequently used DOM elements.
 * This avoids repeated DOM queries and improves readability and performance.
 */
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
 * Event listener for file input changes.
 * When a user selects an audio file, this updates the UI to display
 * the file name and its size in MB for confirmation before upload.
 */
audioFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];

    if (file) {
        // Convert file size from bytes to MB for user-friendly display
        const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);

        // Display selected file name and size
        fileNameDisplay.textContent = `Selected: ${file.name} (${fileSizeMB} MB)`;
    } else {
        // Reset display if no file is selected
        fileNameDisplay.textContent = '';
    }
});

/**
 * Handles form submission for uploading an audio file.
 * Prevents the default browser form submission and instead
 * sends the file asynchronously to the FastAPI backend using fetch().
 */
uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault(); // Prevent page reload

    const file = audioFileInput.files[0];

    // Validate that a file has been selected before attempting upload
    if (!file) {
        showError('Please select an audio file');
        return;
    }

    // Reset UI state before starting upload
    hideError();
    hideResults();
    showLoading();

    try {
        /**
         * Create FormData to send the audio file in multipart/form-data format.
         * This is required for file uploads to the backend API.
         */
        const formData = new FormData();
        formData.append('file', file);

        /**
         * Send POST request to the FastAPI backend.
         * The backend endpoint processes the audio file, generates the transcript
         * and summary, and returns the results as JSON.
         */
        const response = await fetch(API_URL, { method: 'POST', body: formData });

        // Parse the JSON response from the server
        const data = await response.json();

        /**
         * If the response status is not successful, throw an error.
         * The backend may include an error message inside "detail".
         */
        if (!response.ok) {
            throw new Error(data.detail || 'Upload failed');
        }

        // Display transcription and summary results in the UI
        displayResults(data);

    } catch (error) {
        /**
         * Catch network errors or backend processing errors
         * and display a user-friendly error message.
         */
        showError(error.message || 'An error occurred during upload');
    } finally {
        // Ensure loading indicator is hidden regardless of success or failure
        hideLoading();
    }
});

/**
 * Displays the transcription results returned by the backend.
 * Updates transcript text, generated summary, and status message,
 * then reveals the results section in the UI.
 */
function displayResults(data) {
    transcriptDiv.textContent = data.transcript;
    summaryDiv.textContent = data.summary;

    // Display optional backend message or fallback message
    statusMsg.textContent = data.message || 'Processing complete!';

    // Make the results section visible
    resultsSection.classList.remove('hidden');

    // Smoothly scroll the results into view for better UX
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/**
 * Shows the loading indicator and disables the upload button
 * to prevent duplicate submissions while the request is in progress.
 */
function showLoading() {
    loadingIndicator.classList.remove('hidden');
    uploadBtn.disabled = true;
}

/**
 * Hides the loading indicator and re-enables the upload button
 * after the request completes.
 */
function hideLoading() {
    loadingIndicator.classList.add('hidden');
    uploadBtn.disabled = false;
}

/**
 * Displays an error message in the UI.
 * Used for validation errors, network issues, or backend failures.
 */
function showError(message) {
    errorMsgDiv.textContent = `❌ Error: ${message}`;
    errorMsgDiv.classList.remove('hidden');
}

/**
 * Hides the error message container.
 * Called before starting a new upload attempt.
 */
function hideError() {
    errorMsgDiv.classList.add('hidden');
}

/**
 * Hides the results section.
 * Ensures that previous transcription results do not remain visible
 * when a new upload begins.
 */
function hideResults() {
    resultsSection.classList.add('hidden');
}