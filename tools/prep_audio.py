"""Trim the voiceover so the first word lands ~0.1 s after frame 0, and shift the word timings to match.

    python3 prep_audio.py <audio> <words.json> <out_dir> [--lead 0.10] [--tail 0.8]

Writes <out_dir>/vo.wav, <out_dir>/words.json (shifted) and <out_dir>/timing.json {offset, total}.
A reel must not open on silence: the hook text and the first word arrive together.
"""
import json, argparse, subprocess, pathlib
import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument('audio'); ap.add_argument('words'); ap.add_argument('out')
ap.add_argument('--lead', type=float, default=0.10); ap.add_argument('--tail', type=float, default=0.8)
a = ap.parse_args()
out = pathlib.Path(a.out); out.mkdir(parents=True, exist_ok=True)

pcm = subprocess.run(['ffmpeg', '-v', 'error', '-i', a.audio, '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'], capture_output=True, check=True).stdout
x = np.frombuffer(pcm, np.float32); hop = 160                      # 10 ms
rms = np.array([np.sqrt(np.mean(x[i:i + hop] ** 2)) for i in range(0, len(x) - hop, hop)])
db = 20 * np.log10(rms + 1e-9); thr = db.max() - 30                 # speech = within 30 dB of the loudest 10 ms
onset = int(np.argmax(db > thr)) * hop / 16000
words = json.loads(pathlib.Path(a.words).read_text())
first = onset                                                    # Whisper often starts the first word early; trust the energy
if words: words[0]['s'] = max(words[0]['s'], onset)
offset = max(0.0, round(first - a.lead, 3))
dur = len(x) / 16000
total = round(min(dur - offset, words[-1]['e'] - offset + a.tail), 3)

subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(offset), '-t', str(total), '-i', a.audio, '-ar', '48000', '-ac', '2',
                '-af', f'afade=t=out:st={max(0, total - 0.25)}:d=0.25', str(out / 'vo.wav')], check=True)
for w in words:
    w['s'] = round(max(0, w['s'] - offset), 3); w['e'] = round(max(0, w['e'] - offset), 3)
(out / 'words.json').write_text(json.dumps(words, ensure_ascii=False, indent=1))
(out / 'timing.json').write_text(json.dumps({'offset': offset, 'total': total}))
print(f'onset {onset:.2f}s -> trimmed {offset:.2f}s, total {total:.2f}s, {len(words)} words')
