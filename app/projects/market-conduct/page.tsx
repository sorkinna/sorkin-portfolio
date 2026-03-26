"use client";

import { useEffect, useState } from "react";
import { supabaseVilr } from "@/lib/supabaseVILR";
import MarketReportsTable from "./MarketReportsTable";

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

export default function Page() {
  const [reports, setReports] = useState<MarketReport[]>([]);
  const [search, setSearch] = useState("");
  const [companyType, setCompanyType] = useState("");
  const [violationType, setViolationType] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 10;

  useEffect(() => {
    async function loadReports() {
      const { data, error } = await supabaseVilr.from("market_conduct_reports").select("*");
      if (error) {
        console.error("Error fetching reports:", error);
        return;
      }
      if (!data) return;
      setReports(data);
    }
    loadReports();
  }, []);

  // Apply filters + sorting
  const filteredReports = reports
    .filter(r => r.company_names.some(name => name.toLowerCase().includes(search.toLowerCase())))
    .filter(r => (companyType ? r.company_type === companyType : true))
    .filter(r => (violationType ? r.violation_types?.includes(violationType) : true))
    .sort((a, b) => {
      const aYear = a.report_year || 0;
      const bYear = b.report_year || 0;
      return sortOrder === "asc" ? aYear - bYear : bYear - aYear;
    });

  const totalPages = Math.ceil(filteredReports.length / PAGE_SIZE);
  const visibleReports = filteredReports.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const allViolationTypes = Array.from(new Set(reports.flatMap(r => r.violation_types || [])));

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Market Conduct Reports</h1>

      {/* FILTER BAR */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <input type="text" placeholder="Search company..." className="border p-2 rounded w-64" onChange={e => setSearch(e.target.value)} />
        <select className="border p-2 rounded w-40" value={companyType} onChange={e => setCompanyType(e.target.value)}>
          <option value="">All Types</option>
          <option value="P&C">P&C</option>
          <option value="L&H">L&H</option>
        </select>
        <select className="border p-2 rounded w-56" value={violationType} onChange={e => setViolationType(e.target.value)}>
          <option value="">All Violations</option>
          {allViolationTypes.map(v => (<option key={v} value={v}>{v}</option>))}
        </select>
        <select className="border p-2 rounded w-32" value={sortOrder} onChange={e => setSortOrder(e.target.value as "asc" | "desc") }>
          <option value="desc">Newest</option>
          <option value="asc">Oldest</option>
        </select>
      </div>

      {/* CARD STYLE TABLE */}
      <MarketReportsTable reports={visibleReports} />

      {/* PAGINATION */}
      <div className="flex justify-center gap-3 mt-4">
        <button onClick={() => setPage(p => Math.max(p - 1, 0))} className="border px-3 py-1 rounded" disabled={page === 0}>Previous</button>
        <div className="text-sm flex items-center">Page {page + 1} of {totalPages || 1}</div>
        <button onClick={() => setPage(p => Math.min(p + 1, totalPages - 1))} className="border px-3 py-1 rounded" disabled={page + 1 >= totalPages}>Next</button>
      </div>
    </div>
  );
}
