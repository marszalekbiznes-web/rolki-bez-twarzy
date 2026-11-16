"""Sound design mix from a cue list and the user's own sound library.

    python3 tools/sfx_mix.py cues.json --lib "<folder z SFX>" --voice work/ready/vo.wav --out work/mix.wav [--lufs -14] [--list]

--list prints the library grouped by folder (use it to pick files; never invent file names).
cues.json: [{"t": 3.07, "file": "Deep Voice Whoosh", "family": "whoosh", "db": -12, "align": "peak", "event": "cam.dive"}, ...]
  t       time in seconds on the trimmed voiceover (take it from window.EVENTS, not by hand)
  file    a unique part of the file name (or a path relative to --lib)
  family  whoosh | texture | riser | hit   (one family per track; families only steer defaults and the report)
  db      clip gain in dB, as in an editor (defaults: whoosh -12, texture -7, riser -5, hit -8)
  align   peak (loudest 10 ms lands on t; whooshes, hits, textures) | start | end (risers end on t)
  dur     optional max length in seconds (tail fades out over 0.15 s)
The voice is never changed. The final mix is normalised to --lufs with a -1 dBTP ceiling.
"""
import json, argparse, subprocess, pathlib, sys
import numpy as np

SR = 48000
DEFAULT_DB = {'whoosh': -12, 'texture': -7, 'riser': -5, 'hit': -8}
EXT = {'.wav', '.mp3', '.aif', '.aiff', '.flac', '.ogg', '.m4a'}

def load(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-ac', '2', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).copy()

def peak_index(x):
    hop = SR // 100; e = np.array([np.abs(x[i:i + hop]).mean() for i in range(0, max(1, len(x) - hop), hop)])
    return int(np.argmax(e)) * hop + hop // 2

ap = argparse.ArgumentParser(); ap.add_argument('cues', nargs='?'); ap.add_argument('--lib', required=True); ap.add_argument('--voice')
ap.add_argument('--out'); ap.add_argument('--lufs', type=float, default=-14.0); ap.add_argument('--list', action='store_true')
a = ap.parse_args()
lib = pathlib.Path(a.lib); files = sorted(p for p in lib.rglob('*') if p.suffix.lower() in EXT)
if a.list:
    cur = None
    for p in files:
        d = str(p.parent.relative_to(lib)) or '.'
        if d != cur: print(f'\n[{d}]'); cur = d
        print('  ', p.name)
    sys.exit(0)

cues = json.loads(pathlib.Path(a.cues).read_text())
voice = load(a.voice); total = len(voice)
bus = np.zeros_like(voice); cache = {}
print(f'{"t":>7}  {"family":8} {"dB":>5}  align  file')
for c in cues:
    q = c['file'].lower(); hits = [p for p in files if q in str(p.relative_to(lib)).lower()]
    if not hits: sys.exit(f'Brak pliku pasującego do "{c["file"]}" w bibliotece. Użyj --list.')
    if len(hits) > 1 and not any(str(h.relative_to(lib)).lower() == q for h in hits):
        hits.sort(key=lambda p: len(p.name))   # several matches: take the shortest name, and say so
        print(f'   uwaga: "{c["file"]}" pasuje do {len(hits)} plików, biorę {hits[0].name}')
    p = hits[0]
    if p not in cache: cache[p] = load(p)
    x = cache[p].copy(); fam = c.get('family', 'texture'); db = c.get('db', DEFAULT_DB.get(fam, -10))
    if c.get('dur'): n = int(c['dur'] * SR); x = x[:n]; f = min(len(x), int(0.15 * SR)); x[-f:] *= np.linspace(1, 0, f)[:, None]
    x *= 10 ** (db / 20); align = c.get('align', 'end' if fam == 'riser' else 'peak')
    off = {'peak': peak_index(x), 'start': 0, 'end': len(x)}[align]
    s = int(round(c['t'] * SR)) - off; a0, b0 = max(0, s), min(total, s + len(x))
    if b0 > a0: bus[a0:b0] += x[a0 - s:b0 - s]
    print(f'{c["t"]:7.2f}  {fam:8} {db:5.1f}  {align:5}  {p.name}')

mix = voice + bus
tmp = pathlib.Path(a.out).with_suffix('.raw.wav')
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-', str(tmp)], input=mix.astype(np.float32).tobytes(), check=True)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(tmp), '-af', f'loudnorm=I={a.lufs}:TP=-1.0:LRA=11', '-ar', str(SR), str(a.out)], check=True)
tmp.unlink()
r = subprocess.run(['ffmpeg', '-i', str(a.out), '-af', 'loudnorm=print_format=summary', '-f', 'null', '-'], capture_output=True, text=True).stderr
il = [l for l in r.splitlines() if 'Input Integrated' in l or 'Input True Peak' in l]
print('\n' + '\n'.join(l.strip() for l in il)); print(f'ZAPISANO {a.out}')
