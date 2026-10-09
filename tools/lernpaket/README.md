# Lernpaket: vom Kursraum zur Prüfungsvorbereitung im Second Brain

Dieses Verfahren macht aus einem Moodle-Kursraum ein geprüftes Lernpaket im Second Brain: Notizen, Lernkarten und
Multiple-Choice-Testaufgaben, die der Kursfassung folgen und jede Aussage belegen. Es ist am Modul Agiles
Projektmanagement entstanden (09.10.2026; Referenz: `module/agiles-projektmanagement.json`) und für weitere Module
gedacht.

Beteiligt sind der **Nutzer** (Freigaben, Anmeldung), ein **Koordinator** (Claude in der Hauptsitzung: plant, führt
zusammen, entscheidet Prüfbefunde, spielt ein) und **Autoren- und Prüfagenten** (schreiben nur Dateien im
Arbeitsordner, nie ins Second Brain).

## Ablauf auf einen Blick

| # | Schritt | Ergebnis | Werkzeug | Freigabe durch den Nutzer |
|---|---|---|---|---|
| 0 | Modul anlegen | `modul.json`, Arbeitsordner | `module/vorlage.json` | Fachthema, Prüfungsform |
| 1 | Kursraum erfassen | `kursraum/` (Inventar, Texte, Dateien, Medien) | Downloader `--export --with-media` | Anmeldung |
| 2 | Transkribieren | `transkripte/*.md` | `transcribe.py` (Azure; Untertitel ohne Azure) | – |
| 3 | Nummern und Abgleich | `quellen.json`, Abgleich Kurs ↔ Bestand | `skripte/quellen_nummern.py` | – |
| 4 | Soll-Liste | `soll-liste.md` mit Vorschlag Lernbereiche | `vorlagen/BRIEFING_SOLL_LISTE.md` | **Lernbereiche** |
| 5 | Plan | Lernbereiche, Verteilung, Speicherbudget in `modul.json` | – | **Umfang** |
| 6 | Entwürfe | `entwurf/karten-*.json`, `entwurf/quiz-*.json` | `vorlagen/BRIEFING_KARTEN.md`, `BRIEFING_QUIZ.md` | – |
| 7 | Zusammenführen | `aenderungen.json`, `pool.json` | `skripte/zusammenfuehren.py`, Prüfskripte | – |
| 8 | Unabhängige Prüfung | `pruefung-*.json` → `aenderungen-final.json`, `pool-final.json` | `vorlagen/PRUEFAUFTRAG.md`, `skripte/apply_pruefung.py` | gemeldete Punkte |
| 9 | Freigabe | lesbare Änderungsliste und Aufgabenliste | – | **Einspielen** |
| 10 | Einspielen | neue Revision, Sicherungen vorher und nachher | `brain-api.mjs`, `build_nachher.py`, `validate.mjs` | – |
| 11 | Abschluss | Doku im Modulordner, TaskPilot, Gedächtnis | – | Vorschläge in TaskPilot |

Freigaben dürfen gebündelt werden („Freigabe für alles“); sie gelten für das beschriebene Paket, nicht für Folgearbeit.

## Arbeitsordner je Modul

```
<Modulordner>/lernpaket/
  modul.json            Kopie oder Verweis auf tools/lernpaket/module/<modul>.json
  kursraum/             Kursexport des Downloaders (inventar.md/json, texte/, dateien/, medien/, medien/vimeo.json)
  transkripte/          *.md aus transcribe.py (Audio per Azure, Untertitel umgewandelt)
  quellen.json          Aufzeichnungsnummer → Titel → Transkript (aus quellen_nummern.py, Titel von Hand geprüft)
  stand.json            frischer Pull des Second Brain zu Beginn der Entwürfe
  soll-liste.md         Maßstab für Vollständigkeit
  entwurf/              karten-<Teil>.json/.md, quiz-<Teil>.json/.md, notiz-<name>.json
  aenderungen.json      zusammengeführt;   pool.json  vollständiger Aufgabenpool
  pruefung-<Paket>.json Prüfberichte;      aenderungen-final.json, pool-final.json
  einspielen/           vorher.json, nachher.json, kontrolle.json
```

Kursexport und Transkripte enthalten Kursmaterial: nur lokal halten, nicht in ein Repo committen.

## Die Schritte im Einzelnen

### 0 · Modul anlegen
- `module/vorlage.json` nach `module/<modul>.json` kopieren und füllen. **Fachthema allgemein** benennen (AGENTS.md:
  nach Fachthemen, nicht nach Hochschulmodulen; keine Kurskürzel). ID-Präfixe neutral wählen (`<thema>-card-`).
- `verbotene_ausdruecke`: Hochschule, Modulkürzel, Lehreinheitskürzel, Name der Lehrperson, Firmen aus Beispielen.
- Prüfungsform aus dem Kursraum übernehmen (nach Schritt 1 nachtragen, wenn sie erst dort steht).

### 1 · Kursraum erfassen (Downloader, `Private/audio_downloader`)
```powershell
cd C:\Users\jensm\Documents\Project\Private\audio_downloader
.\.venv\Scripts\python main.py --export --with-media "<kurs_url>"
```
- Anmeldung über die lokale `.env` des Nutzers (`UNI_USERNAME`, `UNI_PASSWORD`, `LOGIN_URL`) oder `--manual-login`
  (Browserfenster, 5 Minuten Zeit). Die `.env` wird nie gelesen, ausgegeben oder committet.
- Ergebnis in `exports/kurs-<id>/`; danach nach `<Arbeitsordner>/kursraum/` kopieren.
- **Tests, Abgaben, Foren, Lektionen und SCORM werden nie geöffnet** (ein Abschlusstest ist oft nur einmal aufrufbar).
- `--with-media` lädt Audio und Video aus dem Kurs und holt für eingebettete Vimeo-Videos in der angemeldeten Sitzung
  die Untertitel (bevorzugt) oder die Tonspur; Übersicht in `medien/vimeo.json`. Externe YouTube-Videos werden nur
  gelistet.

### 2 · Transkribieren
```powershell
.\.venv\Scripts\python transcribe.py exports\kurs-<id>\medien --out <Arbeitsordner>\transkripte --resource jensmoos-1541-resource --resource-group rg-jensmoos-1541
```
- Audio per Azure AI Speech (Fast Transcription, de-DE), Schlüssel nur zur Laufzeit über `az`; Kosten gering (erster
  Durchlauf: rund zwei Stunden Audio, unter zwei Euro; aktuelle Preise im Azure-Portal). Untertitel (`.vtt`) werden ohne Azure umgewandelt. Bereits transkribierte Dateien werden übersprungen.
- Automatische Untertitel und Spracherkennung enthalten Fehlhörungen: in der Soll-Liste korrigieren und kennzeichnen,
  wiederkehrende in `fehlhoerungen` aufnehmen.

### 3 · Nummern und Abgleich
```powershell
python -I tools\lernpaket\skripte\quellen_nummern.py <Arbeitsordner>
```
- Nummern beginnen nach der höchsten im Deck zitierten Aufzeichnung (nächster Zehner) und folgen der Kursreihenfolge;
  inhaltsgleiche Transkripte werden als Dublette markiert.
- **Von Hand prüfen:** Titel (aus Dateinamen; fachlich passend benennen), und ob ein neues Transkript schon unter einer
  alten Nummer im Deck steckt (gleiche Dauer, gleicher Anfang). Beides ist im ersten Durchlauf passiert.
- Kursinventar gegen vorhandene Transkripte abgleichen und festhalten, was fehlt (Beispiel:
  `agpm-i/10_Testvorbereitung/Kursinventar_Abgleich_2026-10-09.md`). Die Lernziele des Kurses sind der Maßstab für
  Prüfungsrelevanz.

### 4 · Soll-Liste
- Auftrag `vorlagen/BRIEFING_SOLL_LISTE.md` an einen Agenten. Ergebnis `soll-liste.md` mit Inventar, Aufzählungen,
  Begriffspaaren, **Abweichungen und Widersprüchen zwischen Einheiten** und einem Vorschlag für Lernbereiche.
- Stichproben gegen das Transkript prüfen, bevor der Nutzer die Lernbereiche freigibt.

### 5 · Plan
- Lernbereiche mit Zielverteilung je Stufe in `modul.json` (`quiz.lernbereiche`): mindestens drei Aufgaben je Bereich
  und Stufe, prüfungsrelevante Bereiche mehr. Namen sind danach fest (das Lernprofil hängt daran).
- **Speicherbudget:** Arbeitsraum höchstens 1,8 MB. Grob 2 KB je Aufgabe und 1–1,5 KB je Karte; jede Übungsrunde
  speichert ihre Aufgaben mit (etwa 40 KB je 20er-Runde). Ziel: Platz für mindestens 20 Runden. Lieber weniger, dafür
  geprüfte Aufgaben.

### 6 · Entwürfe
- `stand.json` frisch ziehen: `node %USERPROFILE%\.newhope\brain-api.mjs pull <Arbeitsordner>\stand.json`.
- Karten und Aufgaben in **getrennte Zuständigkeiten** aufteilen: je Autor eigene Lernbereiche, eigenes ID-Präfix für
  neue Karten, eine feste Liste von Notizen, an denen er Karten ändern darf. Notizen anderer Präfixe im selben
  Fachthema (Literatur-Notizen) gehören dazu.
- Vorlagen ausfüllen (Platzhalter `{{…}}`), Agenten parallel starten. Korrekturen während der Arbeit an alle betroffenen
  Agenten schicken und zusätzlich oben in die Aufträge schreiben.

### 7 · Zusammenführen
```powershell
python -I tools\lernpaket\skripte\zusammenfuehren.py <Arbeitsordner>
python -I tools\lernpaket\skripte\check_karten.py <modul.json> <Arbeitsordner>\stand.json <Arbeitsordner>\aenderungen.json
python -I tools\lernpaket\skripte\check_quiz.py --modul <modul.json> --pool <Arbeitsordner>\pool.json
```
- Beide Prüfskripte müssen 0 Fehler melden. Danach den **Bestand** nach Aussagen durchsuchen, die durch die neuen
  Quellen überholt sind („nicht vertieft“, „nur genannt“), und Bestandskarten, die der Kursfassung widersprechen.

### 8 · Unabhängige Prüfung
- Drei Prüfagenten mit `vorlagen/PRUEFAUFTRAG.md`, jeder ein Paket aus Karten und den passenden Aufgaben. Prüfer lösen
  jede Aufgabe zuerst selbst; Korrekturen kommen als exakte Ersetzungen.
- `python -I tools\lernpaket\skripte\apply_pruefung.py <Arbeitsordner>`; danach beide Prüfskripte erneut.
- Gemeldete Punkte entscheidet der Koordinator; Grundsatzfragen gehen an den Nutzer.

### 9 · Freigabe
- Lesbare Fassung erzeugen (neue Notizen, geänderte Karten mit Begründung, neue Karten, alle Aufgaben mit Lösung) und
  in den Modulordner legen. Der Nutzer gibt das Einspielen frei.

### 10 · Einspielen
```powershell
node %USERPROFILE%\.newhope\brain-api.mjs pull <Arbeitsordner>\einspielen\vorher.json
copy <Arbeitsordner>\einspielen\vorher.json %USERPROFILE%\.newhope\backups\<JJJJ-MM-TT_HHMM>-vor-<zweck>.json
python -I tools\lernpaket\skripte\build_nachher.py <Arbeitsordner> <…>\vorher.json <…>\nachher.json
node --experimental-strip-types tools\lernpaket\skripte\validate.mjs <…>\nachher.json
node %USERPROFILE%\.newhope\brain-api.mjs push <…>\nachher.json
node %USERPROFILE%\.newhope\brain-api.mjs pull <…>\kontrolle.json
```
- `build_nachher.py` bricht ab, wenn sich eine geänderte Karte oder Notiz seit dem Entwurf verändert hat.
- `validate.mjs` prüft mit dem Schema der App und meldet Felder, die das Schema stillschweigend verwerfen würde (es
  verwirft unbekannte Felder beim Speichern). Erwartet: gültig, 0 verworfene Zeichen.
- Vor dem Push prüfen: gleiche Schlüssel, Übungsrunden unverändert, Lernstand bestehender Karten unverändert. Nach dem
  Push: Kontroll-Pull identisch mit dem Push; Sicherung „nach“ ablegen.

### 11 · Abschluss
- Im Modulordner: Entscheidung (was, warum, Zahlen), README der Testvorbereitung, Änderungs- und Aufgabenliste.
- TaskPilot: `document_completed_work` im passenden Projekt; offene Punkte als bekannte Grenzen.
- Gedächtnis: Stand des Second Brain (Revision, Zahlen, Speicher) aktualisieren.

## Verbindliche Regeln

- **Kursfassung zuerst.** Keine Karte und keine Aufgabe wertet eine Kursaussage als falsch; Referenzwerke und
  Literatur stehen als gekennzeichnete Zeile danach.
- **Zwei Fassungen im Kurs** (ältere und neuere Aufnahme, Einheit gegen Einheit) werden auf Karten beide genannt; Aufgaben
  beziehen den Stamm auf eine Einheit oder fragen nur, was beide tragen.
- **Jede Aussage belegt** mit „Aufzeichnung NN „Titel“ [mm:ss]–[mm:ss]“ oder „Kurstext „…““. Nummern nur aus
  `quellen.json` oder dem Quellenverzeichnis des Decks (Notiz „Quellen“, dort ergänzen).
- **Keine Kurs- oder Lehreinheitskürzel, keine Hochschul-, Firmen- oder Personennamen** in Titeln, Themen, Tags, Karten,
  Aufgaben und Grafiken; Lehrende und Gäste nur als Rolle, Firmen umschreiben. Standards, Werkzeuge und Fachautoren
  sind erlaubt. Auch Literaturangaben nicht mit Firmennamen belegen.
- **Bestehende IDs, Lernstand und Übungsrunden bleiben.** Themenstruktur nicht umbauen, solange die Wiederherstellung
  der Wissensstruktur offen ist.
- **Ins Second Brain schreibt nur der Koordinator**, immer mit Pull, Sicherung, Schema-Prüfung, Push, Kontroll-Pull.
- **Tests dürfen nie das echte System berühren** (Downloader-Tests laufen gegen einen nachgebauten Kurs; `LOGIN_URL`
  wird im Test überschrieben).

## Lehren aus dem ersten Durchlauf (Agiles Projektmanagement, 09.10.2026)

| Was passiert ist | Was das Verfahren jetzt tut |
|---|---|
| Der Audio-Modus fand nur Audiodateien mit `.mp3` in der Adresse; Podcasts als Datei-Aktivität und Vimeo-Videos fehlten, ganze Kapitel blieben unbemerkt | Schritt 1 erfasst den Kurs vollständig und listet jede Aktivität; der Abgleich in Schritt 3 macht Lücken sichtbar |
| Neue Aufnahmen wurden mit Nummern belegt, die im Deck schon vergeben waren (Deck-Nummern waren LV-Nummern) | `quellen_nummern.py` liest die vergebenen Nummern aus dem Bestand und beginnt dahinter |
| Ein „neues“ Video war dasselbe Interview wie ein vorhandenes Transkript | Schritt 3 verlangt den Vergleich über Dauer und Anfang |
| Zwei Transkripte derselben Datei unterschieden sich leicht | Dubletten über Dauer und Wortbestand, nicht über exakten Text |
| Passende Notizen hatten ein anderes Präfix und wären fast doppelt angelegt worden | Aufträge verlangen die Prüfung aller Notizen eines Fachthemas |
| Eine Bestandskarte trainierte die Literaturfassung („sechs Praktiken“) gegen die Kursfassung („vier“) | Schritt 7 durchsucht den Bestand nach Widersprüchen und überholten Aussagen |
| Ältere und neuere Serie widersprachen sich (Design-Thinking-Phasen, Retrospektive, Dreieck) | Soll-Liste Abschnitt 5 und Regel „zwei Fassungen“ |
| Eine Literaturangabe nannte eine Firma als Quelle; ein Kurstext-Zitat übernahm einen Tippfehler | Prüfskripte prüfen Firmen- und Fehlhörungslisten jetzt auch in Karten |
| Der Downloader-Test las die lokale `.env` und rief die echte Login-Seite auf | Test überschreibt `LOGIN_URL`; Regel „Tests nie gegen das echte System“ |
| Ein Agent-Ergebnis überschritt den Richtwert deutlich (über 100 neue Aufgaben vorgeschlagen) | Speicherbudget in Schritt 5 vor den Entwürfen festlegen |
