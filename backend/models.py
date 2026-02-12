# Imports
import os
import logging
import tempfile
import warnings
import requests

from groq import Groq
from deep_translator import GoogleTranslator
from langdetect import detect
from dotenv import load_dotenv
from pyannote.audio import Pipeline as DiarizationPipeline

# Global setup
warnings.filterwarnings("ignore", category=UserWarning)
load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# Transcription, summarization, and translation pipeline
class TranscribeFlowPipeline:

    # Initialize API clients and cache
    def __init__(self):
        logger.info("🚀 Initializing TranscribeFlowPipeline...")

        self.groq_key = os.getenv("GROQ_API_KEY")
        if not self.groq_key:
            raise ValueError("Missing GROQ_API_KEY")
        self.groq_client = Groq(api_key=self.groq_key)

        self.hf_key = os.getenv("HUGGINGFACE_TOKEN")
        if not self.hf_key:
            raise ValueError("Missing HUGGINGFACE_TOKEN")
        self.hf_headers = {"Authorization": f"Bearer {self.hf_key}"}
        self.hf_api_url = "https://api-inference.huggingface.co/models/facebook/bart-large-cnn"

        self.translation_cache = {}
        logger.info("🎯 Pipeline initialized\n")


    # Audio transcription with timestamps
    def transcribe(self, audio_input, language="en") -> dict:
        logger.info(f"🎙️ Transcribing (lang={language})...")
        try:
            # File path
            if isinstance(audio_input, str):
                if not os.path.exists(audio_input):
                    raise FileNotFoundError(audio_input)
                with open(audio_input, "rb") as f:
                    result = self.groq_client.audio.transcriptions.create(
                        file=f,
                        model="whisper-large-v3-turbo",
                        language=language,
                        response_format="verbose_json",
                        timestamp_granularities=["word", "segment"],
                        temperature=0
                    )
            
            # Bytes
            elif isinstance(audio_input, (bytes, bytearray)):
                with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp:
                    temp.write(audio_input)
                    temp_path = temp.name
                try:
                    with open(temp_path, "rb") as f:
                        result = self.groq_client.audio.transcriptions.create(
                            file=f,
                            model="whisper-large-v3-turbo",
                            language=language,
                            response_format="verbose_json",
                            timestamp_granularities=["word", "segment"],
                            temperature=0
                        )
                finally:
                    os.remove(temp_path)
            else:
                raise TypeError("Unsupported audio format")

            # Extract text and word-level timestamps
            text = result.text.strip()
            words = []
            if hasattr(result, 'words') and result.words:
                for word in result.words:
                    words.append({
                        "word": word.get('word', '') if isinstance(word, dict) else getattr(word, 'word', ''),
                        "start": word.get('start', 0) if isinstance(word, dict) else getattr(word, 'start', 0),
                        "end": word.get('end', 0) if isinstance(word, dict) else getattr(word, 'end', 0),
                    })
            
            # Also extract segment-level timestamps as fallback
            segments = []
            if hasattr(result, 'segments') and result.segments:
                for seg in result.segments:
                    segments.append({
                        "text": seg.get('text', '') if isinstance(seg, dict) else getattr(seg, 'text', ''),
                        "start": seg.get('start', 0) if isinstance(seg, dict) else getattr(seg, 'start', 0),
                        "end": seg.get('end', 0) if isinstance(seg, dict) else getattr(seg, 'end', 0),
                    })
            
            logger.info(f"✅ Transcription complete — {len(words)} words, {len(segments)} segments")
            return {
                "text": text,
                "words": words,
                "segments": segments
            }
        
        except Exception as e:
            logger.error(f"❌ Transcription failed: {e}")
            raise

    # Clean and normalize LLM output to prevent encoding issues
    def _clean_llm_output(self, text: str) -> str:
        """Clean and normalize LLM output to prevent encoding issues."""
        # Replace Unicode bullets/dashes with ASCII equivalents
        replacements = {
            '\u2022': '* ',  # bullet
            '\u25cf': '* ',  # black circle
            '\u25cb': '* ',  # white circle
            '\u25e6': '* ',  # white bullet
            '\u25aa': '* ',  # black small square
            '\u25b8': '* ',  # right triangle
            '\u2013': '- ',  # en-dash
            '\u2014': '- ',  # em-dash
            '\u2026': '...',  # ellipsis
        }
        
        for old, new in replacements.items():
            text = text.replace(old, new)
        
        # Fix garbled UTF-8 sequences that appear in some environments
        garbled = {
            '\u00e2\u20ac\u00a2': '* ',
            '\u00e2\u20ac\u201c': '- ',
            '\u00e2\u20ac\u201d': '- ',
            '\u00e2\u0080\u00a2': '* ',
        }
        
        for old, new in garbled.items():
            text = text.replace(old, new)
        
        # Ensure clean UTF-8 encoding
        text = text.encode('utf-8', errors='ignore').decode('utf-8')
        
        return text

    # Transcript summarization
    def summarize(self, text: str, mode: str = "bullet", max_tokens=1024) -> str:
        """
        Summarize with different modes:
        - bullet: Bullet points (default)
        - meeting: Meeting minutes
        - action: Action items
        - study: Study notes
        - blog: Blog-ready summary
        """
        logger.info(f"📝 Summarizing in '{mode}' mode (text length: {len(text)} chars)...")
        
        # Define prompts for each mode
        prompts = {
            "bullet": "You summarize transcripts into clear, complete bullet points covering ALL key topics. Use markdown bullet format (* item). Every bullet point MUST be a complete sentence. Do NOT cut off mid-sentence.",
            "meeting": "You create professional meeting minutes with sections: Attendees, Discussion Points, Decisions Made, Next Steps.",
            "action": "You extract actionable items and tasks from transcripts in a numbered list.",
            "study": "You create detailed study notes with key concepts, definitions, and important points organized by topic.",
            "blog": "You write an engaging blog post summary with introduction, main points, and conclusion."
        }
        
        system_prompt = prompts.get(mode, prompts["bullet"])
        
        # For very long transcripts, use chunked summarization
        max_input_chars = 16000  # Llama 3.1 8B supports 128K context
        
        if len(text) > max_input_chars:
            return self._summarize_chunked(text, mode, system_prompt, max_tokens, max_input_chars)
        
        return self._summarize_single(text, mode, system_prompt, max_tokens)
    
    def _summarize_single(self, text: str, mode: str, system_prompt: str, max_tokens: int) -> str:
        """Summarize a single chunk of text."""
        try:
            completion = self.groq_client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[
                    {
                        "role": "system",
                        "content": system_prompt
                    },
                    {
                        "role": "user",
                        "content": f"Summarize this transcript completely. Make sure every point is a full, complete sentence:\n\n{text}"
                    }
                ],
                temperature=0,
                max_tokens=max_tokens
            )
            
            summary = completion.choices[0].message.content.strip()
            
            # Clean encoding artifacts from LLM output
            summary = self._clean_llm_output(summary)
            
            # Format based on mode
            if mode == "bullet" and "*" not in summary and "-" not in summary:
                lines = summary.split(".")
                summary = "\n".join([f"* {l.strip()}" for l in lines if l.strip() and len(l.strip()) > 5])
                return "**Key Points:**\n" + summary
            elif mode == "action" and not summary.startswith("1."):
                lines = [l.strip() for l in summary.split("\n") if l.strip()]
                summary = "\n".join([f"{i+1}. {l}" for i, l in enumerate(lines)])
                return "**Action Items:**\n" + summary
            
            return summary
        
        except Exception as e:
            logger.warning(f"Groq failed → using HF: {e}")
            return self._summarize_hf(text, max_tokens)
    
    def _summarize_chunked(self, text: str, mode: str, system_prompt: str, max_tokens: int, max_input_chars: int) -> str:
        """Summarize long text by splitting into chunks, summarizing each, then combining."""
        logger.info(f"📄 Text too long ({len(text)} chars), using chunked summarization...")
        
        # Split text into chunks at sentence boundaries
        chunks = []
        remaining = text
        while remaining:
            if len(remaining) <= max_input_chars:
                chunks.append(remaining)
                break
            # Find last sentence boundary before the limit
            cut_point = remaining[:max_input_chars].rfind('. ')
            if cut_point == -1:
                cut_point = max_input_chars
            else:
                cut_point += 2  # Include the period and space
            chunks.append(remaining[:cut_point])
            remaining = remaining[cut_point:]
        
        logger.info(f"📄 Split into {len(chunks)} chunks for summarization")
        
        # Summarize each chunk
        chunk_summaries = []
        for i, chunk in enumerate(chunks):
            logger.info(f"📝 Summarizing chunk {i+1}/{len(chunks)}...")
            try:
                summary = self._summarize_single(chunk, mode, system_prompt, max_tokens)
                chunk_summaries.append(summary)
            except Exception as e:
                logger.warning(f"Chunk {i+1} failed: {e}")
                continue
        
        if not chunk_summaries:
            return "Summary generation failed."
        
        if len(chunk_summaries) == 1:
            return chunk_summaries[0]
        
        # Combine chunk summaries into a final summary
        combined = "\n\n".join(chunk_summaries)
        logger.info(f"📝 Combining {len(chunk_summaries)} chunk summaries into final summary...")
        
        try:
            completion = self.groq_client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[
                    {
                        "role": "system",
                        "content": system_prompt
                    },
                    {
                        "role": "user",
                        "content": f"Combine these partial summaries into one comprehensive, well-organized summary. Make sure every point is a complete sentence:\n\n{combined}"
                    }
                ],
                temperature=0,
                max_tokens=max_tokens
            )
            
            return self._clean_llm_output(completion.choices[0].message.content.strip())
        
        except Exception as e:
            logger.warning(f"Final combination failed, returning merged chunks: {e}")
            return combined



    # Hugging Face fallback summarization
    def _summarize_hf(self, text, max_tokens):
        payload = {
            "inputs": text[:4096],
            "parameters": {"max_length": max_tokens, "min_length": 30, "do_sample": False}
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

        summary = self._clean_llm_output(data[0]["summary_text"])
        return "**Key Points:**\n* " + summary.replace(". ", ".\n* ")


    # Language detection
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
            return {"code": code, "name": names.get(code, code)}
        except:
            return {"code": "en", "name": "English"}


    # Text translation with caching and fallbacks
    def translate_text(self, text: str, source_lang="auto", target_lang="en") -> dict:
        try:
            cache_key = (text, source_lang, target_lang)
            if cache_key in self.translation_cache:
                return self.translation_cache[cache_key]

            if source_lang == "auto":
                detected = self.detect_language(text)
                source_lang = detected["code"]

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

            if source_lang == "hi" or target_lang == "hi":
                translated = self._google_translate(text, source_lang, target_lang)
                result = self._build_result(text, translated, source_lang, target_lang)
                self.translation_cache[cache_key] = result
                return result

            try:
                translated = self._groq_translate(text, source_lang, target_lang)
            except Exception:
                translated = self._google_translate(text, source_lang, target_lang)

            result = self._build_result(text, translated, source_lang, target_lang)
            self.translation_cache[cache_key] = result
            return result

        except Exception as e:
            return {
                "original": text,
                "translated": text,
                "success": False,
                "error": str(e)
            }


    # Groq-based translation helper
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

        prompt = f"""
Translate the following {names.get(src, src)} text to {names.get(tgt, tgt)}.
Only return the translation.

Text:
{text[:2000]}
"""

        completion = self.groq_client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            max_tokens=1000
        )

        return completion.choices[0].message.content.strip()


    # Google Translate helper with chunking
    def _google_translate(self, text, src, tgt):
        translator = GoogleTranslator(source=src, target=tgt)
        max_len = 4000

        if len(text) <= max_len:
            return translator.translate(text)

        chunks = [text[i:i + max_len] for i in range(0, len(text), max_len)]
        results = [translator.translate(chunk) for chunk in chunks]
        return " ".join(results)


    # Standardized translation result builder
    def _build_result(self, orig, trans, src, tgt):
        return {
            "original": orig,
            "translated": trans,
            "source_lang": src,
            "target_lang": tgt,
            "success": True
        }

    def diarize_speakers(self, audio_path: str, num_speakers: int = None) -> list:
        """
        Detect different speakers in audio
        Returns: List of {speaker, start, end, text} segments
        """
        try:
            logger.info("👥 Detecting speakers...")
            
            # Check for HuggingFace token
            hf_token = os.getenv("HUGGINGFACE_TOKEN") or os.getenv("HUGGINGFACE_API_KEY")
            if not hf_token:
                raise ValueError("Missing HUGGINGFACE_TOKEN or HUGGINGFACE_API_KEY in .env")
            
            # ✅ NEW: Preprocess audio to fix sampling issues
            import torchaudio
            import torch
            
            # Load audio
            waveform, sample_rate = torchaudio.load(audio_path)
            
            # Resample to 16kHz if needed (pyannote expects 16kHz)
            if sample_rate != 16000:
                logger.info(f"🔄 Resampling from {sample_rate}Hz to 16000Hz...")
                resampler = torchaudio.transforms.Resample(sample_rate, 16000)
                waveform = resampler(waveform)
                sample_rate = 16000
            
            # Convert to mono if stereo
            if waveform.shape[0] > 1:
                logger.info("🔄 Converting to mono...")
                waveform = torch.mean(waveform, dim=0, keepdim=True)
            
            # Save preprocessed audio to temp file
            base, ext = os.path.splitext(audio_path)
            temp_audio = f"{base}_preprocessed.wav"
            torchaudio.save(temp_audio, waveform, sample_rate)
            
            logger.info("✅ Audio preprocessed for diarization")
            
            # Load diarization pipeline
            diarization_pipeline = DiarizationPipeline.from_pretrained(
                "pyannote/speaker-diarization-3.1",
                token=hf_token
            )
            
            # Run diarization on preprocessed audio
            if num_speakers:
                logger.info(f"🎯 Running diarization with {num_speakers} speakers...")
                diarization_output = diarization_pipeline(temp_audio, num_speakers=num_speakers)
            else:
                logger.info("🎯 Running diarization (auto-detect speakers)...")
                diarization_output = diarization_pipeline(temp_audio)
            
            # Handle different return types from pyannote versions
            # pyannote 3.1+ returns DiarizeOutput dataclass, older versions return Annotation
            if hasattr(diarization_output, 'speaker_diarization'):
                # New pyannote 3.1+ DiarizeOutput dataclass
                logger.info("📦 Extracting annotation from DiarizeOutput...")
                annotation = diarization_output.speaker_diarization
            elif hasattr(diarization_output, 'itertracks'):
                # Legacy: direct Annotation object
                annotation = diarization_output
            else:
                raise TypeError(f"Unexpected diarization output type: {type(diarization_output)}")
            
            # Extract speaker segments from the Annotation
            segments = []
            for turn, _, speaker in annotation.itertracks(yield_label=True):
                segments.append({
                    "speaker": speaker,
                    "start": round(turn.start, 2),
                    "end": round(turn.end, 2)
                })
            
            # Clean up temp file
            try:
                os.remove(temp_audio)
            except:
                pass
            
            num_speakers_found = len(set([s['speaker'] for s in segments]))
            logger.info(f"✅ Found {num_speakers_found} speakers in {len(segments)} segments")
            
            return segments
        
        except Exception as e:
            logger.error(f"❌ Diarization failed: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return []
        
    def merge_diarization_with_transcript(self, transcript_words, speaker_segments, transcript_segments=None, full_text=""):
        """
        Merge speaker diarization with transcript.
        Supports word-level, segment-level, or raw text fallback.
        
        Args:
            transcript_words: list of {word, start, end} from Whisper (may be empty)
            speaker_segments: list of {speaker, start, end} from diarization
            transcript_segments: list of {text, start, end} from Whisper segments (fallback)
            full_text: raw transcript text (final fallback)
        """
        if not speaker_segments:
            return []
        
        import json
        if isinstance(speaker_segments, str):
            speaker_segments = json.loads(speaker_segments)
        
        # Strategy 1: Word-level timestamps (most precise)
        if transcript_words and len(transcript_words) > 0:
            logger.info(f"📝 Merging using {len(transcript_words)} word-level timestamps")
            return self._merge_with_words(transcript_words, speaker_segments)
        
        # Strategy 2: Segment-level timestamps (good fallback)
        if transcript_segments and len(transcript_segments) > 0:
            logger.info(f"📝 Merging using {len(transcript_segments)} segment-level timestamps")
            return self._merge_with_segments(transcript_segments, speaker_segments)
        
        # Strategy 3: Raw text splitting (last resort)
        if full_text:
            logger.info("📝 Merging using raw text splitting (no timestamps available)")
            return self._merge_with_text(full_text, speaker_segments)
        
        logger.warning("⚠️ No transcript data available for merge")
        return []
    
    def _merge_with_words(self, transcript_words, speaker_segments):
        """Merge using word-level timestamps (most precise)."""
        # Assign speakers to words based on timestamps
        for word in transcript_words:
            word_start = word.get('start', 0)
            word_end = word.get('end', 0)
            word_mid = (word_start + word_end) / 2
            
            # Find which speaker is talking during this word
            for segment in speaker_segments:
                seg_start = segment.get('start', 0)
                seg_end = segment.get('end', 0)
                
                if seg_start <= word_mid <= seg_end:
                    word['speaker'] = segment.get('speaker', 'UNKNOWN')
                    break
        
        return self._group_by_speaker(transcript_words, key='word')
    
    def _merge_with_segments(self, transcript_segments, speaker_segments):
        """Merge using segment-level timestamps."""
        result_words = []
        for seg in transcript_segments:
            seg_start = seg.get('start', 0)
            seg_end = seg.get('end', 0)
            seg_mid = (seg_start + seg_end) / 2
            text = seg.get('text', '').strip()
            
            if not text:
                continue
            
            # Find the speaker for this segment
            assigned_speaker = 'UNKNOWN'
            best_overlap = 0
            
            for sp_seg in speaker_segments:
                sp_start = sp_seg.get('start', 0)
                sp_end = sp_seg.get('end', 0)
                
                # Calculate overlap
                overlap_start = max(seg_start, sp_start)
                overlap_end = min(seg_end, sp_end)
                overlap = max(0, overlap_end - overlap_start)
                
                if overlap > best_overlap:
                    best_overlap = overlap
                    assigned_speaker = sp_seg.get('speaker', 'UNKNOWN')
            
            result_words.append({
                'word': text,
                'speaker': assigned_speaker,
                'start': seg_start,
                'end': seg_end
            })
        
        return self._group_by_speaker(result_words, key='word')
    
    def _merge_with_text(self, full_text, speaker_segments):
        """Fallback: assign text proportionally to speakers by time."""
        if not full_text.strip():
            return []
        
        # Sort speaker segments by start time
        sorted_segs = sorted(speaker_segments, key=lambda s: s.get('start', 0))
        
        # Calculate total duration
        total_duration = max(s.get('end', 0) for s in sorted_segs) if sorted_segs else 1
        
        # Split text into sentences
        sentences = [s.strip() for s in full_text.replace('? ', '?|').replace('. ', '.|').replace('! ', '!|').split('|') if s.strip()]
        
        if not sentences:
            sentences = [full_text]
        
        # Assign sentences to speaker segments proportionally
        result = []
        current_speaker = None
        current_text = []
        
        chars_per_second = len(full_text) / total_duration if total_duration > 0 else 1
        char_position = 0
        
        for sentence in sentences:
            # Estimate the time position of this sentence
            time_pos = char_position / chars_per_second if chars_per_second > 0 else 0
            char_position += len(sentence)
            
            # Find which speaker is at this time position
            speaker = sorted_segs[0].get('speaker', 'UNKNOWN') if sorted_segs else 'UNKNOWN'
            for seg in sorted_segs:
                if seg.get('start', 0) <= time_pos <= seg.get('end', 0):
                    speaker = seg.get('speaker', 'UNKNOWN')
                    break
            
            if speaker != current_speaker:
                if current_text:
                    result.append({
                        'speaker': current_speaker,
                        'text': ' '.join(current_text).strip()
                    })
                current_speaker = speaker
                current_text = [sentence]
            else:
                current_text.append(sentence)
        
        if current_text:
            result.append({
                'speaker': current_speaker,
                'text': ' '.join(current_text).strip()
            })
        
        return result
    
    def _group_by_speaker(self, items, key='word'):
        """Group consecutive items by speaker into speaker turns."""
        formatted_transcript = []
        current_speaker = None
        current_text = []
        
        for item in items:
            speaker = item.get('speaker', 'UNKNOWN')
            text = item.get(key, item.get('text', ''))
            
            if speaker != current_speaker:
                if current_text:
                    formatted_transcript.append({
                        'speaker': current_speaker,
                        'text': ' '.join(current_text).strip()
                    })
                current_speaker = speaker
                current_text = [text]
            else:
                current_text.append(text)
        
        if current_text:
            formatted_transcript.append({
                'speaker': current_speaker,
                'text': ' '.join(current_text).strip()
            })
    
        return formatted_transcript

    def format_transcript_with_speakers(self, speaker_transcript):
        """
        Format transcript with speaker labels for display
        """
        formatted = []
        
        for segment in speaker_transcript:
            speaker = segment.get('speaker', 'UNKNOWN')
            text = segment.get('text', '')
            
            # Format as "Speaker 1: text here"
            formatted.append(f"**{speaker}:** {text}")
        
        return '\n\n'.join(formatted)


# Singleton pipeline instance
pipeline = TranscribeFlowPipeline()