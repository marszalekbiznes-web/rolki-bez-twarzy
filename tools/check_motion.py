"""Find jumps in a render: frames that change much more than their neighbours (a pop, a skipped frame, a hard cut).

    python3 check_motion.py <video.mp4> [--sheet sheet.jpg] [--every 10]

Prints the frame-to-frame change curve as a sparkline and lists suspicious frames (change > 3.5x the local median).
In a continuous-camera reel there should be none, except where a hard change is intended (none, by default).
"""
import sys, subprocess, argparse
import numpy as np

ap = argparse.ArgumentParser(); ap.add_argument('video'); ap.add_argument('--sheet'); ap.add_argument('--every', type=int, default=10)
a = ap.parse_args()
w, h = 108, 192
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', a.video, '-vf', f'scale={w}:{h},format=gray', '-f', 'rawvideo', '-'], capture_output=True, check=True).stdout
fr = np.frombuffer(raw, np.uint8).reshape(-1, h, w).astype(np.float32)
d = np.abs(np.diff(fr, axis=0)).mean(axis=(1, 2))
bars = '▁▂▃▄▅▆▇█'; mx = max(d.max(), 1e-6)
print('change per frame:', ''.join(bars[min(7, int(v / mx * 7.99))] for v in d))
sus = []
for i, v in enumerate(d):
    lo, hi = max(0, i - 6), min(len(d), i + 7)
    med = np.median(np.r_[d[lo:i], d[i + 1:hi]]) if hi - lo > 1 else v
    if v > 3.5 * max(med, 0.4) and v > 2.0: sus.append((i + 1, v, med))
print(f'{len(fr)} frames, mean change {d.mean():.2f}, max {d.max():.2f} at frame {int(d.argmax()) + 1}')
for f, v, m in sus: print(f'  jump at frame {f} ({f / 30:.2f}s): {v:.1f} vs local {m:.1f}')
if not sus: print('  no jumps')
if a.sheet:
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', a.video, '-vf', f"select='not(mod(n\\,{a.every}))',scale=216:384,tile=8x{int(np.ceil(len(fr) / a.every / 8))}", '-frames:v', '1', a.sheet], check=True)
    print('sheet ->', a.sheet)
