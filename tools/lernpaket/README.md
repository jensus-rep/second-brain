# Lernpaket: vom Kursraum zur Prüfungsvorbereitung im Second Brain

Für einen neuen Nutzer zuerst [Übergabe und Einrichtung](UEBERGABE.md) lesen. Beispiele in `module/` stammen aus der
ursprünglichen Installation; neue Module mit der Vorlage und eigenen Werten anlegen. Der Ablauf wird von einem
Agenten koordiniert; ein vollständiger Import per Link ist noch nicht eingebaut.

Dieses Verfahren macht aus einem Moodle-Kursraum ein geprüftes Lernpaket im Second Brain: Notizen, Lernkarten und
Multiple-Choice-Testaufgaben, die der Kursfassung folgen und jede Aussage belegen. Es ist am Modul Agiles
Projektmanagement entstanden (09.10.2026; Referenz: `module/agiles-projektmanagement.json`) und für weitere Module
gedacht.

Beteiligt sind der **Nutzer** (Freigaben, Anmeldung) und ein **Koordinator** (etwa Codex in der Hauptsitzung: plant,
führt zusammen, entscheidet Prüfbefunde, spielt ein). Bei beauftragter Delegation können **Autoren- und Prüfagenten**
zuarbeiten; sie schreiben nur Dateien im Arbeitsordner, nie ins Second Brain. Ein einzelner Agent kann die
Arbeitsphasen auch nacheinander durchführen; Entwurf und fachliche Gegenprüfung bleiben getrennte Durchgänge.

## API-Zugang einmalig einrichten

Aus dem Second-Brain-Repo heraus `.env.brain.example` nach `.env.brain` kopieren. Darin die Basisadresse der eigenen
Instanz (`BRAIN_URL`) und einen im angemeldeten Browser unter „Zugangsschlüssel“ erstellten eigenen Schlüssel
(`BRAIN_ACCESS_KEY`) eintragen. `.env.brain` bleibt lokal und wird nie ausgegeben oder geteilt. Der mitgelieferte
Helfer `tools/lernpaket/brain-api.mjs` benötigt Node ab 22.13 und die installierten Repo-Abhängigkeiten.
Alle untenstehenden `node`-Aufrufe erfolgen aus dem Second-Brain-Repo. Platzhalter vor Ausführung ersetzen.

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
| 11 | Abschluss | Doku im Modulordner; optional im eigenen Aufgabenwerkzeug | – | externe Einträge nur beauftragt |

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

### 1 · Kursraum erfassen (separates Repo `audio_downloader`)
```powershell
Set-Location <Pfad-zum-audio_downloader-Repo>
.\.venv\Scripts\python main.py --export --with-media --manual-login "<kurs_url>"
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
.\.venv\Scripts\python transcribe.py exports\kurs-<id>\medien --out <Arbeitsordner>\transkripte --resource <eigene-speech-ressource> --resource-group <eigene-gruppe>
```
- Audio per Azure AI Speech (Fast Transcription, de-DE), Schlüssel zur Laufzeit über `az` oder die Prozessumgebung;
  Kosten hängen von der eigenen Ressource ab. Untertitel (`.vtt`) werden ohne Azure umgewandelt. Bereits transkribierte
  Dateien werden übersprungen. Die Speech-Variablen werden nicht automatisch aus einer `.env` geladen.
- Automatische Untertitel und Spracherkennung enthalten Fehlhörungen: in der Soll-Liste korrigieren und kennzeichnen,
  wiederkehrende in `fehlhoerungen` aufnehmen.

### 3 · Nummern und Abgleich
Vorher zurück ins Second-Brain-Repo wechseln und den eigenen Bestand als Entwurfsbasis ziehen:

```powershell
Set-Location <Pfad-zum-second-brain-Repo>
node --experimental-strip-types --env-file=.env.brain tools/lernpaket/brain-api.mjs pull <Arbeitsordner>\stand.json
```

```powershell
python -I tools\lernpaket\skripte\quellen_nummern.py <Arbeitsordner>
```
- Nummern beginnen nach der höchsten im Deck zitierten Aufzeichnung (nächster Zehner) und folgen der Kursreihenfolge;
  inhaltsgleiche Transkripte werden als Dublette markiert.
- Parallel vorbereitete Module bekommen getrennte Nummernbereiche (`--start 101`, `--start 201` …), weil der Pull
  noch nicht die Nummern eines anderen Entwurfs enthält. Bereiche anhand des eigenen Bestands abstimmen und bei mehr
  als 100 Aufzeichnungen entsprechend vergrößern; die historischen Beispielbereiche sind keine globale Vergabe.
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
- **Speicherbudget:** Arbeitsraum höchstens 4 MB (bis 09.10.2026: 1,8 MB). Grob 2 KB je Aufgabe, 1–1,5 KB je Karte,
  5–10 KB je Notiz; jede Übungsrunde speichert ihre Aufgaben mit (etwa 40 KB je 20er-Runde). Die App behält je
  Fachthema die letzten 5 Runden vollständig und kürzt ältere verlustfrei auf etwa 12 KB. Ziel: nach dem Einspielen
  mindestens 1 MB frei. Lieber weniger, dafür geprüfte Aufgaben.

### 6 · Entwürfe
- `stand.json` aus Schritt 3 als feste Entwurfsbasis verwenden. Für eine neu begonnene Entwurfsrunde frisch pullen;
  eine bereits verwendete Basis nicht überschreiben, da sie für den späteren Änderungsabgleich gebraucht wird.
- Karten und Aufgaben in **getrennte Zuständigkeiten** aufteilen: je Autor eigene Lernbereiche, eigenes ID-Präfix für
  neue Karten, eine feste Liste von Notizen, an denen er Karten ändern darf. Notizen anderer Präfixe im selben
  Fachthema (Literatur-Notizen) gehören dazu.
- Vorlagen ausfüllen (Platzhalter `{{…}}`), nacheinander oder bei beauftragter Delegation parallel bearbeiten.
  Korrekturen während der Arbeit in alle betroffenen Aufträge übernehmen.

### 7 · Zusammenführen
```powershell
python -I tools\lernpaket\skripte\zusammenfuehren.py <Arbeitsordner>
python -I tools\lernpaket\skripte\check_karten.py <modul.json> <Arbeitsordner>\stand.json <Arbeitsordner>\aenderungen.json
python -I tools\lernpaket\skripte\check_quiz.py --modul <modul.json> --pool <Arbeitsordner>\pool.json
```
- Beide Prüfskripte müssen 0 Fehler melden. Danach den **Bestand** nach Aussagen durchsuchen, die durch die neuen
  Quellen überholt sind („nicht vertieft“, „nur genannt“), und Bestandskarten, die der Kursfassung widersprechen.

### 8 · Unabhängige Prüfung
- Fachliche Gegenprüfung mit `vorlagen/PRUEFAUFTRAG.md`, bei beauftragter Delegation durch separate Prüfagenten.
  Jede Aufgabe zuerst selbst lösen; Korrekturen kommen als exakte Ersetzungen.
- `python -I tools\lernpaket\skripte\apply_pruefung.py <Arbeitsordner>`; danach beide Prüfskripte erneut.
- Gemeldete Punkte entscheidet der Koordinator; Grundsatzfragen gehen an den Nutzer.

### 9 · Freigabe
- Lesbare Fassung erzeugen (neue Notizen, geänderte Karten mit Begründung, neue Karten, alle Aufgaben mit Lösung) und
  in den Modulordner legen. Der Nutzer gibt das Einspielen frei.

### 10 · Einspielen
```powershell
node --experimental-strip-types --env-file=.env.brain tools/lernpaket/brain-api.mjs pull <Arbeitsordner>\einspielen\vorher.json
python -I tools\lernpaket\skripte\build_nachher.py <Arbeitsordner> <…>\vorher.json <…>\nachher.json
node --experimental-strip-types tools\lernpaket\skripte\validate.mjs <…>\nachher.json
node --experimental-strip-types --env-file=.env.brain tools/lernpaket/brain-api.mjs push <…>\nachher.json
node --experimental-strip-types --env-file=.env.brain tools/lernpaket/brain-api.mjs pull <…>\kontrolle.json
```
- `build_nachher.py` vergleicht Entwurf und frischen Pull mit `stand.json`. Es übernimmt nur beabsichtigte Änderungen,
  erhält parallele Änderungen an anderen Feldern und bricht bei Konflikten ab, auch bei Testaufgaben. Lernstandfelder
  bestehender Karten dürfen nicht über die Änderungsliste überschrieben werden. Ohne `pool-final.json` bleibt der
  frische Aufgabenpool unverändert. Eine bereits vorhandene Ausgabedatei wird nicht überschrieben.
- `validate.mjs` prüft Schema und Speicherlimit und bricht auch ab, wenn Eingabefelder verloren gingen oder Werte beim
  Parsen verändert würden. Ergänzte Schema-Standardwerte sind erlaubt.
- Der API-Helfer verlangt die Herkunft der eigenen Instanz aus dem Pull, prüft die Revision, sichert vorher und nachher
  unter `.data/brain-api-backups/` und vergleicht einen Kontroll-Pull mit der Speicherantwort. Bei Konflikten erfolgt kein
  automatischer Wiederholungsversuch. Bereits vorhandene Pull-Dateien bleiben erhalten; für Folgeläufe neue Namen wählen.
- Vor dem Push fachlichen Änderungsumfang prüfen; Übungsrunden und Lernstand bestehender Karten müssen erhalten bleiben.
  Die JSON-Sicherungen des Helfers enthalten Bildreferenzen. Für eine vollständige Mediensicherung zusätzlich ZIP exportieren.

### 11 · Abschluss
- Im Modulordner: Entscheidung (was, warum, Zahlen), README der Testvorbereitung, Änderungs- und Aufgabenliste.
- Optional das eigene Aufgabenwerkzeug oder Gedächtnis aktualisieren (Revision, Zahlen, Speicher, bekannte Grenzen).
  Einträge in externen Diensten nur bei entsprechendem Auftrag erstellen.

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

## Lehren aus dem zweiten Durchlauf (Forschungsmethoden, Softwareentwicklung, 09.10.2026)

| Was passiert ist | Was das Verfahren jetzt tut |
|---|---|
| Keins der Module endet mit einem MC-Test (Forschungsskizze und mündliche Prüfung; Projekt mit Report) | Schritt 0 klärt mit dem Nutzer, ob ein Fragepool sinnvoll ist; ohne Pool entfallen die Quiz-Schritte |
| Abschnittsseiten werden nicht in Kursreihenfolge gelesen; ganze Kapitel landeten hinten | `quellen_nummern.py` sortiert nach Abschnitt, dann nach Position |
| Podcast und Video derselben Einheit unterscheiden sich um 1–3 Sekunden; 5 von 30 Paaren blieben unerkannt | Dubletten bei höchstens 5 s Unterschied |
| `--start` wurde samt Zahl als zweiter Ordner gelesen | Argumente korrigiert |
| Videos ohne Titel im Kurs und bei Vimeo (nur Nummern) | Die Soll-Liste vergibt Titel nach Inhalt; danach in `quellen.json` übernehmen |
| Große Literatur-PDFs (bis 2,5 MB Text) im Kursraum | Soll-Liste liest Kurstexte und Folienskript vollständig, Literatur nur gezielt; große Module auf zwei Soll-Listen-Agenten verteilen |
