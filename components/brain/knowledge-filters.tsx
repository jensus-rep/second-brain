"use client";

import { useState } from "react";
import { Check, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Topic } from "@/lib/brain/model";
import { flattenTopics, getTopicOptionLabel, getTopicPathLabel } from "@/lib/brain/topics";

export function KnowledgeFilters({ topics, tags, topicId, tag, onTopic, onTag, reset }: {
  topics: Topic[]; tags: string[]; topicId: string; tag: string; onTopic: (id: string) => void;
  onTag: (tag: string) => void; reset: () => void;
}) {
  const [tagQuery, setTagQuery] = useState("");
  const count = Number(!!topicId) + Number(!!tag);
  const selectedTopic = topics.find(topic => topic.id === topicId);
  const choices = tags.filter(value => value.toLocaleLowerCase("de").includes(tagQuery.toLocaleLowerCase("de")));
  return <Popover><PopoverTrigger asChild><Button variant="outline" size="sm" className="filter-button"><SlidersHorizontal size={16} />Filtern{count > 0 && <span>{count}</span>}</Button></PopoverTrigger><PopoverContent align="start" className="knowledge-filters">
    <div className="filter-heading"><strong>Ansicht eingrenzen</strong>{count > 0 && <button onClick={reset}>Zurücksetzen</button>}</div>
    <label className="field"><span>Thema und Unterthemen</span><Select value={topicId || "::all"} onValueChange={value => onTopic(value === "::all" ? "" : value)}><SelectTrigger className="topic-path-select" aria-label="Nach Thema filtern" title={selectedTopic ? getTopicPathLabel(topics, selectedTopic.id) : undefined}><SelectValue>{selectedTopic?.title ?? (topicId === "::unassigned" ? "Ohne Thema" : "Alle Themen")}</SelectValue></SelectTrigger><SelectContent className="topic-path-options" position="popper"><SelectItem value="::all">Alle Themen</SelectItem><SelectItem value="::unassigned">Ohne Thema</SelectItem>{flattenTopics(topics).map(({ topic }) => <SelectItem key={topic.id} value={topic.id} title={getTopicPathLabel(topics, topic.id)}>{getTopicOptionLabel(topics, topic.id)}</SelectItem>)}</SelectContent></Select></label>
    {(tags.length > 0 || tag) && <div className="tag-filter"><label className="field"><span>Tag</span><Input aria-label="Tags filtern" placeholder="Tag suchen …" value={tagQuery} onChange={event => setTagQuery(event.target.value)} /></label><div className="tag-filter-options"><button aria-pressed={!tag} onClick={() => onTag("")}><span>Alle Tags</span>{!tag && <Check size={15} />}</button>{choices.map(value => <button key={value} aria-pressed={tag === value} onClick={() => onTag(tag === value ? "" : value)}><span>#{value}</span>{tag === value && <Check size={15} />}</button>)}{!choices.length && <p>Kein passender Tag.</p>}</div></div>}
  </PopoverContent></Popover>;
}
