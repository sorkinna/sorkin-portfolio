"use client";

import { useState } from "react";

type MarketReport = {
  id: string;
  company_names: string[];
  company_type: string;
  report_year?: number | null;
  violations_total?: number | null;
  violations_breakdown?: Record<string, number>;
  civil_penalty?: number | null;
  restitution_amount?: number | null;
  restitution_consumers?: number | null;
  statutes?: string[];
  violation_types?: string[];
  keywords?: string[];
  summary: string;
  report_url: string;
};

export default function MarketReportsTable({ reports }: { reports: MarketReport[] }) {
  const [openRow, setOpenRow] = useState<string | null>(null);

  const toggleRow = (id: string) => {
    setOpenRow(openRow === id ? null : id);
  };

  return (
    <div className="space-y-4">
      {reports.map((report) => (
        <div key={report.id} className="border rounded-lg p-4 bg-white shadow-sm">
          
          {/* HEADER */}
          <div className="flex justify-between items-center">
            <div className="font-semibold text-lg">
              {report.company_names.join(", ")} ({report.company_type})
            </div>
            <div className="text-sm text-gray-500 whitespace-nowrap">
              {report.report_year ?? "-"}
            </div>
          </div>

          {/* SUMMARY */}
          <p className="mt-2 text-gray-700">{report.summary}</p>

          {/* VIOLATION TYPES AS BADGES */}
          {report.violation_types && report.violation_types.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {report.violation_types.map((v) => (
                <span key={v} className="text-xs bg-gray-200 px-2 py-1 rounded">
                  {v}
                </span>
              ))}
            </div>
          )}

          {/* LINKS AND DETAILS TOGGLE */}
          <div className="mt-3 flex gap-4 text-sm">
            <a
              href={report.report_url}
              target="_blank"
              className="text-blue-600 underline"
            >
              View PDF
            </a>

            <button
              onClick={() => toggleRow(report.id)}
              className="text-blue-600 underline"
            >
              {openRow === report.id ? "Hide Details" : "View Details"}
            </button>
          </div>

          {/* EXPANDED DETAILS */}
          {openRow === report.id && (
            <div className="mt-4 pt-4 border-t text-sm text-gray-700 space-y-2">
              
              {report.violations_total != null && (
                <p>
                  <strong>Violations Total:</strong> {report.violations_total.toLocaleString()}
                </p>
              )}

              {report.violations_breakdown && Object.keys(report.violations_breakdown).length > 0 && (
                <div>
                  <strong>Violations Breakdown:</strong>
                  <ul className="ml-4 list-disc">
                    {Object.entries(report.violations_breakdown).map(([key, value]) => (
                      <li key={key}>
                        {key}: {value.toLocaleString()}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {report.civil_penalty != null && (
                <p>
                  <strong>Civil Penalty:</strong> ${report.civil_penalty.toLocaleString()}
                </p>
              )}

              {report.restitution_amount != null && (
                <p>
                  <strong>Restitution Amount:</strong> ${report.restitution_amount.toLocaleString()}
                </p>
              )}

              {report.restitution_consumers != null && (
                <p>
                  <strong>Restitution Consumers:</strong> {report.restitution_consumers.toLocaleString()}
                </p>
              )}

              {report.statutes && report.statutes.length > 0 && (
                <p>
                  <strong>Statutes:</strong> {report.statutes.join(", ")}
                </p>
              )}

              {report.keywords && report.keywords.length > 0 && (
                <p>
                  <strong>Keywords:</strong> {report.keywords.join(", ")}
                </p>
              )}

            </div>
          )}
        </div>
      ))}
    </div>
  );
}