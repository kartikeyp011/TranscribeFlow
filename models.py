import os
import logging
import tempfile
import warnings
import requests

from groq import Groq
from deep_translator import GoogleTranslator
from langdetect import detect
from dotenv import load_dotenv


# ---------------------------
# Setup
# ---------------------------

warnings.filterwarnings("ignore", category=UserWarning)
load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ---------------------------
# Main Pipeline
# ---------------------------

class TranscribeFlowPipeline:

    def __init__(self):

        logger.info("🚀 Initializing TranscribeFlowPipeline...")

        # ---------------------------
        # Groq
        # ---------------------------
        self.groq_key = os.getenv("GROQ_API_KEY")
        if not self.groq_key:
            raise ValueError("Missing GROQ_API_KEY")

        self.groq_client = Groq(api_key=self.groq_key)
        logger.info("✅ Groq client ready")


        # ---------------------------
        # HuggingFace
        # ---------------------------
        self.hf_key = os.getenv("HUGGINGFACE_API_KEY")
        if not self.hf_key:
            raise ValueError("Missing HUGGINGFACE_API_KEY")

        self.hf_headers = {
            "Authorization": f"Bearer {self.hf_key}"
        }

        self.hf_api_url = (
            "https://api-inference.huggingface.co/models/facebook/bart-large-cnn"
        )

        logger.info("✅ HuggingFace ready")


        # ---------------------------
        # Cache
        # ---------------------------
        self.translation_cache = {}

        logger.info("🎯 Pipeline initialized\n")


    # =====================================================
    # Transcription
    # =====================================================

    def transcribe(self, audio_input, language="en") -> str:

        logger.info(f"🎙️ Transcribing (lang={language})...")

        try:

            # File path
            if isinstance(audio_input, str):

                if not os.path.exists(audio_input):
                    raise FileNotFoundError(audio_input)

                with open(audio_input, "rb") as f:
                    audio_file = f

                    result = self.groq_client.audio.transcriptions.create(
                        file=audio_file,
                        model="whisper-large-v3-turbo",
                        language=language,
                        response_format="json",
                        temperature=0
                    )


            # Bytes
            elif isinstance(audio_input, (bytes, bytearray)):

                with tempfile.NamedTemporaryFile(
                    suffix=".wav", delete=False
                ) as temp:

                    temp.write(audio_input)
                    temp_path = temp.name

                try:
                    with open(temp_path, "rb") as f:

                        result = self.groq_client.audio.transcriptions.create(
                            file=f,
                            model="whisper-large-v3-turbo",
                            language=language,
                            response_format="json",
                            temperature=0
                        )

                finally:
                    os.remove(temp_path)


            else:
                raise TypeError("Unsupported audio format")


            text = result.text.strip()

            logger.info("✅ Transcription complete")

            return text


        except Exception as e:
            logger.error(f"❌ Transcription failed: {e}")
            raise


    # =====================================================
    # Summarization
    # =====================================================

    def summarize(self, text: str, max_tokens=200) -> str:

        logger.info("📝 Summarizing...")

        try:

            completion = self.groq_client.chat.completions.create(

                model="llama-3.1-8b-instant",

                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You summarize transcripts into clear bullet points."
                        )
                    },
                    {
                        "role": "user",
                        "content": (
                            f"Summarize in 3-5 bullet points:\n\n{text[:4000]}"
                        )
                    }
                ],

                temperature=0,
                max_tokens=max_tokens
            )


            summary = completion.choices[0].message.content.strip()


            if "•" not in summary:
                lines = summary.split(".")
                summary = "\n".join(
                    [f"• {l.strip()}" for l in lines if l.strip()]
                )


            return "**Key Points:**\n" + summary


        except Exception as e:

            logger.warning("Groq failed → using HF")

            return self._summarize_hf(text, max_tokens)



    def _summarize_hf(self, text, max_tokens):

        payload = {
            "inputs": text[:1024],
            "parameters": {
                "max_length": max_tokens,
                "min_length": 30,
                "do_sample": False
            }
        }

        r = requests.post(
            self.hf_api_url,
            headers=self.hf_headers,
            json=payload,
            timeout=30
        )

        if r.status_code != 200:
            raise RuntimeError("HF summarization failed")

        data = r.json()

        if not data:
            raise RuntimeError("Empty HF response")

        summary = data[0]["summary_text"]

        return "**Key Points:**\n• " + summary.replace(". ", ".\n• ")



    # =====================================================
    # Language Detection
    # =====================================================

    def detect_language(self, text: str) -> dict:

        try:
            code = detect(text)

            names = {
                "en": "English",
                "hi": "Hindi",
                "fr": "French",
                "de": "German",
                "es": "Spanish",
                "ru": "Russian",
                "ja": "Japanese",
                "ar": "Arabic",
                "zh-cn": "Chinese"
            }

            return {
                "code": code,
                "name": names.get(code, code)
            }

        except:
            return {"code": "en", "name": "English"}



    # =====================================================
    # Translation
    # =====================================================

    def translate_text(
        self,
        text: str,
        source_lang="auto",
        target_lang="en"
    ) -> dict:


        try:

            logger.info("🌐 Translating...")


            # ---------------------------
            # Cache
            # ---------------------------
            cache_key = (text, source_lang, target_lang)

            if cache_key in self.translation_cache:
                return self.translation_cache[cache_key]


            # ---------------------------
            # Detect language
            # ---------------------------
            if source_lang == "auto":

                detected = self.detect_language(text)

                source_lang = detected["code"]

                logger.info(
                    f"Detected language: {detected['name']}"
                )


            # ---------------------------
            # Same language
            # ---------------------------
            if source_lang == target_lang:

                result = {
                    "original": text,
                    "translated": text,
                    "source_lang": source_lang,
                    "target_lang": target_lang,
                    "success": True
                }

                self.translation_cache[cache_key] = result
                return result


            # ---------------------------
            # Prefer Google for Hindi
            # ---------------------------
            if source_lang == "hi" or target_lang == "hi":

                logger.info("Using Google Translate (Indic)")

                translated = self._google_translate(
                    text, source_lang, target_lang
                )

                result = self._build_result(
                    text, translated, source_lang, target_lang
                )

                self.translation_cache[cache_key] = result
                return result


            # ---------------------------
            # Try Groq
            # ---------------------------
            try:

                translated = self._groq_translate(
                    text, source_lang, target_lang
                )

                result = self._build_result(
                    text, translated, source_lang, target_lang
                )

                self.translation_cache[cache_key] = result
                return result


            except Exception as e:

                logger.warning(f"Groq failed → Google: {e}")

                translated = self._google_translate(
                    text, source_lang, target_lang
                )

                result = self._build_result(
                    text, translated, source_lang, target_lang
                )

                self.translation_cache[cache_key] = result
                return result


        except Exception as e:

            logger.error(f"❌ Translation failed: {e}")

            return {
                "original": text,
                "translated": text,
                "success": False,
                "error": str(e)
            }



    # =====================================================
    # Helpers
    # =====================================================

    def _groq_translate(self, text, src, tgt):

        names = {
            "en": "English",
            "hi": "Hindi",
            "fr": "French",
            "de": "German",
            "es": "Spanish",
            "ru": "Russian",
            "ja": "Japanese",
            "ar": "Arabic",
            "zh-cn": "Chinese"
        }

        src_name = names.get(src, src)
        tgt_name = names.get(tgt, tgt)


        prompt = f"""
Translate the following {src_name} text to {tgt_name}.
Only return the translation.

Text:
{text[:2000]}
"""


        completion = self.groq_client.chat.completions.create(

            model="llama-3.1-8b-instant",

            messages=[
                {"role": "user", "content": prompt}
            ],

            temperature=0,
            max_tokens=1000
        )


        return completion.choices[0].message.content.strip()



    def _google_translate(self, text, src, tgt):

        translator = GoogleTranslator(
            source=src,
            target=tgt
        )

        max_len = 4000


        if len(text) <= max_len:
            return translator.translate(text)


        chunks = [
            text[i:i + max_len]
            for i in range(0, len(text), max_len)
        ]


        results = []

        for i, chunk in enumerate(chunks, 1):

            logger.info(f"Chunk {i}/{len(chunks)}")

            results.append(
                translator.translate(chunk)
            )


        return " ".join(results)



    def _build_result(self, orig, trans, src, tgt):

        return {
            "original": orig,
            "translated": trans,
            "source_lang": src,
            "target_lang": tgt,
            "success": True
        }



# =====================================================
# Singleton
# =====================================================

pipeline = TranscribeFlowPipeline()
