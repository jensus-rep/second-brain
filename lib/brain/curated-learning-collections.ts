import type { FlashcardPriority, LearningCollection } from "./model.ts";

export type CuratedFlashcardPriority = { fingerprint: string; priority: FlashcardPriority };

// Audited proposals are resolved against each collection's actual content.
// They become persisted choices only when the user adopts them in the UI.
export const curatedLearningCollections: {
  collections: LearningCollection[];
  priorities: Record<string, CuratedFlashcardPriority>;
} = {
  "collections": [
    {
      "id": "learning-collection-project-management",
      "title": "Projektmanagement",
      "description": "Klassisches, agiles und hybrides Projektmanagement: Grundlagen, Planung, Produktentwicklung, Scrum, Führung, Zusammenarbeit, Skalierung und Datenprojekte.",
      "noteIds": [
        "agpm1-note-start",
        "agpm1-note-quellen",
        "agpm1-note-projektauftrag",
        "agpm1-note-stakeholder",
        "agpm1-note-projektstrukturplan",
        "agpm1-note-gantt",
        "agpm1-note-produktvision",
        "agpm1-note-visionboard",
        "agpm1-note-designthinking",
        "agpm1-note-teamsetup",
        "agpm1-note-impactmapping",
        "agpm1-note-storymapping",
        "agpm1-note-mvp",
        "agpm1-note-werkzeuge",
        "agpm1-note-klassische-rollen",
        "agpm1-note-scrum-ueberblick",
        "agpm1-note-backlog-refinement",
        "agpm1-note-sprint-planning",
        "agpm1-note-sprintarbeit-daily",
        "agpm1-note-review-retrospektive",
        "agpm1-note-definition-of-done",
        "agpm1-note-story-points",
        "agpm1-note-planning-poker",
        "agpm1-note-velocity-burndown",
        "agpm1-note-releaseplanung",
        "agpm1-note-agile-skalierung",
        "agpm1-note-produktteams",
        "agpm1-note-megatrends",
        "agpm1-note-vuka",
        "agpm1-note-fuehrungstheorien",
        "agpm1-note-zielorientierte-fuehrung",
        "agpm1-note-management-vopa",
        "agpm1-note-t-shaped",
        "agpm1-note-being-agile",
        "agpm1-note-menschen-und-teams",
        "agpm1-note-data-science-nutzen",
        "agpm1-note-agile-datenprojekte",
        "agpm1-chapter-planung",
        "agpm1-chapter-produkt",
        "agpm1-chapter-scrum",
        "agpm1-chapter-fuehrung",
        "pm-note-klassisch",
        "pm-note-hybrid",
        "pm-note-begriffe-ordnen",
        "agile-note-kanban",
        "produkt-note-dual-track",
        "agile-note-user-stories-pruefen",
        "agpm1-note-pm-grundlagen",
        "agpm1-note-pm-dreieck",
        "agpm1-note-risiko",
        "agpm1-note-controlling",
        "agpm1-note-raci",
        "agpm1-note-manifest",
        "agpm1-note-lean-startup",
        "agpm1-note-veranstaltungsformate",
        "agpm1-note-anforderungen"
      ],
      "questionIds": [
        "apm-q-events-01",
        "apm-q-events-02",
        "apm-q-events-03",
        "apm-q-events-04",
        "apm-q-events-05",
        "apm-q-events-06",
        "apm-q-events-07",
        "apm-q-events-08",
        "apm-q-events-09",
        "apm-q-events-10",
        "apm-q-events-11",
        "apm-q-events-12",
        "apm-q-events-13",
        "apm-q-events-14",
        "apm-q-events-15",
        "apm-q-events-16",
        "apm-q-artefakte-01",
        "apm-q-artefakte-02",
        "apm-q-artefakte-03",
        "apm-q-artefakte-04",
        "apm-q-artefakte-05",
        "apm-q-artefakte-06",
        "apm-q-artefakte-07",
        "apm-q-artefakte-08",
        "apm-q-artefakte-09",
        "apm-q-artefakte-10",
        "apm-q-artefakte-11",
        "apm-q-artefakte-12",
        "apm-q-artefakte-13",
        "apm-q-artefakte-14",
        "apm-q-schaetzen-01",
        "apm-q-schaetzen-02",
        "apm-q-schaetzen-03",
        "apm-q-schaetzen-04",
        "apm-q-schaetzen-05",
        "apm-q-schaetzen-06",
        "apm-q-schaetzen-07",
        "apm-q-schaetzen-08",
        "apm-q-schaetzen-09",
        "apm-q-schaetzen-10",
        "apm-q-schaetzen-11",
        "apm-q-schaetzen-12",
        "apm-q-schaetzen-13",
        "apm-q-schaetzen-14",
        "apm-q-schaetzen-15",
        "apm-q-vision-01",
        "apm-q-vision-02",
        "apm-q-vision-03",
        "apm-q-vision-04",
        "apm-q-vision-05",
        "apm-q-vision-06",
        "apm-q-vision-07",
        "apm-q-vision-08",
        "apm-q-vision-09",
        "apm-q-vision-10",
        "apm-q-vision-11",
        "apm-q-mapping-01",
        "apm-q-mapping-02",
        "apm-q-mapping-03",
        "apm-q-mapping-04",
        "apm-q-mapping-05",
        "apm-q-mapping-06",
        "apm-q-mapping-07",
        "apm-q-mapping-08",
        "apm-q-mapping-09",
        "apm-q-start-01",
        "apm-q-start-02",
        "apm-q-start-03",
        "apm-q-start-04",
        "apm-q-start-05",
        "apm-q-start-06",
        "apm-q-start-07",
        "apm-q-start-08",
        "apm-q-start-09",
        "apm-q-klassisch-01",
        "apm-q-klassisch-02",
        "apm-q-klassisch-03",
        "apm-q-klassisch-04",
        "apm-q-klassisch-05",
        "apm-q-klassisch-06",
        "apm-q-klassisch-07",
        "apm-q-klassisch-08",
        "apm-q-klassisch-09",
        "apm-q-fuehrung-01",
        "apm-q-fuehrung-02",
        "apm-q-fuehrung-03",
        "apm-q-fuehrung-04",
        "apm-q-fuehrung-05",
        "apm-q-fuehrung-06",
        "apm-q-fuehrung-07",
        "apm-q-fuehrung-08",
        "apm-q-fuehrung-09",
        "apm-q-fuehrung-10",
        "apm-q-fuehrung-11",
        "apm-q-fuehrung-12",
        "apm-q-menschen-01",
        "apm-q-menschen-02",
        "apm-q-menschen-03",
        "apm-q-menschen-04",
        "apm-q-menschen-05",
        "apm-q-menschen-06",
        "apm-q-menschen-07",
        "apm-q-menschen-08",
        "apm-q-menschen-09",
        "apm-q-skalierung-01",
        "apm-q-skalierung-02",
        "apm-q-skalierung-03",
        "apm-q-skalierung-04",
        "apm-q-skalierung-05",
        "apm-q-skalierung-06",
        "apm-q-skalierung-07",
        "apm-q-skalierung-08",
        "apm-q-skalierung-09",
        "apm-q-grundlagen-01",
        "apm-q-grundlagen-02",
        "apm-q-grundlagen-03",
        "apm-q-grundlagen-04",
        "apm-q-grundlagen-05",
        "apm-q-grundlagen-06",
        "apm-q-grundlagen-07",
        "apm-q-grundlagen-08",
        "apm-q-grundlagen-09",
        "apm-q-grundlagen-10",
        "apm-q-grundlagen-11",
        "apm-q-grundlagen-12",
        "apm-q-grundlagen-13",
        "apm-q-grundlagen-14",
        "apm-q-risiko-01",
        "apm-q-risiko-02",
        "apm-q-risiko-03",
        "apm-q-risiko-04",
        "apm-q-risiko-05",
        "apm-q-risiko-06",
        "apm-q-risiko-07",
        "apm-q-risiko-08",
        "apm-q-risiko-09",
        "apm-q-start-10",
        "apm-q-start-11",
        "apm-q-klassisch-10",
        "apm-q-klassisch-11",
        "apm-q-klassisch-12",
        "apm-q-klassisch-13",
        "apm-q-manifest-01",
        "apm-q-manifest-02",
        "apm-q-manifest-03",
        "apm-q-manifest-04",
        "apm-q-manifest-05",
        "apm-q-manifest-06",
        "apm-q-manifest-07",
        "apm-q-manifest-08",
        "apm-q-manifest-09",
        "apm-q-manifest-10",
        "apm-q-manifest-11",
        "apm-q-manifest-12",
        "apm-q-manifest-13",
        "apm-q-manifest-14",
        "apm-q-manifest-15",
        "apm-q-ansaetze-01",
        "apm-q-ansaetze-02",
        "apm-q-ansaetze-03",
        "apm-q-ansaetze-04",
        "apm-q-ansaetze-05",
        "apm-q-ansaetze-06",
        "apm-q-ansaetze-07",
        "apm-q-ansaetze-08",
        "apm-q-ansaetze-09",
        "apm-q-ansaetze-10",
        "apm-q-hybrid-01",
        "apm-q-hybrid-02",
        "apm-q-hybrid-03",
        "apm-q-hybrid-04",
        "apm-q-hybrid-05",
        "apm-q-hybrid-06",
        "apm-q-hybrid-07",
        "apm-q-hybrid-08",
        "apm-q-hybrid-09",
        "apm-q-hybrid-10",
        "apm-q-hybrid-11",
        "apm-q-hybrid-12",
        "apm-q-formate-01",
        "apm-q-formate-02",
        "apm-q-formate-03",
        "apm-q-formate-04",
        "apm-q-formate-05",
        "apm-q-formate-06",
        "apm-q-formate-07",
        "apm-q-formate-08",
        "apm-q-formate-09",
        "apm-q-artefakte-15",
        "apm-q-artefakte-16",
        "apm-q-artefakte-17"
      ],
      "cardIds": [],
      "pathIds": [
        "agpm1-path-grundlagen",
        "agpm1-path-produkt",
        "agpm1-path-scrum",
        "agpm1-path-fuehrung"
      ]
    },
    {
      "id": "learning-collection-research-methods",
      "title": "Forschungsmethoden",
      "description": "Vollständiger vorhandener Lernumfang zu wissenschaftlichem Arbeiten, quantitativer und qualitativer Forschung sowie Fallstudien und Design Science. Die Forschungsfragen gehören zu dieser eigenständigen Sammlung.",
      "noteIds": [
        "fm-note-forschungslogik",
        "fm-note-guetekriterien",
        "fm-note-forschungsfrage",
        "fm-note-stichprobe",
        "fm-note-quant-erhebung",
        "fm-note-quant-auswertung",
        "fm-note-qual-prozess",
        "fm-note-qual-erhebung",
        "fm-note-qual-auswertung",
        "fm-note-fallstudien",
        "fm-note-design-science",
        "fm-note-artefakte",
        "fm-note-methodenprofile",
        "fm-note-forschungsskizze",
        "fm-note-quellen"
      ],
      "questionIds": [
        "fm-q-logik-01",
        "fm-q-logik-02",
        "fm-q-logik-03",
        "fm-q-logik-04",
        "fm-q-logik-05",
        "fm-q-logik-06",
        "fm-q-logik-07",
        "fm-q-logik-08",
        "fm-q-logik-09",
        "fm-q-logik-10",
        "fm-q-logik-11",
        "fm-q-hypothese-01",
        "fm-q-hypothese-02",
        "fm-q-hypothese-03",
        "fm-q-hypothese-04",
        "fm-q-hypothese-05",
        "fm-q-hypothese-06",
        "fm-q-hypothese-07",
        "fm-q-hypothese-08",
        "fm-q-hypothese-09",
        "fm-q-erhebung-01",
        "fm-q-erhebung-02",
        "fm-q-erhebung-03",
        "fm-q-erhebung-04",
        "fm-q-erhebung-05",
        "fm-q-erhebung-06",
        "fm-q-erhebung-07",
        "fm-q-erhebung-08",
        "fm-q-erhebung-09",
        "fm-q-erhebung-10",
        "fm-q-erhebung-11",
        "fm-q-auswertung-01",
        "fm-q-auswertung-02",
        "fm-q-auswertung-03",
        "fm-q-auswertung-04",
        "fm-q-auswertung-05",
        "fm-q-auswertung-06",
        "fm-q-auswertung-07",
        "fm-q-auswertung-08",
        "fm-q-auswertung-09",
        "fm-q-auswertung-10",
        "fm-q-auswertung-11",
        "fm-q-auswertung-12",
        "fm-q-qualerhebung-01",
        "fm-q-qualerhebung-02",
        "fm-q-qualerhebung-03",
        "fm-q-qualerhebung-04",
        "fm-q-qualerhebung-05",
        "fm-q-qualerhebung-06",
        "fm-q-qualerhebung-07",
        "fm-q-qualerhebung-08",
        "fm-q-qualerhebung-09",
        "fm-q-qualerhebung-10",
        "fm-q-qualerhebung-11",
        "fm-q-qualauswertung-01",
        "fm-q-qualauswertung-02",
        "fm-q-qualauswertung-03",
        "fm-q-qualauswertung-04",
        "fm-q-qualauswertung-05",
        "fm-q-qualauswertung-06",
        "fm-q-qualauswertung-07",
        "fm-q-qualauswertung-08",
        "fm-q-qualauswertung-09",
        "fm-q-design-01",
        "fm-q-design-02",
        "fm-q-design-03",
        "fm-q-design-04",
        "fm-q-design-05",
        "fm-q-design-06",
        "fm-q-design-07",
        "fm-q-design-08",
        "fm-q-design-09",
        "fm-q-design-10",
        "fm-q-design-11",
        "fm-q-design-12",
        "fm-q-design-13",
        "fm-q-design-14",
        "fm-q-praxis-01",
        "fm-q-praxis-02",
        "fm-q-praxis-03",
        "fm-q-praxis-04",
        "fm-q-praxis-05",
        "fm-q-praxis-06",
        "fm-q-praxis-07",
        "fm-q-praxis-08",
        "fm-q-praxis-09",
        "fm-q-praxis-10"
      ],
      "cardIds": [],
      "pathIds": []
    },
    {
      "id": "learning-collection-artificial-intelligence",
      "title": "Künstliche Intelligenz",
      "description": "Alle vorhandenen Grundlagen und Lernkarten zu künstlicher Intelligenz und den Arten maschinellen Lernens. Für diese Sammlung sind bisher keine Multiple-Choice-Fragen oder Lernpfade hinterlegt.",
      "noteIds": [
        "ki-note-ueberblick",
        "ki-note-machine-learning",
        "ki-note-supervised",
        "ki-note-unsupervised",
        "ki-note-self-supervised",
        "ki-note-reinforcement"
      ],
      "questionIds": [],
      "cardIds": [],
      "pathIds": []
    },
    {
      "id": "learning-collection-software-development",
      "title": "Softwareentwicklung",
      "description": "Alle vorhandenen Grundlagen und Lernkarten zu Softwareentwicklung, Python und Webentwicklung mit Django. Für diese Sammlung sind bisher keine Multiple-Choice-Fragen oder Lernpfade hinterlegt.",
      "noteIds": [
        "swe-note-paradigmen",
        "swe-note-funktional",
        "swe-note-simpy",
        "swe-note-oop-uml",
        "swe-note-django",
        "swe-note-django-orm",
        "swe-note-templates-api",
        "swe-note-ausblick",
        "swe-note-projekt",
        "swe-note-quellen"
      ],
      "questionIds": [],
      "cardIds": [],
      "pathIds": []
    }
  ],
  "priorities": {
    "agpm1-card-product-grid-achse": {
      "fingerprint": "6ae75398",
      "priority": 1
    },
    "agpm1-card-product-grid-felder": {
      "fingerprint": "8072a6a1",
      "priority": 1
    },
    "agpm1-card-product-grid-fall": {
      "fingerprint": "1ec8f4a0",
      "priority": 1
    },
    "agpm1-card-product-visionboard-zweck": {
      "fingerprint": "68cc0313",
      "priority": 1
    },
    "agpm1-card-product-visionboard-standard": {
      "fingerprint": "b6c825c1",
      "priority": 1
    },
    "agpm1-card-product-visionboard-erweitert": {
      "fingerprint": "cbda28f6",
      "priority": 2
    },
    "agpm1-card-product-vision-qualitaet": {
      "fingerprint": "06dc3169",
      "priority": 2
    },
    "agpm1-card-product-vision-begriff": {
      "fingerprint": "acf5a2f9",
      "priority": 1
    },
    "agpm1-card-product-vision-pitch": {
      "fingerprint": "7c2fe2b7",
      "priority": 2
    },
    "agpm1-card-product-vision-canvas": {
      "fingerprint": "11e2a817",
      "priority": 2
    },
    "agpm1-card-product-sprint-null": {
      "fingerprint": "e9d14d12",
      "priority": 2
    },
    "agpm1-card-product-design-phasen": {
      "fingerprint": "32d4894c",
      "priority": 1
    },
    "agpm1-card-product-design-fokus": {
      "fingerprint": "30aef3ff",
      "priority": 1
    },
    "agpm1-card-product-empathize-methoden": {
      "fingerprint": "31caee5e",
      "priority": 1
    },
    "agpm1-card-product-635-kurs": {
      "fingerprint": "f7b6f6de",
      "priority": 2
    },
    "agpm1-card-product-crazy-eight": {
      "fingerprint": "970fa76b",
      "priority": 2
    },
    "agpm1-card-product-impact-begriff": {
      "fingerprint": "8c68279e",
      "priority": 1
    },
    "agpm1-card-product-impact-fragen": {
      "fingerprint": "2caeb3ce",
      "priority": 1
    },
    "agpm1-card-product-storymap-begriff": {
      "fingerprint": "7bdae3e8",
      "priority": 1
    },
    "agpm1-card-product-mvp-heuristik": {
      "fingerprint": "b3d48d73",
      "priority": 1
    },
    "agpm1-card-product-mvp-varianten": {
      "fingerprint": "adeb1a3f",
      "priority": 2
    },
    "agpm1-card-product-impact-fall": {
      "fingerprint": "abb0cc38",
      "priority": 1
    },
    "agpm1-card-product-mc-design": {
      "fingerprint": "53e313af",
      "priority": 1
    },
    "agpm1-card-product-mc-vision": {
      "fingerprint": "79c85932",
      "priority": 2
    },
    "agpm1-card-product-auftrag-begriff": {
      "fingerprint": "b4ae0847",
      "priority": 1
    },
    "agpm1-card-product-auftrag-inhalte": {
      "fingerprint": "d2895c07",
      "priority": 1
    },
    "agpm1-card-product-auftrag-tipps": {
      "fingerprint": "b6e8a2eb",
      "priority": 1
    },
    "agpm1-card-product-psp-begriff": {
      "fingerprint": "4ef31e5a",
      "priority": 1
    },
    "agpm1-card-product-psp-formen": {
      "fingerprint": "33c7c085",
      "priority": 2
    },
    "agpm1-card-product-psp-storymap": {
      "fingerprint": "6141e0f3",
      "priority": 1
    },
    "agpm1-card-product-gantt-begriff": {
      "fingerprint": "2970e31a",
      "priority": 1
    },
    "agpm1-card-product-gantt-elemente": {
      "fingerprint": "6bd36f37",
      "priority": 1
    },
    "agpm1-card-product-gantt-agil": {
      "fingerprint": "c767ef3d",
      "priority": 2
    },
    "agpm1-card-product-tool-prinzip": {
      "fingerprint": "d42e787e",
      "priority": 1
    },
    "agpm1-card-product-tool-beispiele": {
      "fingerprint": "efef647e",
      "priority": 2
    },
    "agpm1-card-product-phasen": {
      "fingerprint": "de6ae6eb",
      "priority": 1
    },
    "agpm1-card-product-rollen-aufbau": {
      "fingerprint": "d329de7a",
      "priority": 1
    },
    "agpm1-card-product-lenkungsausschuss": {
      "fingerprint": "0fc5ce34",
      "priority": 1
    },
    "agpm1-card-product-rollen-konflikt": {
      "fingerprint": "31be913c",
      "priority": 1
    },
    "agpm1-card-product-gantt-fall": {
      "fingerprint": "15a38f6d",
      "priority": 1
    },
    "agpm1-card-product-mc-auftrag": {
      "fingerprint": "b9a7c8b4",
      "priority": 1
    },
    "agpm1-card-product-stakeholder-register": {
      "fingerprint": "389bddfc",
      "priority": 1
    },
    "agpm1-card-product-tool-scrum": {
      "fingerprint": "72a4603a",
      "priority": 1
    },
    "agpm1-card-product-arbeitspaket": {
      "fingerprint": "cc5e0b2c",
      "priority": 1
    },
    "agpm1-card-agiler-start-rahmen": {
      "fingerprint": "d8f8ef83",
      "priority": 1
    },
    "agpm1-card-safe-kurs": {
      "fingerprint": "64d9468d",
      "priority": 2
    },
    "agpm1-card-art-kurswert": {
      "fingerprint": "739ffc7a",
      "priority": 2
    },
    "agpm1-card-less-kurs": {
      "fingerprint": "04d968ce",
      "priority": 2
    },
    "agpm1-card-nexus-kurs": {
      "fingerprint": "a0bc693d",
      "priority": 2
    },
    "agpm1-card-spotify-ubertragung": {
      "fingerprint": "8a6718b7",
      "priority": 2
    },
    "agpm1-card-flightlevels-kurs": {
      "fingerprint": "c90d2ee5",
      "priority": 3
    },
    "agpm1-card-produktteam-verantwortung": {
      "fingerprint": "b3396791",
      "priority": 1
    },
    "agpm1-card-skalierung-kontext": {
      "fingerprint": "321d1f55",
      "priority": 1
    },
    "agpm1-card-skalierung-mc": {
      "fingerprint": "5e606ab8",
      "priority": 2
    },
    "agpm1-card-scrum-of-scrums": {
      "fingerprint": "14d1218b",
      "priority": 2
    },
    "agpm1-card-devops-devsecops": {
      "fingerprint": "beee1737",
      "priority": 2
    },
    "agpm1-card-enabler-teams": {
      "fingerprint": "0f02d741",
      "priority": 3
    },
    "agpm1-card-megatrends-liste": {
      "fingerprint": "b914f2f8",
      "priority": 2
    },
    "agpm1-card-vuka-begriffe": {
      "fingerprint": "b53eedec",
      "priority": 1
    },
    "agpm1-card-eigenschaft-oder-verhalten": {
      "fingerprint": "fc113980",
      "priority": 1
    },
    "agpm1-card-lewin-stile": {
      "fingerprint": "fbac4c1b",
      "priority": 1
    },
    "agpm1-card-situative-fuehrung": {
      "fingerprint": "c94a6366",
      "priority": 1
    },
    "agpm1-card-mbo-prinzip": {
      "fingerprint": "9c1439a8",
      "priority": 1
    },
    "agpm1-card-ziele-vereinbaren-vorgeben": {
      "fingerprint": "37b9537f",
      "priority": 1
    },
    "agpm1-card-okr-prinzip": {
      "fingerprint": "8f2f4701",
      "priority": 1
    },
    "agpm1-card-smart-mc": {
      "fingerprint": "3ced4f8f",
      "priority": 1
    },
    "agpm1-card-malik-management-fuehrung": {
      "fingerprint": "9fd83c4d",
      "priority": 2
    },
    "agpm1-card-vopa-buchstaben": {
      "fingerprint": "471917c0",
      "priority": 1
    },
    "agpm1-card-t-shaped-achsen": {
      "fingerprint": "c11460a2",
      "priority": 1
    },
    "agpm1-card-vopa-transfer": {
      "fingerprint": "c0e4c70b",
      "priority": 1
    },
    "agpm1-card-fuehrungstheorien-mc": {
      "fingerprint": "528d0e1d",
      "priority": 1
    },
    "agpm1-card-vuka-transfer": {
      "fingerprint": "a179e715",
      "priority": 1
    },
    "agpm1-card-mbo-okr-abgrenzung": {
      "fingerprint": "0621a533",
      "priority": 2
    },
    "agpm1-card-megatrends-fuehrung": {
      "fingerprint": "dccbc63f",
      "priority": 2
    },
    "agpm1-card-vopa-vuka-mc": {
      "fingerprint": "821229fd",
      "priority": 1
    },
    "agpm1-card-eisberg-kursheuristik": {
      "fingerprint": "8c35b448",
      "priority": 2
    },
    "agpm1-card-tzi-faktoren": {
      "fingerprint": "df426976",
      "priority": 1
    },
    "agpm1-card-teamuhr-phasen": {
      "fingerprint": "fc22900e",
      "priority": 1
    },
    "agpm1-card-teamkonflikt-transfer": {
      "fingerprint": "cd11303f",
      "priority": 1
    },
    "agpm1-card-full-stack-daten": {
      "fingerprint": "aa04c7cd",
      "priority": 2
    },
    "agpm1-card-data-maturity": {
      "fingerprint": "a6f1706c",
      "priority": 1
    },
    "agpm1-card-methodenkasten-datenprojekte": {
      "fingerprint": "c2bedfbe",
      "priority": 1
    },
    "agpm1-card-eisberg-tzi-mc": {
      "fingerprint": "f5df9162",
      "priority": 1
    },
    "agpm1-card-datenprojekt-erfolgsfaktoren": {
      "fingerprint": "fe4afb73",
      "priority": 1
    },
    "agpm1-card-lernfreiraum-podcast": {
      "fingerprint": "be253ff5",
      "priority": 2
    },
    "produkt-card-dualtrack-kern": {
      "fingerprint": "f5980a20",
      "priority": 2
    },
    "produkt-card-dualtrack-fehler": {
      "fingerprint": "83c1bde1",
      "priority": 2
    },
    "produkt-card-dualtrack-umfang": {
      "fingerprint": "359db835",
      "priority": 2
    },
    "produkt-card-dualtrack-validate": {
      "fingerprint": "f5f21dd5",
      "priority": 2
    },
    "produkt-card-dualtrack-evidenz": {
      "fingerprint": "9917b515",
      "priority": 3
    },
    "product-card-storymap-walking-skeleton": {
      "fingerprint": "dfa44ff3",
      "priority": 2
    },
    "product-card-storymap-slices": {
      "fingerprint": "ec36c47d",
      "priority": 2
    },
    "product-card-mvp-viable": {
      "fingerprint": "9f5a33fa",
      "priority": 1
    },
    "pm-card-hybrid-tailoring": {
      "fingerprint": "9e63109b",
      "priority": 1
    },
    "pm-card-hybrid-muster": {
      "fingerprint": "4aa3f77c",
      "priority": 2
    },
    "pm-card-hybrid-einstufung": {
      "fingerprint": "34fa81e3",
      "priority": 1
    },
    "pm-card-klassisch-wann": {
      "fingerprint": "6a5638f9",
      "priority": 1
    },
    "pm-card-klassisch-aenderung": {
      "fingerprint": "f62964d3",
      "priority": 1
    },
    "pm-card-klassisch-stacey": {
      "fingerprint": "d5a48b87",
      "priority": 1
    },
    "agpm1-card-t-shaped-fullstack": {
      "fingerprint": "893d76d2",
      "priority": 2
    },
    "agpm1-card-t-shaped-fall": {
      "fingerprint": "c53a8ed6",
      "priority": 2
    },
    "agpm1-card-vuka-komplex-kompliziert": {
      "fingerprint": "95cffbd5",
      "priority": 1
    },
    "agpm1-card-vuka-orientierung": {
      "fingerprint": "9b3ca71a",
      "priority": 2
    },
    "agpm1-card-megatrends-person": {
      "fingerprint": "e3d88292",
      "priority": 2
    },
    "agpm1-card-datenprojekte-iterativ": {
      "fingerprint": "6d2c2a49",
      "priority": 1
    },
    "agpm1-card-datenprojekte-zweck-mittel": {
      "fingerprint": "50f7e3ad",
      "priority": 1
    },
    "agpm1-card-stakeholder-definition": {
      "fingerprint": "d011b091",
      "priority": 1
    },
    "agpm1-card-stakeholder-grid-beispiele": {
      "fingerprint": "7eda220a",
      "priority": 2
    },
    "agpm1-card-stakeholder-agil": {
      "fingerprint": "75cf88e2",
      "priority": 1
    },
    "agpm1-card-psp-ablauf": {
      "fingerprint": "9eba3027",
      "priority": 1
    },
    "agpm1-card-psp-arbeitspaket": {
      "fingerprint": "22348e4d",
      "priority": 1
    },
    "agpm1-card-gantt-vs-agil": {
      "fingerprint": "87a74958",
      "priority": 1
    },
    "agpm1-card-gantt-nachteile": {
      "fingerprint": "a2dd1cf5",
      "priority": 1
    },
    "agpm1-card-rollen-auftraggeber": {
      "fingerprint": "7ed823bc",
      "priority": 1
    },
    "agpm1-card-projektorganisation-parallel": {
      "fingerprint": "8e17de20",
      "priority": 1
    },
    "agpm1-card-tool-ausprobieren": {
      "fingerprint": "733f7704",
      "priority": 2
    },
    "agpm1-card-agile-produktentwicklung-fallbeispiel": {
      "fingerprint": "eacd1108",
      "priority": 3
    },
    "agpm1-card-vision-nordstern": {
      "fingerprint": "eb46b51d",
      "priority": 1
    },
    "agpm1-card-vision-beispiel": {
      "fingerprint": "4b8782e6",
      "priority": 2
    },
    "agpm1-card-visionboard-vorgehen": {
      "fingerprint": "67683b07",
      "priority": 2
    },
    "agpm1-card-design-persona-beispiel": {
      "fingerprint": "a103d85d",
      "priority": 2
    },
    "agpm1-card-design-ideate-beispiel": {
      "fingerprint": "4968cc38",
      "priority": 3
    },
    "agpm1-card-design-ideate-regeln": {
      "fingerprint": "bcf34db1",
      "priority": 1
    },
    "agpm1-card-impact-beispiel": {
      "fingerprint": "6dcfeaab",
      "priority": 2
    },
    "agpm1-card-impact-einsatz": {
      "fingerprint": "04edd2d2",
      "priority": 1
    },
    "agpm1-card-storymap-nutzen": {
      "fingerprint": "5b106123",
      "priority": 1
    },
    "agpm1-card-storymap-beispiel": {
      "fingerprint": "234f56b3",
      "priority": 2
    },
    "agpm1-card-fuehrungstheorien-reihenfolge": {
      "fingerprint": "97b7763f",
      "priority": 3
    },
    "agpm1-card-tzi-globe": {
      "fingerprint": "5d75ff76",
      "priority": 2
    },
    "agpm1-card-grund-business-change": {
      "fingerprint": "3134d11e",
      "priority": 1
    },
    "agpm1-card-grund-standards": {
      "fingerprint": "16441caf",
      "priority": 3
    },
    "agpm1-card-grund-projektdefinitionen": {
      "fingerprint": "103ef1f4",
      "priority": 2
    },
    "agpm1-card-grund-projektmerkmale": {
      "fingerprint": "8cb527a1",
      "priority": 1
    },
    "agpm1-card-grund-pm-definitionen": {
      "fingerprint": "ddac9283",
      "priority": 1
    },
    "agpm1-card-grund-pmi-prozesse": {
      "fingerprint": "5fac78eb",
      "priority": 1
    },
    "agpm1-card-grund-aufgaben-prince2": {
      "fingerprint": "bf70e119",
      "priority": 1
    },
    "agpm1-card-grund-fachgewerke": {
      "fingerprint": "d42aa00d",
      "priority": 1
    },
    "agpm1-card-grund-steuern-fall": {
      "fingerprint": "8d64d86b",
      "priority": 1
    },
    "agpm1-card-grund-dreieck": {
      "fingerprint": "a84a02ad",
      "priority": 1
    },
    "agpm1-card-grund-dimensionen": {
      "fingerprint": "b6cfa0c5",
      "priority": 1
    },
    "agpm1-card-grund-scope": {
      "fingerprint": "25419f93",
      "priority": 1
    },
    "agpm1-card-grund-klassisch-schlagworte": {
      "fingerprint": "7ad3b6ca",
      "priority": 2
    },
    "agpm1-card-grund-klassisch-hierarchien": {
      "fingerprint": "5d839620",
      "priority": 2
    },
    "agpm1-card-grund-klassisch-techniken": {
      "fingerprint": "204c6491",
      "priority": 2
    },
    "agpm1-card-grund-literaturueberblick": {
      "fingerprint": "985d2ac2",
      "priority": 3
    },
    "agpm1-card-grund-statusbericht": {
      "fingerprint": "543e7f46",
      "priority": 1
    },
    "agpm1-card-grund-eskalation-fall": {
      "fingerprint": "49eaec99",
      "priority": 2
    },
    "agpm1-card-grund-projektabschluss": {
      "fingerprint": "026516ab",
      "priority": 1
    },
    "agpm1-card-grund-lessons-learned": {
      "fingerprint": "dc52fb90",
      "priority": 1
    },
    "agpm1-card-grund-pflichtenheft": {
      "fingerprint": "3ace00f3",
      "priority": 2
    },
    "agpm1-card-grund-auftrag-zeitpunkt": {
      "fingerprint": "6906fc8a",
      "priority": 1
    },
    "agpm1-card-grund-kickoff": {
      "fingerprint": "e2ab64ee",
      "priority": 1
    },
    "agpm1-card-grund-stakeholder-einstellung": {
      "fingerprint": "8d946dc6",
      "priority": 1
    },
    "agpm1-card-grund-stakeholder-ebenen": {
      "fingerprint": "8468b743",
      "priority": 2
    },
    "agpm1-card-grund-stakeholder-realitaet": {
      "fingerprint": "ea78793f",
      "priority": 1
    },
    "agpm1-card-grund-stakeholder-fenster": {
      "fingerprint": "c4c45330",
      "priority": 2
    },
    "agpm1-card-grund-echte-kunden": {
      "fingerprint": "e664e110",
      "priority": 1
    },
    "agpm1-card-grund-ablaufplan": {
      "fingerprint": "85d402f3",
      "priority": 1
    },
    "agpm1-card-grund-risiko-definition": {
      "fingerprint": "78d6882d",
      "priority": 1
    },
    "agpm1-card-grund-risiko-umgang": {
      "fingerprint": "71053b1c",
      "priority": 1
    },
    "agpm1-card-grund-risikomatrix": {
      "fingerprint": "ead4e8c1",
      "priority": 1
    },
    "agpm1-card-grund-risikostrategien": {
      "fingerprint": "f9a6fed3",
      "priority": 1
    },
    "agpm1-card-grund-risiko-fall": {
      "fingerprint": "73710c5f",
      "priority": 1
    },
    "agpm1-card-grund-risiko-agil": {
      "fingerprint": "c34c83be",
      "priority": 1
    },
    "agpm1-card-grund-controlling-din": {
      "fingerprint": "7fddd4a8",
      "priority": 1
    },
    "agpm1-card-grund-controlling-vergleich": {
      "fingerprint": "a96bb369",
      "priority": 1
    },
    "agpm1-card-grund-raci-buchstaben": {
      "fingerprint": "7c81a90c",
      "priority": 1
    },
    "agpm1-card-grund-raci-aufbau": {
      "fingerprint": "58d81746",
      "priority": 1
    },
    "agpm1-card-grund-raci-beispiel": {
      "fingerprint": "bedfb97f",
      "priority": 2
    },
    "agpm1-card-grund-raci-fehler": {
      "fingerprint": "57cb7e3d",
      "priority": 1
    },
    "agpm1-card-grund-raci-agil": {
      "fingerprint": "12f4c4cb",
      "priority": 2
    },
    "agpm1-card-grund-raci-hybrid": {
      "fingerprint": "0f5c845f",
      "priority": 1
    },
    "agpm1-card-grund-raci-mc": {
      "fingerprint": "e5bb2641",
      "priority": 1
    },
    "agpm1-card-grund-kein-pl-neben-po": {
      "fingerprint": "8185f90d",
      "priority": 1
    },
    "agpm1-card-grund-teambuilding": {
      "fingerprint": "e332a6d6",
      "priority": 1
    },
    "agpm1-card-grund-use-case": {
      "fingerprint": "eb08d48f",
      "priority": 1
    },
    "agpm1-card-grund-datenqualitaet": {
      "fingerprint": "fc40105b",
      "priority": 1
    },
    "agpm1-card-grund-einstieg-agilitaet": {
      "fingerprint": "4cf08dfa",
      "priority": 3
    },
    "agpm1-card-agil-lean-startup": {
      "fingerprint": "101a26db",
      "priority": 2
    },
    "agpm1-card-agil-lean-bml": {
      "fingerprint": "e25bde52",
      "priority": 1
    },
    "agpm1-card-agil-lean-mvp-begriff": {
      "fingerprint": "946b6365",
      "priority": 1
    },
    "agpm1-card-agil-reflexion-scheitern": {
      "fingerprint": "a74be4de",
      "priority": 1
    },
    "agpm1-card-agil-reflexion-bruecke": {
      "fingerprint": "8d01598c",
      "priority": 1
    },
    "agpm1-card-agil-reflexion-kriterien": {
      "fingerprint": "3d8e0845",
      "priority": 1
    },
    "agpm1-card-agil-hybrid-begriff": {
      "fingerprint": "264e3366",
      "priority": 1
    },
    "agpm1-card-agil-hybrid-agile-elemente": {
      "fingerprint": "db737fc7",
      "priority": 1
    },
    "agpm1-card-agil-hybrid-klassische-elemente": {
      "fingerprint": "b02cb4db",
      "priority": 1
    },
    "agpm1-card-agil-hybrid-varianten": {
      "fingerprint": "186791c3",
      "priority": 2
    },
    "agpm1-card-agil-stacey-achsen": {
      "fingerprint": "ba7ab6e3",
      "priority": 1
    },
    "agpm1-card-agil-stacey-felder": {
      "fingerprint": "24d01b07",
      "priority": 1
    },
    "agpm1-card-agil-stacey-methoden": {
      "fingerprint": "b5eb6bef",
      "priority": 1
    },
    "agpm1-card-agil-stacey-kompliziert": {
      "fingerprint": "3c1e0c00",
      "priority": 2
    },
    "agpm1-card-agil-stacey-designthinking": {
      "fingerprint": "50376adb",
      "priority": 2
    },
    "agpm1-card-agil-stacey-diehl": {
      "fingerprint": "e3a07939",
      "priority": 3
    },
    "agpm1-card-agil-stacey-mc": {
      "fingerprint": "f4f0b0a1",
      "priority": 1
    },
    "agpm1-card-agil-dt-beobachten-sichtweise": {
      "fingerprint": "1848e937",
      "priority": 1
    },
    "agpm1-card-agil-dt-prototyp-feedback": {
      "fingerprint": "4d6cdc46",
      "priority": 1
    },
    "agpm1-card-product-team-vorbereitung": {
      "fingerprint": "a2cafbf3",
      "priority": 1
    },
    "agpm1-card-product-team-agreement": {
      "fingerprint": "3ded8812",
      "priority": 1
    },
    "agpm1-card-product-lean-kontext": {
      "fingerprint": "0250dd37",
      "priority": 3
    },
    "agpm1-card-refinement-zweck": {
      "fingerprint": "44efcb84",
      "priority": 1
    },
    "agpm1-card-ready-kriterien": {
      "fingerprint": "72cff2fa",
      "priority": 2
    },
    "agpm1-card-refinement-beteiligte": {
      "fingerprint": "91261c10",
      "priority": 2
    },
    "agpm1-card-planning-ergebnis": {
      "fingerprint": "65cbd3c5",
      "priority": 1
    },
    "agpm1-card-planning-timebox": {
      "fingerprint": "e25009a2",
      "priority": 2
    },
    "agpm1-card-backlogs-verantwortung": {
      "fingerprint": "40e4d9ae",
      "priority": 1
    },
    "agpm1-card-daily-kursformat": {
      "fingerprint": "c1c33035",
      "priority": 1
    },
    "agpm1-card-swarming": {
      "fingerprint": "419df562",
      "priority": 2
    },
    "agpm1-card-review-ergebnis": {
      "fingerprint": "92ef4274",
      "priority": 1
    },
    "agpm1-card-retro-ergebnis": {
      "fingerprint": "6b2e8e5a",
      "priority": 1
    },
    "agpm1-card-review-retro-unterschied": {
      "fingerprint": "5269c9cb",
      "priority": 1
    },
    "agpm1-card-dod-zweck": {
      "fingerprint": "0135dd44",
      "priority": 1
    },
    "agpm1-card-dod-beispiele": {
      "fingerprint": "14bcf9a4",
      "priority": 2
    },
    "agpm1-card-dod-akzeptanz": {
      "fingerprint": "71efa5f0",
      "priority": 1
    },
    "agpm1-card-velocity-bedeutung": {
      "fingerprint": "e051e526",
      "priority": 1
    },
    "agpm1-card-velocity-rechnung": {
      "fingerprint": "fc8c1908",
      "priority": 2
    },
    "agpm1-card-burndown-achsen": {
      "fingerprint": "644521d6",
      "priority": 1
    },
    "agpm1-card-burndown-muster": {
      "fingerprint": "93167624",
      "priority": 2
    },
    "agpm1-card-velocity-burndown-unterschied": {
      "fingerprint": "61b05efe",
      "priority": 1
    },
    "agpm1-card-storypoints-keine-stunden": {
      "fingerprint": "8d48a0ec",
      "priority": 1
    },
    "agpm1-card-fibonacci-skala": {
      "fingerprint": "201a91ac",
      "priority": 2
    },
    "agpm1-card-planning-poker-ablauf": {
      "fingerprint": "bff34cfb",
      "priority": 2
    },
    "agpm1-card-releaseplanung-zweck": {
      "fingerprint": "d6030711",
      "priority": 1
    },
    "agpm1-card-release-rechnung": {
      "fingerprint": "32df9218",
      "priority": 2
    },
    "agpm1-card-release-mvp-fall": {
      "fingerprint": "2bf9368e",
      "priority": 2
    },
    "agpm1-card-daily-mc": {
      "fingerprint": "8d8fd6ae",
      "priority": 1
    },
    "agpm1-card-dod-mc": {
      "fingerprint": "4349fc6b",
      "priority": 1
    },
    "agpm1-card-scrum-artefakte": {
      "fingerprint": "63f901e0",
      "priority": 1
    },
    "agpm1-card-refinement-ready-einordnung": {
      "fingerprint": "4c4edd87",
      "priority": 1
    },
    "agpm1-card-daily-statusbericht": {
      "fingerprint": "ce157897",
      "priority": 1
    },
    "agpm1-card-sprint-po-eingriff": {
      "fingerprint": "accab550",
      "priority": 1
    },
    "agpm1-card-schatzung-mc": {
      "fingerprint": "c06a5b4c",
      "priority": 1
    },
    "agpm1-card-scrummaster-teilnahme-korrektur": {
      "fingerprint": "cb729303",
      "priority": 1
    },
    "agpm1-card-scrum-team-terminologie": {
      "fingerprint": "14f86b0a",
      "priority": 1
    },
    "agpm1-card-release-mc": {
      "fingerprint": "dff89452",
      "priority": 1
    },
    "agpm1-card-taskboard-einsatz": {
      "fingerprint": "1eca33a7",
      "priority": 1
    },
    "agpm1-card-doing-being-unterschied": {
      "fingerprint": "2ade3925",
      "priority": 1
    },
    "agpm1-card-manifest-kursbezug": {
      "fingerprint": "f337ea77",
      "priority": 1
    },
    "agpm1-card-agiles-theater-transfer": {
      "fingerprint": "c06de35f",
      "priority": 1
    },
    "pm-card-begriffe-framework-methode": {
      "fingerprint": "d9a2be19",
      "priority": 2
    },
    "pm-card-begriffe-ebenen": {
      "fingerprint": "e3e29e27",
      "priority": 3
    },
    "pm-card-begriffe-scrum-kanban": {
      "fingerprint": "a8e9a291",
      "priority": 2
    },
    "pm-card-begriffe-storymapping": {
      "fingerprint": "673e51e5",
      "priority": 3
    },
    "pm-card-begriffe-storypoints": {
      "fingerprint": "10fa0e47",
      "priority": 2
    },
    "pm-card-begriffe-doppelnatur": {
      "fingerprint": "f8b59632",
      "priority": 3
    },
    "pm-card-begriffe-dod-dor": {
      "fingerprint": "95aa95d7",
      "priority": 1
    },
    "pm-card-begriffe-neumann": {
      "fingerprint": "30352043",
      "priority": 3
    },
    "agile-card-kanban-praktiken": {
      "fingerprint": "7eda906f",
      "priority": 1
    },
    "agile-card-kanban-board": {
      "fingerprint": "574bb68c",
      "priority": 1
    },
    "agile-card-kanban-kennzahlen": {
      "fingerprint": "212bd4a9",
      "priority": 1
    },
    "agile-card-kanban-little": {
      "fingerprint": "baaad69c",
      "priority": 2
    },
    "agile-card-kanban-scrum": {
      "fingerprint": "f120e3ca",
      "priority": 1
    },
    "agile-card-stories-invest": {
      "fingerprint": "56edb8c0",
      "priority": 1
    },
    "agile-card-stories-atomar-minimal": {
      "fingerprint": "bbaba18f",
      "priority": 2
    },
    "agile-card-stories-qus-gruppen": {
      "fingerprint": "add7e8ea",
      "priority": 3
    },
    "agile-card-stories-abweichung": {
      "fingerprint": "4096605b",
      "priority": 2
    },
    "agile-card-stories-ac-dod": {
      "fingerprint": "72a99fe4",
      "priority": 1
    },
    "agpm1-card-planning-drei-themen": {
      "fingerprint": "159d0ab5",
      "priority": 1
    },
    "agpm1-card-planning-dialog": {
      "fingerprint": "070bec7b",
      "priority": 1
    },
    "agpm1-card-storypoints-referenz": {
      "fingerprint": "c082e33d",
      "priority": 2
    },
    "agpm1-card-poker-extreme": {
      "fingerprint": "b9ea8d30",
      "priority": 2
    },
    "agpm1-card-team-kompetenzmatrix": {
      "fingerprint": "eb8c9159",
      "priority": 2
    },
    "agpm1-card-agiles-theater-ursache": {
      "fingerprint": "404f1dc9",
      "priority": 2
    },
    "agpm1-card-refinement-ablauf": {
      "fingerprint": "51f293b7",
      "priority": 2
    },
    "agpm1-card-refinement-stolperfallen": {
      "fingerprint": "3ba38087",
      "priority": 1
    },
    "agpm1-card-planning-beispiel": {
      "fingerprint": "198c5998",
      "priority": 2
    },
    "agpm1-card-planning-freiwillig": {
      "fingerprint": "42d290c7",
      "priority": 1
    },
    "agpm1-card-planning-tipps": {
      "fingerprint": "9444a17f",
      "priority": 1
    },
    "agpm1-card-sprintbacklog-daily-nutzen": {
      "fingerprint": "8e2ce3c6",
      "priority": 1
    },
    "agpm1-card-review-ablauf": {
      "fingerprint": "15edfda9",
      "priority": 2
    },
    "agpm1-card-retro-grundsaetze": {
      "fingerprint": "0e39f383",
      "priority": 1
    },
    "agpm1-card-review-retro-fehler": {
      "fingerprint": "eb5c7953",
      "priority": 2
    },
    "agpm1-card-dod-mindeststandard": {
      "fingerprint": "afebaee6",
      "priority": 1
    },
    "agpm1-card-dod-beispiel": {
      "fingerprint": "e39a7bdf",
      "priority": 2
    },
    "agpm1-card-scrum-events-ueberblick": {
      "fingerprint": "6f122646",
      "priority": 1
    },
    "agpm1-card-scrum-events-timeboxen": {
      "fingerprint": "2756eead",
      "priority": 2
    },
    "agpm1-card-scrum-events-mc": {
      "fingerprint": "f659ecfa",
      "priority": 2
    },
    "agpm1-card-burndown-beispiel": {
      "fingerprint": "4c933707",
      "priority": 2
    },
    "agpm1-card-storypoints-zwecke": {
      "fingerprint": "9b97799e",
      "priority": 1
    },
    "agpm1-card-storypoints-tipps": {
      "fingerprint": "bd259993",
      "priority": 2
    },
    "agpm1-card-storypoints-beispiel": {
      "fingerprint": "0b75b068",
      "priority": 3
    },
    "agpm1-card-poker-vorteile": {
      "fingerprint": "881501d2",
      "priority": 2
    },
    "agpm1-card-poker-klassisch": {
      "fingerprint": "3a8ef6f5",
      "priority": 2
    },
    "agpm1-card-release-klassisch-agil": {
      "fingerprint": "1aeca860",
      "priority": 1
    },
    "agpm1-card-release-ablauf": {
      "fingerprint": "67d3b0dd",
      "priority": 2
    },
    "agpm1-card-release-einfluesse": {
      "fingerprint": "cca877e2",
      "priority": 1
    },
    "agpm1-card-release-tipps": {
      "fingerprint": "f4324335",
      "priority": 2
    },
    "agpm1-card-grund-po-befugnis": {
      "fingerprint": "40455542",
      "priority": 1
    },
    "agpm1-card-grund-fehlerkultur": {
      "fingerprint": "fb926747",
      "priority": 1
    },
    "agpm1-card-agil-begriff": {
      "fingerprint": "89de5ed3",
      "priority": 1
    },
    "agpm1-card-agil-wasserfall-iteration": {
      "fingerprint": "a5e59c4d",
      "priority": 1
    },
    "agpm1-card-agil-manifest-entstehung": {
      "fingerprint": "a30d659d",
      "priority": 3
    },
    "agpm1-card-agil-manifest-werte": {
      "fingerprint": "3cae93ec",
      "priority": 1
    },
    "agpm1-card-agil-manifest-werte-mc": {
      "fingerprint": "e0d8e0a7",
      "priority": 1
    },
    "agpm1-card-agil-prinzipien-liste": {
      "fingerprint": "e26338bb",
      "priority": 2
    },
    "agpm1-card-agil-prinzipien-1-3": {
      "fingerprint": "f15ab682",
      "priority": 1
    },
    "agpm1-card-agil-prinzipien-4-6": {
      "fingerprint": "6754d53e",
      "priority": 1
    },
    "agpm1-card-agil-prinzipien-7-9": {
      "fingerprint": "701da992",
      "priority": 1
    },
    "agpm1-card-agil-prinzipien-10-12": {
      "fingerprint": "f758c1a3",
      "priority": 1
    },
    "agpm1-card-agil-kanban-herkunft": {
      "fingerprint": "57f856f3",
      "priority": 3
    },
    "agpm1-card-agil-kanban-prinzipien": {
      "fingerprint": "daba0e29",
      "priority": 1
    },
    "agpm1-card-agil-kanban-board": {
      "fingerprint": "2b24b12a",
      "priority": 2
    },
    "agpm1-card-agil-kanban-in-scrum": {
      "fingerprint": "90f270ca",
      "priority": 2
    },
    "agpm1-card-agil-formate-kennzeichen": {
      "fingerprint": "4118ac29",
      "priority": 2
    },
    "agpm1-card-agil-formate-liste": {
      "fingerprint": "8a724dfc",
      "priority": 3
    },
    "agpm1-card-agil-formate-ziele": {
      "fingerprint": "73947332",
      "priority": 2
    },
    "agpm1-card-agil-scrum-herkunft": {
      "fingerprint": "bb387e2d",
      "priority": 3
    },
    "agpm1-card-agil-scrum-kernelemente": {
      "fingerprint": "e71dc244",
      "priority": 1
    },
    "agpm1-card-agil-scrum-ablauf": {
      "fingerprint": "5a0bfe48",
      "priority": 1
    },
    "agpm1-card-agil-scrum-sprintlaenge": {
      "fingerprint": "01f3383a",
      "priority": 1
    },
    "agpm1-card-agil-scrum-vuka-fuehrung": {
      "fingerprint": "01a65dc9",
      "priority": 1
    },
    "agpm1-card-agil-scrum-master-rollenbilder": {
      "fingerprint": "521584d4",
      "priority": 1
    },
    "agpm1-card-agil-scrum-was-wie": {
      "fingerprint": "a1fcce8d",
      "priority": 1
    },
    "agpm1-card-agil-retro-teilnehmer": {
      "fingerprint": "713f7947",
      "priority": 1
    },
    "agpm1-card-agil-retro-fragen": {
      "fingerprint": "9de25201",
      "priority": 2
    },
    "agpm1-card-agil-tools-ueberblick": {
      "fingerprint": "af51e5ae",
      "priority": 3
    },
    "agpm1-card-agil-anf-hierarchie": {
      "fingerprint": "2e61a4bc",
      "priority": 1
    },
    "agpm1-card-agil-anf-ebenen": {
      "fingerprint": "db798323",
      "priority": 1
    },
    "agpm1-card-agil-anf-beispiel": {
      "fingerprint": "30f2ce8b",
      "priority": 2
    },
    "agpm1-card-agil-us-format": {
      "fingerprint": "6f0155a1",
      "priority": 1
    },
    "agpm1-card-agil-us-akzeptanzkriterien": {
      "fingerprint": "7dd314ae",
      "priority": 1
    },
    "agpm1-card-agil-pb-definition": {
      "fingerprint": "e276a1cf",
      "priority": 1
    },
    "agpm1-card-agil-pb-befuellen": {
      "fingerprint": "7badae74",
      "priority": 2
    },
    "agpm1-card-agil-pb-pflege": {
      "fingerprint": "016f3a96",
      "priority": 1
    },
    "agpm1-card-agil-tshirt-groessen": {
      "fingerprint": "2c9397db",
      "priority": 2
    },
    "agpm1-card-agil-taskboard-anlegen": {
      "fingerprint": "372bc1e9",
      "priority": 2
    }
  }
};
