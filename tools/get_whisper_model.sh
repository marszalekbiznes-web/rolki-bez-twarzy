#!/usr/bin/env bash
# Model Whisper "small" do transkrypcji. Na własnym komputerze nie jest potrzebny: faster-whisper pobierze go sam z HuggingFace.
# W chmurze Claude HuggingFace bywa zablokowany: wtedy ten skrypt składa ten sam model (CTranslate2 int8) z paczek npm
# i sprawdza sumę kontrolną. Użycie: bash tools/get_whisper_model.sh  →  potem transcribe.py --model models/whisper-small
set -e
cd "$(dirname "$0")/.."
OUT=models/whisper-small; SUM=ca732cb1379efc49417d028465f543d83a39de2c61f3027678de103dc404ce73
[ -f "$OUT/model.bin" ] && echo "Model już jest: $OUT" && exit 0
TMP=$(mktemp -d); mkdir -p "$OUT"
for i in 0 1 2 3; do (cd "$TMP" && npm pack "@skillninja/shortmovie-telop-model-p$i" --silent >/dev/null && mkdir -p p$i && tar -xzf skillninja-shortmovie-telop-model-p$i-*.tgz -C p$i); done
cat "$TMP"/p0/package/model.bin.part0 "$TMP"/p1/package/model.bin.part1 "$TMP"/p2/package/model.bin.part2 "$TMP"/p3/package/model.bin.part3 > "$OUT/model.bin"
cp "$TMP"/p0/package/{config.json,tokenizer.json,vocabulary.json,preprocessor_config.json} "$OUT/"
echo "$SUM  $OUT/model.bin" | sha256sum -c - || { echo "Suma kontrolna się nie zgadza, usuwam model."; rm -rf "$OUT"; exit 1; }
rm -rf "$TMP"; echo "Gotowe: $OUT"
