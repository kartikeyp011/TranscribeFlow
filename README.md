# 🌌 TranscribeFlow

> **Advanced AI-Powered Audio Transcription & Intelligence Platform**

TranscribeFlow is a modern, full-stack web application designed to transform audio content into actionable intelligence. It goes beyond simple transcription by offering speaker diarization, AI-powered summarization, multi-language translation, and smart search capabilities—all wrapped in a beautiful, responsive "Space/Galaxy" themed interface.

![Project Status](https://img.shields.io/badge/Status-Active_Development-blue?style=for-the-badge&logo=github)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge&logo=open-source-initiative)
![Python](https://img.shields.io/badge/Python-3.11.9-yellow?style=for-the-badge&logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-0.128+-009688?style=for-the-badge&logo=fastapi)
![MySQL](https://img.shields.io/badge/MySQL-8.0+-4479A1?style=for-the-badge&logo=mysql)

---

## ✨ Key Features

### 🎧 Core Intelligence
-   **High-Accuracy Transcription:** Powered by **Whisper Large-v3-turbo** via Groq for lightning-fast, industry-leading speech recognition.
-   **Speaker Diarization:** Automatically identifies "Who spoke when" using **Pyannote Audio 4.0.4**, distinguishing multiple speakers in conversations with high precision.
-   **Smart Summarization:** Generates concise summaries using **Llama 3.1 8B Instant** (Groq). Supports multiple modes:
    -   *Bullet Points* (Default)
    -   *Meeting Minutes* (Attendees, Decisions, Next Steps)
    -   *Action Items* (Task extraction)
    -   *Study Notes* (Key concepts & definitions)
    -   *Blog Post* (Content creation)

### 🌍 Global Accessibility
-   **Multi-Language Support:** Configure input language for **22+ languages** including English, Hindi, Spanish, French, German, Chinese, Japanese, and more.
-   **Instant Translation:** Translate transcripts and summaries into major languages on-the-fly using **Llama 3.1** and **Deep Translator**.
-   **Language Detection:** Automatically detects the spoken language of the uploaded audio.

### 💻 Modern User Experience
-   **Galaxy Theme:** A premium, dark-mode interface with animated nebula backgrounds, glassmorphism cards, and smooth transitions.
-   **Interactive Player:** Custom audio player with waveform visualization. Click any transcript segment to jump to that timestamp.
-   **Real-time Logs:** Watch the AI pipeline in action with live WebSocket-powered processing logs.
-   **Batch Processing:** Upload multiple files at once and let them process in the background.
-   **Smart Search & Filters:** Instantly find keywords within transcripts. Filter files by Starred, Pinned, or Date.

### 📄 Export & Management
-   **Multi-Format Export:** Download your results in **TXT**, **PDF**, **DOCX**, and **SRT** (Subtitle) formats.
-   **File Management:** Organize your transcriptions with pinning and starring capabilities.
-   **Secure Storage:** All files are securely stored and associated with your user account.

### 🛡️ Security & Reliability
-   **User Authentication:** Secure signup/login system with **JWT** (JSON Web Tokens) and password hashing.
-   **Robust Backend:** Built on **FastAPI** with **SQLAlchemy ORM** for reliable data handling.
-   **Data Persistence:** **MySQL** database integration for user profiles and file metadata, with scalable JSON file storage for transcript content.

---

## 🛠️ Tech Stack

### Backend
-   **Framework:** FastAPI (Python 3.11.9)
-   **AI Engines:**
    -   *Transcription:* **Whisper-Large-v3-Turbo** (via Groq API) for speed & accuracy.
    -   *Diarization:* **Pyannote Audio 4.0.4** (Hugging Face) for speaker identification.
    -   *Summarization/Translation:* **Llama 3.1 8B Instant** (Groq API) as primary, with Hugging Face (**BART**) fallback & **Deep Translator**.
-   **Database:** MySQL (Production-grade RDMS) with **SQLAlchemy ORM** and JSON file storage.
-   **Authentication:** OAuth2 with Password Flow (JWT) & bcrypt hashing.
-   **Utilities:** torchaudio (Audio processing), ReportLab (PDF), Python-docx (Word), Pysrt (Subtitles).

### Frontend
-   **Core:** HTML5, CSS3, JavaScript (ES6+ Modules).
-   **Styling:** Vanilla CSS with **CSS Variables** for the "Galaxy" theme and responsive design.
-   **Components:** Font Awesome 6 (Icons), Google Fonts (Inter).
-   **Architecture:** Zero-build step; runs natively in modern browsers.

---

## 🚀 Installation & Setup

Prerequisites:
-   **Python 3.11.9** installed.
-   **MySQL Server** installed and running.
-   **Git** for version control.

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/TranscribeFlow.git
cd TranscribeFlow
```

### 2. Create Virtual Environment
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
*Note: PyTorch and Pyannote Audio may require significant download time.*

### 4. Database Setup
1.  Log in to MySQL and create the database:
    ```sql
    CREATE DATABASE transcribeflow;
    ```
2.  Update the `.env` file with your credentials (see below).

### 5. Configure Environment Variables
Create a `.env` file in the root directory (copy from `.env-sample` if available):

```ini
# AI Services APIs
GROQ_API_KEY=your_groq_api_key_here
HUGGINGFACE_TOKEN=your_huggingface_token_here

# Database Config
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=your_mysql_username
MYSQL_PASSWORD=your_mysql_password
MYSQL_DATABASE=transcribeflow
DATABASE_URL=mysql+pymysql://your_mysql_username:your_mysql_password@localhost:3306/transcribeflow

# Security / JWT Settings
SECRET_KEY=your_super_secret_key_here
JWT_SECRET_KEY=your_jwt_secret_key_here
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# App Settings
FRONTEND_URL=http://localhost:8000
UPLOAD_DIR=uploads
MAX_FILE_SIZE_MB=25
```

### 6. Run the Application
Start the FastAPI server with hot-reload enabled:
```bash
uvicorn backend.main:app --reload
```

### 7. Access the App
Open your browser to: **[http://localhost:8000](http://localhost:8000)**

---

## 📖 Usage Guide

1.  **Sign Up / Login:** Create an account to access the platform.
2.  **Upload Audio:** Drag & drop an audio file (MP3, WAV, M4A) on the dashboard.
3.  **Configure Settings:**
    -   Select **Audio Language**.
    -   Toggle **Speaker Diarization** if you have multiple speakers.
    -   Set **Number of Speakers** (optional, improves accuracy).
4.  **Process:** Click **Process Audio**. The system uploads securely and starts the AI pipeline.
5.  **View Results:**
    -   **Player:** Listen to audio with waveform visualization.
    -   **Transcript:** Read the speaker-labeled text.
    -   **Summary:** Review AI-generated bullet points.
    -   **Translate:** Switch language using the translation tool.
6.  **Export:** Download results as `.txt` or `.pdf`.

---

## 🔌 API Documentation

TranscribeFlow exposes a full REST API. Access the interactive Swagger UI at:
**[http://localhost:8000/docs](http://localhost:8000/docs)**

### Key Endpoints
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Register a new user |
| `POST` | `/api/auth/login` | Login and get access token |
| `POST` | `/api/upload` | Upload audio for synchronous processing |
| `POST` | `/api/upload/batch` | Upload multiple files for background batch processing |
| `GET` | `/api/files` | List user's files |
| `GET` | `/api/files/{id}` | Get specific file results |
| `POST` | `/api/translate` | Translate text content |

---

## 📂 Project Structure

```
TranscribeFlow/
├── backend/                # Python FastAPI Backend
│   ├── __init__.py         # Package initialization
│   ├── crud.py             # Database CRUD operations
│   ├── database.py         # DB connection & sessionmaker
│   ├── db_models.py        # SQLAlchemy ORM models
│   ├── dependencies.py     # FastAPI dependencies (auth setup)
│   ├── export.py           # Export formatting (TXT, PDF, DOCX, SRT)
│   ├── main.py             # App entry point & API endpoints
│   ├── models.py           # AI Pipeline (Whisper/Pyannote/Llama)
│   ├── schemas.py          # Pydantic validation schemas
│   └── security.py         # JWT tokens and password hashing
├── content_files/          # JSON transcripts storage
├── frontend/               # Static Frontend Assets
│   ├── static/             # CSS, JS, and image assets
│   ├── dashboard.html      # User Dashboard
│   ├── history.html        # History of Past Transcriptions
│   ├── index.html          # Landing Page
│   ├── login.html          # Login Page
│   ├── register.html       # Registration Page
│   ├── results.html        # Results View for Transcripts
│   ├── upload.html         # Audio Upload Interface
│   └── user.html           # User Profile & Settings
├── uploads/                # Temp storage for audio files
├── .env-sample             # Environment variables template
├── requirements.txt        # Python dependencies
└── README.md               # Documentation
```

---

## 🤝 Contributing

1.  Fork the repository.
2.  Create your feature branch (`git checkout -b feature/NewFeature`).
3.  Commit your changes (`git commit -m 'Add NewFeature'`).
4.  Push to the branch (`git push origin feature/NewFeature`).
5.  Open a Pull Request.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

<p align="center">
  Built with ❤️ by the TranscribeFlow Team
</p>