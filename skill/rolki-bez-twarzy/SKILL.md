---
name: rolki-bez-twarzy
description: "Rolki bez twarzy: animacja 3D przez całą rolkę na bazie lektora (ciągła kamera, modele 3D, napisy, SFX, MP4). Używaj do rolek i shortów z samego głosu oraz animacji do voiceovera."
---

# Rolki bez twarzy: animacja 3D z lektora

Robisz pionowe rolki (1080×1920, 30 kl/s), w których nie ma ani jednego ujęcia z kamery. Cały obraz to animacja 3D zbudowana kodem (three.js w przeglądarce) i zsynchronizowana z nagranym lektorem co do słowa. Odpowiadasz w języku użytkownika (domyślnie po polsku).

Rolki z gadającą głową robią inne skille. Ten jest tylko do rolek, w których obraz w 100% niesie animacja.

Dwa cele, w tej kolejności:
1. **Zrozumienie.** Każdy obraz pokazuje to, co właśnie słychać, jedną metaforą naraz.
2. **Watch time.** Mocny pierwszy kadr, ciągły ruch, zero martwych momentów, bez chaosu.

## 0. Zestaw (silnik i narzędzia)

Kod mieszka w repozytorium: https://github.com/marszalekbiznes-web/rolki-bez-twarzy. Na starcie każdej sesji:
```bash
git clone https://github.com/marszalekbiznes-web/rolki-bez-twarzy rolki && cd rolki && bash setup.sh
```
Pracuj w `rolki/work/<nazwa-rolki>/` (strona `reel.html`, `ready/` z audio, `assets/` z modelami i ikonami). Narzędzia uruchamiaj z katalogu `rolki/`.
- `kit/engine.js`: scena, post-produkcja (głębia ostrości, glow, ziarno, winieta), krzywe, kanały ruchu, rig kamery, napisy, kontrakt strony.
- `kit/objects.js`: gotowi bohaterowie (obiektyw z przysłoną, zegar, klepsydra, szklane karty, modele 3D jako rzeźba, cząsteczki na powierzchni modelu).
- `tools/`: `transcribe.py`, `prep_audio.py`, `shoot.mjs` (klatki kontrolne), `render.mjs` (MP4), `check_motion.py` (skoki + arkusz kontaktowy), `events.mjs` (zdarzenia do dźwięku), `sfx_mix.py` (miks z biblioteki).
- `templates/reel.html`: pełna rolka testowa jako wzór (obiektyw → taśma → zegar → dłoń i oś czasu → kula → mózg → ekran). Przeczytaj ją, zanim zbudujesz nową scenę.
- `presets/*.json`: zestawy tokenów (kolory, fonty).

Gdy nie da się sklonować repozytorium, poproś użytkownika o zip zestawu i rozpakuj go do osobnego folderu.

## 1. Pierwsze uruchomienie u nowego użytkownika (raz)

Styl ma należeć do użytkownika, nie do twórcy skilla. Zanim zrobisz pierwszą rolkę, zapytaj w jednej wiadomości:
1. **Biblioteka inspiracji:** 3–15 grafik lub rolek, które uważa za topowe, w pełnej rozdzielczości, i jedno zdanie do każdej, co dokładnie mu się podoba.
2. **Biblioteka asetów:** folder z modelami 3D (GLB), ikonami (SVG/PNG) i elementami marki. To z niej najczęściej powstają najlepsze sceny.
3. **Kolory:** jeden kolor akcentu i odcień tła albo gotowy preset.
4. **Fonty:** mały bezszeryfowy (domyślnie Inter Tight) i duży szeryfowy italic na słowa-klucze (domyślnie Playfair Display Italic). Oba darmowe.
5. **Biblioteka efektów dźwiękowych** (folder). Zapytaj, czy jest w niej własny poradnik sound designu.
6. **Własny skill stylu:** jeśli ma inny skill ze swoim stylem (np. do rolek z twarzą), połącz się z nim: weź z niego kolory, fonty i SFX. Treść animacji zostaje z tego skilla.

Zapisz to jako `presets/<nazwa>.json` (tokeny: `bg`, `accent`, `accentHi`, `glow`, `text`, `fontSmall`, `fontBig`), `profil.md` (co lubi, czego nie znosi) i `asety.md` (spis modeli, ikon i licencji). Każda kolejna rolka zaczyna się od przeczytania tych plików.

**Styl uniwersalny nie może wyglądać jak cudzy profil.** Gdy użytkownik nie wybrał kolorów, użyj presetu `granat` i zaproponuj zmianę.

## 2. Proces każdej rolki

Każdy etap kończy się akceptacją. Poprawka na storyboardzie kosztuje minutę, a w renderze godzinę.

1. **Audio.** `python3 tools/transcribe.py lektor.mp3 work/x/words.json`. Popraw słowa ręcznie: nazwy, angielskie frazy, liczby. Potem `python3 tools/prep_audio.py lektor.mp3 work/x/words.json work/x/ready`: tnie ciszę na starcie, żeby pierwsze słowo padło ~0,1 s po klatce 0.
2. **Sens.** Jedno zdanie: o czym jest rolka i co widz ma z niej wynieść.
3. **Beaty.** Jedna myśl = jeden beat (zwykle 2–5 s). Każdy beat zaczyna się na pierwszym słowie myśli.
4. **Bohater każdego beatu** i lista asetów do poproszenia (sekcja 5).
5. **Storyboard do akceptacji.** Tabela: `# | czas | lektor | co widać | przejście do następnego`, pod nią lista asetów i pytanie, czy rolka ma mieć sound design. Nie buduj przed akceptacją.
6. **Prototyp hooka.** Zbuduj i wyrenderuj pierwsze 6–8 s w ruchu i pokaż. O tempie decyduje się na początku, a stopklatki go nie oddają.
7. **Pełna budowa.** Klatki kontrolne co beat (`shoot.mjs`), arkusz kontaktowy, poprawki, render całości, `check_motion.py`.
8. **Sound design** po akceptacji obrazu, jeśli rolka go potrzebuje (sekcja 7).
9. **Kontrola** (sekcja 9) i dostawa: MP4 z głosem (i SFX), osobno master bez dźwięku. Poprawki renderuj fragmentami (`--from/--to`) i sklejaj w miejscu, gdzie obie wersje są identyczne.

## 3. Styl

Zasady przyszły z poprawek montażysty. Stosuj je do każdego elementu, nie tylko do tego, którego dotyczyła uwaga.

- **Ciemno + jeden akcent.** Tło prawie czarne lub granatowe, jeden kolor akcentu z tokenów, biel do tekstu. Kolor nigdy nie jest wpisany na sztywno w scenę.
- **Subtelny glow tylko tam, gdzie patrzy oko**: krawędź obiektu, światło, słowo-klucz. Nie na wszystkim.
- **Mało informacji.** Jeden bohater na ekranie. Bez etykiet, timecode'ów i podpisów, których widz nie zdąży przeczytać.
- **Bohaterowie niegeneryczni.** Dłoń, mózg, zegar, tłum, klucz, kula światła, obiektyw: rzeczy, które rozpoznaje się w pół sekundy. Schemat z ikonkami to ostatnia opcja.
- **Materiały premium:** ciemny metal z jasną krawędzią, szkło z odbiciami pasów studyjnych (bez gorących plam), modele jako ciemna rzeźba (kolory modelu wyłączone, zostaje normal map) podświetlona akcentem od tyłu, cząsteczki i linie światła.
- **Zakazy:** przyciski-pigułki i generyczne „UI z AI”, grube zaokrąglone plastikowe klocki (wyglądają jak Paint 3D), cross dissolve, light leak, neon na wszystkim, emoji, tęczowe gradienty.

## 4. Ruch i kamera

- **Jedna ciągła kamera** przez całą rolkę (`rig()`: cel, odległość, azymut, elewacja, przechył, `frameY`). Nie ma cięć.
- **Przejście = ruch kamery:** przelot przez obiekt (obiektyw, kula), przelot obok lub nad obiektem, okrążenie, podążanie za światłem, obiekt, który rozpada się w cząsteczki i składa w następny. Kamera nie cofa się po tej samej osi (najazd i odjazd na ten sam obiekt to błąd), a zakręt to maksymalnie 90°. Sprawdzaj to, wypisując pozycje kamery co sekundę.
- **Krzywa domyślna:** `EASE.main` = bezier(0.33, 0, 0.06, 1). Krótki rozbieg, najszybciej na początku, długie wyhamowanie. Pierwsze wersje są prawie zawsze za szybkie.
- **Każdy beat to nowy ruch** startujący na pierwszym słowie beatu. Ruchy mogą na siebie nachodzić (`channel()` sumuje przesunięcia), więc kamera nigdy nie staje.
- **Obiekty mają fizykę:** stały dryf (`drift()`), obrót wokół własnej osi, a przy zdarzeniu impuls i wyhamowanie.
- **Synchronizacja:** zdarzenie ląduje na słowie (±2 kl.), wejście dużej sceny 4–8 kl. przed słowem. Wszystkie czasy beatów w jednym bloku `B` na górze sceny.
- **Nic nie wskakuje.** Każdy nowy element wchodzi przez krycie i skalę w min. 6–8 klatkach. Pojedyncze skoki jasności wyłapie `check_motion.py`.
- **Przelot przez obiekt bez czarnej dziury.** Cel po drugiej stronie musi być już widoczny, zanim kamera wyjdzie z obiektu, a w środku świecącego obiektu kamera leci przez jego światło.
- **Mijane elementy gasną,** gdy schodzą do dolnej części kadru, zamiast przelatywać wielkie przez pierwszy plan.
- **Kadr:** bohater w górnej części kadru (`frameY` 650–760 px, przesunięcie obiektywu, nie pochylenie), bo pas napisów jest pod środkiem. Obiekt nie szerszy niż ~80% kadru.

## 5. Bohaterowie i asety (najważniejsze dla jakości)

Najlepsze sceny powstają z prawdziwych elementów od użytkownika. **Proś o nie przy każdej rolce**, konkretnie i z miejscem użycia, już w storyboardzie:
- **Modele 3D (GLB) to pierwszy wybór** dla każdego bohatera: dłonie, mózg, ludzie i tłum, zegar, klepsydra, klucz, telefon, przedmioty z treści. Nawet gdy umiesz zbudować obiekt kodem (zegar, klepsydra), zaproponuj model, bo zwykle wygląda lepiej. Podpowiedz źródła z darmowymi modelami: Sketchfab (filtr Downloadable, licencje CC0/CC-BY), Poly Pizza, Poly Haven.
- **Ikony: proś, nie rysuj.** Ikony rysowane kodem wychodzą przeciętnie. Poproś o SVG/PNG (np. z biblioteki ikon użytkownika). Sam rysuj tylko proste znaki geometryczne, gdy nic nie dostałeś.
- **Zrzuty, logo, zdjęcia produktu, inspiracje** w pełnej rozdzielczości.
- Przykład prośby: „Scena 3 (0:06–0:11, „kilka lat temu”): model zegara GLB. Scena 4 („ręcznie”): model dłoni GLB. Scena 6: ikona pędzla i ikona planu (SVG). Bez nich zbuduję zegar kodem i użyję prostych znaków.”
- Obiekty z kodu (`kit/objects.js`) to plan B albo dodatek. Wzbogacaj je elementami użytkownika (jego ikony na kartach, jego logo na ekranie).
- Z chmury Claude zwykle nie da się pobrać modeli ze stron, więc użytkownik musi je załączyć. Licencje: CC-BY wymaga podpisu autora w opisie publikacji. Zapisz autora i link z metadanych GLB (`asset.extras`) w `asety.md` i przypomnij o tym przy dostawie. Cudze grafiki (inspiracje) tylko do testów, nie do publikacji.

Przykłady z rolki testowej (`templates/reel.html`):
| Myśl | Bohater | Ruch |
|---|---|---|
| „zero ujęć z kamery” | obiektyw z przysłoną | przysłona zamyka się na „zero”, potem kamera wlatuje przez otwór |
| „animacja przez całą rolkę” | taśma klatek rolki | światło biegnie przez klatki i każdą budzi, potem wpada w zegar |
| „kilka lat temu” | zegar 3D | wskazówki cofają się z rozmyciem ruchu |
| „montować ręcznie” | dłoń (model) nad osią czasu | odkłada klipy jeden po drugim |
| „masę czasu” | klepsydra + nieskończona oś | piasek się przesypuje, kamera odsłania długość osi |
| „inspiracja” | kula światła nad otwartą dłonią | klipy rozsypują się w cząsteczki i zbierają w kulę, inspiracje krążą wokół |
| „kreatywność, planowanie” | mózg (model) z cząsteczek | impulsy przechodzą przez mózg, linie rysują plan scen |
| „wszystko gotowe” | jeden ekran rolki | wszystko zbiega się w ekran, który się zapala (pętla do hooka) |

## 6. Napisy

Minimalizm w stylu podcastowych rolek premium:
- Chunk = 1–3 krótkie linie: **mała linia** bezszeryfowa (biała, ~46 px) niesie zdanie, **duża linia** szeryfowa italic (~124 px, gradient akcentu i glow) niesie słowo-klucz. W chunku jedna duża linia.
- Pas napisów tuż pod środkiem (środek bloku y ≈ 1235). Animacja zostawia tam miejsce (sekcja 4, kadr).
- Słowa pojawiają się na swoich znacznikach czasu (wyostrzenie z rozmycia, uniesienie o 18 px, duże rosną z 94%). Chunk znika razem, tuż przed następnym.
- Bez interpunkcji na końcach, bez emoji, maks. ~900 px szerokości (za długie linie same się zmniejszają).
- Czytelność: delikatny ciemny cień pod literami.

## 7. Sound design

Zapytaj w storyboardzie, czy rolka go potrzebuje (rolki testowe często nie). Biblioteka jest zawsze użytkownika. **Jeśli w jej folderze jest własny poradnik sound designu, przeczytaj go najpierw i trzymaj się go zamiast zasad poniżej.** Domyślnie:
- **Trzy rodziny, trzy zadania.** Whoosh = ruch (każdy ruch kamery i każdy element, który się przesuwa). Tekstura = zdarzenie bez przesuwania (wskoczenie, kliknięcie, zapalenie, zmiana stanu). Riser + hit = narastanie przed nowym segmentem i jego rozładowanie.
- **Najpierw dźwięk, który obiekt naprawdę by wydał**: przysłona i zegar = mechanizm, odłożony klip = klik, zapalenie ekranu = jasny ton.
- **Whoosh ma szczyt na najszybszej klatce ruchu** (przy `EASE.main` to ok. 25–30% długości ruchu: `at + dur * peakOf()`), tekstura ląduje na klatce zdarzenia, riser kończy się na klatce przejścia, a hit leży pod nim.
- **Poziomy (gain klipu):** whoosh −12 dB (maks. −10), tekstura −6…−7 dB, riser −5 dB, hit pod riserem. Głos zawsze najgłośniejszy i nietknięty.
- **Jeden najmocniejszy moment na scenę.** Pierwszy riser kilka sekund po hooku, kolejne przy zmianach myśli.
- **Bez muzyki pod animacją**, chyba że użytkownik jej chce.
- **Kolejność:** najpierw wszystkie whooshe od początku do końca, potem wszystkie tekstury, na końcu risery i hity. Po każdym przejściu krótki raport.
- **Wariant z folderu:** gdy jest kilka podobnych plików, wybierz po nazwie, długości i charakterze, powiedz który i dlaczego. Nie słyszysz dźwięku, więc przy wątpliwościach daj użytkownikowi 2 warianty do odsłuchu.
- **Technicznie:** `node tools/events.mjs work/x/reel.html work/x/events.json` (zdarzenia z tych samych stałych co obraz), `python3 tools/sfx_mix.py --lib <folder> --list` (spis biblioteki), cue w `cues.json`, potem `python3 tools/sfx_mix.py cues.json --lib <folder> --voice work/x/ready/vo.wav --out work/x/mix.wav`. Wynik: ok. −14 LUFS, szczyt ≤ −1 dBTP.

## 8. Technika i pułapki

- **Kontrakt strony:** `canvas#c`, `window.ready`, `async window.renderAt(t)`, `window.TOTAL`, `window.EVENTS`. Każda klatka jest czystą funkcją `t`.
- **Tekst w osobnej scenie (overlay)**, rysowany po głębi ostrości i glow, żeby był zawsze ostry.
- **Szkło nieoświetlone** (MeshBasicMaterial + envMap): oświetlone szkło łapie od światła kierunkowego jasne plamy, które glow zamienia w kwadraty.
- **`userData.noDepth = true`** dla glow, linii, szkła i cząsteczek: inaczej psują mapę głębi i rozmycie.
- **Studio:** odbicia z długich pasów światła (`studioEnv`), nie z RoomEnvironment (pudełka dają kwadratowe refleksy).
- **Geometria zmieniana co klatkę** (cząsteczki, piasek): `frustumCulled = false`. Inaczej three.js liczy granice obiektu raz i w renderze ciągłym obiekt potrafi zniknąć, choć na pojedynczych klatkach kontrolnych go widać.
- **Modele:** `loadModel()` normalizuje rozmiar, wyłącza kolory modelu, zostawia normal map. Cząsteczki na powierzchni modelu: `surfacePoints()`. Zawsze obejrzyj model z 5 stron (poza, orientacja), zanim go ustawisz.
- **Przeglądarka:** narzędzia same szukają Chrome/Chromium (też Chromium z Playwrighta w chmurze). Gdy nie znajdą, ustaw `CHROME=/ścieżka`.
- **Render:** w chmurze bez GPU ~2–3 s na klatkę (rolka 30 s ≈ 35–40 min), na komputerze z kartą graficzną `--gpu` dużo szybciej. Najpierw klatki kontrolne, potem fragment, na końcu całość.
- **Transkrypcja:** Whisper pobiera model z HuggingFace. Gdy jest zablokowany (chmura Claude): `bash tools/get_whisper_model.sh` i `--model models/whisper-small`.

## 9. Kontrola przed oddaniem

- [ ] `python3 tools/check_motion.py rolka.mp4 --sheet sheet.jpg`: 0 skoków. Arkusz obejrzany jak widz.
- [ ] Klatka 0: bohater i pierwsze słowo napisu już widoczne.
- [ ] Każdy beat ma bohatera, każde przejście to ruch kamery. Brak przenikań, light leaków i czarnych przerw.
- [ ] Napisy nie zasłaniają bohatera, nie urywają się, słowo-klucz w dużym foncie.
- [ ] Nic ważnego przy krawędziach, jeden punkt skupienia w kadrze.
- [ ] Kolory i fonty wyłącznie z presetu użytkownika.
- [ ] Licencje modeli spisane (CC-BY → podpis), cudzych grafik brak w wersji do publikacji.
- [ ] Z dźwiękiem: ok. −14 LUFS, szczyt ≤ −1 dBTP, głos najgłośniejszy.
