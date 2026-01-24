import os
import logging
from groq import Groq
from deep_translator import GoogleTranslator
import requests

import warnings
warnings.filterwarnings('ignore', category=UserWarning)

from dotenv import load_dotenv
load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TranscribeFlowPipeline:
    def __init__(self):
        """Initialize cloud-based AI services"""
        
        # ---------------------------
        # Initialize Groq Client
        # ---------------------------
        logger.info("🔄 Initializing Groq API client...")
        
        self.groq_api_key = os.getenv("GROQ_API_KEY")
        if not self.groq_api_key:
            raise ValueError("GROQ_API_KEY not found in environment variables")
        
        self.groq_client = Groq(api_key=self.groq_api_key)
        logger.info("✅ Groq API client ready!")

        # ---------------------------
        # Initialize Hugging Face
        # ---------------------------
        logger.info("🔄 Initializing Hugging Face Inference API...")
        
        self.hf_api_key = os.getenv("HUGGINGFACE_API_KEY")
        if not self.hf_api_key:
            raise ValueError("HUGGINGFACE_API_KEY not found in environment variables")
        
        self.hf_headers = {"Authorization": f"Bearer {self.hf_api_key}"}
        self.hf_api_url = "https://api-inference.huggingface.co/models/facebook/bart-large-cnn"
        
        logger.info("✅ Hugging Face API ready!")

        # ---------------------------
        # Initialize Translator
        # ---------------------------
        logger.info("🌐 Initializing translation service...")
        self.translator_cache = {}
        logger.info("✅ Translation service ready!")

    # ---------------------------
    # Transcription
    # ---------------------------
    def transcribe(self, audio_input, language="en"):
        """
        Transcribe audio using Groq Whisper API
        
        Args:
            audio_input: Path to audio file or bytes
            language: ISO-639-1 language code (e.g., 'en', 'hi', 'es')
        
        Returns:
            Transcribed text
        """
        try:
            logger.info(f"🎙️ Transcribing with Groq Whisper (language: {language})...")
            
            # Handle file path
            if isinstance(audio_input, str):
                if not os.path.exists(audio_input):
                    raise ValueError(f"Audio file not found: {audio_input}")
                
                with open(audio_input, "rb") as audio_file:
                    transcription = self.groq_client.audio.transcriptions.create(
                        file=audio_file,
                        model="whisper-large-v3-turbo",
                        language=language,
                        response_format="json",
                        temperature=0.0
                    )
            
            # Handle bytes
            elif isinstance(audio_input, (bytes, bytearray)):
                # Save temporarily for Groq API
                temp_path = f"/tmp/temp_audio_{os.getpid()}.wav"
                with open(temp_path, "wb") as f:
                    f.write(audio_input)
                
                try:
                    with open(temp_path, "rb") as audio_file:
                        transcription = self.groq_client.audio.transcriptions.create(
                            file=audio_file,
                            model="whisper-large-v3-turbo",
                            language=language,
                            response_format="json",
                            temperature=0.0
                        )
                finally:
                    if os.path.exists(temp_path):
                        os.remove(temp_path)
            
            else:
                raise TypeError(f"Unsupported audio_input type: {type(audio_input)}")
            
            transcript_text = transcription.text
            logger.info(f"✅ Transcription complete ({len(transcript_text)} characters)")
            
            return transcript_text
            
        except Exception as e:
            logger.error(f"Transcription failed: {e}")
            raise

    # ---------------------------
    # Summarization
    # ---------------------------
    def summarize(self, transcript: str, max_length: int = 200) -> str:
        """
        Summarize text using Groq LLM API
        
        Args:
            transcript: Text to summarize
            max_length: Maximum length of summary (tokens)
        
        Returns:
            Formatted summary with bullet points
        """
        try:
            logger.info("📝 Generating summary with Groq LLM...")
            
            # Use Groq's LLM for better summarization
            chat_completion = self.groq_client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[
                    {
                        "role": "system",
                        "content": "You are a helpful assistant that creates concise, bullet-point summaries of transcripts. Format your response with key points as bullet points."
                    },
                    {
                        "role": "user",
                        "content": f"Summarize the following transcript in 3-5 key bullet points:\n\n{transcript[:4000]}"  # Limit input length
                    }
                ],
                temperature=0.0,
                max_tokens=max_length,
            )
            
            summary = chat_completion.choices[0].message.content
            
            # Format if not already formatted
            if "•" not in summary and "*" not in summary:
                sentences = [s.strip() for s in summary.split('.') if s.strip()]
                formatted = "**Key Points:**\n" + "\n".join([f"• {s}" for s in sentences[:5]])
            else:
                formatted = f"**Key Points:**\n{summary}"
            
            logger.info("✅ Summary generated")
            return formatted
            
        except Exception as e:
            logger.error(f"Groq summarization failed, trying Hugging Face: {e}")
            
            # Fallback to Hugging Face
            try:
                return self._summarize_with_hf(transcript, max_length)
            except Exception as hf_error:
                logger.error(f"Hugging Face summarization also failed: {hf_error}")
                # Final fallback
                sentences = transcript.split('. ')
                summary = ". ".join(sentences[:4]) + "..."
                return f"**Summary:**\n{summary}"

    def _summarize_with_hf(self, transcript: str, max_length: int = 200) -> str:
        """
        Fallback summarization using Hugging Face Inference API
        """
        logger.info("📝 Generating summary with Hugging Face...")
        
        payload = {
            "inputs": transcript[:1024],  # HF free tier has input limits
            "parameters": {
                "max_length": max_length,
                "min_length": 30,
                "do_sample": False
            }
        }
        
        response = requests.post(
            self.hf_api_url,
            headers=self.hf_headers,
            json=payload,
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            if isinstance(result, list) and len(result) > 0:
                summary = result[0].get('summary_text', '')
                bullet_points = summary.replace('. ', '.\n• ')
                formatted = f"**Key Points:**\n• {bullet_points}"
                logger.info("✅ Summary generated with HF")
                return formatted
        
        raise Exception(f"HF API error: {response.status_code}")

    # ---------------------------
    # Language Detection
    # ---------------------------
    def detect_language(self, text: str) -> dict:
        """
        Detect language from text using simple heuristics
        Enhanced with more language patterns
        """
        try:
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
            elif any(char in text for char in ['क', 'ख', 'ग', 'च', 'है']):
                return {'code': 'hi', 'name': 'Hindi'}
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
        Translate text using Groq LLM for better quality
        Falls back to GoogleTranslator if needed
        """
        try:
            logger.info(f"🌐 Translating from {source_lang} to {target_lang}...")
            
            # Handle same language case
            if source_lang == target_lang and source_lang != 'auto':
                return {
                    'original': text,
                    'translated': text,
                    'source_lang': source_lang,
                    'target_lang': target_lang,
                    'message': 'Source and target languages are the same',
                    'success': True
                }
            
            # Try Groq LLM translation first for better quality
            try:
                language_names = {
                    'en': 'English', 'hi': 'Hindi', 'es': 'Spanish',
                    'fr': 'French', 'de': 'German', 'zh-cn': 'Chinese',
                    'ja': 'Japanese', 'ru': 'Russian', 'ar': 'Arabic'
                }
                
                target_name = language_names.get(target_lang, target_lang)
                
                chat_completion = self.groq_client.chat.completions.create(
                    model="llama-3.1-8b-instant",
                    messages=[
                        {
                            "role": "user",
                            "content": f"Translate the following text to {target_name}. Only provide the translation, no explanations:\n\n{text[:2000]}"
                        }
                    ],
                    temperature=0.0,
                    max_tokens=1000,
                )
                
                translated_text = chat_completion.choices[0].message.content.strip()
                
                logger.info("✅ Translation complete (Groq LLM)")
                
                return {
                    'original': text,
                    'translated': translated_text,
                    'source_lang': source_lang,
                    'target_lang': target_lang,
                    'success': True
                }
                
            except Exception as groq_error:
                logger.warning(f"Groq translation failed, using Google Translate: {groq_error}")
                
                # Fallback to Google Translate
                translator = GoogleTranslator(source=source_lang, target=target_lang)
                
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
                
                logger.info("✅ Translation complete (Google Translate)")
                
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

