// Explicit links for the existing project-management question bank.
// Filled from the audited collection; internal IDs remain stable.
export type LearningVisualHint = { noteId: string; kind: "image" | "diagram" | "comparison"; contains: string; imageSignature?: string };
export type CuratedLearningQuestion = { fingerprint: string; noteIds: string[]; visualHints: LearningVisualHint[] };
export const projectManagementLearning: {
  subject: string;
  areas: { concept: string; noteIds: string[] }[];
  questions: Record<string, CuratedLearningQuestion>;
} = {
  "subject": "Agiles Projektmanagement",
  "areas": [
    {
      "concept": "Projekt und Projektmanagement: Grundlagen",
      "noteIds": [
        "agpm1-note-pm-grundlagen",
        "agpm1-note-pm-dreieck",
        "agpm1-note-start",
        "agpm1-note-quellen",
        "agpm1-chapter-planung",
        "pm-note-begriffe-ordnen"
      ]
    },
    {
      "concept": "Projektstart und Stakeholder",
      "noteIds": [
        "agpm1-note-projektauftrag",
        "agpm1-note-klassische-rollen",
        "agpm1-note-stakeholder",
        "agpm1-note-teamsetup"
      ]
    },
    {
      "concept": "Klassische Planung und Projektorganisation",
      "noteIds": [
        "pm-note-klassisch",
        "agpm1-note-projektstrukturplan",
        "agpm1-note-gantt",
        "agpm1-note-werkzeuge",
        "agpm1-note-raci"
      ]
    },
    {
      "concept": "Risiko und Controlling",
      "noteIds": [
        "agpm1-note-risiko",
        "agpm1-note-controlling"
      ]
    },
    {
      "concept": "Agilität und agiles Manifest",
      "noteIds": [
        "agpm1-note-manifest",
        "agpm1-note-being-agile"
      ]
    },
    {
      "concept": "Produktvision und Design Thinking",
      "noteIds": [
        "agpm1-note-produktvision",
        "agpm1-note-visionboard",
        "agpm1-note-designthinking",
        "agpm1-chapter-produkt",
        "produkt-note-dual-track"
      ]
    },
    {
      "concept": "Impact Mapping, Story Mapping und MVP",
      "noteIds": [
        "agpm1-note-impactmapping",
        "agpm1-note-storymapping",
        "agpm1-note-mvp"
      ]
    },
    {
      "concept": "Artefakte, Done und Ready",
      "noteIds": [
        "agpm1-note-anforderungen",
        "agile-note-user-stories-pruefen",
        "agpm1-note-backlog-refinement",
        "agpm1-note-definition-of-done"
      ]
    },
    {
      "concept": "Scrum-Rollen und -Events",
      "noteIds": [
        "agpm1-note-scrum-ueberblick",
        "agpm1-note-sprint-planning",
        "agpm1-note-sprintarbeit-daily",
        "agpm1-note-review-retrospektive",
        "agpm1-chapter-scrum"
      ]
    },
    {
      "concept": "Schätzen, Velocity und Releaseplanung",
      "noteIds": [
        "agpm1-note-story-points",
        "agpm1-note-planning-poker",
        "agpm1-note-velocity-burndown",
        "agpm1-note-releaseplanung"
      ]
    },
    {
      "concept": "Lean Startup und Kanban",
      "noteIds": [
        "agpm1-note-lean-startup",
        "agile-note-kanban"
      ]
    },
    {
      "concept": "Klassisch, agil oder hybrid",
      "noteIds": [
        "pm-note-hybrid",
        "agpm1-note-raci"
      ]
    },
    {
      "concept": "Umfeld, Führung und Management",
      "noteIds": [
        "agpm1-note-megatrends",
        "agpm1-note-vuka",
        "agpm1-note-fuehrungstheorien",
        "agpm1-note-zielorientierte-fuehrung",
        "agpm1-note-management-vopa",
        "agpm1-chapter-fuehrung"
      ]
    },
    {
      "concept": "Menschen und Teams",
      "noteIds": [
        "agpm1-note-menschen-und-teams",
        "agpm1-note-t-shaped",
        "agpm1-note-data-science-nutzen"
      ]
    },
    {
      "concept": "Agile Haltung, Skalierung und Datenprojekte",
      "noteIds": [
        "agpm1-note-being-agile",
        "agpm1-note-agile-skalierung",
        "agpm1-note-produktteams",
        "agpm1-note-agile-datenprojekte",
        "agpm1-note-data-science-nutzen"
      ]
    },
    {
      "concept": "Agile Veranstaltungsformate",
      "noteIds": [
        "agpm1-note-veranstaltungsformate"
      ]
    }
  ],
  "questions": {
    "apm-q-events-01": {
      "fingerprint": "682945eb",
      "noteIds": [
        "agpm1-note-sprint-planning"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-sprint-planning",
          "kind": "image",
          "contains": "/api/media/155e5d43-131f-4399-a3cc-0756149b746c",
          "imageSignature": "![Warum, Was und Wie bilden zusammen das Sprint Backlog; ein Beispiel zeigt die Auswahl von Stories innerhalb eines angenommenen Umfangs von acht Punkten.](/api/media/<image> \"Das Sprintziel leitet die Auswahl. Punkte werden nicht in Stunden umgerechnet.\")"
        }
      ]
    },
    "apm-q-events-02": {
      "fingerprint": "73995e11",
      "noteIds": [
        "agpm1-note-sprintarbeit-daily"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-sprintarbeit-daily",
          "kind": "image",
          "contains": "/api/media/85a8f606-2ae4-43f1-a98f-611d4881b5a5",
          "imageSignature": "![Ein Sprint-Board mit vier Spalten und einer blockierten Aufgabe, an der mehrere Personen gemeinsam arbeiten; daneben drei mögliche Fragen für das Daily Scrum.](/api/media/<image> \"Das Daily dient der Abstimmung auf das Sprintziel, nicht dem Statusbericht. Swarming bündelt Kräfte beim Wichtigsten.\")"
        }
      ]
    },
    "apm-q-events-03": {
      "fingerprint": "bd791bf5",
      "noteIds": [
        "agpm1-note-scrum-ueberblick",
        "agpm1-note-review-retrospektive"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-scrum-ueberblick",
          "kind": "image",
          "contains": "/api/media/ab8d9d6e-a4ec-4d08-8168-70cfea23fe10",
          "imageSignature": "![Planning, laufende Arbeit mit Daily, Review und Retrospektive innerhalb eines Sprints; Feedback verändert das Product Backlog.](/api/media/<image> \"Planning, Daily, Review und Retrospektive gehören zum Sprint. Ein nutzbares Inkrement entsteht während der Arbeit und muss nicht auf das Review warten.\")"
        },
        {
          "noteId": "agpm1-note-review-retrospektive",
          "kind": "comparison",
          "contains": "| | Sprint Review | Sprint Retrospektive |"
        }
      ]
    },
    "apm-q-events-04": {
      "fingerprint": "a414b020",
      "noteIds": [
        "agpm1-note-backlog-refinement"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-backlog-refinement",
          "kind": "image",
          "contains": "/api/media/1e838467-c106-482b-b0d3-595812aadcc0",
          "imageSignature": "![Eine unklare Idee wird in fünf Klärungsschritten zu zwei konkreten Stories; darunter eine mögliche Definition of Ready mit fünf Kriterien.](/api/media/<image> \"Refinement ist eine laufende Aktivität. Die Definition of Ready ist eine optionale Teamvereinbarung und betrifft die Vorbereitung, nicht die Qualität des Ergebnisses.\")"
        }
      ]
    },
    "apm-q-events-05": {
      "fingerprint": "8d48ac78",
      "noteIds": [
        "agpm1-note-sprintarbeit-daily"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-sprintarbeit-daily",
          "kind": "image",
          "contains": "/api/media/85a8f606-2ae4-43f1-a98f-611d4881b5a5",
          "imageSignature": "![Ein Sprint-Board mit vier Spalten und einer blockierten Aufgabe, an der mehrere Personen gemeinsam arbeiten; daneben drei mögliche Fragen für das Daily Scrum.](/api/media/<image> \"Das Daily dient der Abstimmung auf das Sprintziel, nicht dem Statusbericht. Swarming bündelt Kräfte beim Wichtigsten.\")"
        }
      ]
    },
    "apm-q-events-06": {
      "fingerprint": "018acfcf",
      "noteIds": [
        "agpm1-note-sprint-planning"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-sprint-planning",
          "kind": "image",
          "contains": "/api/media/155e5d43-131f-4399-a3cc-0756149b746c",
          "imageSignature": "![Warum, Was und Wie bilden zusammen das Sprint Backlog; ein Beispiel zeigt die Auswahl von Stories innerhalb eines angenommenen Umfangs von acht Punkten.](/api/media/<image> \"Das Sprintziel leitet die Auswahl. Punkte werden nicht in Stunden umgerechnet.\")"
        }
      ]
    },
    "apm-q-events-07": {
      "fingerprint": "13ffc025",
      "noteIds": [
        "agpm1-note-sprint-planning",
        "agpm1-note-backlog-refinement"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-sprint-planning",
          "kind": "image",
          "contains": "/api/media/155e5d43-131f-4399-a3cc-0756149b746c",
          "imageSignature": "![Warum, Was und Wie bilden zusammen das Sprint Backlog; ein Beispiel zeigt die Auswahl von Stories innerhalb eines angenommenen Umfangs von acht Punkten.](/api/media/<image> \"Das Sprintziel leitet die Auswahl. Punkte werden nicht in Stunden umgerechnet.\")"
        },
        {
          "noteId": "agpm1-note-backlog-refinement",
          "kind": "image",
          "contains": "/api/media/1e838467-c106-482b-b0d3-595812aadcc0",
          "imageSignature": "![Eine unklare Idee wird in fünf Klärungsschritten zu zwei konkreten Stories; darunter eine mögliche Definition of Ready mit fünf Kriterien.](/api/media/<image> \"Refinement ist eine laufende Aktivität. Die Definition of Ready ist eine optionale Teamvereinbarung und betrifft die Vorbereitung, nicht die Qualität des Ergebnisses.\")"
        }
      ]
    },
    "apm-q-events-08": {
      "fingerprint": "917bac27",
      "noteIds": [
        "agpm1-note-scrum-ueberblick"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-scrum-ueberblick",
          "kind": "comparison",
          "contains": "| Baustein | Bestandteile |"
        }
      ]
    },
    "apm-q-events-09": {
      "fingerprint": "c6849044",
      "noteIds": [
        "agpm1-note-review-retrospektive"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-review-retrospektive",
          "kind": "image",
          "contains": "/api/media/87791ba7-164d-41d0-820b-f823c5f34aea",
          "imageSignature": "![Sprint Review fragt nach dem Produkt und nächsten Prioritäten; die Retrospektive nach Zusammenarbeit und Prozessverbesserungen.](/api/media/<image> \"Zwei Lernfragen: Was braucht das Produkt als Nächstes? Wie verbessern wir unsere gemeinsame Arbeitsweise?\")"
        }
      ]
    },
    "apm-q-events-10": {
      "fingerprint": "14a922b1",
      "noteIds": [
        "agpm1-note-backlog-refinement",
        "agpm1-note-scrum-ueberblick"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-scrum-ueberblick",
          "kind": "comparison",
          "contains": "| Baustein | Bestandteile |"
        }
      ]
    },
    "apm-q-events-11": {
      "fingerprint": "77851a4a",
      "noteIds": [
        "agpm1-note-sprint-planning"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-sprint-planning",
          "kind": "image",
          "contains": "/api/media/155e5d43-131f-4399-a3cc-0756149b746c",
          "imageSignature": "![Warum, Was und Wie bilden zusammen das Sprint Backlog; ein Beispiel zeigt die Auswahl von Stories innerhalb eines angenommenen Umfangs von acht Punkten.](/api/media/<image> \"Das Sprintziel leitet die Auswahl. Punkte werden nicht in Stunden umgerechnet.\")"
        }
      ]
    },
    "apm-q-events-12": {
      "fingerprint": "7aacbc99",
      "noteIds": [
        "agpm1-note-review-retrospektive",
        "agpm1-note-definition-of-done"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-review-retrospektive",
          "kind": "image",
          "contains": "/api/media/87791ba7-164d-41d0-820b-f823c5f34aea",
          "imageSignature": "![Sprint Review fragt nach dem Produkt und nächsten Prioritäten; die Retrospektive nach Zusammenarbeit und Prozessverbesserungen.](/api/media/<image> \"Zwei Lernfragen: Was braucht das Produkt als Nächstes? Wie verbessern wir unsere gemeinsame Arbeitsweise?\")"
        },
        {
          "noteId": "agpm1-note-definition-of-done",
          "kind": "image",
          "contains": "/api/media/5a06434f-3c74-447f-b434-01694d73ea90",
          "imageSignature": "![Akzeptanzkriterien beschreiben die fachliche Erwartung an eine Story; die Definition of Done beschreibt den gemeinsamen Qualitätsstandard.](/api/media/<image> \"Beide Ebenen müssen zusammenpassen: die konkrete Funktion und die übergreifende Qualität. Die gezeigten Kriterien sind Beispiele, kein allgemeines Qualitätsrezept.\")"
        }
      ]
    },
    "apm-q-events-13": {
      "fingerprint": "24275892",
      "noteIds": [
        "agpm1-note-review-retrospektive"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-review-retrospektive",
          "kind": "image",
          "contains": "/api/media/87791ba7-164d-41d0-820b-f823c5f34aea",
          "imageSignature": "![Sprint Review fragt nach dem Produkt und nächsten Prioritäten; die Retrospektive nach Zusammenarbeit und Prozessverbesserungen.](/api/media/<image> \"Zwei Lernfragen: Was braucht das Produkt als Nächstes? Wie verbessern wir unsere gemeinsame Arbeitsweise?\")"
        }
      ]
    },
    "apm-q-events-14": {
      "fingerprint": "83cc831d",
      "noteIds": [
        "agpm1-note-sprint-planning"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-sprint-planning",
          "kind": "image",
          "contains": "/api/media/155e5d43-131f-4399-a3cc-0756149b746c",
          "imageSignature": "![Warum, Was und Wie bilden zusammen das Sprint Backlog; ein Beispiel zeigt die Auswahl von Stories innerhalb eines angenommenen Umfangs von acht Punkten.](/api/media/<image> \"Das Sprintziel leitet die Auswahl. Punkte werden nicht in Stunden umgerechnet.\")"
        }
      ]
    },
    "apm-q-events-15": {
      "fingerprint": "dc458798",
      "noteIds": [
        "agpm1-note-sprintarbeit-daily"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-sprintarbeit-daily",
          "kind": "image",
          "contains": "/api/media/85a8f606-2ae4-43f1-a98f-611d4881b5a5",
          "imageSignature": "![Ein Sprint-Board mit vier Spalten und einer blockierten Aufgabe, an der mehrere Personen gemeinsam arbeiten; daneben drei mögliche Fragen für das Daily Scrum.](/api/media/<image> \"Das Daily dient der Abstimmung auf das Sprintziel, nicht dem Statusbericht. Swarming bündelt Kräfte beim Wichtigsten.\")"
        }
      ]
    },
    "apm-q-events-16": {
      "fingerprint": "6a174175",
      "noteIds": [
        "agpm1-note-review-retrospektive"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-review-retrospektive",
          "kind": "image",
          "contains": "/api/media/87791ba7-164d-41d0-820b-f823c5f34aea",
          "imageSignature": "![Sprint Review fragt nach dem Produkt und nächsten Prioritäten; die Retrospektive nach Zusammenarbeit und Prozessverbesserungen.](/api/media/<image> \"Zwei Lernfragen: Was braucht das Produkt als Nächstes? Wie verbessern wir unsere gemeinsame Arbeitsweise?\")"
        }
      ]
    },
    "apm-q-artefakte-01": {
      "fingerprint": "7109534f",
      "noteIds": [
        "agpm1-note-definition-of-done"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-definition-of-done",
          "kind": "image",
          "contains": "/api/media/5a06434f-3c74-447f-b434-01694d73ea90",
          "imageSignature": "![Akzeptanzkriterien beschreiben die fachliche Erwartung an eine Story; die Definition of Done beschreibt den gemeinsamen Qualitätsstandard.](/api/media/<image> \"Beide Ebenen müssen zusammenpassen: die konkrete Funktion und die übergreifende Qualität. Die gezeigten Kriterien sind Beispiele, kein allgemeines Qualitätsrezept.\")"
        }
      ]
    },
    "apm-q-artefakte-02": {
      "fingerprint": "2e6ade31",
      "noteIds": [
        "agpm1-note-definition-of-done",
        "agpm1-note-backlog-refinement"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-definition-of-done",
          "kind": "image",
          "contains": "/api/media/5a06434f-3c74-447f-b434-01694d73ea90",
          "imageSignature": "![Akzeptanzkriterien beschreiben die fachliche Erwartung an eine Story; die Definition of Done beschreibt den gemeinsamen Qualitätsstandard.](/api/media/<image> \"Beide Ebenen müssen zusammenpassen: die konkrete Funktion und die übergreifende Qualität. Die gezeigten Kriterien sind Beispiele, kein allgemeines Qualitätsrezept.\")"
        },
        {
          "noteId": "agpm1-note-backlog-refinement",
          "kind": "image",
          "contains": "/api/media/1e838467-c106-482b-b0d3-595812aadcc0",
          "imageSignature": "![Eine unklare Idee wird in fünf Klärungsschritten zu zwei konkreten Stories; darunter eine mögliche Definition of Ready mit fünf Kriterien.](/api/media/<image> \"Refinement ist eine laufende Aktivität. Die Definition of Ready ist eine optionale Teamvereinbarung und betrifft die Vorbereitung, nicht die Qualität des Ergebnisses.\")"
        }
      ]
    },
    "apm-q-artefakte-03": {
      "fingerprint": "336603a7",
      "noteIds": [
        "agpm1-note-definition-of-done"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-definition-of-done",
          "kind": "image",
          "contains": "/api/media/5a06434f-3c74-447f-b434-01694d73ea90",
          "imageSignature": "![Akzeptanzkriterien beschreiben die fachliche Erwartung an eine Story; die Definition of Done beschreibt den gemeinsamen Qualitätsstandard.](/api/media/<image> \"Beide Ebenen müssen zusammenpassen: die konkrete Funktion und die übergreifende Qualität. Die gezeigten Kriterien sind Beispiele, kein allgemeines Qualitätsrezept.\")"
        }
      ]
    },
    "apm-q-artefakte-04": {
      "fingerprint": "e2574f34",
      "noteIds": [
        "agpm1-note-sprintarbeit-daily"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-sprintarbeit-daily",
          "kind": "image",
          "contains": "/api/media/85a8f606-2ae4-43f1-a98f-611d4881b5a5",
          "imageSignature": "![Ein Sprint-Board mit vier Spalten und einer blockierten Aufgabe, an der mehrere Personen gemeinsam arbeiten; daneben drei mögliche Fragen für das Daily Scrum.](/api/media/<image> \"Das Daily dient der Abstimmung auf das Sprintziel, nicht dem Statusbericht. Swarming bündelt Kräfte beim Wichtigsten.\")"
        }
      ]
    },
    "apm-q-artefakte-05": {
      "fingerprint": "cbe38b1f",
      "noteIds": [
        "agpm1-note-backlog-refinement"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-backlog-refinement",
          "kind": "image",
          "contains": "/api/media/1e838467-c106-482b-b0d3-595812aadcc0",
          "imageSignature": "![Eine unklare Idee wird in fünf Klärungsschritten zu zwei konkreten Stories; darunter eine mögliche Definition of Ready mit fünf Kriterien.](/api/media/<image> \"Refinement ist eine laufende Aktivität. Die Definition of Ready ist eine optionale Teamvereinbarung und betrifft die Vorbereitung, nicht die Qualität des Ergebnisses.\")"
        }
      ]
    },
    "apm-q-artefakte-06": {
      "fingerprint": "91904ee9",
      "noteIds": [
        "agpm1-note-definition-of-done",
        "agpm1-note-scrum-ueberblick"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-definition-of-done",
          "kind": "image",
          "contains": "/api/media/5a06434f-3c74-447f-b434-01694d73ea90",
          "imageSignature": "![Akzeptanzkriterien beschreiben die fachliche Erwartung an eine Story; die Definition of Done beschreibt den gemeinsamen Qualitätsstandard.](/api/media/<image> \"Beide Ebenen müssen zusammenpassen: die konkrete Funktion und die übergreifende Qualität. Die gezeigten Kriterien sind Beispiele, kein allgemeines Qualitätsrezept.\")"
        },
        {
          "noteId": "agpm1-note-scrum-ueberblick",
          "kind": "comparison",
          "contains": "| Baustein | Bestandteile |"
        }
      ]
    },
    "apm-q-artefakte-07": {
      "fingerprint": "31196f28",
      "noteIds": [
        "agpm1-note-sprintarbeit-daily",
        "agpm1-note-anforderungen"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-sprintarbeit-daily",
          "kind": "image",
          "contains": "/api/media/85a8f606-2ae4-43f1-a98f-611d4881b5a5",
          "imageSignature": "![Ein Sprint-Board mit vier Spalten und einer blockierten Aufgabe, an der mehrere Personen gemeinsam arbeiten; daneben drei mögliche Fragen für das Daily Scrum.](/api/media/<image> \"Das Daily dient der Abstimmung auf das Sprintziel, nicht dem Statusbericht. Swarming bündelt Kräfte beim Wichtigsten.\")"
        }
      ]
    },
    "apm-q-artefakte-08": {
      "fingerprint": "5b460839",
      "noteIds": [
        "agpm1-note-definition-of-done",
        "agpm1-note-backlog-refinement"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-definition-of-done",
          "kind": "image",
          "contains": "/api/media/5a06434f-3c74-447f-b434-01694d73ea90",
          "imageSignature": "![Akzeptanzkriterien beschreiben die fachliche Erwartung an eine Story; die Definition of Done beschreibt den gemeinsamen Qualitätsstandard.](/api/media/<image> \"Beide Ebenen müssen zusammenpassen: die konkrete Funktion und die übergreifende Qualität. Die gezeigten Kriterien sind Beispiele, kein allgemeines Qualitätsrezept.\")"
        },
        {
          "noteId": "agpm1-note-backlog-refinement",
          "kind": "image",
          "contains": "/api/media/1e838467-c106-482b-b0d3-595812aadcc0",
          "imageSignature": "![Eine unklare Idee wird in fünf Klärungsschritten zu zwei konkreten Stories; darunter eine mögliche Definition of Ready mit fünf Kriterien.](/api/media/<image> \"Refinement ist eine laufende Aktivität. Die Definition of Ready ist eine optionale Teamvereinbarung und betrifft die Vorbereitung, nicht die Qualität des Ergebnisses.\")"
        }
      ]
    },
    "apm-q-artefakte-09": {
      "fingerprint": "91b081c4",
      "noteIds": [
        "agpm1-note-definition-of-done"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-definition-of-done",
          "kind": "image",
          "contains": "/api/media/5a06434f-3c74-447f-b434-01694d73ea90",
          "imageSignature": "![Akzeptanzkriterien beschreiben die fachliche Erwartung an eine Story; die Definition of Done beschreibt den gemeinsamen Qualitätsstandard.](/api/media/<image> \"Beide Ebenen müssen zusammenpassen: die konkrete Funktion und die übergreifende Qualität. Die gezeigten Kriterien sind Beispiele, kein allgemeines Qualitätsrezept.\")"
        }
      ]
    },
    "apm-q-artefakte-10": {
      "fingerprint": "0d8d13a1",
      "noteIds": [
        "agpm1-note-backlog-refinement",
        "agpm1-note-definition-of-done"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-backlog-refinement",
          "kind": "image",
          "contains": "/api/media/1e838467-c106-482b-b0d3-595812aadcc0",
          "imageSignature": "![Eine unklare Idee wird in fünf Klärungsschritten zu zwei konkreten Stories; darunter eine mögliche Definition of Ready mit fünf Kriterien.](/api/media/<image> \"Refinement ist eine laufende Aktivität. Die Definition of Ready ist eine optionale Teamvereinbarung und betrifft die Vorbereitung, nicht die Qualität des Ergebnisses.\")"
        },
        {
          "noteId": "agpm1-note-definition-of-done",
          "kind": "image",
          "contains": "/api/media/5a06434f-3c74-447f-b434-01694d73ea90",
          "imageSignature": "![Akzeptanzkriterien beschreiben die fachliche Erwartung an eine Story; die Definition of Done beschreibt den gemeinsamen Qualitätsstandard.](/api/media/<image> \"Beide Ebenen müssen zusammenpassen: die konkrete Funktion und die übergreifende Qualität. Die gezeigten Kriterien sind Beispiele, kein allgemeines Qualitätsrezept.\")"
        }
      ]
    },
    "apm-q-artefakte-11": {
      "fingerprint": "1fd9f58a",
      "noteIds": [
        "agpm1-note-sprintarbeit-daily",
        "agpm1-note-anforderungen"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-sprintarbeit-daily",
          "kind": "image",
          "contains": "/api/media/85a8f606-2ae4-43f1-a98f-611d4881b5a5",
          "imageSignature": "![Ein Sprint-Board mit vier Spalten und einer blockierten Aufgabe, an der mehrere Personen gemeinsam arbeiten; daneben drei mögliche Fragen für das Daily Scrum.](/api/media/<image> \"Das Daily dient der Abstimmung auf das Sprintziel, nicht dem Statusbericht. Swarming bündelt Kräfte beim Wichtigsten.\")"
        }
      ]
    },
    "apm-q-artefakte-12": {
      "fingerprint": "3ac82f42",
      "noteIds": [
        "agpm1-note-definition-of-done"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-definition-of-done",
          "kind": "image",
          "contains": "/api/media/5a06434f-3c74-447f-b434-01694d73ea90",
          "imageSignature": "![Akzeptanzkriterien beschreiben die fachliche Erwartung an eine Story; die Definition of Done beschreibt den gemeinsamen Qualitätsstandard.](/api/media/<image> \"Beide Ebenen müssen zusammenpassen: die konkrete Funktion und die übergreifende Qualität. Die gezeigten Kriterien sind Beispiele, kein allgemeines Qualitätsrezept.\")"
        }
      ]
    },
    "apm-q-artefakte-13": {
      "fingerprint": "3a8604da",
      "noteIds": [
        "agpm1-note-definition-of-done",
        "agpm1-note-review-retrospektive"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-definition-of-done",
          "kind": "image",
          "contains": "/api/media/5a06434f-3c74-447f-b434-01694d73ea90",
          "imageSignature": "![Akzeptanzkriterien beschreiben die fachliche Erwartung an eine Story; die Definition of Done beschreibt den gemeinsamen Qualitätsstandard.](/api/media/<image> \"Beide Ebenen müssen zusammenpassen: die konkrete Funktion und die übergreifende Qualität. Die gezeigten Kriterien sind Beispiele, kein allgemeines Qualitätsrezept.\")"
        },
        {
          "noteId": "agpm1-note-review-retrospektive",
          "kind": "image",
          "contains": "/api/media/87791ba7-164d-41d0-820b-f823c5f34aea",
          "imageSignature": "![Sprint Review fragt nach dem Produkt und nächsten Prioritäten; die Retrospektive nach Zusammenarbeit und Prozessverbesserungen.](/api/media/<image> \"Zwei Lernfragen: Was braucht das Produkt als Nächstes? Wie verbessern wir unsere gemeinsame Arbeitsweise?\")"
        }
      ]
    },
    "apm-q-artefakte-14": {
      "fingerprint": "1bfd40e3",
      "noteIds": [
        "agpm1-note-backlog-refinement"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-backlog-refinement",
          "kind": "image",
          "contains": "/api/media/1e838467-c106-482b-b0d3-595812aadcc0",
          "imageSignature": "![Eine unklare Idee wird in fünf Klärungsschritten zu zwei konkreten Stories; darunter eine mögliche Definition of Ready mit fünf Kriterien.](/api/media/<image> \"Refinement ist eine laufende Aktivität. Die Definition of Ready ist eine optionale Teamvereinbarung und betrifft die Vorbereitung, nicht die Qualität des Ergebnisses.\")"
        }
      ]
    },
    "apm-q-schaetzen-01": {
      "fingerprint": "f241af11",
      "noteIds": [
        "agpm1-note-velocity-burndown"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-velocity-burndown",
          "kind": "image",
          "contains": "/api/media/bc23aab1-3d3e-4ed3-8eb2-2a012c1cbd9f",
          "imageSignature": "![Links ein Säulendiagramm mit 18, 21 und 20 erledigten Punkten und einem Durchschnitt von etwa 20; rechts ein Burndown, der lange flach verläuft und spät steil fällt.](/api/media/<image> \"Velocity blickt zurück, der Burndown zeigt offene Arbeit. Die Linie allein beweist keine Ursache.\")"
        }
      ]
    },
    "apm-q-schaetzen-02": {
      "fingerprint": "592b4856",
      "noteIds": [
        "agpm1-note-planning-poker"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-planning-poker",
          "kind": "image",
          "contains": "/api/media/b99f42e2-1867-4167-91bd-0d7112e899e7",
          "imageSignature": "![Fibonacci-Karten von 1 bis 21 und eine Pause-Karte; in Runde 1 schätzen fünf Personen 3, 5, 5, 5 und 13, die Extreme erklären ihre Annahmen; in Runde 2 einigt sich das Team auf 5 Punkte.](/api/media/<image> \"Nicht mitteln: Die Gründe hinter den Extremen sind die eigentliche Information. Die sichtbaren Karten sind individuelle Vorschläge; die gemeinsamen 5 Punkte werden nach dem Gespräch vereinbart. Das Beispiel zeigt keine Mittelwert- oder Mehrheitswahlregel.\")"
        }
      ]
    },
    "apm-q-schaetzen-03": {
      "fingerprint": "ed59d6fe",
      "noteIds": [
        "agpm1-note-story-points"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-story-points",
          "kind": "diagram",
          "contains": "A[\"Referenzstory wählen\"]"
        }
      ]
    },
    "apm-q-schaetzen-04": {
      "fingerprint": "a5d45a94",
      "noteIds": [
        "agpm1-note-velocity-burndown"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-velocity-burndown",
          "kind": "image",
          "contains": "/api/media/bc23aab1-3d3e-4ed3-8eb2-2a012c1cbd9f",
          "imageSignature": "![Links ein Säulendiagramm mit 18, 21 und 20 erledigten Punkten und einem Durchschnitt von etwa 20; rechts ein Burndown, der lange flach verläuft und spät steil fällt.](/api/media/<image> \"Velocity blickt zurück, der Burndown zeigt offene Arbeit. Die Linie allein beweist keine Ursache.\")"
        }
      ]
    },
    "apm-q-schaetzen-05": {
      "fingerprint": "a3b2f50a",
      "noteIds": [
        "agpm1-note-planning-poker"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-planning-poker",
          "kind": "image",
          "contains": "/api/media/b99f42e2-1867-4167-91bd-0d7112e899e7",
          "imageSignature": "![Fibonacci-Karten von 1 bis 21 und eine Pause-Karte; in Runde 1 schätzen fünf Personen 3, 5, 5, 5 und 13, die Extreme erklären ihre Annahmen; in Runde 2 einigt sich das Team auf 5 Punkte.](/api/media/<image> \"Nicht mitteln: Die Gründe hinter den Extremen sind die eigentliche Information. Die sichtbaren Karten sind individuelle Vorschläge; die gemeinsamen 5 Punkte werden nach dem Gespräch vereinbart. Das Beispiel zeigt keine Mittelwert- oder Mehrheitswahlregel.\")"
        }
      ]
    },
    "apm-q-schaetzen-06": {
      "fingerprint": "ed743c39",
      "noteIds": [
        "agpm1-note-releaseplanung"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-releaseplanung",
          "kind": "image",
          "contains": "/api/media/95cbcd33-e478-4e4b-b8fc-9b77333d743f",
          "imageSignature": "![Rechnung: 100 Story Points geteilt durch 20 pro Sprint ergibt 5 Sprints oder 10 Wochen; die ersten drei Sprints markieren den MVP-Umfang, darunter Faktoren, die die Prognose verschieben.](/api/media/<image> \"Eine vereinfachte Prognose unter stabilen Annahmen, kein Liefervertrag. Annahmen regelmäßig überprüfen.\")"
        }
      ]
    },
    "apm-q-schaetzen-07": {
      "fingerprint": "792a4435",
      "noteIds": [
        "agpm1-note-velocity-burndown"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-velocity-burndown",
          "kind": "image",
          "contains": "/api/media/bc23aab1-3d3e-4ed3-8eb2-2a012c1cbd9f",
          "imageSignature": "![Links ein Säulendiagramm mit 18, 21 und 20 erledigten Punkten und einem Durchschnitt von etwa 20; rechts ein Burndown, der lange flach verläuft und spät steil fällt.](/api/media/<image> \"Velocity blickt zurück, der Burndown zeigt offene Arbeit. Die Linie allein beweist keine Ursache.\")"
        }
      ]
    },
    "apm-q-schaetzen-08": {
      "fingerprint": "ec9b2339",
      "noteIds": [
        "agpm1-note-story-points"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-story-points",
          "kind": "diagram",
          "contains": "A[\"Referenzstory wählen\"]"
        }
      ]
    },
    "apm-q-schaetzen-09": {
      "fingerprint": "4ae11ebb",
      "noteIds": [
        "agpm1-note-planning-poker"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-planning-poker",
          "kind": "diagram",
          "contains": "C[\"Verdeckt schätzen\"]"
        }
      ]
    },
    "apm-q-schaetzen-10": {
      "fingerprint": "34a45d00",
      "noteIds": [
        "agpm1-note-velocity-burndown",
        "agpm1-note-releaseplanung"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-velocity-burndown",
          "kind": "image",
          "contains": "/api/media/bc23aab1-3d3e-4ed3-8eb2-2a012c1cbd9f",
          "imageSignature": "![Links ein Säulendiagramm mit 18, 21 und 20 erledigten Punkten und einem Durchschnitt von etwa 20; rechts ein Burndown, der lange flach verläuft und spät steil fällt.](/api/media/<image> \"Velocity blickt zurück, der Burndown zeigt offene Arbeit. Die Linie allein beweist keine Ursache.\")"
        },
        {
          "noteId": "agpm1-note-releaseplanung",
          "kind": "image",
          "contains": "/api/media/95cbcd33-e478-4e4b-b8fc-9b77333d743f",
          "imageSignature": "![Rechnung: 100 Story Points geteilt durch 20 pro Sprint ergibt 5 Sprints oder 10 Wochen; die ersten drei Sprints markieren den MVP-Umfang, darunter Faktoren, die die Prognose verschieben.](/api/media/<image> \"Eine vereinfachte Prognose unter stabilen Annahmen, kein Liefervertrag. Annahmen regelmäßig überprüfen.\")"
        }
      ]
    },
    "apm-q-schaetzen-11": {
      "fingerprint": "4f2669ad",
      "noteIds": [
        "agpm1-note-velocity-burndown"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-velocity-burndown",
          "kind": "image",
          "contains": "/api/media/bc23aab1-3d3e-4ed3-8eb2-2a012c1cbd9f",
          "imageSignature": "![Links ein Säulendiagramm mit 18, 21 und 20 erledigten Punkten und einem Durchschnitt von etwa 20; rechts ein Burndown, der lange flach verläuft und spät steil fällt.](/api/media/<image> \"Velocity blickt zurück, der Burndown zeigt offene Arbeit. Die Linie allein beweist keine Ursache.\")"
        }
      ]
    },
    "apm-q-schaetzen-12": {
      "fingerprint": "b193160c",
      "noteIds": [
        "agpm1-note-releaseplanung"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-releaseplanung",
          "kind": "image",
          "contains": "/api/media/95cbcd33-e478-4e4b-b8fc-9b77333d743f",
          "imageSignature": "![Rechnung: 100 Story Points geteilt durch 20 pro Sprint ergibt 5 Sprints oder 10 Wochen; die ersten drei Sprints markieren den MVP-Umfang, darunter Faktoren, die die Prognose verschieben.](/api/media/<image> \"Eine vereinfachte Prognose unter stabilen Annahmen, kein Liefervertrag. Annahmen regelmäßig überprüfen.\")"
        }
      ]
    },
    "apm-q-schaetzen-13": {
      "fingerprint": "b57d285a",
      "noteIds": [
        "agpm1-note-releaseplanung"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-releaseplanung",
          "kind": "image",
          "contains": "/api/media/95cbcd33-e478-4e4b-b8fc-9b77333d743f",
          "imageSignature": "![Rechnung: 100 Story Points geteilt durch 20 pro Sprint ergibt 5 Sprints oder 10 Wochen; die ersten drei Sprints markieren den MVP-Umfang, darunter Faktoren, die die Prognose verschieben.](/api/media/<image> \"Eine vereinfachte Prognose unter stabilen Annahmen, kein Liefervertrag. Annahmen regelmäßig überprüfen.\")"
        }
      ]
    },
    "apm-q-schaetzen-14": {
      "fingerprint": "89509aa0",
      "noteIds": [
        "agpm1-note-releaseplanung"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-releaseplanung",
          "kind": "image",
          "contains": "/api/media/95cbcd33-e478-4e4b-b8fc-9b77333d743f",
          "imageSignature": "![Rechnung: 100 Story Points geteilt durch 20 pro Sprint ergibt 5 Sprints oder 10 Wochen; die ersten drei Sprints markieren den MVP-Umfang, darunter Faktoren, die die Prognose verschieben.](/api/media/<image> \"Eine vereinfachte Prognose unter stabilen Annahmen, kein Liefervertrag. Annahmen regelmäßig überprüfen.\")"
        }
      ]
    },
    "apm-q-schaetzen-15": {
      "fingerprint": "9cbb655d",
      "noteIds": [
        "agpm1-note-sprint-planning",
        "agpm1-note-story-points"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-sprint-planning",
          "kind": "image",
          "contains": "/api/media/155e5d43-131f-4399-a3cc-0756149b746c",
          "imageSignature": "![Warum, Was und Wie bilden zusammen das Sprint Backlog; ein Beispiel zeigt die Auswahl von Stories innerhalb eines angenommenen Umfangs von acht Punkten.](/api/media/<image> \"Das Sprintziel leitet die Auswahl. Punkte werden nicht in Stunden umgerechnet.\")"
        },
        {
          "noteId": "agpm1-note-story-points",
          "kind": "comparison",
          "contains": "| Aufgabe der Vereins-App | Beispielschätzung |"
        }
      ]
    },
    "apm-q-vision-01": {
      "fingerprint": "14f9fbe1",
      "noteIds": [
        "agpm1-note-visionboard"
      ],
      "visualHints": []
    },
    "apm-q-vision-02": {
      "fingerprint": "d68a4832",
      "noteIds": [
        "agpm1-note-designthinking"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-designthinking",
          "kind": "comparison",
          "contains": "| Empathize: Bedürfnisse verstehen | Ideate: Lösungen öffnen |"
        }
      ]
    },
    "apm-q-vision-03": {
      "fingerprint": "0c96a50b",
      "noteIds": [
        "agpm1-note-designthinking"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-designthinking",
          "kind": "image",
          "contains": "/api/media/f931549d-5bfe-4a6a-b2c6-0761cdb402a7",
          "imageSignature": "![Zwei Rauten für Problemraum und Lösungsraum mit den Phasen Empathize, Define, Ideate, Prototype, Test und Implement; darunter das Beispiel Lara von der Beobachtung über eine Wie-können-wir-Frage zu mehreren Ideen.](/api/media/<image> \"Erst verstehen und das Problem fassen, dann viele Ideen öffnen und prüfen. Rücksprünge gehören dazu.\")"
        }
      ]
    },
    "apm-q-vision-04": {
      "fingerprint": "5c3e958e",
      "noteIds": [
        "agpm1-note-produktvision"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-produktvision",
          "kind": "image",
          "contains": "/api/media/ab0dce5e-6d77-4596-a88c-0241b3977fd5",
          "imageSignature": "![Produktvision, Impact Map, Story Map und MVP beantworten vier Fragen; eine Feedbackschleife führt zu neuen Annahmen.](/api/media/<image> \"Redaktionelle Lernlandkarte: Richtung, erwartete Wirkung, Nutzerweg und erster sinnvoller Umfang. Die Ansätze können wiederholt und kombiniert werden.\")"
        }
      ]
    },
    "apm-q-vision-05": {
      "fingerprint": "57eddb54",
      "noteIds": [
        "agpm1-note-designthinking"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-designthinking",
          "kind": "comparison",
          "contains": "| Empathize: Bedürfnisse verstehen | Ideate: Lösungen öffnen |"
        }
      ]
    },
    "apm-q-vision-06": {
      "fingerprint": "147cc630",
      "noteIds": [
        "agpm1-note-produktvision"
      ],
      "visualHints": []
    },
    "apm-q-vision-07": {
      "fingerprint": "ba01223d",
      "noteIds": [
        "agpm1-note-produktvision"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-produktvision",
          "kind": "image",
          "contains": "/api/media/ab0dce5e-6d77-4596-a88c-0241b3977fd5",
          "imageSignature": "![Produktvision, Impact Map, Story Map und MVP beantworten vier Fragen; eine Feedbackschleife führt zu neuen Annahmen.](/api/media/<image> \"Redaktionelle Lernlandkarte: Richtung, erwartete Wirkung, Nutzerweg und erster sinnvoller Umfang. Die Ansätze können wiederholt und kombiniert werden.\")"
        }
      ]
    },
    "apm-q-vision-08": {
      "fingerprint": "e19ca4fd",
      "noteIds": [
        "agpm1-note-designthinking"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-designthinking",
          "kind": "comparison",
          "contains": "| Empathize: Bedürfnisse verstehen | Ideate: Lösungen öffnen |"
        }
      ]
    },
    "apm-q-vision-09": {
      "fingerprint": "f01afe7e",
      "noteIds": [
        "agpm1-note-designthinking"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-designthinking",
          "kind": "image",
          "contains": "/api/media/f931549d-5bfe-4a6a-b2c6-0761cdb402a7",
          "imageSignature": "![Zwei Rauten für Problemraum und Lösungsraum mit den Phasen Empathize, Define, Ideate, Prototype, Test und Implement; darunter das Beispiel Lara von der Beobachtung über eine Wie-können-wir-Frage zu mehreren Ideen.](/api/media/<image> \"Erst verstehen und das Problem fassen, dann viele Ideen öffnen und prüfen. Rücksprünge gehören dazu.\")"
        }
      ]
    },
    "apm-q-vision-10": {
      "fingerprint": "813becd7",
      "noteIds": [
        "agpm1-note-produktvision"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-produktvision",
          "kind": "image",
          "contains": "/api/media/ab0dce5e-6d77-4596-a88c-0241b3977fd5",
          "imageSignature": "![Produktvision, Impact Map, Story Map und MVP beantworten vier Fragen; eine Feedbackschleife führt zu neuen Annahmen.](/api/media/<image> \"Redaktionelle Lernlandkarte: Richtung, erwartete Wirkung, Nutzerweg und erster sinnvoller Umfang. Die Ansätze können wiederholt und kombiniert werden.\")"
        }
      ]
    },
    "apm-q-vision-11": {
      "fingerprint": "9490b68f",
      "noteIds": [
        "agpm1-note-visionboard"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-visionboard",
          "kind": "comparison",
          "contains": "| Feld | Leitfrage |"
        }
      ]
    },
    "apm-q-mapping-01": {
      "fingerprint": "d9320c22",
      "noteIds": [
        "agpm1-note-storymapping",
        "agpm1-note-mvp"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-storymapping",
          "kind": "comparison",
          "contains": "| Epic (Aktivität) | Story im MVP (eine pro Epic) | Weitere Story |"
        },
        {
          "noteId": "agpm1-note-mvp",
          "kind": "diagram",
          "contains": "A[\"Nutzeraufgabe klären\"]"
        }
      ]
    },
    "apm-q-mapping-02": {
      "fingerprint": "77c85938",
      "noteIds": [
        "agpm1-note-impactmapping"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-impactmapping",
          "kind": "diagram",
          "contains": "A[\"Ziel: Mitglieder binden\"]"
        }
      ]
    },
    "apm-q-mapping-03": {
      "fingerprint": "16ebc22b",
      "noteIds": [
        "agpm1-note-storymapping"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-storymapping",
          "kind": "comparison",
          "contains": "| Epic (Aktivität) | Story im MVP (eine pro Epic) | Weitere Story |"
        }
      ]
    },
    "apm-q-mapping-04": {
      "fingerprint": "99e010e5",
      "noteIds": [
        "agpm1-note-impactmapping"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-impactmapping",
          "kind": "diagram",
          "contains": "A[\"Ziel: Mitglieder binden\"]"
        }
      ]
    },
    "apm-q-mapping-05": {
      "fingerprint": "40e017d1",
      "noteIds": [
        "agpm1-note-impactmapping"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-impactmapping",
          "kind": "diagram",
          "contains": "A[\"Ziel: Mitglieder binden\"]"
        }
      ]
    },
    "apm-q-mapping-06": {
      "fingerprint": "37b83c03",
      "noteIds": [
        "agpm1-note-projektstrukturplan",
        "agpm1-note-storymapping"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-projektstrukturplan",
          "kind": "image",
          "contains": "/api/media/42ed861a-ed93-4b61-b772-59387de5092d",
          "imageSignature": "![Links gliedert ein Projektstrukturbaum die Aufgaben eines Teamtags; rechts ordnen Gantt-Balken dieselben Aufgaben beispielhaften Wochen zu.](/api/media/<image> \"Redaktionelles Beispiel: Der PSP beschreibt den Arbeitsumfang, Gantt ergänzt Zeitlage und Abhängigkeiten. Baumkanten sind keine zeitlichen Abhängigkeiten.\")"
        },
        {
          "noteId": "agpm1-note-storymapping",
          "kind": "comparison",
          "contains": "| Epic (Aktivität) | Story im MVP (eine pro Epic) | Weitere Story |"
        }
      ]
    },
    "apm-q-mapping-07": {
      "fingerprint": "0a41d8f0",
      "noteIds": [
        "agpm1-note-storymapping"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-storymapping",
          "kind": "comparison",
          "contains": "| Epic (Aktivität) | Story im MVP (eine pro Epic) | Weitere Story |"
        }
      ]
    },
    "apm-q-mapping-08": {
      "fingerprint": "538196b6",
      "noteIds": [
        "agpm1-note-impactmapping"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-impactmapping",
          "kind": "diagram",
          "contains": "A[\"Ziel: Mitglieder binden\"]"
        }
      ]
    },
    "apm-q-mapping-09": {
      "fingerprint": "25078531",
      "noteIds": [
        "agpm1-note-mvp",
        "agpm1-note-storymapping"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-mvp",
          "kind": "diagram",
          "contains": "A[\"Nutzeraufgabe klären\"]"
        },
        {
          "noteId": "agpm1-note-storymapping",
          "kind": "comparison",
          "contains": "| Epic (Aktivität) | Story im MVP (eine pro Epic) | Weitere Story |"
        }
      ]
    },
    "apm-q-start-01": {
      "fingerprint": "0fd659d1",
      "noteIds": [
        "agpm1-note-stakeholder"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-stakeholder",
          "kind": "image",
          "contains": "/api/media/0abd08bd-ec87-49bf-9266-bbb8d98b3a8d",
          "imageSignature": "![Stakeholder-Matrix mit Interesse auf der waagerechten und Einfluss auf der senkrechten Achse sowie vier Kommunikationsstrategien.](/api/media/<image> \"Einfluss und Interesse bestimmen den aktuellen Kommunikationsbedarf. Positionen regelmäßig überprüfen; geringer Einfluss heißt nicht unwichtig.\")"
        }
      ]
    },
    "apm-q-start-02": {
      "fingerprint": "fdf4cae7",
      "noteIds": [
        "agpm1-note-projektauftrag"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-projektauftrag",
          "kind": "comparison",
          "contains": "| Inhalt | Leitfrage |"
        }
      ]
    },
    "apm-q-start-03": {
      "fingerprint": "c4260214",
      "noteIds": [
        "agpm1-note-projektauftrag"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-projektauftrag",
          "kind": "image",
          "contains": "/api/media/eca42bf4-bcb3-4beb-ba67-b97f40a94be5",
          "imageSignature": "![Sechs Klärungsfelder eines Projektauftrags – Kurzbeschreibung, Ziele und Nicht-Ziele, Organisation, Zeitplan, Budget, Rahmen und Risiken – münden in Abstimmung und Freigabe.](/api/media/<image> \"Der Auftrag macht Ergebnis, Mittel und Bedingungen verbindlich. Auch agile Vorhaben brauchen diesen Rahmen; Details entwickeln sich iterativ.\")"
        }
      ]
    },
    "apm-q-start-04": {
      "fingerprint": "02299a88",
      "noteIds": [
        "agpm1-note-projektauftrag",
        "agpm1-note-teamsetup"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-projektauftrag",
          "kind": "image",
          "contains": "/api/media/eca42bf4-bcb3-4beb-ba67-b97f40a94be5",
          "imageSignature": "![Sechs Klärungsfelder eines Projektauftrags – Kurzbeschreibung, Ziele und Nicht-Ziele, Organisation, Zeitplan, Budget, Rahmen und Risiken – münden in Abstimmung und Freigabe.](/api/media/<image> \"Der Auftrag macht Ergebnis, Mittel und Bedingungen verbindlich. Auch agile Vorhaben brauchen diesen Rahmen; Details entwickeln sich iterativ.\")"
        },
        {
          "noteId": "agpm1-note-teamsetup",
          "kind": "image",
          "contains": "/api/media/a773c45d-74bc-474a-9e66-1d532902e75a",
          "imageSignature": "![Acht Schritte zum arbeitsfähigen Team: Rahmen, Rollen, Besetzung, Onboarding, Arbeitsweise, Zugänge, Stakeholder und erstes Backlog, jeweils mit Ergebnis.](/api/media/<image> \"Eine Orientierung für den Teamstart, keine offizielle Scrum-Phase. Schritte können parallel laufen.\")"
        }
      ]
    },
    "apm-q-start-05": {
      "fingerprint": "69f5119f",
      "noteIds": [
        "agpm1-note-stakeholder"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-stakeholder",
          "kind": "image",
          "contains": "/api/media/0abd08bd-ec87-49bf-9266-bbb8d98b3a8d",
          "imageSignature": "![Stakeholder-Matrix mit Interesse auf der waagerechten und Einfluss auf der senkrechten Achse sowie vier Kommunikationsstrategien.](/api/media/<image> \"Einfluss und Interesse bestimmen den aktuellen Kommunikationsbedarf. Positionen regelmäßig überprüfen; geringer Einfluss heißt nicht unwichtig.\")"
        }
      ]
    },
    "apm-q-start-06": {
      "fingerprint": "2337c3ac",
      "noteIds": [
        "agpm1-note-klassische-rollen"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-klassische-rollen",
          "kind": "image",
          "contains": "/api/media/5f516186-e5b2-4a53-8345-e168ea41189e",
          "imageSignature": "![Organigramm von Auftraggeber über Lenkungsausschuss, Projektleitung und Teilprojektleitung bis zu den Arbeitspaketverantwortlichen, gruppiert nach Entscheiden, Steuern und Ausführen; ein Sounding Board berät die Projektleitung. Daneben unterschiedliche Interessen bei einer Softwareeinführung.](/api/media/<image> \"Vereinfachtes Modell für größere Projekte. Das Sounding Board berät, es weist nicht an.\")"
        }
      ]
    },
    "apm-q-start-07": {
      "fingerprint": "90a2050c",
      "noteIds": [
        "agpm1-note-teamsetup"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-teamsetup",
          "kind": "image",
          "contains": "/api/media/a773c45d-74bc-474a-9e66-1d532902e75a",
          "imageSignature": "![Acht Schritte zum arbeitsfähigen Team: Rahmen, Rollen, Besetzung, Onboarding, Arbeitsweise, Zugänge, Stakeholder und erstes Backlog, jeweils mit Ergebnis.](/api/media/<image> \"Eine Orientierung für den Teamstart, keine offizielle Scrum-Phase. Schritte können parallel laufen.\")"
        }
      ]
    },
    "apm-q-start-08": {
      "fingerprint": "7d7451c6",
      "noteIds": [
        "agpm1-note-stakeholder"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-stakeholder",
          "kind": "image",
          "contains": "/api/media/0abd08bd-ec87-49bf-9266-bbb8d98b3a8d",
          "imageSignature": "![Stakeholder-Matrix mit Interesse auf der waagerechten und Einfluss auf der senkrechten Achse sowie vier Kommunikationsstrategien.](/api/media/<image> \"Einfluss und Interesse bestimmen den aktuellen Kommunikationsbedarf. Positionen regelmäßig überprüfen; geringer Einfluss heißt nicht unwichtig.\")"
        }
      ]
    },
    "apm-q-start-09": {
      "fingerprint": "e5cb9713",
      "noteIds": [
        "agpm1-note-projektauftrag"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-projektauftrag",
          "kind": "image",
          "contains": "/api/media/eca42bf4-bcb3-4beb-ba67-b97f40a94be5",
          "imageSignature": "![Sechs Klärungsfelder eines Projektauftrags – Kurzbeschreibung, Ziele und Nicht-Ziele, Organisation, Zeitplan, Budget, Rahmen und Risiken – münden in Abstimmung und Freigabe.](/api/media/<image> \"Der Auftrag macht Ergebnis, Mittel und Bedingungen verbindlich. Auch agile Vorhaben brauchen diesen Rahmen; Details entwickeln sich iterativ.\")"
        }
      ]
    },
    "apm-q-klassisch-01": {
      "fingerprint": "69b36da9",
      "noteIds": [
        "agpm1-note-projektstrukturplan"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-projektstrukturplan",
          "kind": "image",
          "contains": "/api/media/42ed861a-ed93-4b61-b772-59387de5092d",
          "imageSignature": "![Links gliedert ein Projektstrukturbaum die Aufgaben eines Teamtags; rechts ordnen Gantt-Balken dieselben Aufgaben beispielhaften Wochen zu.](/api/media/<image> \"Redaktionelles Beispiel: Der PSP beschreibt den Arbeitsumfang, Gantt ergänzt Zeitlage und Abhängigkeiten. Baumkanten sind keine zeitlichen Abhängigkeiten.\")"
        }
      ]
    },
    "apm-q-klassisch-02": {
      "fingerprint": "bb479ac0",
      "noteIds": [
        "agpm1-note-werkzeuge"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-werkzeuge",
          "kind": "image",
          "contains": "/api/media/2e697d95-d4e1-41c7-b5cf-770465de6ff4",
          "imageSignature": "![Vier Projektphasen mit typischem Unterstützungsbedarf und möglichen Werkzeugarten; Überwachung und Steuerung begleiten den gesamten Verlauf.](/api/media/<image> \"Erst den Zweck klären, dann das Werkzeug wählen. Ein einfaches Werkzeug kann genügen.\")"
        }
      ]
    },
    "apm-q-klassisch-03": {
      "fingerprint": "249b4135",
      "noteIds": [
        "agpm1-note-gantt"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-gantt",
          "kind": "image",
          "contains": "/api/media/42ed861a-ed93-4b61-b772-59387de5092d",
          "imageSignature": "![Links gliedert ein Projektstrukturbaum die Aufgaben eines Teamtags; rechts ordnen Gantt-Balken dieselben Aufgaben beispielhaften Wochen zu.](/api/media/<image> \"Redaktionelles Beispiel: Der PSP beschreibt den Arbeitsumfang, Gantt ergänzt Zeitlage und Abhängigkeiten. Baumkanten sind keine zeitlichen Abhängigkeiten.\")"
        }
      ]
    },
    "apm-q-klassisch-04": {
      "fingerprint": "ebb1abf5",
      "noteIds": [
        "agpm1-note-gantt",
        "agpm1-note-releaseplanung"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-gantt",
          "kind": "image",
          "contains": "/api/media/42ed861a-ed93-4b61-b772-59387de5092d",
          "imageSignature": "![Links gliedert ein Projektstrukturbaum die Aufgaben eines Teamtags; rechts ordnen Gantt-Balken dieselben Aufgaben beispielhaften Wochen zu.](/api/media/<image> \"Redaktionelles Beispiel: Der PSP beschreibt den Arbeitsumfang, Gantt ergänzt Zeitlage und Abhängigkeiten. Baumkanten sind keine zeitlichen Abhängigkeiten.\")"
        },
        {
          "noteId": "agpm1-note-releaseplanung",
          "kind": "image",
          "contains": "/api/media/95cbcd33-e478-4e4b-b8fc-9b77333d743f",
          "imageSignature": "![Rechnung: 100 Story Points geteilt durch 20 pro Sprint ergibt 5 Sprints oder 10 Wochen; die ersten drei Sprints markieren den MVP-Umfang, darunter Faktoren, die die Prognose verschieben.](/api/media/<image> \"Eine vereinfachte Prognose unter stabilen Annahmen, kein Liefervertrag. Annahmen regelmäßig überprüfen.\")"
        }
      ]
    },
    "apm-q-klassisch-05": {
      "fingerprint": "461a06db",
      "noteIds": [
        "agpm1-note-klassische-rollen"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-klassische-rollen",
          "kind": "image",
          "contains": "/api/media/5f516186-e5b2-4a53-8345-e168ea41189e",
          "imageSignature": "![Organigramm von Auftraggeber über Lenkungsausschuss, Projektleitung und Teilprojektleitung bis zu den Arbeitspaketverantwortlichen, gruppiert nach Entscheiden, Steuern und Ausführen; ein Sounding Board berät die Projektleitung. Daneben unterschiedliche Interessen bei einer Softwareeinführung.](/api/media/<image> \"Vereinfachtes Modell für größere Projekte. Das Sounding Board berät, es weist nicht an.\")"
        }
      ]
    },
    "apm-q-klassisch-06": {
      "fingerprint": "de9d4e1f",
      "noteIds": [
        "agpm1-note-klassische-rollen",
        "agpm1-note-stakeholder"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-klassische-rollen",
          "kind": "image",
          "contains": "/api/media/5f516186-e5b2-4a53-8345-e168ea41189e",
          "imageSignature": "![Organigramm von Auftraggeber über Lenkungsausschuss, Projektleitung und Teilprojektleitung bis zu den Arbeitspaketverantwortlichen, gruppiert nach Entscheiden, Steuern und Ausführen; ein Sounding Board berät die Projektleitung. Daneben unterschiedliche Interessen bei einer Softwareeinführung.](/api/media/<image> \"Vereinfachtes Modell für größere Projekte. Das Sounding Board berät, es weist nicht an.\")"
        },
        {
          "noteId": "agpm1-note-stakeholder",
          "kind": "image",
          "contains": "/api/media/0abd08bd-ec87-49bf-9266-bbb8d98b3a8d",
          "imageSignature": "![Stakeholder-Matrix mit Interesse auf der waagerechten und Einfluss auf der senkrechten Achse sowie vier Kommunikationsstrategien.](/api/media/<image> \"Einfluss und Interesse bestimmen den aktuellen Kommunikationsbedarf. Positionen regelmäßig überprüfen; geringer Einfluss heißt nicht unwichtig.\")"
        }
      ]
    },
    "apm-q-klassisch-07": {
      "fingerprint": "0397c2b4",
      "noteIds": [
        "agpm1-note-werkzeuge"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-werkzeuge",
          "kind": "comparison",
          "contains": "| Bedarf | Mögliche Werkzeugart |"
        }
      ]
    },
    "apm-q-klassisch-08": {
      "fingerprint": "2dda2bc2",
      "noteIds": [
        "agpm1-note-gantt",
        "agpm1-note-releaseplanung"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-gantt",
          "kind": "image",
          "contains": "/api/media/42ed861a-ed93-4b61-b772-59387de5092d",
          "imageSignature": "![Links gliedert ein Projektstrukturbaum die Aufgaben eines Teamtags; rechts ordnen Gantt-Balken dieselben Aufgaben beispielhaften Wochen zu.](/api/media/<image> \"Redaktionelles Beispiel: Der PSP beschreibt den Arbeitsumfang, Gantt ergänzt Zeitlage und Abhängigkeiten. Baumkanten sind keine zeitlichen Abhängigkeiten.\")"
        },
        {
          "noteId": "agpm1-note-releaseplanung",
          "kind": "image",
          "contains": "/api/media/95cbcd33-e478-4e4b-b8fc-9b77333d743f",
          "imageSignature": "![Rechnung: 100 Story Points geteilt durch 20 pro Sprint ergibt 5 Sprints oder 10 Wochen; die ersten drei Sprints markieren den MVP-Umfang, darunter Faktoren, die die Prognose verschieben.](/api/media/<image> \"Eine vereinfachte Prognose unter stabilen Annahmen, kein Liefervertrag. Annahmen regelmäßig überprüfen.\")"
        }
      ]
    },
    "apm-q-klassisch-09": {
      "fingerprint": "c7b124a7",
      "noteIds": [
        "agpm1-note-projektstrukturplan"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-projektstrukturplan",
          "kind": "image",
          "contains": "/api/media/42ed861a-ed93-4b61-b772-59387de5092d",
          "imageSignature": "![Links gliedert ein Projektstrukturbaum die Aufgaben eines Teamtags; rechts ordnen Gantt-Balken dieselben Aufgaben beispielhaften Wochen zu.](/api/media/<image> \"Redaktionelles Beispiel: Der PSP beschreibt den Arbeitsumfang, Gantt ergänzt Zeitlage und Abhängigkeiten. Baumkanten sind keine zeitlichen Abhängigkeiten.\")"
        }
      ]
    },
    "apm-q-fuehrung-01": {
      "fingerprint": "fa78a6e4",
      "noteIds": [
        "agpm1-note-vuka"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-vuka",
          "kind": "image",
          "contains": "/api/media/8baca985-ce13-470a-aad9-dfd25570ee3d",
          "imageSignature": "![Die vier VUKA-Dimensionen Volatilität, Ungewissheit, Komplexität und Ambiguität mit Bedeutung und typischem Signal; darunter der Unterschied zwischen kompliziert und komplex.](/api/media/<image> \"VUKA ist eine Orientierung, keine trennscharfe Diagnose. Mehrere Dimensionen können gleichzeitig auftreten.\")"
        }
      ]
    },
    "apm-q-fuehrung-02": {
      "fingerprint": "4fbba4df",
      "noteIds": [
        "agpm1-note-megatrends"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-megatrends",
          "kind": "image",
          "contains": "/api/media/cc6b5ecc-e241-4d88-88ed-5a1ff9b37cd2",
          "imageSignature": "![Zwölf Megatrends als Kacheln und vier mögliche Auswirkungen auf Teams: verteilte Zusammenarbeit, Vielfalt, Gesundheit und einfache Werkzeuge.](/api/media/<image> \"Auswahl nach einer früheren Darstellung von Horx beziehungsweise dem Zukunftsinstitut. Blickrichtungen, keine Vorhersage.\")"
        }
      ]
    },
    "apm-q-fuehrung-03": {
      "fingerprint": "5ffa3f51",
      "noteIds": [
        "agpm1-note-fuehrungstheorien"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-fuehrungstheorien",
          "kind": "image",
          "contains": "/api/media/304bd53e-83aa-477b-9ee6-aee5d0da6a91",
          "imageSignature": "![Drei Blickrichtungen auf Führung – Eigenschaft, Verhalten, Situation – und die Führungsstile nach Lewin auf einer Achse von viel bis wenig Steuerung.](/api/media/<image> \"Eine einführende Gegenüberstellung. Kein Führungsstil passt pauschal in jeder Situation. Die Pfeile geben eine Lesereihenfolge an; sie zeigen keinen verbindlichen Ablauf und keine vollständige Theoriegeschichte.\")"
        }
      ]
    },
    "apm-q-fuehrung-04": {
      "fingerprint": "6012e183",
      "noteIds": [
        "agpm1-note-management-vopa"
      ],
      "visualHints": []
    },
    "apm-q-fuehrung-05": {
      "fingerprint": "aef98e58",
      "noteIds": [
        "agpm1-note-zielorientierte-fuehrung"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-zielorientierte-fuehrung",
          "kind": "image",
          "contains": "/api/media/494a6495-1fc7-4a97-81b7-c8df253ab28f",
          "imageSignature": "![Drei Spalten: MbO mit gemeinsamer Richtung und Freiraum, die fünf SMART-Kriterien und ein OKR mit Objective und drei messbaren Key Results.](/api/media/<image> \"Zielklarheit ist nicht Starrheit: Der gewünschte Nutzen bleibt Bezugspunkt, der Lösungsweg darf sich ändern.\")"
        }
      ]
    },
    "apm-q-fuehrung-06": {
      "fingerprint": "d3f7ecc6",
      "noteIds": [
        "agpm1-note-vuka",
        "agpm1-note-management-vopa"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-vuka",
          "kind": "image",
          "contains": "/api/media/8baca985-ce13-470a-aad9-dfd25570ee3d",
          "imageSignature": "![Die vier VUKA-Dimensionen Volatilität, Ungewissheit, Komplexität und Ambiguität mit Bedeutung und typischem Signal; darunter der Unterschied zwischen kompliziert und komplex.](/api/media/<image> \"VUKA ist eine Orientierung, keine trennscharfe Diagnose. Mehrere Dimensionen können gleichzeitig auftreten.\")"
        },
        {
          "noteId": "agpm1-note-management-vopa",
          "kind": "image",
          "contains": "/api/media/c2d0781e-2f67-4edb-90ad-32d14ad65765",
          "imageSignature": "![Die vier gleichrangigen Handlungsfelder Vernetzung, Offenheit, Partizipation und Agilität stehen auf einer Vertrauensbasis.](/api/media/<image> \"Die VOPA-Handlungsfelder: Vertrauen trägt vier gleichwertige Handlungsfelder. Zwischen den Buchstaben gibt es keine feste Prozessreihenfolge.\")"
        }
      ]
    },
    "apm-q-fuehrung-07": {
      "fingerprint": "c19d8062",
      "noteIds": [
        "agpm1-note-fuehrungstheorien"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-fuehrungstheorien",
          "kind": "comparison",
          "contains": "| Ansatz | Leitfrage | Fokus |"
        }
      ]
    },
    "apm-q-fuehrung-08": {
      "fingerprint": "4fa317a5",
      "noteIds": [
        "agpm1-note-fuehrungstheorien"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-fuehrungstheorien",
          "kind": "comparison",
          "contains": "| Ansatz | Leitfrage | Fokus |"
        }
      ]
    },
    "apm-q-fuehrung-09": {
      "fingerprint": "f5074292",
      "noteIds": [
        "agpm1-note-zielorientierte-fuehrung"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-zielorientierte-fuehrung",
          "kind": "image",
          "contains": "/api/media/494a6495-1fc7-4a97-81b7-c8df253ab28f",
          "imageSignature": "![Drei Spalten: MbO mit gemeinsamer Richtung und Freiraum, die fünf SMART-Kriterien und ein OKR mit Objective und drei messbaren Key Results.](/api/media/<image> \"Zielklarheit ist nicht Starrheit: Der gewünschte Nutzen bleibt Bezugspunkt, der Lösungsweg darf sich ändern.\")"
        }
      ]
    },
    "apm-q-fuehrung-10": {
      "fingerprint": "75f1b150",
      "noteIds": [
        "agpm1-note-zielorientierte-fuehrung"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-zielorientierte-fuehrung",
          "kind": "image",
          "contains": "/api/media/494a6495-1fc7-4a97-81b7-c8df253ab28f",
          "imageSignature": "![Drei Spalten: MbO mit gemeinsamer Richtung und Freiraum, die fünf SMART-Kriterien und ein OKR mit Objective und drei messbaren Key Results.](/api/media/<image> \"Zielklarheit ist nicht Starrheit: Der gewünschte Nutzen bleibt Bezugspunkt, der Lösungsweg darf sich ändern.\")"
        }
      ]
    },
    "apm-q-fuehrung-11": {
      "fingerprint": "06564345",
      "noteIds": [
        "agpm1-note-management-vopa"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-management-vopa",
          "kind": "image",
          "contains": "/api/media/c2d0781e-2f67-4edb-90ad-32d14ad65765",
          "imageSignature": "![Die vier gleichrangigen Handlungsfelder Vernetzung, Offenheit, Partizipation und Agilität stehen auf einer Vertrauensbasis.](/api/media/<image> \"Die VOPA-Handlungsfelder: Vertrauen trägt vier gleichwertige Handlungsfelder. Zwischen den Buchstaben gibt es keine feste Prozessreihenfolge.\")"
        }
      ]
    },
    "apm-q-fuehrung-12": {
      "fingerprint": "5491836a",
      "noteIds": [
        "agpm1-note-megatrends",
        "agpm1-note-werkzeuge"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-megatrends",
          "kind": "image",
          "contains": "/api/media/cc6b5ecc-e241-4d88-88ed-5a1ff9b37cd2",
          "imageSignature": "![Zwölf Megatrends als Kacheln und vier mögliche Auswirkungen auf Teams: verteilte Zusammenarbeit, Vielfalt, Gesundheit und einfache Werkzeuge.](/api/media/<image> \"Auswahl nach einer früheren Darstellung von Horx beziehungsweise dem Zukunftsinstitut. Blickrichtungen, keine Vorhersage.\")"
        },
        {
          "noteId": "agpm1-note-werkzeuge",
          "kind": "comparison",
          "contains": "| Bedarf | Mögliche Werkzeugart |"
        }
      ]
    },
    "apm-q-menschen-01": {
      "fingerprint": "2dfef7f8",
      "noteIds": [
        "agpm1-note-menschen-und-teams"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-menschen-und-teams",
          "kind": "image",
          "contains": "/api/media/167c0d73-9192-4971-9b29-75ab10c84825",
          "imageSignature": "![Links ein Eisberg mit sichtbarer Sachebene und verborgener Beziehungsebene; rechts das TZI-Dreieck aus Ich, Wir und Es im Umfeld Globe.](/api/media/<image> \"Das Eisbergbild ist eine Metapher, keine Messung. TZI hilft, eine Situation aus vier Perspektiven zu betrachten.\")"
        }
      ]
    },
    "apm-q-menschen-02": {
      "fingerprint": "778c1d94",
      "noteIds": [
        "agpm1-note-menschen-und-teams"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-menschen-und-teams",
          "kind": "image",
          "contains": "/api/media/167c0d73-9192-4971-9b29-75ab10c84825",
          "imageSignature": "![Links ein Eisberg mit sichtbarer Sachebene und verborgener Beziehungsebene; rechts das TZI-Dreieck aus Ich, Wir und Es im Umfeld Globe.](/api/media/<image> \"Das Eisbergbild ist eine Metapher, keine Messung. TZI hilft, eine Situation aus vier Perspektiven zu betrachten.\")"
        }
      ]
    },
    "apm-q-menschen-03": {
      "fingerprint": "219ff5e7",
      "noteIds": [
        "agpm1-note-menschen-und-teams"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-menschen-und-teams",
          "kind": "image",
          "contains": "/api/media/167c0d73-9192-4971-9b29-75ab10c84825",
          "imageSignature": "![Links ein Eisberg mit sichtbarer Sachebene und verborgener Beziehungsebene; rechts das TZI-Dreieck aus Ich, Wir und Es im Umfeld Globe.](/api/media/<image> \"Das Eisbergbild ist eine Metapher, keine Messung. TZI hilft, eine Situation aus vier Perspektiven zu betrachten.\")"
        }
      ]
    },
    "apm-q-menschen-04": {
      "fingerprint": "8bc92b06",
      "noteIds": [
        "agpm1-note-t-shaped"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-t-shaped",
          "kind": "image",
          "contains": "/api/media/0bd3e1a9-7994-42e4-8291-eb3dde243faf",
          "imageSignature": "![Ein großes T zeigt fachübergreifende Breite im waagerechten Querbalken und tiefe Modellierungskompetenz im senkrechten Stamm.](/api/media/<image> \"Redaktionelles Transferbeispiel einer Datenexpertin: Breite ermöglicht Zusammenarbeit, Tiefe einen fachlichen Beitrag. T-shaped ist nicht gleichbedeutend mit Full-Stack.\")"
        }
      ]
    },
    "apm-q-menschen-05": {
      "fingerprint": "d4414011",
      "noteIds": [
        "agpm1-note-menschen-und-teams"
      ],
      "visualHints": []
    },
    "apm-q-menschen-06": {
      "fingerprint": "8ad0fc44",
      "noteIds": [
        "agpm1-note-menschen-und-teams"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-menschen-und-teams",
          "kind": "image",
          "contains": "/api/media/167c0d73-9192-4971-9b29-75ab10c84825",
          "imageSignature": "![Links ein Eisberg mit sichtbarer Sachebene und verborgener Beziehungsebene; rechts das TZI-Dreieck aus Ich, Wir und Es im Umfeld Globe.](/api/media/<image> \"Das Eisbergbild ist eine Metapher, keine Messung. TZI hilft, eine Situation aus vier Perspektiven zu betrachten.\")"
        }
      ]
    },
    "apm-q-menschen-07": {
      "fingerprint": "3dc16401",
      "noteIds": [
        "agpm1-note-data-science-nutzen"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-data-science-nutzen",
          "kind": "image",
          "contains": "/api/media/28c158ef-7a1b-4406-8219-238faef67eec",
          "imageSignature": "![Drei überlappende Kreise Statistik und Methoden, IT und Domänenwissen; daneben fünf Schritte vom Use Case bis zur beobachteten Nutzung und fünf Faktoren, die ein Datenprojekt tragen.](/api/media/<image> \"Ein Modell wirkt erst im Betrieb. Orientierungsskizze, keine offizielle Methode.\")"
        }
      ]
    },
    "apm-q-menschen-08": {
      "fingerprint": "a50c3068",
      "noteIds": [
        "agpm1-note-menschen-und-teams"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-menschen-und-teams",
          "kind": "image",
          "contains": "/api/media/167c0d73-9192-4971-9b29-75ab10c84825",
          "imageSignature": "![Links ein Eisberg mit sichtbarer Sachebene und verborgener Beziehungsebene; rechts das TZI-Dreieck aus Ich, Wir und Es im Umfeld Globe.](/api/media/<image> \"Das Eisbergbild ist eine Metapher, keine Messung. TZI hilft, eine Situation aus vier Perspektiven zu betrachten.\")"
        }
      ]
    },
    "apm-q-menschen-09": {
      "fingerprint": "cfd66f38",
      "noteIds": [
        "agpm1-note-t-shaped"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-t-shaped",
          "kind": "image",
          "contains": "/api/media/0bd3e1a9-7994-42e4-8291-eb3dde243faf",
          "imageSignature": "![Ein großes T zeigt fachübergreifende Breite im waagerechten Querbalken und tiefe Modellierungskompetenz im senkrechten Stamm.](/api/media/<image> \"Redaktionelles Transferbeispiel einer Datenexpertin: Breite ermöglicht Zusammenarbeit, Tiefe einen fachlichen Beitrag. T-shaped ist nicht gleichbedeutend mit Full-Stack.\")"
        }
      ]
    },
    "apm-q-skalierung-01": {
      "fingerprint": "71bb448d",
      "noteIds": [
        "agpm1-note-agile-skalierung"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-agile-skalierung",
          "kind": "image",
          "contains": "/api/media/d678fbd4-80e7-4352-9bfd-4a69d7e9f407",
          "imageSignature": "![Vier Klärungsfragen führen zu Skalierungsansätzen, gruppiert nach mehreren Teams an einem Produkt, größeren Organisationen sowie Ebenen und Wissensaustausch.](/api/media/<image> \"Abhängigkeiten, Integrationsbedarf und Produktverantwortung bestimmen die Wahl, nicht die Teamanzahl allein.\")"
        }
      ]
    },
    "apm-q-skalierung-02": {
      "fingerprint": "c7aefddb",
      "noteIds": [
        "agpm1-note-being-agile"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-being-agile",
          "kind": "image",
          "contains": "/api/media/5427d6e6-3d43-4f34-97c6-6867101741ee",
          "imageSignature": "![Zwei Ebenen: Doing Agile mit Praktiken wie Daily, Backlog, Review und Being Agile mit Vertrauen, Offenheit, Lernen und Verantwortung; daneben eine Lernschleife aus Vertrauen, Ausprobieren, gemeinsamem Lernen und besserer Zusammenarbeit.](/api/media/<image> \"Praktiken ohne Haltung werden zur Pflichtübung. Die Lernschleife ist eine mögliche positive Wechselwirkung.\")"
        }
      ]
    },
    "apm-q-skalierung-03": {
      "fingerprint": "2f6b66f9",
      "noteIds": [
        "agpm1-note-agile-skalierung"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-agile-skalierung",
          "kind": "image",
          "contains": "/api/media/d678fbd4-80e7-4352-9bfd-4a69d7e9f407",
          "imageSignature": "![Vier Klärungsfragen führen zu Skalierungsansätzen, gruppiert nach mehreren Teams an einem Produkt, größeren Organisationen sowie Ebenen und Wissensaustausch.](/api/media/<image> \"Abhängigkeiten, Integrationsbedarf und Produktverantwortung bestimmen die Wahl, nicht die Teamanzahl allein.\")"
        }
      ]
    },
    "apm-q-skalierung-04": {
      "fingerprint": "26ec9387",
      "noteIds": [
        "agpm1-note-being-agile"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-being-agile",
          "kind": "image",
          "contains": "/api/media/5427d6e6-3d43-4f34-97c6-6867101741ee",
          "imageSignature": "![Zwei Ebenen: Doing Agile mit Praktiken wie Daily, Backlog, Review und Being Agile mit Vertrauen, Offenheit, Lernen und Verantwortung; daneben eine Lernschleife aus Vertrauen, Ausprobieren, gemeinsamem Lernen und besserer Zusammenarbeit.](/api/media/<image> \"Praktiken ohne Haltung werden zur Pflichtübung. Die Lernschleife ist eine mögliche positive Wechselwirkung.\")"
        }
      ]
    },
    "apm-q-skalierung-05": {
      "fingerprint": "63de3465",
      "noteIds": [
        "agpm1-note-manifest",
        "agpm1-note-being-agile"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-manifest",
          "kind": "comparison",
          "contains": "| Nr. | Prinzip | Kernaussage |"
        },
        {
          "noteId": "agpm1-note-being-agile",
          "kind": "image",
          "contains": "/api/media/5427d6e6-3d43-4f34-97c6-6867101741ee",
          "imageSignature": "![Zwei Ebenen: Doing Agile mit Praktiken wie Daily, Backlog, Review und Being Agile mit Vertrauen, Offenheit, Lernen und Verantwortung; daneben eine Lernschleife aus Vertrauen, Ausprobieren, gemeinsamem Lernen und besserer Zusammenarbeit.](/api/media/<image> \"Praktiken ohne Haltung werden zur Pflichtübung. Die Lernschleife ist eine mögliche positive Wechselwirkung.\")"
        }
      ]
    },
    "apm-q-skalierung-06": {
      "fingerprint": "b7813906",
      "noteIds": [
        "agpm1-note-produktteams"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-produktteams",
          "kind": "image",
          "contains": "/api/media/a1f2dd8a-de01-442a-a301-95ee555a676b",
          "imageSignature": "![Vergleich eines befristeten Projektteams mit Übergabe und eines Product Teams im Kreislauf aus Entwickeln, Betreiben und Verbessern; darunter DevOps, DevSecOps und Enabler-Team.](/api/media/<image> \"Ein Product Team trägt dauerhafte Verantwortung. Auftrag und Schnittstellen unterstützender Teams müssen ausdrücklich geklärt sein.\")"
        }
      ]
    },
    "apm-q-skalierung-07": {
      "fingerprint": "0fa14693",
      "noteIds": [
        "agpm1-note-agile-skalierung"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-agile-skalierung",
          "kind": "image",
          "contains": "/api/media/d678fbd4-80e7-4352-9bfd-4a69d7e9f407",
          "imageSignature": "![Vier Klärungsfragen führen zu Skalierungsansätzen, gruppiert nach mehreren Teams an einem Produkt, größeren Organisationen sowie Ebenen und Wissensaustausch.](/api/media/<image> \"Abhängigkeiten, Integrationsbedarf und Produktverantwortung bestimmen die Wahl, nicht die Teamanzahl allein.\")"
        }
      ]
    },
    "apm-q-skalierung-08": {
      "fingerprint": "9e39c962",
      "noteIds": [
        "agpm1-note-being-agile"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-being-agile",
          "kind": "image",
          "contains": "/api/media/5427d6e6-3d43-4f34-97c6-6867101741ee",
          "imageSignature": "![Zwei Ebenen: Doing Agile mit Praktiken wie Daily, Backlog, Review und Being Agile mit Vertrauen, Offenheit, Lernen und Verantwortung; daneben eine Lernschleife aus Vertrauen, Ausprobieren, gemeinsamem Lernen und besserer Zusammenarbeit.](/api/media/<image> \"Praktiken ohne Haltung werden zur Pflichtübung. Die Lernschleife ist eine mögliche positive Wechselwirkung.\")"
        }
      ]
    },
    "apm-q-skalierung-09": {
      "fingerprint": "d290bf4f",
      "noteIds": [
        "agpm1-note-agile-datenprojekte",
        "agpm1-note-data-science-nutzen"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-agile-datenprojekte",
          "kind": "image",
          "contains": "/api/media/9ee0a794-b63c-468d-a8b4-30a8fa77cd47",
          "imageSignature": "![Eine Treppe in vier Lernschritten vom Beobachten neuer Methoden bis zur breiteren Übernahme; daneben Abstimmungsformen je nach Bedarf.](/api/media/<image> \"Ein Praxisbeispiel: Lernen braucht freie Kapazität. Ein Weekly ist kein Daily Scrum.\")"
        },
        {
          "noteId": "agpm1-note-data-science-nutzen",
          "kind": "image",
          "contains": "/api/media/28c158ef-7a1b-4406-8219-238faef67eec",
          "imageSignature": "![Drei überlappende Kreise Statistik und Methoden, IT und Domänenwissen; daneben fünf Schritte vom Use Case bis zur beobachteten Nutzung und fünf Faktoren, die ein Datenprojekt tragen.](/api/media/<image> \"Ein Modell wirkt erst im Betrieb. Orientierungsskizze, keine offizielle Methode.\")"
        }
      ]
    },
    "apm-q-grundlagen-01": {
      "fingerprint": "69722401",
      "noteIds": [
        "agpm1-note-pm-grundlagen"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-pm-grundlagen",
          "kind": "comparison",
          "contains": "| Business as Usual / Business Change |"
        }
      ]
    },
    "apm-q-grundlagen-02": {
      "fingerprint": "2902abbb",
      "noteIds": [
        "agpm1-note-pm-grundlagen"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-pm-grundlagen",
          "kind": "comparison",
          "contains": "| Standard | Herkunft laut Aufzeichnung | Seit |"
        }
      ]
    },
    "apm-q-grundlagen-03": {
      "fingerprint": "b44dd1aa",
      "noteIds": [
        "agpm1-note-pm-grundlagen"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-pm-grundlagen",
          "kind": "comparison",
          "contains": "| Quelle | Schwerpunkt |"
        }
      ]
    },
    "apm-q-grundlagen-04": {
      "fingerprint": "559e10d8",
      "noteIds": [
        "agpm1-note-pm-dreieck"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-pm-dreieck",
          "kind": "diagram",
          "contains": "K[\"Kosten\"]"
        }
      ]
    },
    "apm-q-grundlagen-05": {
      "fingerprint": "b6f7b1e8",
      "noteIds": [
        "agpm1-note-pm-grundlagen"
      ],
      "visualHints": []
    },
    "apm-q-grundlagen-06": {
      "fingerprint": "9303754c",
      "noteIds": [
        "agpm1-note-pm-grundlagen"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-pm-grundlagen",
          "kind": "comparison",
          "contains": "| Aufgabe | Konkrete Tätigkeit |"
        }
      ]
    },
    "apm-q-grundlagen-07": {
      "fingerprint": "20343b79",
      "noteIds": [
        "agpm1-note-pm-grundlagen"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-pm-grundlagen",
          "kind": "diagram",
          "contains": "P[\"Planen\"]"
        }
      ]
    },
    "apm-q-grundlagen-08": {
      "fingerprint": "cba3e423",
      "noteIds": [
        "agpm1-note-pm-dreieck"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-pm-dreieck",
          "kind": "comparison",
          "contains": "| Darstellung | Anzahl | Vollständige Liste |"
        }
      ]
    },
    "apm-q-grundlagen-09": {
      "fingerprint": "8df001ab",
      "noteIds": [
        "agpm1-note-pm-grundlagen"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-pm-grundlagen",
          "kind": "comparison",
          "contains": "| Aufgaben / Prozesse |"
        }
      ]
    },
    "apm-q-grundlagen-10": {
      "fingerprint": "18243e15",
      "noteIds": [
        "agpm1-note-pm-grundlagen"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-pm-grundlagen",
          "kind": "comparison",
          "contains": "| Merkmal | Bedeutung am Beispiel einer Mitglieder-App |"
        }
      ]
    },
    "apm-q-grundlagen-11": {
      "fingerprint": "ba7cef70",
      "noteIds": [
        "agpm1-note-pm-dreieck"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-pm-dreieck",
          "kind": "diagram",
          "contains": "K[\"Kosten\"]"
        }
      ]
    },
    "apm-q-grundlagen-12": {
      "fingerprint": "1164e15b",
      "noteIds": [
        "agpm1-note-pm-dreieck"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-pm-dreieck",
          "kind": "comparison",
          "contains": "| Darstellung | Anzahl | Vollständige Liste |"
        }
      ]
    },
    "apm-q-grundlagen-13": {
      "fingerprint": "c8eee418",
      "noteIds": [
        "agpm1-note-pm-grundlagen",
        "agpm1-note-klassische-rollen"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-pm-grundlagen",
          "kind": "diagram",
          "contains": "P[\"Planen\"]"
        },
        {
          "noteId": "agpm1-note-klassische-rollen",
          "kind": "image",
          "contains": "/api/media/5f516186-e5b2-4a53-8345-e168ea41189e",
          "imageSignature": "![Organigramm von Auftraggeber über Lenkungsausschuss, Projektleitung und Teilprojektleitung bis zu den Arbeitspaketverantwortlichen, gruppiert nach Entscheiden, Steuern und Ausführen; ein Sounding Board berät die Projektleitung. Daneben unterschiedliche Interessen bei einer Softwareeinführung.](/api/media/<image> \"Vereinfachtes Modell für größere Projekte. Das Sounding Board berät, es weist nicht an.\")"
        }
      ]
    },
    "apm-q-grundlagen-14": {
      "fingerprint": "3fd4ebb0",
      "noteIds": [
        "agpm1-note-pm-grundlagen"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-pm-grundlagen",
          "kind": "comparison",
          "contains": "| Business as Usual / Business Change |"
        },
        {
          "noteId": "agpm1-note-pm-grundlagen",
          "kind": "comparison",
          "contains": "| Merkmal | Bedeutung am Beispiel einer Mitglieder-App |"
        }
      ]
    },
    "apm-q-risiko-01": {
      "fingerprint": "2283b0ae",
      "noteIds": [
        "agpm1-note-risiko"
      ],
      "visualHints": []
    },
    "apm-q-risiko-02": {
      "fingerprint": "59247dac",
      "noteIds": [
        "agpm1-note-risiko"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-risiko",
          "kind": "comparison",
          "contains": "| Variante | Beispiel |"
        }
      ]
    },
    "apm-q-risiko-03": {
      "fingerprint": "f10d3551",
      "noteIds": [
        "agpm1-note-risiko"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-risiko",
          "kind": "diagram",
          "contains": "I[\"Identifizieren: Risikoanalyse mit dem Team\"]"
        }
      ]
    },
    "apm-q-risiko-04": {
      "fingerprint": "93b1804e",
      "noteIds": [
        "agpm1-note-risiko",
        "agpm1-note-projektstrukturplan"
      ],
      "visualHints": []
    },
    "apm-q-risiko-05": {
      "fingerprint": "eacd41b6",
      "noteIds": [
        "agpm1-note-risiko"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-risiko",
          "kind": "comparison",
          "contains": "| Variante | Beispiel |"
        }
      ]
    },
    "apm-q-risiko-06": {
      "fingerprint": "9dba9f3e",
      "noteIds": [
        "agpm1-note-controlling"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-controlling",
          "kind": "comparison",
          "contains": "| | Klassisch | Agil |"
        }
      ]
    },
    "apm-q-risiko-07": {
      "fingerprint": "840e3f16",
      "noteIds": [
        "agpm1-note-risiko"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-risiko",
          "kind": "diagram",
          "contains": "I[\"Identifizieren: Risikoanalyse mit dem Team\"]"
        }
      ]
    },
    "apm-q-risiko-08": {
      "fingerprint": "9e0bd1f1",
      "noteIds": [
        "agpm1-note-risiko"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-risiko",
          "kind": "comparison",
          "contains": "| Variante | Beispiel |"
        }
      ]
    },
    "apm-q-risiko-09": {
      "fingerprint": "c1bb1b14",
      "noteIds": [
        "agpm1-note-controlling"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-controlling",
          "kind": "diagram",
          "contains": "A[\"Soll und Ist vergleichen\"]"
        }
      ]
    },
    "apm-q-start-10": {
      "fingerprint": "2b74e01f",
      "noteIds": [
        "agpm1-note-werkzeuge",
        "agpm1-note-projektauftrag"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-werkzeuge",
          "kind": "comparison",
          "contains": "| Projektphase | Typischer Unterstützungsbedarf |"
        },
        {
          "noteId": "agpm1-note-projektauftrag",
          "kind": "image",
          "contains": "/api/media/eca42bf4-bcb3-4beb-ba67-b97f40a94be5",
          "imageSignature": "![Sechs Klärungsfelder eines Projektauftrags – Kurzbeschreibung, Ziele und Nicht-Ziele, Organisation, Zeitplan, Budget, Rahmen und Risiken – münden in Abstimmung und Freigabe.](/api/media/<image> \"Der Auftrag macht Ergebnis, Mittel und Bedingungen verbindlich. Auch agile Vorhaben brauchen diesen Rahmen; Details entwickeln sich iterativ.\")"
        }
      ]
    },
    "apm-q-start-11": {
      "fingerprint": "ca723ed2",
      "noteIds": [
        "agpm1-note-stakeholder"
      ],
      "visualHints": []
    },
    "apm-q-klassisch-10": {
      "fingerprint": "25d00fe7",
      "noteIds": [
        "agpm1-note-raci"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-raci",
          "kind": "comparison",
          "contains": "| Buchstabe | Bedeutung |"
        }
      ]
    },
    "apm-q-klassisch-11": {
      "fingerprint": "d9f85a45",
      "noteIds": [
        "pm-note-klassisch"
      ],
      "visualHints": []
    },
    "apm-q-klassisch-12": {
      "fingerprint": "5ab8eab5",
      "noteIds": [
        "pm-note-klassisch",
        "agpm1-note-klassische-rollen"
      ],
      "visualHints": [
        {
          "noteId": "pm-note-klassisch",
          "kind": "comparison",
          "contains": "| Schlagwort | Laut Kurs | Folge |"
        },
        {
          "noteId": "agpm1-note-klassische-rollen",
          "kind": "image",
          "contains": "/api/media/5f516186-e5b2-4a53-8345-e168ea41189e",
          "imageSignature": "![Organigramm von Auftraggeber über Lenkungsausschuss, Projektleitung und Teilprojektleitung bis zu den Arbeitspaketverantwortlichen, gruppiert nach Entscheiden, Steuern und Ausführen; ein Sounding Board berät die Projektleitung. Daneben unterschiedliche Interessen bei einer Softwareeinführung.](/api/media/<image> \"Vereinfachtes Modell für größere Projekte. Das Sounding Board berät, es weist nicht an.\")"
        }
      ]
    },
    "apm-q-klassisch-13": {
      "fingerprint": "16ef4973",
      "noteIds": [
        "agpm1-note-raci"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-raci",
          "kind": "comparison",
          "contains": "| Aufgabe | Projektleitung | Marketing | IT | UX-Design | Geschäftsführung |"
        }
      ]
    },
    "apm-q-manifest-01": {
      "fingerprint": "65a237c5",
      "noteIds": [
        "agpm1-note-manifest"
      ],
      "visualHints": []
    },
    "apm-q-manifest-02": {
      "fingerprint": "a4fb0315",
      "noteIds": [
        "agpm1-note-manifest"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-manifest",
          "kind": "diagram",
          "contains": "A[\"Kleine Iteration\"]"
        }
      ]
    },
    "apm-q-manifest-03": {
      "fingerprint": "279d5c3d",
      "noteIds": [
        "agpm1-note-manifest"
      ],
      "visualHints": []
    },
    "apm-q-manifest-04": {
      "fingerprint": "85da3184",
      "noteIds": [
        "agpm1-note-manifest",
        "agpm1-note-review-retrospektive"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-manifest",
          "kind": "comparison",
          "contains": "| Nr. | Prinzip | Kernaussage |"
        },
        {
          "noteId": "agpm1-note-review-retrospektive",
          "kind": "image",
          "contains": "/api/media/87791ba7-164d-41d0-820b-f823c5f34aea",
          "imageSignature": "![Sprint Review fragt nach dem Produkt und nächsten Prioritäten; die Retrospektive nach Zusammenarbeit und Prozessverbesserungen.](/api/media/<image> \"Zwei Lernfragen: Was braucht das Produkt als Nächstes? Wie verbessern wir unsere gemeinsame Arbeitsweise?\")"
        }
      ]
    },
    "apm-q-manifest-05": {
      "fingerprint": "b8313204",
      "noteIds": [
        "agpm1-note-manifest"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-manifest",
          "kind": "diagram",
          "contains": "A[\"Kleine Iteration\"]"
        }
      ]
    },
    "apm-q-manifest-06": {
      "fingerprint": "05fe8461",
      "noteIds": [
        "agpm1-note-manifest"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-manifest",
          "kind": "diagram",
          "contains": "A[\"Kleine Iteration\"]"
        }
      ]
    },
    "apm-q-manifest-07": {
      "fingerprint": "32ccfcf2",
      "noteIds": [
        "agpm1-note-manifest",
        "agpm1-note-pm-dreieck"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-manifest",
          "kind": "comparison",
          "contains": "| | klassisch | agil |"
        }
      ]
    },
    "apm-q-manifest-08": {
      "fingerprint": "9469535b",
      "noteIds": [
        "agpm1-note-manifest"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-manifest",
          "kind": "comparison",
          "contains": "| Nr. | Prinzip | Kernaussage |"
        }
      ]
    },
    "apm-q-manifest-09": {
      "fingerprint": "2080b3db",
      "noteIds": [
        "agpm1-note-manifest"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-manifest",
          "kind": "diagram",
          "contains": "A[\"Kleine Iteration\"]"
        }
      ]
    },
    "apm-q-manifest-10": {
      "fingerprint": "92571e1c",
      "noteIds": [
        "agpm1-note-manifest"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-manifest",
          "kind": "comparison",
          "contains": "| Nr. | Prinzip | Kernaussage |"
        }
      ]
    },
    "apm-q-manifest-11": {
      "fingerprint": "0b98322f",
      "noteIds": [
        "agpm1-note-manifest"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-manifest",
          "kind": "comparison",
          "contains": "| Nr. | Prinzip | Kernaussage |"
        }
      ]
    },
    "apm-q-manifest-12": {
      "fingerprint": "0a8b549f",
      "noteIds": [
        "agpm1-note-manifest"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-manifest",
          "kind": "comparison",
          "contains": "| Nr. | Prinzip | Kernaussage |"
        }
      ]
    },
    "apm-q-manifest-13": {
      "fingerprint": "7ef98eb7",
      "noteIds": [
        "agpm1-note-manifest",
        "agpm1-note-pm-dreieck"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-manifest",
          "kind": "comparison",
          "contains": "| | klassisch | agil |"
        },
        {
          "noteId": "agpm1-note-pm-dreieck",
          "kind": "diagram",
          "contains": "K[\"Kosten\"]"
        }
      ]
    },
    "apm-q-manifest-14": {
      "fingerprint": "3ba348c6",
      "noteIds": [
        "agpm1-note-manifest",
        "agpm1-note-review-retrospektive"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-manifest",
          "kind": "comparison",
          "contains": "| Nr. | Prinzip | Kernaussage |"
        },
        {
          "noteId": "agpm1-note-review-retrospektive",
          "kind": "image",
          "contains": "/api/media/87791ba7-164d-41d0-820b-f823c5f34aea",
          "imageSignature": "![Sprint Review fragt nach dem Produkt und nächsten Prioritäten; die Retrospektive nach Zusammenarbeit und Prozessverbesserungen.](/api/media/<image> \"Zwei Lernfragen: Was braucht das Produkt als Nächstes? Wie verbessern wir unsere gemeinsame Arbeitsweise?\")"
        }
      ]
    },
    "apm-q-manifest-15": {
      "fingerprint": "7c4191e5",
      "noteIds": [
        "agpm1-note-manifest"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-manifest",
          "kind": "diagram",
          "contains": "A[\"Kleine Iteration\"]"
        }
      ]
    },
    "apm-q-ansaetze-01": {
      "fingerprint": "0d7870a9",
      "noteIds": [
        "agpm1-note-lean-startup"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-lean-startup",
          "kind": "diagram",
          "contains": "B[\"Build: MVP bauen\"]"
        }
      ]
    },
    "apm-q-ansaetze-02": {
      "fingerprint": "b964d8f1",
      "noteIds": [
        "agile-note-kanban"
      ],
      "visualHints": []
    },
    "apm-q-ansaetze-03": {
      "fingerprint": "f83e8f47",
      "noteIds": [
        "agile-note-kanban"
      ],
      "visualHints": [
        {
          "noteId": "agile-note-kanban",
          "kind": "diagram",
          "contains": "A{\"WIP-Platz frei?\"}"
        }
      ]
    },
    "apm-q-ansaetze-04": {
      "fingerprint": "05260c5a",
      "noteIds": [
        "agile-note-kanban"
      ],
      "visualHints": [
        {
          "noteId": "agile-note-kanban",
          "kind": "diagram",
          "contains": "A[\"Ideen\"]"
        }
      ]
    },
    "apm-q-ansaetze-05": {
      "fingerprint": "b9bf2f45",
      "noteIds": [
        "agile-note-kanban"
      ],
      "visualHints": [
        {
          "noteId": "agile-note-kanban",
          "kind": "diagram",
          "contains": "A{\"WIP-Platz frei?\"}"
        }
      ]
    },
    "apm-q-ansaetze-06": {
      "fingerprint": "35b56546",
      "noteIds": [
        "agile-note-kanban",
        "agpm1-note-scrum-ueberblick"
      ],
      "visualHints": [
        {
          "noteId": "agile-note-kanban",
          "kind": "comparison",
          "contains": "| | Scrum | Kanban |"
        },
        {
          "noteId": "agpm1-note-scrum-ueberblick",
          "kind": "image",
          "contains": "/api/media/ab8d9d6e-a4ec-4d08-8168-70cfea23fe10",
          "imageSignature": "![Planning, laufende Arbeit mit Daily, Review und Retrospektive innerhalb eines Sprints; Feedback verändert das Product Backlog.](/api/media/<image> \"Planning, Daily, Review und Retrospektive gehören zum Sprint. Ein nutzbares Inkrement entsteht während der Arbeit und muss nicht auf das Review warten.\")"
        }
      ]
    },
    "apm-q-ansaetze-07": {
      "fingerprint": "3a1eed2a",
      "noteIds": [
        "agpm1-note-lean-startup",
        "agpm1-note-designthinking"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-lean-startup",
          "kind": "diagram",
          "contains": "B[\"Build: MVP bauen\"]"
        },
        {
          "noteId": "agpm1-note-designthinking",
          "kind": "image",
          "contains": "/api/media/f931549d-5bfe-4a6a-b2c6-0761cdb402a7",
          "imageSignature": "![Zwei Rauten für Problemraum und Lösungsraum mit den Phasen Empathize, Define, Ideate, Prototype, Test und Implement; darunter das Beispiel Lara von der Beobachtung über eine Wie-können-wir-Frage zu mehreren Ideen.](/api/media/<image> \"Erst verstehen und das Problem fassen, dann viele Ideen öffnen und prüfen. Rücksprünge gehören dazu.\")"
        }
      ]
    },
    "apm-q-ansaetze-08": {
      "fingerprint": "046dc348",
      "noteIds": [
        "agpm1-note-lean-startup"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-lean-startup",
          "kind": "diagram",
          "contains": "B[\"Build: MVP bauen\"]"
        }
      ]
    },
    "apm-q-ansaetze-09": {
      "fingerprint": "f85c0c9d",
      "noteIds": [
        "agpm1-note-lean-startup",
        "agpm1-note-mvp"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-lean-startup",
          "kind": "diagram",
          "contains": "B[\"Build: MVP bauen\"]"
        },
        {
          "noteId": "agpm1-note-mvp",
          "kind": "diagram",
          "contains": "A[\"Nutzeraufgabe klären\"]"
        }
      ]
    },
    "apm-q-ansaetze-10": {
      "fingerprint": "0b953568",
      "noteIds": [
        "agile-note-kanban"
      ],
      "visualHints": [
        {
          "noteId": "agile-note-kanban",
          "kind": "diagram",
          "contains": "A{\"WIP-Platz frei?\"}"
        }
      ]
    },
    "apm-q-hybrid-01": {
      "fingerprint": "61c9e219",
      "noteIds": [
        "pm-note-hybrid",
        "agpm1-note-manifest"
      ],
      "visualHints": [
        {
          "noteId": "pm-note-hybrid",
          "kind": "comparison",
          "contains": "| | Klassisch | Agil | Hybrid |"
        },
        {
          "noteId": "agpm1-note-manifest",
          "kind": "diagram",
          "contains": "A[\"Kleine Iteration\"]"
        }
      ]
    },
    "apm-q-hybrid-02": {
      "fingerprint": "971046b8",
      "noteIds": [
        "pm-note-hybrid"
      ],
      "visualHints": [
        {
          "noteId": "pm-note-hybrid",
          "kind": "diagram",
          "contains": "A[\"Klassisch: Initialisierung und Planung\"]"
        }
      ]
    },
    "apm-q-hybrid-03": {
      "fingerprint": "942862ac",
      "noteIds": [
        "pm-note-hybrid"
      ],
      "visualHints": [
        {
          "noteId": "pm-note-hybrid",
          "kind": "image",
          "contains": "/api/media/7d4ea7d7-52b0-4cbe-aaf2-8c77cb608c09",
          "imageSignature": "![Stacey-Matrix mit den Bereichen einfach, kompliziert, komplex und chaotisch; daneben drei Kombinationsmuster: nacheinander, nebeneinander mit gemeinsamen Meilensteinen und ineinander.](/api/media/<image> \"Die Stacey-Matrix ist eine grobe Orientierung, kein Entscheidungsautomat.\")"
        }
      ]
    },
    "apm-q-hybrid-04": {
      "fingerprint": "c99a06fe",
      "noteIds": [
        "pm-note-hybrid"
      ],
      "visualHints": [
        {
          "noteId": "pm-note-hybrid",
          "kind": "comparison",
          "contains": "| | Klassisch | Agil | Hybrid |"
        }
      ]
    },
    "apm-q-hybrid-05": {
      "fingerprint": "b1f39266",
      "noteIds": [
        "pm-note-hybrid"
      ],
      "visualHints": [
        {
          "noteId": "pm-note-hybrid",
          "kind": "comparison",
          "contains": "| | Klassisch | Agil | Hybrid |"
        }
      ]
    },
    "apm-q-hybrid-06": {
      "fingerprint": "3a08fc3f",
      "noteIds": [
        "pm-note-hybrid"
      ],
      "visualHints": [
        {
          "noteId": "pm-note-hybrid",
          "kind": "diagram",
          "contains": "A[\"Klassisch: Initialisierung und Planung\"]"
        }
      ]
    },
    "apm-q-hybrid-07": {
      "fingerprint": "b68f31d2",
      "noteIds": [
        "pm-note-hybrid"
      ],
      "visualHints": [
        {
          "noteId": "pm-note-hybrid",
          "kind": "image",
          "contains": "/api/media/7d4ea7d7-52b0-4cbe-aaf2-8c77cb608c09",
          "imageSignature": "![Stacey-Matrix mit den Bereichen einfach, kompliziert, komplex und chaotisch; daneben drei Kombinationsmuster: nacheinander, nebeneinander mit gemeinsamen Meilensteinen und ineinander.](/api/media/<image> \"Die Stacey-Matrix ist eine grobe Orientierung, kein Entscheidungsautomat.\")"
        }
      ]
    },
    "apm-q-hybrid-08": {
      "fingerprint": "872e51ea",
      "noteIds": [
        "pm-note-hybrid"
      ],
      "visualHints": [
        {
          "noteId": "pm-note-hybrid",
          "kind": "image",
          "contains": "/api/media/7d4ea7d7-52b0-4cbe-aaf2-8c77cb608c09",
          "imageSignature": "![Stacey-Matrix mit den Bereichen einfach, kompliziert, komplex und chaotisch; daneben drei Kombinationsmuster: nacheinander, nebeneinander mit gemeinsamen Meilensteinen und ineinander.](/api/media/<image> \"Die Stacey-Matrix ist eine grobe Orientierung, kein Entscheidungsautomat.\")"
        }
      ]
    },
    "apm-q-hybrid-09": {
      "fingerprint": "c7b56acb",
      "noteIds": [
        "pm-note-hybrid"
      ],
      "visualHints": [
        {
          "noteId": "pm-note-hybrid",
          "kind": "comparison",
          "contains": "| | Klassisch | Agil | Hybrid |"
        }
      ]
    },
    "apm-q-hybrid-10": {
      "fingerprint": "98b1d338",
      "noteIds": [
        "pm-note-hybrid",
        "agpm1-note-review-retrospektive"
      ],
      "visualHints": [
        {
          "noteId": "pm-note-hybrid",
          "kind": "diagram",
          "contains": "A[\"Klassisch: Initialisierung und Planung\"]"
        },
        {
          "noteId": "agpm1-note-review-retrospektive",
          "kind": "image",
          "contains": "/api/media/87791ba7-164d-41d0-820b-f823c5f34aea",
          "imageSignature": "![Sprint Review fragt nach dem Produkt und nächsten Prioritäten; die Retrospektive nach Zusammenarbeit und Prozessverbesserungen.](/api/media/<image> \"Zwei Lernfragen: Was braucht das Produkt als Nächstes? Wie verbessern wir unsere gemeinsame Arbeitsweise?\")"
        }
      ]
    },
    "apm-q-hybrid-11": {
      "fingerprint": "056ac766",
      "noteIds": [
        "agpm1-note-raci",
        "agpm1-note-klassische-rollen"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-raci",
          "kind": "comparison",
          "contains": "| Buchstabe | Bedeutung |"
        },
        {
          "noteId": "agpm1-note-klassische-rollen",
          "kind": "image",
          "contains": "/api/media/5f516186-e5b2-4a53-8345-e168ea41189e",
          "imageSignature": "![Organigramm von Auftraggeber über Lenkungsausschuss, Projektleitung und Teilprojektleitung bis zu den Arbeitspaketverantwortlichen, gruppiert nach Entscheiden, Steuern und Ausführen; ein Sounding Board berät die Projektleitung. Daneben unterschiedliche Interessen bei einer Softwareeinführung.](/api/media/<image> \"Vereinfachtes Modell für größere Projekte. Das Sounding Board berät, es weist nicht an.\")"
        }
      ]
    },
    "apm-q-hybrid-12": {
      "fingerprint": "995a7a63",
      "noteIds": [
        "pm-note-hybrid"
      ],
      "visualHints": []
    },
    "apm-q-formate-01": {
      "fingerprint": "8b9b63e1",
      "noteIds": [
        "agpm1-note-veranstaltungsformate"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-veranstaltungsformate",
          "kind": "comparison",
          "contains": "| Format | Was der Kurs dazu sagt |"
        }
      ]
    },
    "apm-q-formate-02": {
      "fingerprint": "fab93e93",
      "noteIds": [
        "agpm1-note-veranstaltungsformate"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-veranstaltungsformate",
          "kind": "comparison",
          "contains": "| Format | Was der Kurs dazu sagt |"
        }
      ]
    },
    "apm-q-formate-03": {
      "fingerprint": "26e8268e",
      "noteIds": [
        "agpm1-note-veranstaltungsformate"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-veranstaltungsformate",
          "kind": "comparison",
          "contains": "| Format | Was der Kurs dazu sagt |"
        }
      ]
    },
    "apm-q-formate-04": {
      "fingerprint": "6d220c0a",
      "noteIds": [
        "agpm1-note-veranstaltungsformate"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-veranstaltungsformate",
          "kind": "comparison",
          "contains": "| Format | Was der Kurs dazu sagt |"
        }
      ]
    },
    "apm-q-formate-05": {
      "fingerprint": "bfb75364",
      "noteIds": [
        "agpm1-note-veranstaltungsformate"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-veranstaltungsformate",
          "kind": "comparison",
          "contains": "| Format | Was der Kurs dazu sagt |"
        }
      ]
    },
    "apm-q-formate-06": {
      "fingerprint": "a3950602",
      "noteIds": [
        "agpm1-note-veranstaltungsformate"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-veranstaltungsformate",
          "kind": "comparison",
          "contains": "| Format | Was der Kurs dazu sagt |"
        }
      ]
    },
    "apm-q-formate-07": {
      "fingerprint": "6e012579",
      "noteIds": [
        "agpm1-note-veranstaltungsformate"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-veranstaltungsformate",
          "kind": "comparison",
          "contains": "| Format | Was der Kurs dazu sagt |"
        }
      ]
    },
    "apm-q-formate-08": {
      "fingerprint": "c2b95430",
      "noteIds": [
        "agpm1-note-veranstaltungsformate"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-veranstaltungsformate",
          "kind": "comparison",
          "contains": "| Format | Was der Kurs dazu sagt |"
        }
      ]
    },
    "apm-q-formate-09": {
      "fingerprint": "3fd4c5cd",
      "noteIds": [
        "agpm1-note-veranstaltungsformate"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-veranstaltungsformate",
          "kind": "comparison",
          "contains": "| Format | Was der Kurs dazu sagt |"
        }
      ]
    },
    "apm-q-artefakte-15": {
      "fingerprint": "48d9f1c7",
      "noteIds": [
        "agpm1-note-anforderungen"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-anforderungen",
          "kind": "diagram",
          "contains": "E[\"Epic: Trainingsorganisation\"]"
        }
      ]
    },
    "apm-q-artefakte-16": {
      "fingerprint": "ffa7af69",
      "noteIds": [
        "agile-note-user-stories-pruefen"
      ],
      "visualHints": [
        {
          "noteId": "agile-note-user-stories-pruefen",
          "kind": "comparison",
          "contains": "| Kriterium | Frage |"
        }
      ]
    },
    "apm-q-artefakte-17": {
      "fingerprint": "8d7285d9",
      "noteIds": [
        "agpm1-note-anforderungen",
        "agpm1-note-backlog-refinement"
      ],
      "visualHints": [
        {
          "noteId": "agpm1-note-backlog-refinement",
          "kind": "image",
          "contains": "/api/media/1e838467-c106-482b-b0d3-595812aadcc0",
          "imageSignature": "![Eine unklare Idee wird in fünf Klärungsschritten zu zwei konkreten Stories; darunter eine mögliche Definition of Ready mit fünf Kriterien.](/api/media/<image> \"Refinement ist eine laufende Aktivität. Die Definition of Ready ist eine optionale Teamvereinbarung und betrifft die Vorbereitung, nicht die Qualität des Ergebnisses.\")"
        }
      ]
    }
  }
};
