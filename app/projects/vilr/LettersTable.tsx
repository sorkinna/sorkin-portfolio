"use client";

import { useState } from "react";

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

export default function LettersTable({ letters }: { letters: Document[] }) {
  const [openRow, setOpenRow] = useState<string | null>(null);

  const toggleRow = (id: string) => {
    setOpenRow(openRow === id ? null : id);
  };

  return (
    <div className="space-y-4">
      {letters.map((letter) => (
        <div key={letter.id} className="border rounded-lg p-4 bg-white shadow-sm">
          {/* HEADER */}
          <div className="flex justify-between items-center">
            <div className="font-semibold text-lg">{letter.identifier}</div>
            <div className="text-sm text-gray-500 whitespace-nowrap">
              {new Date(letter.publication_date + "T00:00:00").toLocaleDateString()}
            </div>
          </div>

          {/* SUMMARY */}
          <p className="mt-2 text-gray-700">{letter.summary}</p>

          {/* TOPICS */}
          <div className="mt-2 flex flex-wrap gap-2">
            {letter.topics.map((topic) => (
              <span key={topic} className="text-xs bg-gray-200 px-2 py-1 rounded">
                {topic}
              </span>
            ))}
          </div>

          {/* LINKS & DETAILS */}
          <div className="mt-3 flex gap-4 text-sm">
            <a
              href={letter.source_url}
              target="_blank"
              className="text-blue-600 underline"
            >
              View PDF
            </a>

            <button onClick={() => toggleRow(letter.id)} className="text-blue-600 underline">
              {openRow === letter.id ? "Hide Details" : "View Details"}
            </button>
          </div>

          {/* EXPANDED METADATA */}
          {openRow === letter.id && (
            <div className="mt-4 pt-4 border-t text-sm text-gray-700 space-y-2">
              {letter.practical_impact && (
                <p>
                  <strong>Practical Impact:</strong> {letter.practical_impact}
                </p>
              )}
              {letter.metadata?.statutes && (
                <p>
                  <strong>Statutes:</strong> {letter.metadata.statutes.join(", ")}
                </p>
              )}
              {letter.metadata?.keywords && (
                <p>
                  <strong>Keywords:</strong> {letter.metadata.keywords.join(", ")}
                </p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}