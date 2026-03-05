"use client";

import { useEffect, useState } from "react";
import { supabaseVilr } from "@/lib/supabaseVILR";
import LettersTable from "./LettersTable";
import Filters, { TopicGroup } from "./Filters";

type Document = {
  id: string;
  identifier: string;
  publication_date: string;
  practical_impact: string;
  summary: string;
  source_url: string;
  metadata?: {
    statutes?: string[];
    keywords?: string[];
  };
  document_topics: {
    topics: {
      name: string;
      category: string;
    };
  }[];
  topics: string[]; // flattened for UI
};

export default function Page() {
  const [allLetters, setAllLetters] = useState<Document[]>([]);
  const [filteredLetters, setFilteredLetters] = useState<Document[]>([]);
  const [visibleLetters, setVisibleLetters] = useState<Document[]>([]);
  const [search, setSearch] = useState("");
  const [topicFilter, setTopicFilter] = useState<{ [category: string]: string }>({});
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const [topics, setTopics] = useState<TopicGroup[]>([]);
  const PAGE_SIZE = 10;

  // -----------------------------
  // Load all documents once
  // -----------------------------
  useEffect(() => {
    async function loadAll() {
      const { data, error } = await supabaseVilr
        .from("documents")
        .select(`
          id,
          identifier,
          practical_impact,
          metadata,
          publication_date,
          summary,
          source_url,
          document_topics!inner (
            topics!inner (
              name,
              category
            )
          )
        `);

      if (error) {
        console.error("Error fetching documents:", error);
        return;
      }

      if (!data) return;

      const mapped: Document[] = data.map((doc: any) => ({
        ...doc,
        topics: doc.document_topics.map((dt: any) => dt.topics.name)
      }));

      setAllLetters(mapped);
    }

    loadAll();
  }, []);

  // -----------------------------
  // Load all topics grouped by category
  // -----------------------------
  useEffect(() => {
    async function loadTopics() {
      const { data, error } = await supabaseVilr
        .from("topics")
        .select("name, category")
        .order("category", { ascending: true })
        .order("name", { ascending: true });

      if (error) {
        console.error("Error fetching topics:", error);
        return;
      }

      if (!data) return;

      const grouped: TopicGroup[] = [];
      data.forEach((t: any) => {
        const existing = grouped.find((g) => g.category === t.category);
        if (existing) {
          existing.names.push(t.name);
        } else {
          grouped.push({ category: t.category, names: [t.name] });
        }
      });

      setTopics(grouped);
    }

    loadTopics();
  }, []);

  // -----------------------------
  // Apply filters + sorting
  // -----------------------------
  useEffect(() => {
    let temp = [...allLetters];

    // Filter by search
    if (search) {
      const lowerSearch = search.toLowerCase();
      temp = temp.filter(
        (doc) =>
          doc.identifier.toLowerCase().includes(lowerSearch) ||
          doc.summary.toLowerCase().includes(lowerSearch)
      );
    }

    // Filter by topic per category
    Object.entries(topicFilter).forEach(([category, value]) => {
      if (value) {
        temp = temp.filter((doc) =>
          doc.document_topics.some(
            (dt) => dt.topics.category === category && dt.topics.name === value
          )
        );
      }
    });

    // Sort
    temp.sort((a, b) => {
      const dateA = new Date(a.publication_date).getTime();
      const dateB = new Date(b.publication_date).getTime();
      return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
    });

    setFilteredLetters(temp);
    setPage(0); // reset to first page whenever filter changes
  }, [allLetters, search, topicFilter, sortOrder]);

  // -----------------------------
  // Pagination
  // -----------------------------
  useEffect(() => {
    const start = page * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    setVisibleLetters(filteredLetters.slice(start, end));
  }, [filteredLetters, page]);

  const totalPages = Math.ceil(filteredLetters.length / PAGE_SIZE);

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">
        Virginia Insurance Law Repository
      </h1>

      <Filters
        setSearch={setSearch}
        setTopicFilter={setTopicFilter}
        setSortOrder={setSortOrder}
        topics={topics}
      />

      <LettersTable letters={visibleLetters} />

      {/* Pagination */}
      <div className="flex justify-center gap-4 mt-6">
        <button
          onClick={() => setPage((p) => Math.max(p - 1, 0))}
          className="border px-3 py-1 rounded"
          disabled={page === 0}
        >
          Previous
        </button>

        <div className="text-sm flex items-center">
          Page {page + 1} of {totalPages || 1}
        </div>

        <button
          onClick={() => setPage((p) => Math.min(p + 1, totalPages - 1))}
          className="border px-3 py-1 rounded"
          disabled={page + 1 >= totalPages}
        >
          Next
        </button>
      </div>
    </div>
  );
}