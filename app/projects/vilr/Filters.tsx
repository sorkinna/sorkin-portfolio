"use client";

import { useState } from "react";

export type TopicGroup = {
  category: string;
  names: string[];
};

type FiltersProps = {
  setSearch: (value: string) => void;
  setTopicFilter: (filter: { [category: string]: string }) => void;
  setSortOrder: (value: "asc" | "desc") => void;
  topics: TopicGroup[];
};

export default function Filters({
  setSearch,
  setTopicFilter,
  setSortOrder,
  topics,
}: FiltersProps) {
  const [selectedTopics, setSelectedTopics] = useState<{ [category: string]: string }>({});

  const handleSelect = (category: string, value: string) => {
    const updated = { ...selectedTopics, [category]: value };
    setSelectedTopics(updated);
    setTopicFilter(updated);
  };

  return (
    <div className="flex flex-nowrap gap-4 mb-6 overflow-x-auto items-end">
      {/* Search input */}
      <input
        type="text"
        placeholder="Search letters..."
        className="border p-2 rounded w-64 flex-shrink-0"
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* Dropdowns per topic category */}
      {topics.map((group) => (
        <div key={group.category} className="flex flex-col flex-shrink-0">
          <label className="text-sm font-semibold mb-1">
            {group.category
              .replace(/_/g, " ")
              .replace(/\b\w(?=\w{2,})/g, (s) => s.toUpperCase())}
          </label>
          <select
            className="border p-2 rounded w-45"
            value={selectedTopics[group.category] || ""}
            onChange={(e) => handleSelect(group.category, e.target.value)}
          >
            <option value="">All</option>
            {group.names.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
      ))}

      {/* Sort dropdown */}
      <select
        className="border p-2 rounded w-24 flex-shrink-0"
        onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
      >
        <option value="desc">Newest</option>
        <option value="asc">Oldest</option>
      </select>
    </div>
  );
}