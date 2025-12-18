"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Category = {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  type: "subject" | "topic" | "subtopic" | null;
};

type Props = {
  allCategories: Category[];
  sections: Category[];
  initialSection?: string;
  initialTopic?: string;
  initialSubtopic?: string;
  initialQuery?: string;
};

export function CascadingFilter({
  allCategories,
  sections,
  initialSection,
  initialTopic,
  initialSubtopic,
  initialQuery,
}: Props) {
  const router = useRouter();

  const [selectedSection, setSelectedSection] = useState(initialSection || "");
  const [selectedTopic, setSelectedTopic] = useState(initialTopic || "");
  const [selectedSubtopic, setSelectedSubtopic] = useState(initialSubtopic || "");
  const [query, setQuery] = useState(initialQuery || "");

  const topics = selectedSection
    ? allCategories.filter((c) => c.parent_id === selectedSection)
    : [];

  const subtopics = selectedTopic
    ? allCategories.filter((c) => c.parent_id === selectedTopic)
    : [];

  const handleSectionChange = (sectionId: string) => {
    setSelectedSection(sectionId);
    setSelectedTopic("");
    setSelectedSubtopic("");
  };

  const handleTopicChange = (topicId: string) => {
    setSelectedTopic(topicId);
    setSelectedSubtopic("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const params = new URLSearchParams();
    if (selectedSection) params.set("section", selectedSection);
    if (selectedTopic) params.set("topic", selectedTopic);
    if (selectedSubtopic) params.set("subtopic", selectedSubtopic);
    if (query) params.set("q", query);
    
    router.push(`/admin/questions${params.toString() ? `?${params.toString()}` : ""}`);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Filter Hierarki</p>
        <p className="text-sm text-slate-700">Pilih Section → Topic → Sub-topic.</p>
      </div>

      <label className="block space-y-2">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">1. Section</span>
        <select
          value={selectedSection}
          onChange={(e) => handleSectionChange(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400"
        >
          <option value="">-- Semua Section --</option>
          {sections.map((sect) => (
            <option key={sect.id} value={sect.id}>
              {sect.name}
            </option>
          ))}
        </select>
      </label>

      {selectedSection && topics.length > 0 && (
        <label className="block space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">2. Topic</span>
          <select
            value={selectedTopic}
            onChange={(e) => handleTopicChange(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400"
          >
            <option value="">-- Semua Topic --</option>
            {topics.map((top) => (
              <option key={top.id} value={top.id}>
                {top.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {selectedTopic && subtopics.length > 0 && (
        <label className="block space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">3. Sub-topic</span>
          <select
            value={selectedSubtopic}
            onChange={(e) => setSelectedSubtopic(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400"
          >
            <option value="">-- Semua Sub-topic --</option>
            {subtopics.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="block space-y-2">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Pencarian</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400"
          placeholder="Cari teks soal..."
        />
      </label>

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="submit"
          className="flex-1 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
        >
          Tampilkan
        </button>
        <Link
          href="/admin/questions"
          className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Reset
        </Link>
      </div>
    </form>
  );
}
