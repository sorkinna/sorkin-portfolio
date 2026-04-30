import Link from "next/link";
import { Film, Music, Trophy } from "lucide-react";

export default function Projects() {
  return (
    <div className="min-h-screen px-6 py-20 max-w-6xl mx-auto">
      <h1 className="text-4xl font-semibold mb-4">Projects</h1>

      <p className="text-neutral-600 mb-12">
        A collection of experimental and production-ready applications.
      </p>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Spotify Recommender */}
        <Link
          href="/projects/survivor-fantasy/admin"
          className="group p-8 border border-neutral-200 rounded-xl hover:shadow-md transition"
        >
          <div className="mb-4 inline-flex items-center justify-center w-12 h-12 rounded-lg bg-neutral-100 group-hover:bg-neutral-200 transition">
            <Music className="w-6 h-6 text-neutral-700" />
          </div>

          <h2 className="text-2xl font-medium mb-3 group-hover:underline">
            Mystery Project
          </h2>

          <p className="text-neutral-500">
            Coming soon!
          </p>
        </Link>

        {/* Survivor Fantasy */}
        <Link
          href="/projects/survivor-fantasy"
          className="group p-8 border border-neutral-200 rounded-xl hover:shadow-md transition"
        >
          <div className="mb-4 inline-flex items-center justify-center w-12 h-12 rounded-lg bg-neutral-100 group-hover:bg-neutral-200 transition">
            <Trophy className="w-6 h-6 text-neutral-700" />
          </div>

          <h2 className="text-2xl font-medium mb-3 group-hover:underline">
            Survivor Fantasy Tracker
          </h2>

          <p className="text-neutral-500">
            Live scoring dashboard for tracking fantasy league performance.
          </p>
        </Link>

        {/* VILR */}
        <Link
          href="/projects/vilr"
          className="group p-8 border border-neutral-200 rounded-xl hover:shadow-md transition"
        >
          <div className="mb-4 inline-flex items-center justify-center w-12 h-12 rounded-lg bg-neutral-100 group-hover:bg-neutral-200 transition">
            <Trophy className="w-6 h-6 text-neutral-700" />
          </div>

          <h2 className="text-2xl font-medium mb-3 group-hover:underline">
            Virginia Insurance Law Repository
          </h2>

          <p className="text-neutral-500">
            Repository of Virginia Bureau of Insurance administrative letters.
          </p>
        </Link>

        {/* Market Conduct */}
        <Link
          href="/projects/market-conduct"
          className="group p-8 border border-neutral-200 rounded-xl hover:shadow-md transition"
        >
          <div className="mb-4 inline-flex items-center justify-center w-12 h-12 rounded-lg bg-neutral-100 group-hover:bg-neutral-200 transition">
            <Trophy className="w-6 h-6 text-neutral-700" />
          </div>

          <h2 className="text-2xl font-medium mb-3 group-hover:underline">
            Market Conduct Report Repository
          </h2>

          <p className="text-neutral-500">
            Repository of Virginia Bureau of Insurance market conduct reports.
          </p>
        </Link>
      </div>
    </div>
  );
}
