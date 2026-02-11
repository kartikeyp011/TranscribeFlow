# 🌌 TranscribeFlow

> **Advanced AI-Powered Audio Transcription & Intelligence Platform**

TranscribeFlow is a modern, full-stack web application designed to transform audio content into actionable intelligence. It goes beyond simple transcription by offering speaker diarization, AI-powered summarization, multi-language translation, and smart search capabilities—all wrapped in a beautiful, responsive "Space/Galaxy" themed interface.

![Project Status](https://img.shields.io/badge/Status-Active_Development-blue?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)
![Python](https://img.shields.io/badge/Python-3.10+-yellow?style=for-the-badge&logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-0.109+-009688?style=for-the-badge&logo=fastapi)

---

## ✨ Key Features

### 🎧 Core Processing
-   **High-Fidelity Transcription:** powered by **Faster-Whisper** for state-of-the-art accuracy.
-   **Speaker Diarization:** Automatically identifies and labels different speakers (e.g., "Speaker A", "Speaker B") using **pyannote.audio**.
-   **Smart Summarization:** Generates concise, bulleted summaries using **Groq (Llama 3.1)** with intelligent chunking for long audio files.
-   **Fallback Mechanisms:** Robust error handling with Hugging Face API fallbacks if primary services are unavailable.

### 🌍 Global Reach
-   **Multi-Language Support:** Transcribe audio from 50+ languages.
-   **Instant Translation:** Translate transcripts into major languages (English, Hindi, Spanish, French, German, etc.) on the fly using **deep-translator**.

### 💻 Modern User Experience
-   **Space/Galaxy Theme:** A visually stunning, dark-mode interface with animated backgrounds and glassmorphism effects.
-   **Interactive Player:** Custom audio player synced with transcript text.
-   **Smart Search:** Real-time search to instantly find keywords within the transcript.
-   **Responsive Design:** Fully optimized for desktop, tablet, and mobile devices.

### 📂 Productivity Tools
-   **Export Options:** Download results in **PDF**, **DOCX**, or **TXT** formats.
-   **Secure Storage:** Local storage implementation for user sessions and data persistence.

---

## 🛠️ Tech Stack

### Backend
-   **Framework:** FastAPI (Python)
-   **AI Models:**
    -   *Transcription:* Faster-Whisper
    -   *Summarization:* Groq API (Llama 3.1 8B), Hugging Face (BART/Pegasus fallback)
    -   *Diarization:* pyannote.audio
-   **Database:** SQLite with SQLAlchemy ORM
-   **Utilities:** Librosa (audio processing), ReportLab (PDF), Python-Docx

### Frontend
-   **Core:** HTML5, CSS3, JavaScript (ES6+)
-   **Styling:** Vanilla CSS with CSS Variables (Custom Properties) for theming.
-   **Icons & Fonts:** Font Awesome 6, Google Fonts (Inter).
-   **No Frameworks:** Lightweight, performance-focused implementation without React/Vue/Angular dependencies.

---

## 🚀 Installation & Setup

Follow these steps to get TranscribeFlow running on your local machine.

### Prerequisites
-   Python 3.10 or higher
-   Git

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/TranscribeFlow.git
cd TranscribeFlow
```

### 2. Create a Virtual Environment
```bash
# Windows
python -m venv venv
.\venv\Scripts\activate

# macOS/Linux
python3 -m venv venv
source venv/bin/activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```
*Note: This may take a few minutes as it installs PyTorch and other AI libraries.*

### 4. Database Setup (MySQL)
TranscribeFlow uses MySQL for robust data persistence.

1.  **Install MySQL Server:** Download and install from [mysql.com](https://dev.mysql.com/downloads/mysql/) or use Docker.
2.  **Create Database:** Log in to your MySQL shell and run:
    ```sql
    CREATE DATABASE transcribeflow CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    CREATE USER 'tf_user'@'localhost' IDENTIFIED BY 'your_password';
    GRANT ALL PRIVILEGES ON transcribeflow.* TO 'tf_user'@'localhost';
    FLUSH PRIVILEGES;
    ```

### 5. Configure Environment Variables
Create a `.env` file in the root directory and add your API keys and database credentials:

```ini
# AI Service Keys
GROQ_API_KEY=your_groq_api_key_here
HUGGINGFACE_TOKEN=your_huggingface_token_here

# Database Configuration
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=tf_user
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=transcribeflow
```
*   Get a Groq API Key: [console.groq.com](https://console.groq.com)
*   Get a Hugging Face Token: [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)

### 6. Run the Application
Start the FastAPI server:

```bash
uvicorn backend.main:app --reload
```

### 7. Access the App
Open your browser and navigate to:
**[http://localhost:8000](http://localhost:8000)**

---

## 📖 Usage Guide

1.  **Upload:** on the home page, select or drag-and-drop an audio file (MP3, WAV, M4A).
2.  **Configure:** Choose the audio language (or leave as Auto) and optional settings.
3.  **Process:** Click "Process Audio". The secure backend will handle upload, transcription, and summarization.
4.  **View Results:** Once complete, you'll be redirected to the Results dashboard.
    -   **Listen:** Use the custom player to playback audio.
    -   **Read:** Follow along with the interactive transcript.
    -   **Summarize:** View AI-generated key points.
    -   **Translate:** Use the dropdown to translate the text.
    -   **Search:** Find specific topics instantly.
5.  **Export:** Click the "Export" button to download your data.

---

## 🔌 API Documentation

TranscribeFlow provides a comprehensive REST API. When the server is running, you can access the interactive documentation (Swagger UI) at:

**[http://localhost:8000/docs](http://localhost:8000/docs)**

Key Endpoints:
-   `POST /api/upload`: Upload and process audio files.
-   `GET /api/results/{task_id}`: Retrieve transcription status and data.
-   `GET /api/export/{task_id}`: Export data in specified format.

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:
1.  Fork the repository.
2.  Create a feature branch (`git checkout -b feature/AmazingFeature`).
3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4.  Push to the branch (`git push origin feature/AmazingFeature`).
5.  Open a Pull Request.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

<p align="center">
  Built with ❤️ by the TranscribeFlow Team
</p>