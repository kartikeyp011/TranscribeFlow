# TranscribeFlow - Audio Transcript Summarizer

## 🎙️ Project Overview

**TranscribeFlow** is a modern web application that transforms lengthy audio content (lectures, podcasts, meetings) into instant text transcripts and concise summaries. Designed for knowledge workers and students, it eliminates the need to listen through entire recordings by providing a two-stage AI pipeline: **Audio → Transcript → Summary**.

### Key Features (Frontend Implementation)
- ✅ Clean, minimal UI with vibrant color palette (indigo/pink/purple theme)
- ✅ Drag-and-drop style audio file upload (MP3, WAV, M4A, FLAC, OGG)
- ✅ Responsive design for all screen sizes
- ✅ Vanilla JS + Tailwind CSS

---

## 🚀 Quick Setup

### Prerequisites
- Web browser (Chrome, Firefox, Safari recommended)
- No Node.js or build tools required

### Running the Frontend
```
# Navigate to frontend folder
cd frontend

# Option 1: Simple Python HTTP server (recommended)
python -m http.server 3000

# Option 2: Open directly
# Double-click index.html
```

**Access:** [http://localhost:3000](http://localhost:3000)

---

## 📁 Folder Structure

```text
transcribeflow/
├── frontend/                # Current implementation
│   ├── index.html           # Main application (Tailwind + Vanilla JS)
│   ├── app.js               # API communication & UI logic
│   └── styles.css           # Custom styles (optional)
├── backend/                 # FastAPI server + AI models
└── README.md                # You're reading it!
```
---

## 🔌 API Integration Ready

Frontend connects to: `http://localhost:8000/api/upload`

**Expected Response:**

```json
{
  "filename": "lecture.mp3",
  "transcript": "Full spoken text...",
  "summary": "Key points summary...",
  "status": "success"
}
```
---

## 📄 License

MIT License — Feel free to use and modify for your portfolio/projects.

---

**Built for rapid audio processing** | January 2026