import type { QuizQuestion } from "./model.ts";

const scrum = "https://scrumguides.org/scrum-guide.html";
const discovery = "https://www.svpg.com/four-big-risks/";
function question(id: string, subject: string, concept: string, difficulty: number, prompt: string, options: [string, string, boolean][], explanation: string, source: string): QuizQuestion {
  return { id, subject, concept, difficulty, prompt, options: options.map(([text, feedback], index) => ({ id: "option-" + index, text, feedback })), correctOptionIds: options.flatMap((option, index) => option[2] ? ["option-" + index] : []), explanation, source };
}

// Original practice scenarios. Scrum is one framework within project management;
// SVPG's risk categories are one useful model for product discovery.
export const quizExamples: QuizQuestion[] = [
  question("example-project-goal-1", "Projektmanagement", "Ziel und Umfang in Scrum", 1, "Was beschreibt ein Sprint-Ziel am besten?", [
    ["Ein gemeinsames Ergebnis, auf das der Sprint hinarbeitet.", "Das Ziel gibt den Arbeiten eine gemeinsame Richtung.", true],
    ["Die Anzahl der zu erledigenden Tickets.", "Du setzt eine Arbeitsmenge mit einem Ziel gleich. Frage dich, wozu die Tickets dienen.", false],
    ["Alle geplanten Funktionen für das nächste Jahr.", "Du verwechselst den Horizont eines Sprints mit der längerfristigen Produktplanung.", false],
  ], "Ein Sprint-Ziel beschreibt den Zweck des Sprints. Die ausgewählten Aufgaben unterstützen dieses Ziel.", scrum),
  question("example-project-goal-2", "Projektmanagement", "Ziel und Umfang in Scrum", 2, "Ein Team entwickelt eine Buchungsfunktion. Im Sprint zeigt sich, dass eine geplante Komfortfunktion das Sprint-Ziel nicht unterstützt. Was ist sinnvoll?", [
    ["Den Umfang mit dem Product Owner neu abstimmen und das Sprint-Ziel schützen.", "Die konkrete Arbeit kann angepasst werden, während das gemeinsame Ziel erhalten bleibt.", true],
    ["Jedes ursprünglich ausgewählte Ticket unverändert fertigstellen.", "Du behandelst den Arbeitsplan als unveränderliches Versprechen. Ein Plan muss neue Erkenntnisse berücksichtigen.", false],
    ["Das Sprint-Ziel ohne Abstimmung durch ein beliebiges neues Ziel ersetzen.", "Anpassung des Umfangs bedeutet nicht, die gemeinsame Richtung beliebig auszutauschen.", false],
  ], "In Scrum dürfen neue Erkenntnisse den Umfang verändern. Die Developers klären Änderungen mit dem Product Owner, ohne das Sprint-Ziel zu gefährden.", scrum),
  question("example-project-goal-3", "Projektmanagement", "Ziel und Umfang in Scrum", 3, "Das Sprint-Ziel lautet: Kunden können einen Termin verbindlich buchen. Welche Entscheidungen unterstützen dieses Ziel? Wähle alle passenden Antworten.", [
    ["Eine notwendige Buchungsbestätigung priorisieren.", "Diese Funktion unterstützt das vereinbarte Ergebnis.", true],
    ["Optionale Farbschemata mit dem Product Owner aus dem Sprint-Umfang nehmen.", "Ein verzichtbares Detail kann zugunsten des Ziels neu abgestimmt werden.", true],
    ["Die Buchung streichen, damit möglichst viele kleine Tickets abgeschlossen werden.", "Du optimierst die Ticketzahl statt des vereinbarten Ergebnisses.", false],
  ], "Bewerte Anpassungen daran, ob sie das Sprint-Ziel unterstützen. Die Zahl erledigter Tickets allein zeigt den Nutzen des Sprints nicht.", scrum),
  question("example-project-role-1", "Projektmanagement", "Verantwortung und Abstimmung", 1, "Wer ist in Scrum für die Reihenfolge der Einträge im Product Backlog verantwortlich?", [
    ["Der Product Owner.", "Diese Verantwortung gehört zum Product Backlog Management.", true],
    ["Der Scrum Master allein.", "Du verwechselst die Unterstützung des Scrum-Prozesses mit der Verantwortung für Produktentscheidungen.", false],
    ["Jeder Stakeholder für seine eigenen Wünsche.", "Wünsche brauchen eine gemeinsame Ordnung; sie bilden keine parallelen verbindlichen Prioritäten.", false],
  ], "Der Product Owner verantwortet die Ordnung des Product Backlogs, auch wenn er Aufgaben delegiert.", scrum),
  question("example-project-role-2", "Projektmanagement", "Verantwortung und Abstimmung", 2, "Eine Vertriebsleiterin möchte eine neue Funktion mitten im Sprint sofort einplanen. Wie geht das Team sinnvoll damit um?", [
    ["Den Bedarf mit dem Product Owner klären und Auswirkungen auf das Sprint-Ziel gemeinsam prüfen.", "So fließen neue Informationen ein, ohne das gemeinsame Ziel zu gefährden.", true],
    ["Die lauteste Stakeholder-Stimme bestimmt sofort alle Aufgaben.", "Du verwechselst Einfluss mit der vereinbarten Entscheidungsverantwortung.", false],
    ["Neue Informationen grundsätzlich bis zum nächsten Jahr ignorieren.", "Du verwechselst Zielorientierung mit dem Verbot, neue Erkenntnisse zu berücksichtigen.", false],
  ], "Der Product Owner verantwortet Produktprioritäten. Die Developers planen die Arbeit und stimmen Änderungen des Umfangs mit ihm ab.", scrum),
  question("example-project-role-3", "Projektmanagement", "Verantwortung und Abstimmung", 3, "Welche Zuordnungen stimmen in Scrum? Wähle alle passenden Antworten.", [
    ["Product Owner: Product Backlog wirksam verwalten.", "Der Product Owner verantwortet die Produktordnung.", true],
    ["Developers: den Plan im Sprint Backlog anpassen.", "Die Developers verantworten ihren Arbeitsplan.", true],
    ["Scrum Master: allein alle täglichen Aufgaben verteilen.", "Du interpretierst Prozessunterstützung als Aufgabensteuerung; Scrum setzt auf Selbstmanagement.", false],
  ], "Produktordnung, Arbeitsplanung und Unterstützung des Scrum-Teams sind unterschiedliche Verantwortungen.", scrum),
  question("example-product-value-1", "Produktmanagement", "Nutzen und Bedienbarkeit", 1, "Eine App ist leicht zu bedienen, aber die Zielgruppe möchte sie nicht nutzen. Welches Discovery-Risiko bleibt vor allem offen?", [
    ["Nutzen: Ist die Lösung für die Zielgruppe wertvoll?", "Bedienbarkeit allein belegt keinen Bedarf.", true],
    ["Bedienbarkeit: Findet die Zielgruppe den richtigen Knopf?", "Du setzt leichte Bedienung mit tatsächlichem Nutzen gleich.", false],
    ["Machbarkeit: Kann die Technik grundsätzlich gebaut werden?", "Technische Umsetzbarkeit beantwortet nicht, ob Menschen die Lösung brauchen.", false],
  ], "Das SVPG-Modell unterscheidet vier Risiken. Nutzen und Bedienbarkeit sollten gezielt geprüft werden.", discovery),
  question("example-product-value-2", "Produktmanagement", "Nutzen und Bedienbarkeit", 2, "Fünf Personen bedienen einen Termin-Prototyp problemlos. Welche Aussage ist dadurch am ehesten gestützt?", [
    ["Diese Personen konnten die getesteten Abläufe bedienen.", "Die Beobachtung stützt eine begrenzte Aussage zur Bedienbarkeit.", true],
    ["Der gesamte Markt wird das Produkt kaufen.", "Du generalisierst kleine qualitative Beobachtungen und leitest Kaufbereitschaft aus Bedienung ab.", false],
    ["Das Produkt ist bereits technisch und wirtschaftlich abgesichert.", "Ein Bedienungstest prüft diese Risiken nicht automatisch.", false],
  ], "Ein kleiner Prototypentest liefert Hinweise zu den getesteten Abläufen. Nachfrage, Machbarkeit und Wirtschaftlichkeit brauchen eigene Evidenz.", discovery),
  question("example-product-value-3", "Produktmanagement", "Nutzen und Bedienbarkeit", 3, "Menschen verstehen einen Prototyp, sagen aber, ihr aktuelles Werkzeug genüge. Welche nächsten Schritte sind sinnvoll? Wähle alle passenden Antworten.", [
    ["Das zugrunde liegende Problem und einen möglichen Wechselanreiz untersuchen.", "Das prüft, ob überhaupt ein ausreichender Nutzen besteht.", true],
    ["Konkretes Verhalten statt nur freundlicher Zustimmung beobachten.", "Verhalten liefert zusätzliche Hinweise auf tatsächliches Interesse.", true],
    ["Sofort alle Funktionen bauen, weil der Bedienungstest gut lief.", "Du wertest Evidenz für Bedienbarkeit als Absicherung aller Produktrisiken.", false],
  ], "Wähle Tests passend zur offenen Annahme. Verständliche Bedienung sichert den Nutzwert der Lösung noch nicht ab.", discovery),
  question("example-product-feasible-1", "Produktmanagement", "Machbarkeit und Tragfähigkeit", 1, "Welche Frage prüft vor allem technische Machbarkeit?", [
    ["Kann unser Team diese Lösung mit seinen technischen Möglichkeiten umsetzen?", "Das betrifft die Umsetzung mit vorhandenen Fähigkeiten und Technik.", true],
    ["Passt die Lösung zu unserem Geschäftsmodell?", "Du verwechselst technische Umsetzbarkeit mit geschäftlicher Tragfähigkeit.", false],
    ["Können Kunden den Ablauf verstehen?", "Das ist primär eine Frage der Bedienbarkeit.", false],
  ], "Machbarkeit und geschäftliche Tragfähigkeit sind unterschiedliche Risiken im SVPG-Modell.", discovery),
  question("example-product-feasible-2", "Produktmanagement", "Machbarkeit und Tragfähigkeit", 2, "Eine gewünschte Funktion hängt von einer unklaren Schnittstelle ab. Was prüft die offene Annahme am direktesten?", [
    ["Ein kleiner technischer Versuch mit dem Entwicklungsteam.", "Ein gezielter Versuch liefert Erkenntnisse zur konkreten technischen Unsicherheit.", true],
    ["Noch eine Umfrage zur Lieblingsfarbe der Oberfläche.", "Du wählst eine Methode, die die technische Unsicherheit nicht prüft.", false],
    ["Die Funktion allein aufgrund positiver Nutzerinterviews als machbar einstufen.", "Nutzerbedarf ersetzt keine technische Prüfung.", false],
  ], "Die Prüfmethode sollte zur Unsicherheit passen. Technische Annahmen lassen sich etwa durch begrenzte Versuche untersuchen.", discovery),
  question("example-product-feasible-3", "Produktmanagement", "Machbarkeit und Tragfähigkeit", 3, "Kunden wollen eine Funktion; ein Prototyp ist verständlich. Welche Risiken können dennoch offen sein? Wähle alle passenden Antworten.", [
    ["Ob die Funktion zuverlässig technisch umgesetzt werden kann.", "Nutzen und Bedienbarkeit belegen nicht die technische Machbarkeit.", true],
    ["Ob die Lösung zu Kosten, Geschäftsmodell und geschäftlichen Anforderungen passt.", "Geschäftliche Tragfähigkeit muss zusätzlich geprüft werden.", true],
    ["Keine: Zustimmung und leichte Bedienung sichern jedes Risiko ab.", "Du überträgst Ergebnisse zweier Prüfungen auf ungeprüfte Annahmen.", false],
  ], "Eine Produktentscheidung braucht Evidenz für die relevanten Risiken. Das Modell ist eine Orientierung und ersetzt keine kontextspezifische Prüfung.", discovery),
];
