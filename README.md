# Rolki bez twarzy: silnik

Zestaw do skilla Claude **rolki-bez-twarzy**: pionowe rolki (1080×1920, 30 kl/s), w których cały obraz to animacja 3D zbudowana kodem (three.js) i zsynchronizowana z nagranym lektorem co do słowa. Ciągła kamera, obiekty-bohaterowie, napisy, render do MP4.

Skill sam klonuje to repozytorium i z niego korzysta. Nie musisz niczego uruchamiać ręcznie.

## Wymagania
Node 18+, Python 3, ffmpeg, Google Chrome lub Chromium. Instalacja: `bash setup.sh`.

## Co jest w środku
| Folder | Zawartość |
|---|---|
| `kit/engine.js` | scena, glow, głębia ostrości, ziarno, krzywe ruchu, kanały, rig kamery, napisy, kontrakt strony |
| `kit/objects.js` | bohaterowie: obiektyw z przysłoną, zegar, klepsydra, szklane karty, modele 3D jako rzeźba, cząsteczki na modelu |
| `tools/transcribe.py` | słowa lektora ze znacznikami czasu (faster-whisper) |
| `tools/prep_audio.py` | tnie ciszę na starcie, przesuwa czasy słów |
| `tools/shoot.mjs` | klatki kontrolne w wybranych sekundach |
| `tools/render.mjs` | render do MP4 z dźwiękiem (`--gpu` na komputerze z kartą graficzną) |
| `tools/check_motion.py` | wykrywa skoki obrazu, robi arkusz kontaktowy |
| `tools/events.mjs` | zdarzenia sceny (ruch, zdarzenie, narastanie) do sound designu |
| `tools/sfx_mix.py` | miks efektów z twojej biblioteki pod głos, normalizacja do −14 LUFS |
| `templates/reel.html` | pełna rolka testowa jako wzór |
| `presets/*.json` | kolory i fonty (zestawy tokenów) |

## Szybki start
```bash
python3 tools/transcribe.py lektor.mp3 work/words.json
python3 tools/prep_audio.py lektor.mp3 work/words.json work/ready
node tools/shoot.mjs "work/reel.html" work/stills 0 2 4
node tools/render.mjs "work/reel.html" "work/rolka.mp4" --audio work/ready/vo.wav --gpu
node tools/events.mjs "work/reel.html" work/events.json
python3 tools/sfx_mix.py work/cues.json --lib "<twoje SFX>" --voice work/ready/vo.wav --out work/mix.wav
```

## Licencje
Kod: MIT (plik LICENSE). Szczegóły i autorzy: CREDITS.md. Fonty: SIL Open Font License (Inter Tight, Playfair Display). Modele 3D i grafiki dostarczasz sam; przy licencji CC-BY podpisz autora w opisie publikacji.
