"""Baut einen neuen Stand aus Entwurfsbasis, frischem Pull und geprüften Änderungen.

    python -I build_nachher.py <arbeitsordner> <vorher.json> <nachher.json>

Liest stand.json, aenderungen-final.json und optional pool-final.json aus dem Arbeitsordner.
Nur beabsichtigte Inhaltsänderungen werden übernommen; parallele Änderungen führen bei
Konflikten zum Abbruch. Lernstand und unbekannte Felder des frischen Pulls bleiben erhalten.
"""
import json
import sys
from pathlib import Path


def read(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def by_id(items, label):
    result = {}
    for item in items:
        if item["id"] in result:
            raise ValueError(f"Doppelte ID in {label}: {item['id']}")
        result[item["id"]] = item
    return result


def build(root, snapshot):
    baseline = read(root / "stand.json")
    if baseline["revision"] > snapshot["revision"] or baseline.get("source") != snapshot.get("source"):
        raise ValueError("Entwurfsbasis und frischer Pull gehören nicht zum selben fortgeschriebenen Bestand")
    base = baseline["workspace"]
    live = snapshot["workspace"]
    changes = read(root / "aenderungen-final.json")
    allowed = {
        "cards": {"question", "answer", "noteId", "priority"},
        "notes": {"title", "summary", "content", "topicId", "tags", "relatedIds", "terms", "updatedAt"},
    }
    used_ids = {item["id"] for key in ("cards", "notes") for item in base[key] + live[key]}
    for key, singular in (("cards", "card"), ("notes", "note")):
        old = by_id(base[key], f"Basis {key}")
        current = by_id(live[key], f"Bestand {key}")
        modifications = changes.get(f"modified_{key}", [])
        by_id(modifications, f"Änderungen {key}")
        for change in modifications:
            item_id = change["id"]
            if item_id not in old or item_id not in current:
                raise ValueError(f"{singular} {item_id} fehlt in Basis oder aktuellem Bestand")
            if any(field not in old[item_id] or old[item_id][field] != value for field, value in change["before"].items()):
                raise ValueError(f"Ausgangswerte für {singular} {item_id} passen nicht zur Entwurfsbasis")
            for field, proposed in change["after"].items():
                if field not in allowed[key]:
                    raise ValueError(f"{singular} {item_id}: Feld {field} darf nicht verändert werden")
                if field in old[item_id] and proposed == old[item_id][field]:
                    continue  # An unchanged draft field must not undo a concurrent edit.
                if current[item_id].get(field) != old[item_id].get(field) and current[item_id].get(field) != proposed:
                    raise ValueError(f"Konflikt bei {singular} {item_id}, Feld {field}")
                current[item_id][field] = proposed
        for item in changes.get(f"new_{key}", []):
            if item["id"] in used_ids:
                raise ValueError(f"Neue ID {item['id']} existiert schon oder ist doppelt")
            used_ids.add(item["id"])
            live[key].append(item)

    # Apply the reviewed delta, never replace the fresh pool with an old full pool.
    pool_path = root / "pool-final.json"
    if pool_path.exists():
        pool = read(pool_path)
        old = by_id(base["quizQuestions"], "Basis Aufgaben")
        current = by_id(live["quizQuestions"], "Bestand Aufgaben")
        proposed = by_id(pool, "geprüfter Aufgabenpool")
        missing = old.keys() - proposed.keys()
        if missing:
            raise ValueError("Bestandsaufgaben fehlen im Pool: " + ", ".join(sorted(missing)))
        for item_id, question in proposed.items():
            if item_id in old:
                if question == old[item_id]:
                    continue
                if item_id not in current or (current[item_id] != old[item_id] and current[item_id] != question):
                    raise ValueError(f"Konflikt bei Aufgabe {item_id}")
            elif item_id in current:
                raise ValueError(f"Neue Aufgaben-ID {item_id} existiert inzwischen")
            current[item_id] = question
        live["quizQuestions"] = list(current.values())

    module_path = root / "modul.json"
    topics = by_id(live["topics"], "Themen")
    if module_path.exists():
        additions = read(module_path).get("themen", [])
        by_id(additions, "Modulthemen")
        for topic in additions:
            if topic["id"] not in topics:
                topics[topic["id"]] = topic
        live["topics"] = list(topics.values())
    return snapshot


def main():
    if len(sys.argv) != 4:
        raise ValueError(__doc__)
    root, before, after = map(Path, sys.argv[1:])
    snapshot = build(root, read(before))
    # Keep any previous reviewed output intact; choose a new name for another run.
    with after.open("x", encoding="utf-8") as output:
        json.dump(snapshot, output, ensure_ascii=False)
    workspace = snapshot["workspace"]
    size = len(json.dumps(workspace, ensure_ascii=False, separators=(",", ":")).encode("utf-8"))
    print(f"revision {snapshot['revision']} · Notizen {len(workspace['notes'])} · Karten {len(workspace['cards'])} · Aufgaben {len(workspace['quizQuestions'])} · {size} Bytes")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    try:
        main()
    except (ValueError, KeyError, OSError) as error:
        print(f"FEHLER: {error}")
        raise SystemExit(1)
