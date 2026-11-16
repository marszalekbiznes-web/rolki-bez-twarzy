"""Word-level transcription for voiceover-driven animation.

    python3 transcribe.py <audio> <out_words.json> [--model DIR] [--lang pl]

Writes [{"w": "słowo", "s": 0.42, "e": 0.71}, ...] plus a plain-text transcript next to it.
Uses faster-whisper (CTranslate2). Check and fix the words by hand afterwards: names, English phrases, numbers.
"""
import json, sys, argparse, pathlib, subprocess
import numpy as np
from faster_whisper import WhisperModel

ap = argparse.ArgumentParser()
ap.add_argument('audio'); ap.add_argument('out')
ap.add_argument('--model', default='small'); ap.add_argument('--lang', default='pl')
a = ap.parse_args()

try:
    model = WhisperModel(a.model, device='cpu', compute_type='int8')
except Exception as e:
    sys.exit(f'Nie udało się wczytać modelu Whisper ({e}).\nGdy HuggingFace jest zablokowany: bash tools/get_whisper_model.sh, potem --model models/whisper-small')
# decode with ffmpeg to 16 kHz mono float32 (PyAV inside faster-whisper is version-sensitive)
pcm = subprocess.run(['ffmpeg', '-v', 'error', '-i', a.audio, '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'], capture_output=True, check=True).stdout
audio = np.frombuffer(pcm, np.float32)
segs, info = model.transcribe(audio, language=a.lang, word_timestamps=True, vad_filter=True, beam_size=5,
                              condition_on_previous_text=False)
words = []
for s in segs:
    for w in s.words:
        words.append({'w': w.word.strip(), 's': round(w.start, 3), 'e': round(w.end, 3), 'p': round(w.probability, 3)})
pathlib.Path(a.out).write_text(json.dumps(words, ensure_ascii=False, indent=1))
txt = ' '.join(w['w'] for w in words)
pathlib.Path(a.out).with_suffix('.txt').write_text(txt)
print(f'{len(words)} words, {words[-1]["e"] if words else 0:.2f} s\n{txt}')
for w in words:
    if w['p'] < 0.6:
        print(f'  ? {w["w"]!r} at {w["s"]:.2f}s (p={w["p"]})')
