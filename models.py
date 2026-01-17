import os
import io
import logging
import pydub
from faster_whisper import WhisperModel
from transformers import pipeline, AutoTokenizer, AutoModelForSeq2SeqLM

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MODEL_DIR = "models_cache"
WHISPER_MODEL_NAME = "distil-large-v3"
T5_MODEL_NAME = "google-t5/t5-base"

os.makedirs(MODEL_DIR, exist_ok=True)

class TranscribeFlowPipeline:
    def __init__(self):
        """Load models: use local cache if available, else download"""

        # ---------------------------
        # Load Whisper ASR
        # ---------------------------
        logger.info("🔄 Loading Whisper ASR model...")

        self.asr_model = WhisperModel(
            WHISPER_MODEL_NAME,
            device="cpu",
            compute_type="int8",
            download_root=MODEL_DIR
        )

        logger.info("✅ Whisper ASR loaded!")

        # ---------------------------
        # Load T5 Summarizer
        # ---------------------------
        logger.info("🔄 Loading T5 summarization model...")

        try:
            # Try local cache first
            tokenizer = AutoTokenizer.from_pretrained(
                T5_MODEL_NAME,
                cache_dir=MODEL_DIR,
                local_files_only=True
            )
            model = AutoModelForSeq2SeqLM.from_pretrained(
                T5_MODEL_NAME,
                cache_dir=MODEL_DIR,
                local_files_only=True
            )
            logger.info("✅ Loaded T5 from local cache")

        except Exception:
            # Download if not found locally
            logger.warning("⚠️ Local model not found. Downloading from HuggingFace...")

            tokenizer = AutoTokenizer.from_pretrained(
                T5_MODEL_NAME,
                cache_dir=MODEL_DIR
            )
            model = AutoModelForSeq2SeqLM.from_pretrained(
                T5_MODEL_NAME,
                cache_dir=MODEL_DIR
            )

            logger.info("✅ T5 downloaded and cached locally")

        self.summarizer = pipeline(
            "summarization",
            model=model,
            tokenizer=tokenizer,
            device=-1
        )

        logger.info("✅ Summarization model ready!")

    # ---------------------------
    # Audio Preprocessing
    # ---------------------------
    def preprocess_audio(self, audio_bytes: bytes) -> io.BytesIO:
        """Convert to 16kHz mono WAV (Whisper requirement)"""

        audio = pydub.AudioSegment.from_file(io.BytesIO(audio_bytes))
        audio = audio.set_frame_rate(16000).set_channels(1)

        buffer = io.BytesIO()
        audio.export(buffer, format="wav")
        buffer.seek(0)
        return buffer

    # ---------------------------
    # Transcription
    # ---------------------------
    def transcribe(self, audio_bytes: bytes) -> str:
        processed_audio = self.preprocess_audio(audio_bytes)

        segments, _ = self.asr_model.transcribe(
            processed_audio,
            beam_size=5,
            language=None,
            task="transcribe"
        )

        transcript = " ".join(segment.text for segment in segments)

        logger.info(f"✅ Transcribed: {len(transcript)} characters")
        return transcript.strip()

    # ---------------------------
    # Summarization
    # ---------------------------
    def summarize(self, transcript: str, max_length: int = 200) -> str:
        try:
            if len(transcript) > 4000:
                chunks = [transcript[i:i + 4000] for i in range(0, len(transcript), 3500)]
                summaries = []

                for chunk in chunks:
                    result = self.summarizer(
                        chunk,
                        max_length=max_length // len(chunks),
                        min_length=30,
                        do_sample=False
                    )
                    summaries.append(result[0]['summary_text'])

                summary = " ".join(summaries)

            else:
                result = self.summarizer(
                    transcript,
                    max_length=max_length,
                    min_length=50,
                    do_sample=False
                )
                summary = result[0]['summary_text']

            bullet_points = summary.replace('. ', '.\n• ')
            formatted = f"**Key Points:**\n• {bullet_points}"

            logger.info("✅ Summary generated")
            return formatted

        except Exception as e:
            logger.error(f"Summarization failed: {e}")
            sentences = transcript.split('. ')
            summary = ". ".join(sentences[:4]) + "..."
            return f"**Summary:**\n{summary}"


# ---------------------------
# Global Singleton
# ---------------------------
pipeline = TranscribeFlowPipeline()
