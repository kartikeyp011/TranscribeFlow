import os
import io
import logging
import pydub
from faster_whisper import WhisperModel
from transformers import pipeline, AutoTokenizer, AutoModelForSeq2SeqLM
import numpy as np
from deep_translator import GoogleTranslator

import warnings
warnings.filterwarnings('ignore', category=UserWarning)

from dotenv import load_dotenv
# Load environment variables from .env file
load_dotenv()


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
        # Initialize Translator
        # ---------------------------
        logger.info("🌐 Initializing translation service...")
        self.translator_cache = {}
        logger.info("✅ Translation service ready!")

    # ---------------------------
    # Audio Preprocessing
    # ---------------------------
    def preprocess_audio(self, audio_bytes: bytes):
        audio = pydub.AudioSegment.from_file(
            io.BytesIO(audio_bytes)
        )
        return audio

    # ---------------------------
    # Transcription
    # ---------------------------
    def transcribe(self, audio_input, language="en"):

        if isinstance(audio_input, str):
            if not os.path.exists(audio_input):
                raise ValueError(f"Audio file not found: {audio_input}")
            with open(audio_input, "rb") as f:
                audio_bytes = f.read()

        elif isinstance(audio_input, (bytes, bytearray)):
            audio_bytes = audio_input

        else:
            raise TypeError(f"Unsupported audio_input type: {type(audio_input)}")

        processed_audio = self.preprocess_audio(audio_bytes)
        return self.run_whisper(processed_audio, language)


    def run_whisper(self, audio_segment, language="en"):
        """
        Correctly prepare audio for faster-whisper with language support
        """        
        logger.info(f"🎙️ Transcribing with language: {language}")

        # Ensure mono
        if audio_segment.channels > 1:
            audio_segment = audio_segment.set_channels(1)

        # Ensure 16kHz sample rate
        audio_segment = audio_segment.set_frame_rate(16000)

        # Convert to float32 numpy array
        samples = np.array(audio_segment.get_array_of_samples())
        audio_np = samples.astype(np.float32) / 32768.0

        segments, info = self.asr_model.transcribe(
            audio_np,
            language=language,
            beam_size=5,
            vad_filter=True
        )

        logger.info(f"✅ Transcription complete (Detected: {info.language if hasattr(info, 'language') else language})")
        
        text = []
        for segment in segments:
            text.append(segment.text.strip())

        return " ".join(text)


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
                        max_new_tokens=None,
                        min_length=30,
                        do_sample=False
                    )
                    summaries.append(result[0]['summary_text'])

                summary = " ".join(summaries)

            else:
                max_len = min(max_length, max(30, len(transcript) // 2))

                result = self.summarizer(
                    transcript,
                    max_length=max_len,
                    max_new_tokens=None,
                    min_length=20,
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
    # Language Detection
    # ---------------------------
    def detect_language(self, text: str) -> dict:
        """
        Detect language from transcribed text using Whisper's detected language
        Returns: dict with 'code' and 'name'
        """
        try:
            # Whisper already detected language during transcription
            # For now we'll use a simple heuristic
            # You can enhance this with langdetect library later
            
            # Common language patterns
            if any(char in text for char in ['ä', 'ö', 'ü', 'ß']):
                return {'code': 'de', 'name': 'German'}
            elif any(char in text for char in ['é', 'è', 'ê', 'à', 'ç']):
                return {'code': 'fr', 'name': 'French'}
            elif any(char in text for char in ['ñ', '¿', '¡']):
                return {'code': 'es', 'name': 'Spanish'}
            elif any(char in text for char in ['а', 'б', 'в', 'г', 'д']):
                return {'code': 'ru', 'name': 'Russian'}
            elif any(char in text for char in ['你', '我', '的', '是']):
                return {'code': 'zh-cn', 'name': 'Chinese'}
            elif any(char in text for char in ['の', 'は', 'を', 'に']):
                return {'code': 'ja', 'name': 'Japanese'}
            else:
                return {'code': 'en', 'name': 'English'}
                
        except Exception as e:
            logger.error(f"Language detection failed: {e}")
            return {'code': 'en', 'name': 'English'}

    
    # ---------------------------
    # Translation
    # ---------------------------
    def translate_text(self, text: str, source_lang: str = 'auto', target_lang: str = 'en') -> dict:
        """
        Translate text to target language
        Returns: dict with 'original', 'translated', 'source_lang', 'target_lang'
        """
        try:
            logger.info(f"🌐 Translating from {source_lang} to {target_lang}...")
            
            # Handle case where source and target are same
            if source_lang == target_lang and source_lang != 'auto':
                return {
                    'original': text,
                    'translated': text,
                    'source_lang': source_lang,
                    'target_lang': target_lang,
                    'message': 'Source and target languages are the same'
                }
            
            # Initialize translator
            translator = GoogleTranslator(source=source_lang, target=target_lang)
            
            # For long texts, split into chunks
            if len(text) > 4500:
                chunks = [text[i:i + 4500] for i in range(0, len(text), 4000)]
                translated_chunks = []
                
                for i, chunk in enumerate(chunks):
                    logger.info(f"Translating chunk {i+1}/{len(chunks)}...")
                    translated_chunk = translator.translate(chunk)
                    translated_chunks.append(translated_chunk)
                
                translated_text = ' '.join(translated_chunks)
            else:
                translated_text = translator.translate(text[:5000])
            
            logger.info("✅ Translation complete")
            
            return {
                'original': text,
                'translated': translated_text,
                'source_lang': source_lang,
                'target_lang': target_lang,
                'success': True
            }
            
        except Exception as e:
            logger.error(f"Translation failed: {e}")
            return {
                'original': text,
                'translated': text,
                'source_lang': source_lang,
                'target_lang': target_lang,
                'success': False,
                'error': str(e)
            }


# ---------------------------
# Global Singleton
# ---------------------------
pipeline = TranscribeFlowPipeline()
