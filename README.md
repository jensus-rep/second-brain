# Second Brain · Dein Wissensatelier

Eine private, deutschsprachige Second-Brain-Web-App. Wissen wird als Markdown mit strukturierten Metadaten gespeichert und als Bibliothek, Notizleser, Verknüpfungskarte und Lernpfad dargestellt.

## Funktionen

- Notizen erstellen, bearbeiten, favorisieren, archivieren und wiederherstellen.
- Eigene Fachthemen und verschachtelte Unterthemen, Tags sowie Verbindungen und automatisch sichtbare Rückverweise.
- Volltextsuche über Titel, Zusammenfassung, Inhalt, Tags und Themennamen; kombinierbare Filter.
- Karten- und Listenansicht sowie responsive Navigation.
- Aufklappbare Themenstruktur mit Eintragszahlen und klickbaren Themenpfaden; Elternansichten und Themenfilter schließen das Wissen ihrer Unterthemen ein.
- Großzügige Eintragsansicht mit moderner Lesetypografie, Gliederung aus den tatsächlichen Markdown-Überschriften und einklappbaren Metadaten.
- Verwandte Einträge mit Browsernavigation; nach dem Bearbeiten oder Erstellen einer Lernkarte zurück zum gelesenen Eintrag.
- Lernpfade mit sortierbaren Schritten, eigenen Aufgaben und dauerhaftem Fortschritt.
- JSON-Export und validierter Import mit ausdrücklicher Ersetzungsbestätigung.
- Bilder (PNG, JPEG, WebP, GIF) mit Beschriftung, Kartenvorschau und vergrößerbarer Ansicht; private Speicherung in der Datenbank.
- Sichere Mermaid-Ablaufdiagramme, Sequenzdiagramme und Mindmaps direkt im Markdown.
- Markdown-Tabellen erscheinen als responsive SVG-Karten mit umbrechender Schrift. Eine aufklappbare Textansicht erhält Formatierungen und bedienbare Links; Notizen und Lernkarten nutzen dieselbe Darstellung.
- Lernkarten mit Frage, aufdeckbarer Antwort und geplanten Wiederholungen; Bilder und Diagramme auf beiden Seiten. Fachbegriffe öffnen per Klick eine Begriffskarte mit Abbildung und Kurzbeschreibung.
- Eigener Bereich für Lernsammlungen mit sofortiger Detailansicht und direktem Lernstart; zugehörige Notizen, Lernkarten, Tests und Lernpfade sowie drei Prioritätsstufen für die Karten.
- Sammlungsauswahl und Lernstart gemeinsam im Lernkartenbereich; freies Üben bleibt auch ohne fällige Karten verfügbar.
- Multiple-Choice-Prüfungssimulationen mit optionalem Zeitlimit und adaptiver Übung, Fehlerjournal und eigenen Testaufgaben. Die letzte gespeicherte Antwort schließt eine vollständig beantwortete Runde automatisch ab.
- Vorbereitung nach Lernbereichen mit passenden Wissensnotizen, kurzen oder vollständigen Übungsrunden und gespeichertem Arbeitsfortschritt.
- Lernüberblick mit dauerhaftem Lernfokus, unterbrochenen Einheiten, fälligen Karten, offenen Lernbereichen und direktem Start; letzte Auswertung und Vergleich tatsächlich vergleichbarer Runden.
- Tutor mit geführten kurzen Kartenrunden, passendem Kurztest, persönlichem Lernplan und Rückmeldung aus gespeicherten Ergebnissen. Eigene Kartenantworten erhalten einen kurzen Vergleich zur Musterantwort.
- Animierte Ergebnisauswertung sowie passende Abbildungen, Diagramme und Vergleiche direkt bei der Antworterklärung.
- Gespeicherte Lernerinnerungen im Überblick mit Kalenderexport und Alarm.
- Vollständige ZIP-Sicherungen inklusive Bilder und Lernkarten; JSON bleibt zum Bearbeiten der Wissensdaten verfügbar.
- Sechs editierbare Einstiegsnotizen und ein unbegonnener Beispiel-Lernpfad.
- Private Bereitstellung auf Azure App Service mit eigenem Login; Speicherung in Azure SQL pro Konto.
- Konflikterkennung über Revisionen statt stiller Überschreibung in mehreren Fenstern.

## Architektur

| Bereich | Ort |
| --- | --- |
| Typen, Datenvalidierung, Suche, Fortschritt | lib/brain/model.ts |
| Themenhierarchie, Themenpfade und aufklappbare Struktur | lib/brain/topics.ts, components/brain/topic-tree.tsx |
| Editierbare Startinhalte für neue Sammlungen | lib/brain/seed.ts |
| Datenbankzugriff | lib/brain/storage.ts, lib/server/store*.ts |
| Anmeldung und Sessions | lib/server/auth.ts, app/login/, app/api/auth/ |
| Authentifizierte GET-/PUT-Schnittstelle | app/api/brain/route.ts |
| Clientseitiges Laden und Speichern | lib/brain/use-brain.ts |
| Arbeitsoberfläche | components/brain/brain-app.tsx |
| Notiz-, Themen- und Lernpfad-Editoren | components/brain/editors.tsx |
| Sicherer Markdown-Renderer | components/brain/markdown.tsx |
| Leseansicht und kompakte Wissensfilter | components/brain/note-reader.tsx, knowledge-filters.tsx |
| Abbildungen, Diagramme, Uploads | components/brain/visual.tsx, media-toolbar.tsx, app/api/media/ |
| Lernkarten und Lernansicht | components/brain/flashcards.tsx |
| Begriffsvorschau in Lernkarten | lib/brain/glossary.ts, components/brain/term-preview.tsx, glossary-context.tsx |
| Lernsammlungen, Zuordnung und Kartenprioritäten | components/brain/learning-collections.tsx, lib/brain/learning-collections.ts |
| Tests, Fehlerjournal und Erinnerungen | components/brain/quizzes.tsx, lib/brain/quiz.ts, quiz-examples.ts |
| Adaptive Tutorvorschläge und optionaler Azure-OpenAI-Aufruf | lib/brain/learning-tutor.ts, lib/server/tutor-runtime.ts, app/api/tutor/route.ts |
| Bildsicherungen und Import | lib/brain/backup.ts, components/brain/transfer-dialog.tsx |
| Design-Tokens, Layout, responsive Gestaltung | app/globals.css |
| Bibliotheks- und Lesegestaltung | app/reading-workspace.css |
| Themenstruktur und gemeinsame Orientierung | app/topic-hierarchy.css, app/workspace-redesign.css |
| Wiederverwendbare UI-Primitiven | components/ui/ |

React 19, TypeScript, Next.js 16 (eigenständiger Node-Server) und Tailwind. Die App hat ein eigenes Konto mit E-Mail und Passwort (scrypt-Hash, signiertes HttpOnly-Cookie, Sperre nach wiederholten Fehlversuchen). Anfragen ohne gültige Session werden von der API abgelehnt. Nutzer-IDs kommen ausschließlich aus der serverseitigen Session.

In Produktion liegen Konten, Sammlungen und Bilder in Azure SQL (Tabellen `newhope_users`, `newhope_workspaces`, `newhope_media`; sie werden beim ersten Start angelegt). Die Tabellen `second_brain_*` der Vorgänger-App bleiben unberührt. Lokal verwendet die App eine SQLite-Datei unter `.data/`.

Die erste Version speichert eine vollständige Sammlung atomar als versioniertes Dokument. Dadurch bleiben Verknüpfungen, Lernpfade und Fortschritte beim Speichern konsistent. Die Update-Abfrage prüft Eigentümer und Revision. Ab 32 KB lädt die App die Sammlung gzip-komprimiert hoch; der Server erkennt komprimierte Daten am Inhalt, begrenzt auch entpackt auf 4 MB und nimmt von Zugangsschlüssel-Clients weiterhin unkomprimiertes JSON an. Änderungen, die sich hinter einer laufenden Speicherung anstauen, werden gemeinsam in einer Revision gespeichert; jede behält ihr eigenes Ergebnis. Für umfangreiche Sammlungen lässt sich die isolierte Speicherschicht später in einzelne Datensätze und einen Suchindex aufteilen.

## Lokal entwickeln

Node.js 24 LTS empfohlen, mindestens 22.13.

~~~sh
npm install
npm run dev
~~~

Der Entwicklungsserver läuft unter http://127.0.0.1:5173. Lokal meldet sich der Browser automatisch als Testnutzer an (`/api/auth/dev-login`, nur im Entwicklungsmodus). Daten liegen in `.data/newhope.sqlite`; die Azure-Datenbank wird lokal nie verwendet, solange `AZURE_SQL_SERVER` nicht gesetzt ist. Mit `NEWHOPE_DEV_AUTOLOGIN=false` lässt sich der echte Login-Ablauf lokal prüfen.

## Prüfen

~~~sh
npm run typecheck
npm test
npm run test:browser
npm run test:visual
npm run test:reading
npm run test:quizzes
npm run test:preparation
npm run test:collections
npm run test:structure
npm run test:reentry
npm run test:comparisons
npm run test:mobile
npm run test:zoom
~~~

Für den Browsertest muss der lokale Entwicklungsserver laufen und Google Chrome installiert sein. Alternativ die Browserkonfiguration in tests/browser.mjs auf einen verfügbaren Playwright-Browser ändern. Der Test lehnt externe Ziele ab und stellt den lokalen Ausgangsbestand nach seinem Lauf wieder her.

Er prüft Erstellen, Neuladen, Volltextsuche, Favoriten, Archivieren/Wiederherstellen, Lernfortschritt, eigene Lernpfade, konkurrierende Updates, ungültige Referenzen und die mobile Breite. Screenshots landen ausschließlich im ignorierten Verzeichnis .sites-runtime/qa/.

Die Leseprüfung ergänzt Themenwechsel, nicht zugeordnete Einträge, Tags im Archiv, Gliederung mit wiederholten Überschriften, Rückkehr aus dem Editor, Zurück/Vorwärts im Browser, direkte Eintragslinks und die mobile Lesefläche. Alle veränderten lokalen Wissensdaten werden nach dem Test wiederhergestellt. Datenändernde Browsertests nacheinander ausführen.

Die Testprüfung ergänzt gespeicherte Multiple-Choice-Runden, Antwortkombinationen, Fehlerhinweise und Merksätze, verborgene Lösungen während einer Simulation, Konfliktbehandlung, Zeitablauf, eigene Aufgaben, Erinnerungen und Kalenderexport sowie die mobile Breite.

Die Vorbereitungsprüfung ergänzt Themenabdeckung, kurze und vollständige Übungsrunden, dauerhaft gespeicherten Fortschritt, passende Lernvisualisierungen und Notiznavigation. Sie prüft außerdem Ergebnisanimationen, reduzierte Bewegung und die Breite bei 320 und 390 Pixeln. Alle datenändernden Tests laufen nacheinander ausschließlich auf localhost.

Die Sammlungsprüfung testet Umfang und Quellenzuordnung, gemeinsame Auswahl in Lernkarten und Tests, drei Prioritätsstufen, exakt gefilterte fällige Karten, Speichern und Neuladen, eigene Sammlungen und konsistente Verweise beim Kartenlöschen. `BRAIN_TEST_URL` muss auf localhost zeigen; `BRAIN_TEST_SQLITE_PATH` benennt die tatsächliche lokale SQLite-Datei. Vor jeder Testdatenänderung wird geprüft, dass API und diese Datei denselben Ausgangsbestand enthalten. Screenshots prüfen auch 320 und 390 Pixel Breite; anschließend wird der Ausgangsbestand wiederhergestellt.

Die Wiedereinstiegsprüfung (`test:reentry`) prüft gespeicherte Kartenpositionen nach Pause und Neuladen, direkte Vorbereitungseinheiten, Speicherfehler und gezielte Wiederholung unsicherer Lernbereiche. Sie kontrolliert Auswertungslinks, vergleichbare Ergebnisse sowie kurze Tests mit verborgenen Lösungen bis zur Abgabe. Sie nutzt dieselben lokalen Umgebungsvariablen, prüft die SQLite-Datei vor Schreibvorgängen und stellt den Ausgangsbestand wieder her.

## Lernüberblick und Wiedereinstieg

Im Überblick steht der zuletzt gespeicherte Lernfokus vor der Wissenssuche. Eine offene Testrunde oder eine pausierte Kartenrunde hat Vorrang. Danach empfiehlt die App den zuletzt falsch beantworteten Lernbereich, fällige Karten, eine offene Vorbereitungseinheit oder einen kurzen Abschlusstest mit höchstens sechs Aufgaben aus mehreren Lernbereichen. Die Begründung steht direkt beim Startknopf. Ein Kurztest lässt sich auch vor Abschluss aller Bereiche gezielt starten; Lösungen bleiben bis zur Abgabe verborgen.

„Lernbereiche bearbeitet“ zählt vollständig beantwortete und abgeschlossene Vorbereitungseinheiten, auch wenn dabei Antworten falsch waren. „Karten bereits wiederholt“ zählt Karten mit mindestens einer gespeicherten Bewertung. Beide Werte beschreiben bearbeitete Inhalte. Die letzte Testauswertung und Hinweise zum Nachschlagen zeigen getrennt, wo noch Unsicherheit besteht. Verbesserungen werden nur bei gleichem Fachthema, Modus, Lernbereich und tatsächlich gleichen Aufgaben angezeigt; geänderte Aufgaben oder gekürzte Althistorie ergeben keinen erfundenen Vergleich.

Die optionalen Workspace-Felder `learningFocus` und `flashcardSession` speichern Auswahl und Kartenposition serverseitig mit Revision und werden in Sicherungen übernommen. Beim Fortsetzen werden gelöschte, aus einer vorhandenen Sammlung entfernte oder inzwischen anders bewertete Karten übersprungen. Eine neue Kartenrunde ersetzt eine gespeicherte Runde erst nach ausdrücklicher Auswahl. Historische Referenzen dürfen bestehen bleiben; sie ändern keine vorhandenen IDs und benötigen keine Tabellenmigration.

## Lernsammlungen und Umfang

Auf der Startseite und unter „Lernsammlungen“ stehen Sammlungen für konkrete Lernziele. Ein Klick öffnet direkt die Detailansicht mit allen enthaltenen Notizen, Fachthemen, Karten, Testaufgaben und Lernpfaden. „Jetzt lernen“ startet die fälligen Karten der Sammlung; wenn keine fällig ist, werden alle Karten geübt. „Lernkarten öffnen“ führt zur Sammlungsauswahl mit zusätzlichen Filtern. Dieselbe Auswahl gilt beim Wechsel zu Tests. Eigene Sammlungen lassen sich aus vorhandenen Inhalten zusammenstellen und mit ihrem Lernziel speichern. Karten zu ausgewählten Notizen gehören automatisch dazu; zusätzliche Karten, Testaufgaben und Lernpfade werden ausdrücklich ausgewählt. Neue Karten und Testaufgaben aus einer ausgewählten Sammlung werden ihr beim Speichern direkt zugeordnet. Ein Inhalt kann mehreren Sammlungen angehören und behält dabei einen gemeinsamen Lernfortschritt.

Unter „Themen“ steht die fachliche Struktur unabhängig von den Lernsammlungen. Im Themeneditor lässt sich ein übergeordnetes Thema wählen; „Unterthema anlegen“ übernimmt die gewählte Ebene. Notizen werden ihrem konkreten Thema zugeordnet und erscheinen auch in seinen Elternansichten. Die optionale Metadatenangabe `parentId` wird im bestehenden Workspace-Dokument gespeichert. Ältere Themen ohne diese Angabe bleiben auf der obersten Ebene. Änderungen erhalten IDs und Lernfortschritte; ungültige Elternverweise und Kreisverknüpfungen werden abgelehnt.

Lernsammlungen öffnen die fachliche Struktur jetzt Ebene für Ebene. Bei einem einzigen Fachthema erscheinen unmittelbar dessen Unterthemen, bei mehreren Fachthemen zunächst die Einstiegsthemen. Themenkarten zählen ausschließlich Notizen der gewählten Sammlung einschließlich ihrer Nachfahren. Noch leere Unterthemen wie Regression und Klassifikation bleiben zur Orientierung sichtbar; Zweige mit ausschließlich ausgeschlossenen Notizen gehören nicht zum Ausschnitt. Ein klickbarer Themenpfad führt zurück; die direkte Themenauswahl zeigt vollständige Pfade. Notizen auf der aktuellen Ebene stehen unter den Themenkarten. „Alle Einträge anzeigen“ ergänzt die Notizen sämtlicher Unterthemen. Automatische Sammlungen bündeln ein Fachthema mit seinen Nachfahren, statt für jedes Unterthema eine eigene Sammlung anzulegen. Falls eine kleinere Sammlung bereits denselben Namen trägt, kennzeichnet „gesamter Themenbestand“ den zusätzlich verfügbaren vollständigen Umfang.

Für den bestehenden flachen Fachbestand bietet „Themenstruktur prüfen“ eine Vorschau und „Struktur übernehmen“ einen regulären, validierten Speichervorgang mit Revision. Projektmanagement erhält gemeinsame Grundlagen sowie agile, klassische und hybride Vorgehensweisen; Produktentwicklung, Führung und Datenprojekte ergänzen diese als Querschnittsthemen. Risikomanagement, Controlling und RACI werden beim erstmaligen Anlegen der gemeinsamen Grundlagen zusammen mit den bisherigen allgemeinen Projektmanagement-Notizen dort eingeordnet. KI führt über Machine Learning zu Supervised, Unsupervised, Self-Supervised und Reinforcement Learning. Frameworks und Praktiken sowie Forschungs- und Softwarethemen erhalten weitere Ebenen. Die Zuordnungen verwenden ausschließlich bekannte IDs und vorhandene Eltern; explizite eigene Elternzuordnungen (auch `null`) bleiben erhalten. Ein späteres manuelles Verschieben der Grundlagen-Notizen wird nicht erneut korrigiert. Bestehende Inhalte, Sammlungszugehörigkeiten und Fortschritte werden nicht ersetzt; Seed- und Datenbank-Resets sind dafür nicht erforderlich.

Die Themenstruktur dient der Lernorientierung und behauptet keine vollständige, disjunkte Taxonomie: hybride Vorgehensweisen verbinden prädiktive und agile Praktiken ([PMI](https://www.pmi.org/learning/thought-leadership/series/achieving-greater-agility/spectrum-of-approaches)); Self-Supervised Learning erzeugt Trainingsziele aus den Daten selbst und wird hier als eigener Einstieg neben den übrigen Lernformen angeboten ([IBM](https://www.ibm.com/think/topics/self-supervised-learning)). Querschnittsthemen und weitere Lernformen können im Themeneditor ergänzt und verschoben werden.

`npm run test:hierarchy` prüft die Strukturübernahme mit Speicherfehler und Revisionskonflikt, Projektmanagement-Ebenen, alle vier ML-Lernformen, Themenpfade, Sammlungsgrenzen, Neuladen und mobile Layouts. Es verwendet wie die übrigen Browsertests ausschließlich localhost und die geprüfte lokale SQLite-Datei und stellt den Ausgangsbestand anschließend wieder her.

`npm run test:structure` prüft Sammlungsöffnung und direkten Lernstart, freies Üben zukünftiger Karten, Rücknavigation, Themenfilter inklusive Nachfahren, Themenverschiebung, neue Unterthemen und Notizzuordnung nach Neuladen. Es kontrolliert außerdem 44-Pixel-Bedienelemente und Layouts bei 320, 390, 768 und 1440 Pixeln sowie lange Themenpfade. Wie die Sammlungsprüfung verwendet es `BRAIN_TEST_URL` und `BRAIN_TEST_SQLITE_PATH` für einen isolierten lokalen Bestand und stellt diesen anschließend wieder her.

Für den vorhandenen Bestand sind Projektmanagement, Forschungsmethoden, Künstliche Intelligenz und Softwareentwicklung vorbereitet. Zuordnungen enthalten ausschließlich tatsächlich vorhandene IDs; gespeicherte Änderungen haben Vorrang. Andere Bestände werden anhand ihrer Fachthemen und der ausdrücklich verknüpften Aufgaben vollständig angezeigt. „Sammlung speichern“ übernimmt die vorbereitete Auswahl in den versionierten Arbeitsraum und damit in Sicherungen. Die Anzeige unterscheidet den gesamten Bestand einer Sammlung vom aktuell gefilterten Ausschnitt.

## Lernen mit dem Tutor

Der Tutor führt eine gespeicherte kurze Einheit aus bis zu fünf passenden Karten, höchstens drei Testfragen und einer Rückmeldung aus. Start und Fortsetzung zeigen ausschließlich den gerade vorbereiteten Lernschritt. Karten wechseln nach bestätigter Speicherung; die letzte gespeicherte Testantwort und der Testabschluss verwenden dieselbe Revision. Fehlgeschlagene Speicherungen lassen Antwort und Runde offen. Dezente Übergänge beachten `prefers-reduced-motion`; mobile Aktionen bleiben am Bildschirmrand verankert.

Eine eigene getippte oder diktierte Kartenantwort wird beim Aufdecken kurz mit der Musterantwort verglichen: passende Aussagen und noch fehlende oder widersprüchliche Kernpunkte. Die Rückmeldung wird bei der Kartenbewertung mit der eigenen Antwort optional in `cardReviewEvents.comparison` gespeichert. Sie verändert weder die manuelle Selbsteinschätzung noch das Testergebnis. Ohne erreichbare Tutor-KI erscheinen die eigene Erklärung und ein ausdrücklich als Auszug gekennzeichneter Referenztext; daraus wird keine automatische Inhaltsbewertung abgeleitet.

`npm run test:quiz-completion` prüft automatischen Abschluss bei Übung, Test und Zeitlimit, auch bei anderer Antwortreihenfolge und Speicherfehlern. `test:tutor` beobachtet zusätzlich Zwischenansichten während verzögerter Speicherungen und prüft Wiedereinstieg, Retry, reduzierte Bewegung und Navigation während eines laufenden Starts. Alle Schreibzugriffe bleiben auf localhost mit geprüfter SQLite-Datei begrenzt.

Bestehende Wochenpläne bleiben als kompatible Metadaten erhalten. Das frühere Format „7-Tage-Plan“ verteilte den Lernfokus auf drei Themen pro Tag mit bis zu fünf verknüpften Karten und anschließenden Aufgaben. Die neue Tutor-Oberfläche führt jeweils eine kurze gespeicherte Einheit aus und berücksichtigt die vereinbarte Themenreihenfolge sowie offene oder falsche Antworten.

Gespeicherte Einstiegstests, Zwischenchecks und Abschlusstests früherer Wochenpläne bleiben mit ihren ursprünglichen Aufgaben erhalten. Ein direkter Ergebnisvergleich setzt unveränderte Aufgaben und Bewertungsbedingungen voraus; die Stichprobe ersetzt nicht den Antwortstand aller Themen. `tutorWeek`, `tutorWeekCheckpoint` und `tutorWeekStartedOn` sind optionale Felder im serverseitigen Workspace. Der ursprüngliche Wortlaut dieser Wochenrunden bleibt auch bei der Kürzung älterer Testhistorie erhalten. Eigene Kartenantworten sind optional und werden mit der bestätigten Bewertung gespeichert; der Kurzvergleich ergänzt die weiterhin manuelle Selbsteinschätzung.

`npm run test:tutor-week` prüft Speicherfehler, Wiederöffnen, kurze Kartenrunden, eigene Antworten, Aufgaben und den Testvergleich sowie die Darstellung bei 320/390/1440 Pixeln. Es verlangt localhost und bestätigt die SQLite-Datei vor jeder Datenänderung. Für eine zweite lokale Testinstanz kann `NEWHOPE_ISOLATED_DEV=true` mit einer eigenen `NEWHOPE_SQLITE_PATH` und `npm run dev -- --port 5174` verwendet werden; `AZURE_SQL_SERVER` muss dabei leer sein. Der Test erhält die entsprechende Adresse über `BRAIN_TEST_URL` und die lokale Datei über `BRAIN_TEST_SQLITE_PATH`.

„Tutor“ ist über die Seitenleiste, die mobile Hauptnavigation und „Zum Tutor“ auf der Startseite erreichbar. Eine zentrale Aktion startet den nächsten Lernschritt. Unterbrochene Runden haben Vorrang und werden mit ihrem gespeicherten Stand fortgesetzt. Auch noch nicht fällige Karten können geübt werden. Nach einer über den Tutor gestarteten Einheit führt die Rücknavigation wieder dorthin.

Der persönliche Lernplan speichert ein Lernziel, ein optionales Zieldatum und ein Wochenziel von einem bis sieben Lerntagen. Die Wochenaktivität gilt für den gesamten Lernbestand, unabhängig vom aktuell gewählten Fokus. Gespeicherte Übungsantworten, Antworten abgegebener Tests und Kartenbewertungen zählen als Aktivität; das Öffnen der App oder Starten einer leeren Runde zählt nicht. Kalenderwochen, Zieltermine und Lernserien verwenden Europe/Berlin einschließlich Zeitumstellungen.

Die aufklappbaren Bereiche „Lernbereiche und Grundlagen“ sowie „Ergebnisse und Verlauf“ zeigen den aktuellen Antwortstand und abgeschlossene Runden des Lernfokus. Ein Bereich mit ausschließlich zuletzt richtigen Antworten beschreibt die vorhandenen Aufgaben, keine umfassende Beherrschung des Fachthemas. Die Lernkurve verbindet nur Runden mit identischen Aufgaben, Lösungen, Schwierigkeitsstufen und Bedingungen; unterschiedliche Aufgaben erhalten keinen behaupteten Verbesserungswert. Kartenbewertungen erscheinen separat als Selbsteinschätzung.

Lernplan (`tutorPlan`) und Tageszähler der Kartenbewertungen (`cardReviewDays`, höchstens 3.000 Einträge aus Datum und Sammlung) werden im versionierten Workspace auf dem Server und in Sicherungen gespeichert. Kartenbewertung, Wiederholungstermin und Tageszähler werden atomar gespeichert. Bestehende Sicherungen bleiben ohne diese optionalen Felder gültig. Frühere Kartenwiederholungszähler enthalten keine Bewertungsdaten oder Zeitpunkte und werden deshalb nicht als vergangene Tagesaktivität ausgegeben; die Testaktivität verwendet die vorhandenen gespeicherten Antworten.

`npm run test:tutor` prüft gegen einen lokalen Entwicklungsserver die Planung einschließlich Speicherfehlern, direkte Lernstarts, Wiedereinstieg, Auswertungen, Sammlungsumfang und Darstellung bei 320, 390 und 1.440 Pixeln. Vor Schreibzugriffen bestätigt es den Bestand in der über `BRAIN_TEST_SQLITE_PATH` gewählten SQLite-Datei; `BRAIN_TEST_URL` muss localhost sein. Anschließend wird der Ausgangsbestand wiederhergestellt.

Nach fünf gespeicherten Kartenbewertungen kann der Tutor einen freiwilligen Kurztest mit bis zu drei vorhandenen Aufgaben anbieten. Die Aufgaben müssen ausdrücklich auf die Quellnotizen der gerade geübten Karten verweisen und zum gleichen Lernumfang gehören: der gewählten Sammlung oder dem gesamten Lernbestand. Der Test deckt möglichst mehrere wiederholte Lernbereiche ab; unsicher bewertete Inhalte und seltener verwendete Aufgaben erhalten Vorrang. Ohne passende Verknüpfungen wird kein Test erfunden. „Weiter mit Karten“ stellt das Angebot zurück und speichert die Entscheidung; ein weiteres Angebot benötigt fünf neue Bewertungen. Ein laufender Test wird zuerst fortgesetzt. Die Kartenrunde bleibt beim Wechsel erhalten. Nach dem Kurztest führt „Mit deinen Karten weiterlernen“ direkt zur nächsten gespeicherten Karte.

Die optionalen Felder `cardReviewEvents` und `tutorCheckpointDecisions` speichern die dazu benötigten Bewertungen und Entscheidungen im versionierten Workspace und in Sicherungen. Der Ereignisverlauf enthält höchstens 1.500 Bewertungen; jede Bewertung hält Karten-ID, Sitzung, Sammlung, Quellnotiz, Zeitpunkt, Selbsteinschätzung und einen Fingerabdruck des Wortlauts fest. Ein Testvorschlag verwendet nur Bewertungen der letzten 24 Stunden für unveränderte Karten. Alte Sicherungen erhalten keine erfundenen Einzelbewertungen.

`npm run test:tutor-adaptive` prüft den Kartentest, atomaren Teststart, Speicherfehler, genaue Fortsetzung, gespeicherte Zurückstellung, alte Sicherungen sowie aktuelle und verspätete KI-Antworten. Der Lauf verwendet dieselben localhost- und SQLite-Prüfungen wie die bestehenden Tutor-Browsertests und stellt den Ausgangsbestand wieder her.

### Optional: Azure OpenAI für den Tutor

Die normalen Vorschläge funktionieren ohne LLM. Azure OpenAI bleibt standardmäßig deaktiviert. Eine optionale Laufzeitkomponente kann einen nächsten Schritt aus einer kleinen, serverseitig geprüften Auswahl wählen und die Einladung formulieren. Im Überblick erhält sie Fachthema, Lernbereiche, Zähler zu beantworteten Aufgaben und höchstens drei letzte Testergebnisse des aktuellen Fokus. Jedes Ergebnis enthält ausschließlich die Anzahl richtiger und vorhandener Aufgaben sowie eine Veränderung in Prozentpunkten, wenn eine tatsächlich vergleichbare Runde vorliegt. Hinzu kommen die Anzahl aktiver Lerntage dieser Woche und die aktuelle Lernserie für den gesamten Bestand. Bei einem Kartentest bleibt die Evidenz auf die Anzahl und Selbsteinschätzung der gerade bewerteten Karten und ihre verknüpften Lernbereiche begrenzt. Beide Kontexte können die zeitlichen Planangaben enthalten: Wochenziel, Zieldatum und verbleibende Kalender- bzw. Lerntage; die Berechnung verwendet Europe/Berlin. Vollständige Notizen, Aufgaben, Antworten, persönliche Lernzieltexte, Kontodaten und interne Inhalts-IDs werden nicht übermittelt. Bezeichnungen von Lernsammlungen und Lernbereichen können dennoch persönliche Angaben enthalten; bei Aktivierung geht dieser Überblick an die konfigurierte Azure-OpenAI-Ressource.

Diese Inhaltsbeschränkung gilt für Lernvorschläge. Der neue Antwortvergleich unter `/api/tutor/compare` übermittelt bei aktivierter Tutor-KI ausschließlich die aktuelle Kartenfrage, ihre gespeicherte Musterantwort und die eigene Erklärung an dieselbe konfigurierte Azure-OpenAI-Ressource. Es werden keine Kontodaten, fremden Notizen, übrigen Antworten oder internen IDs übertragen. Der Aufruf fordert `store: false` an. Nur Browser-Sessions mit gültigem Ursprung dürfen den Vergleich anfordern; Revision, aktive Karte und Quelle werden vor und nach dem Aufruf geprüft. Ausgaben sind validierter kurzer Text, keine ausführbaren Aktionen. Ein Besitzer erhält höchstens 60 Vergleiche pro Stunde; Fehler, Zeitlimit oder ausgeschöpfte Kapazität führen zum direkten Referenzvergleich. Die [OpenAI-Dokumentation zu Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses) beschreibt das verwendete Antwortformat.

Nach 1,2 Sekunden Schreibpause wird höchstens ein Entwurf pro aktueller Karte vorbereitet. Beim Aufdecken wird ein laufender oder fertiger Vergleich weiterverwendet; spätere Textänderungen werden erst beim Aufdecken neu verglichen. Die Musterantwort erscheint sofort, auch während die KI noch arbeitet. „Vergleich erneut versuchen“ erlaubt nach einem Fehler einen neuen Versuch mit derselben Eingabe. Gültige KI-Texte werden auf die Anzeigelängen gekürzt; HTML, Links, widersprüchliche und unvollständige Ergebnisse bleiben ausgeschlossen. Nur erfolgreiche KI-Vergleiche werden zwei Minuten lang pro Besitzer und identischem Frage-/Antwortinhalt zwischengespeichert, auch über unverwandte Speicherungen oder eine neue Kartenrunde hinweg. Jede Anfrage prüft weiterhin den aktuellen Lernstand. Die abschließende Prüfung lädt ausschließlich die Revisionsnummer aus der Datenbank und vermeidet einen zweiten Download der ganzen Sammlung.

Für eine ausdrückliche Aktivierung diese App-Einstellungen der Web App setzen:

| Einstellung | Wert / Zweck |
| --- | --- |
| `NEWHOPE_TUTOR_LLM_ENABLED` | Nur der exakte Wert `true` aktiviert externe Tutoraufrufe; weglassen oder `false` deaktiviert sie. |
| `AZURE_OPENAI_ENDPOINT` | HTTPS-Ressourcenadresse, z. B. `https://<ressource>.openai.azure.com`. Auch Azure-Hosts unter `services.ai.azure.com` oder `cognitiveservices.azure.com` sind möglich. |
| `AZURE_OPENAI_API_KEY` | Schlüssel der Ressource; ausschließlich als geheime Servereinstellung hinterlegen. |
| `AZURE_OPENAI_TUTOR_DEPLOYMENT` | Name des vorhandenen Deployments: `gpt-6.1-sol`. Das Deployment muss die Responses API und strukturierte Ausgaben unterstützen. |

Der Server verwendet `POST /openai/v1/responses` mit `api-key`, `store: false`, höchstens 1.024 Ausgabetokens und einem strikten JSON-Schema. Für das Deployment `gpt-6.1-sol` wird `reasoning.effort` auf `low` gesetzt; das Tokenlimit umfasst auch Reasoning. Er akzeptiert ausschließlich einen vorhandenen Kandidaten und einen kurzen Text bis 420 Zeichen. Die Längenbegrenzung wird lokal geprüft, da Azure diesen String-Schlüssel im externen Schema nicht unterstützt. Das LLM hat keine Werkzeuge, erzeugt keine neuen Testfragen und schreibt keine Daten. Die Lernstandrevision wird vor und nach dem Aufruf geprüft; ein inzwischen geänderter Stand ergibt `409`. `/api/tutor` verlangt eine Browser-Session und den gleichen Ursprung. Persönliche Zugangsschlüssel gelten dort nicht.

Gleiche Anfragen eines Kontos werden zusammengefasst und bis zu zwei Minuten zwischengespeichert. Pro Konto ist höchstens ein neuer Aufruf in 30 Sekunden und sind zwölf Aufrufe pro Stunde erlaubt; pro Serverprozess laufen höchstens acht Aufrufe gleichzeitig. Der begrenzte Cache enthält höchstens 500 Konten mit jeweils acht Ergebnissen. Diese Grenzen gelten pro Prozess und beginnen bei einem Neustart neu; für mehrere App-Service-Instanzen sollte zusätzlich ein Azure-Budget bzw. eine zentrale Begrenzung verwendet werden. Fehler, Ablehnung, ungültige Ausgabe oder eine Antwortzeit über 10 Sekunden führen zum normalen Regelvorschlag. Das Lernen wartet im Browser nicht auf Azure OpenAI.

Die Implementierung folgt der [offiziellen Azure-Dokumentation zur Responses API](https://learn.microsoft.com/en-us/rest/api/microsoft-foundry/azureopenai/responses) und den [OpenAI Docs zu strukturierten Ausgaben](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses). `node --experimental-strip-types --test tests/tutor-runtime.test.mjs` prüft die Anbindung ausschließlich mit simulierten Antworten, einschließlich Datenschutzumfang, Revisionen, Zeitlimit, Ablehnung, Cache und Kostenbegrenzung. Dabei erfolgen keine echten LLM-Aufrufe.

## Lernen mit Tests

Unter „Tests & Übungen“ lassen sich eigene Aufgaben für allgemeine Fachthemen anlegen. „Beispiele hinzufügen“ ergänzt einmalig zwölf editierbare Aufgaben zu Projektmanagement (Scrum) und Produktmanagement (Discovery-Risiken) mit Quellen, drei Schwierigkeitsstufen und Rückmeldungen zu typischen Verwechslungen. Bestehende Inhalte werden dabei erhalten; die Beispiele werden nicht automatisch in bestehende Sammlungen eingespielt.

Die Vorbereitung ordnet vorhandene Aufgaben nach Lernbereichen und verknüpft passende Wissensnotizen. Für die bestehende Sammlung zum agilen Projektmanagement sind 16 Einheiten mit 191 Aufgaben und 56 Notizen zugeordnet. Eine Kurzrunde wählt möglichst eine Frage pro Schwierigkeitsstufe und bevorzugt seltener beantwortete Aufgaben. Für Einheiten mit vier bis 30 Aufgaben lässt sich auch der gesamte Fragenbestand üben. Eine vollständig beantwortete und abgeschlossene Vorbereitungsrunde markiert die Einheit als bearbeitet; diese Markierung beschreibt den Arbeitsfortschritt. Ergebnisse und Fortschritt bleiben über die gespeicherten Runden beim Neuladen und in Sicherungen erhalten.

Aufgaben können bis zu vier Lernnotizen über `noteIds` verknüpfen. Die Antworterklärung zeigt bis zu zwei sichere Visualisierungen und öffnet bei Bedarf die vollständigen Notizen. Die vorhandenen Projektmanagement-Aufgaben verwenden geprüfte Zuordnungen zu genau passenden Bild-, Diagramm- oder Vergleichsausschnitten; geänderter Fragenwortlaut oder fehlende Abbildungen lösen keine automatische Zuordnung zu anderen Fachvarianten aus. Im Prüfungsmodus erscheinen Lernmaterial und Lösungen erst nach der Abgabe. Die Ergebnisübersicht animiert den Bewertungsring und zeigt richtige, falsche sowie unbeantwortete Aufgaben. Bei reduzierter Bewegung erscheinen die Werte ohne Animation.

„Adaptiv üben“ gibt nach jeder gespeicherten Antwort eine Erklärung. Die nächste Runde priorisiert zuletzt falsch beantwortete Lernbereiche und wählt Aufgaben auf der passenden Stufe. Zwei richtige Antworten auf mindestens der aktuellen Stufe erhöhen sie um eins; ein Fehler senkt sie um eins. Gibt es zu wenige passende Aufgaben, bleibt die Runde kürzer als die gewünschte Aufgabenanzahl. Das Verfahren verwendet feste Regeln und hinterlegte Hinweise. Es erzeugt keine neuen Aufgaben oder Diagnosen durch KI.

Der Lernstand eines Lernbereichs gilt sammlungsübergreifend; die angezeigte nächste Stufe und die adaptive Aufgabenwahl verwenden denselben gemeinsamen Stand. Historie und Fehlerjournal zeigen die Runden der gewählten Sammlung. Runden aus älteren Sicherungen ohne Sammlungsangabe erscheinen dort, wenn sämtliche damaligen Aufgaben zu dieser Auswahl gehören.

Die Prüfungssimulation mischt die Aufgaben des Fachthemas, lässt gespeicherte Antworten vor der Abgabe ändern und zeigt Lösungen erst am Ende. Nach „Antwort speichern“ folgt sofort die nächste Aufgabe; schlägt das Speichern im Hintergrund fehl, kehrt der Test mit der getroffenen Auswahl zur ersten nicht gespeicherten Aufgabe zurück. Alle richtigen Antworten müssen ausgewählt sein, ohne zusätzliche falsche Antworten; es gibt keine Teilpunkte. Unbeantwortete Aufgaben zählen im Ergebnis als falsch, beeinflussen aber nicht das Lernprofil. Das optionale Zeitlimit bleibt beim Neuladen erhalten; bei Ablauf wird die Runde ausgewertet, sobald die Testansicht geöffnet ist. Ergebnisse sind Lernhilfen und keine offizielle Prüfungsbewertung.

Aufgaben, laufende Runden, Antworten, persönliche Merksätze und Erinnerungen liegen im versionierten Arbeitsraum auf dem Server und sind im JSON-/ZIP-Backup enthalten. Alte Sicherungen erhalten beim validierten Einlesen leere Testfelder. Jede Runde speichert ihre damaligen Aufgaben, damit spätere Bearbeitungen die Auswertung nicht verändern. Vollständig (mit Rückmeldungen, Erklärung und Quelle) bleiben die letzten 5 abgeschlossenen Runden je Fachthema; ältere abgeschlossene Runden werden beim nächsten Speichern auf IDs, Lernbereich, Stufe, richtige Antworten und die eigenen Antworten samt Merksätzen gekürzt. Fragestellung und Antworttexte entfallen nur, solange die Aufgabe mit gleichem Wortlaut und gleicher Lösung in der Sammlung steht; sonst bleiben sie in der Runde. Wird eine solche Aufgabe in der App geändert oder ersetzt, schreibt das Speichern den alten Wortlaut zurück in die Runde. Der Rückblick zeigt Wortlaut, Erklärung und Rückmeldungen der gleichnamigen Aufgabe aus der aktuellen Sammlung, solange deren Lösung unverändert ist, sonst einen Hinweis. Laufende Runden werden nie gekürzt. Höchstens 200 Runden, 1.000 Aufgaben und 100 Erinnerungen passen in das Modell; zusätzlich gilt die bestehende Grenze von 4 MB für den gesamten Arbeitsraum.

Erinnerungen sind in der App sichtbar. Für einen Alarm außerhalb der App kann der gespeicherte Termin als `.ics` exportiert und in einen Kalender importiert werden. Der Termin enthält einen Alarm zehn Minuten vorher; die Benachrichtigung richtet sich nach den Einstellungen des Kalenders. Die Datumseingabe nutzt die Gerätezeitzone, die Anzeige Europe/Berlin und der Export UTC.

Das generierte Second-Brain-Logo liegt in `public/brand/second-brain-mark.png` und wird in Navigation, Login und als Browser-Icon verwendet. Es verbindet zwei abstrakte Gehirnhälften mit einem offenen Buch. Der endgültige Imagegen-Prompt steht in `public/brand/second-brain-mark.prompt.txt`.

Der Produktname lautet Second Brain. Bestehende technische Bezeichner (`newhope_*`, `NEWHOPE_*`, Session-Cookie und SQLite-Pfad) bleiben für die Kompatibilität mit gespeicherten Daten und der Serverkonfiguration erhalten.

## Gemeinsam Wissen pflegen

Neue Inhalte lassen sich über die Oberfläche erfassen. Für vorbereitete Inhalte oder größere Änderungen:

1. Aktuellen Bestand über „Import & Datensicherung“ exportieren.
2. Notizen und Metadaten im JSON bearbeiten. Die IDs bestehender Notizen, Themen und Lernschritte beibehalten.
3. Die validierte Datei importieren und das Ersetzen bewusst bestätigen.

Das Format ist in lib/brain/model.ts beschrieben. Ein Import ersetzt den gesamten Bestand; vorher eine Sicherung aufbewahren. Änderungen an seed.ts beeinflussen ausschließlich neu angelegte Nutzer-Sammlungen.

Der Markdown-Renderer verwendet react-markdown und remark-gfm: Überschriften, Listen, Vergleiche als SVG-Karten, Zitate, Code, Links und private Bilder. Bestehende Markdown-Tabellen werden beim Lesen automatisch als SVG-Karten dargestellt; die gespeicherten Inhalte bleiben erhalten. Bilder über „Bild einfügen“ hochladen; Bildunterschriften stehen im Markdown-Titel. Externe Bilder werden nicht automatisch abgerufen. HTML wird nicht ausgeführt.

„Diagramm einfügen“ legt eine editierbare Mermaid-Vorlage an. Unterstützt sind klassische flowchart/graph-Diagramme, sequenceDiagram und mindmap. HTML, Konfigurationsdirektiven, externe Ressourcen und Bildformen sind ausgeschlossen. Das Ergebnis wird mit DOMPurify bereinigt und als isoliertes SVG-Bild angezeigt.

Die Diagrammvorlage verläuft von oben nach unten, damit sie auch mobil lesbar bleibt. Drei Einstiegsnotizen neuer Sammlungen erklären Verstehen, Verbindungen und Lernplanung zusätzlich mit SVG-Diagrammen. `test:comparisons` prüft die SVG-Vergleiche auf Desktop und bei 320/390 Pixel Breite, lange Wörter, Links, Vorschau, Lernkarten und die neuen Diagramme; lokale Ausgangsdaten werden anschließend wiederhergestellt.

Abbildungen und Diagramme öffnen in Originalgröße. Auf dem Handy nutzt die Ansicht im Hoch- und Querformat den ganzen Bildschirm. Zwei Finger oder die Zoomtasten vergrößern die Grafik; durch Ziehen lassen sich alle Bildränder erreichen. „Einpassen“ zeigt die Übersicht, „Originalgröße anzeigen“ stellt die ursprüngliche Größe wieder her. Beim Drehen bleibt der gewählte Maßstab erhalten; eine eingepasste Grafik wird erneut eingepasst. `test:zoom` prüft echte Touch-Gesten, Bildränder, Originalgröße, Drehung und die Rückkehr zur Vorschau. `test:mobile` prüft zusätzlich Abbildungen, Editor und Navigation von 320 bis 1440 Pixeln; mit `BRAIN_TEST_ENGINE=webkit` läuft diese Prüfung in WebKit.

## Lernen mit Karten

Unter „Lernkarten“ eigene Fragen und Antworten erstellen, oder im Notizleser „Lernkarte erstellen“ wählen. Eine Lernrunde zeigt fällige Karten. Erst nach dem Aufdecken erscheinen die Bewertungen. „Noch üben“ plant zehn Minuten später; „Gewusst“ steigert den Abstand auf 1, 3, 7, 14 und höchstens 30 Tage. Eine neue Runde wird vor der Anzeige gespeichert. Jede Bewertung speichert Kartenfortschritt und nächste Position atomar. Die nächste Karte erscheint sofort; Bewertungen werden in Reihenfolge im Hintergrund gespeichert, höchstens fünf bleiben gleichzeitig unbestätigt. Ein Speicherfehler führt zur ersten nicht gespeicherten Karte zurück, mit aufgedeckter Antwort und eigenem Text, damit sie erneut bewertet werden kann. „Beenden“ pausiert die Runde für den späteren Wiedereinstieg. Ältere Sammlungen ohne Lernkarten bleiben kompatibel. Termine werden in UTC gespeichert und für Europe/Berlin angezeigt.

Karten lassen sich nach Lernsammlung, Fachthema, Suche und Priorität filtern. Die drei Stufen heißen „Kernwissen“ (muss sicher sitzen), „Vertiefung“ (Zusammenhänge und Anwendung) und „Ergänzung“ (weitere Details). Nicht eingestufte Karten bleiben separat sichtbar. Jede Karte zeigt ihre Quellnotiz und die zugehörigen Sammlungen; die Quelle lässt sich auch während einer Lernrunde öffnen. Die Runde verwendet ausschließlich fällige Karten des gewählten Ausschnitts.

Fachbegriffe in Frage und Antwort sind gepunktet unterstrichen. Ein Klick öffnet eine Begriffskarte mit der passenden Abbildung der Notiz (hochgeladene Grafik, Diagramm oder Vergleichsgrafik; weitere Abbildungen lassen sich durchblättern), der Kurzbeschreibung, verwandten Einträgen und „Ganzen Lerninhalt öffnen“. Die Begriffe stammen aus den Notiztiteln: der Teil vor dem Doppelpunkt („Product Vision Board: …“), aufgezählte Begriffe („Velocity und Burndown“), Abkürzungen in Klammern sowie Kurzformen wie „Vision Board“ oder „Impact Map“. Allgemeine Wörter und Begriffe mehrerer Notizen bleiben unverlinkt; jeder Begriff wird pro Kartenseite einmal verlinkt. Vor dem Aufdecken bleibt der Begriff der eigenen Quellnotiz unverlinkt, damit die Vorschau die Antwort nicht vorwegnimmt.

Weitere Begriffe einer Notiz stehen im Notizeditor unter „Details & Verbindungen“ › „Begriffe für Verweise“ (Feld `terms`, höchstens 20): Abkürzungen, Synonyme oder Konzepte, die ein Abschnitt erklärt, etwa „OKR“ oder „Swarming“. Ein so gewählter Begriff hat Vorrang vor einem gleichlautenden Titelteil einer anderen Notiz; wählen zwei Notizen denselben Begriff, bleibt er unverlinkt. Nennt eine Abschnittsüberschrift den Begriff – auch ausgeschrieben, „Objectives and Key Results“ für „OKR“ –, zeigt die Begriffskarte diesen Abschnitt mit seiner Abbildung statt der Kurzbeschreibung der ganzen Notiz. Begriffe, die in einem anderen Fachgebiet etwas anderes bedeuten („Regression“, „Paradigma“), gehören nicht in die Liste.

Für unveränderte Karten des bestehenden Projektmanagement-Bestands sind fachlich geprüfte Stufen als Vorschlag hinterlegt. Sie lassen sich in der Sammlungsansicht gesammelt oder im Karteneditor einzeln übernehmen. Reine Textänderungen übernehmen einen Vorschlag nicht automatisch. Die Priorität beschreibt die Bedeutung des Inhalts unabhängig von Wiederholungsterminen und Lernfortschritt; diese bleiben beim Umgruppieren und Einstufen erhalten. Gespeicherte Sammlungen und Prioritäten werden serverseitig mit Revision geführt und in JSON-/ZIP-Sicherungen mitgenommen. Ältere Sicherungen erhalten beim Einlesen eine leere Sammlungsliste; fehlende Prioritäten bleiben unterstützt.

## Abbildungen sichern

ZIP-Sicherungen enthalten die Wissensdaten sowie hochgeladene Bilder. Beim Import werden die Bilder dem angemeldeten Nutzer neu zugeordnet und ihre Referenzen angepasst. JSON enthält nur Referenzen auf Bilder derselben Umgebung. Fehlende Abbildungen verhindern einen unvollständigen Import oder ZIP-Export. Die Bildsicherung unterstützt bis zu 200 Bilder und insgesamt 64 MB. Bilder bleiben beim Entfernen einer Notiz erhalten, damit andere Verknüpfungen und vorhandene JSON-Sicherungen funktionieren.

## Grenzen

- Maximal 4 MB UTF-8 für Text und Metadaten, 1.000 Notizen, 100 Themen, 100 Lernpfade und 3.000 Lernkarten; maximal 80.000 Zeichen je Notiz. Bilddateien zählen nicht in dieses Textlimit.
- Bilder: höchstens 8 MB und 24 Megapixel. Der Server prüft Format und Abmessungen, der Browser decodiert Uploads und importierte Bilder vor dem Speichern.
- Kein Offline-Modus, keine allgemeinen Dateianhänge und keine automatische externe Recherche.
- Änderungen werden ausdrücklich gespeichert. Bei Verbindungsfehlern bleiben offene Formulare erhalten; beim Verlassen mit ungespeicherten Änderungen erfolgt eine Warnung.
- Die Sammlung bleibt privat; weitere Nutzer erhalten separate Sammlungen, falls der Zugang später erweitert wird.
- Die Verknüpfungskarte zeigt bis zu 40 Notizen; Themenfilter grenzen größere Bestände ein.
- Browser-WebMCP wird nur bei vorhandener Unterstützung registriert: Wissen suchen oder einen ungespeicherten Notizentwurf öffnen. Es ist keine eigene KI-Chatfunktion. Die native WebMCP-Integration benötigt einen unterstützten Browser und konnte in der lokalen Chrome-Umgebung nicht nativ geprüft werden.

## Veröffentlichung

Ein Push auf `main` baut die App mit GitHub Actions (`.github/workflows/main_second-brain.yml`) und deployt sie auf die Azure Web App `second-brain` (Linux, Node 22). Der Workflow prüft vorab, dass die benötigten App-Einstellungen vorhanden sind, und testet danach Anmeldeseite und API.

Die Azure-Anmeldung verwendet OIDC mit den GitHub-Secrets `AZURE_CLIENT_ID`, `AZURE_TENANT_ID` und `AZURE_SUBSCRIPTION_ID`. Die Deployment-Identität erhält die Rolle `Website Contributor` ausschließlich für die Web App in `rg-toolhub-dev-we`. Ihre föderierte Identität vertraut nur dem Branch `main` dieses Repositorys; beim Anlegen oder Umziehen eines Repositorys muss das tatsächliche OIDC-Subject aus den GitHub-Einstellungen übernommen werden, einschließlich unveränderlicher Besitzer- und Repository-IDs, falls aktiviert. Ein Client-Kennwort wird nicht benötigt.

Benötigte App-Einstellungen der Web App:

| Einstellung | Zweck |
| --- | --- |
| `AZURE_SQL_SERVER`, `AZURE_SQL_DATABASE`, `AZURE_SQL_USERNAME`, `AZURE_SQL_PASSWORD` | Datenbankzugang (optional `AZURE_SQL_PORT`, `AZURE_SQL_ENCRYPT`, `AZURE_SQL_TRUST_SERVER_CERTIFICATE`, `AZURE_SQL_CONNECTION_TIMEOUT`) |
| `SESSION_SECRET` | Mindestens 32 zufällige Zeichen zum Signieren der Sessions |
| `NEWHOPE_SETUP_TOKEN` | Einmaliger Einrichtungscode für das erste Konto; wird aus dem GitHub-Secret gleichen Namens gesetzt |

Beim ersten Aufruf zeigt `/login` die Kontoeinrichtung. Sie verlangt den Einrichtungscode und ist gesperrt, sobald ein Konto existiert. Danach die ZIP-Sicherung über „Import & Datensicherung“ einspielen.
