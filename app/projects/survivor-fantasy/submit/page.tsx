"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Contestant = {
  id: string;
  name: string;
  team: string;
  eliminated: boolean;
};

export default function SubmitPage() {
  const [contestants, setContestants] = useState<Contestant[]>([]);
  const [teams, setTeams] = useState<string[]>([]);

  const [contestantId, setContestantId] = useState("");
  const [points, setPoints] = useState<number | "">("");
  const [reason, setReason] = useState("");
  const [team, setTeam] = useState("");
  const router = useRouter();
  const [currentEpisode, setCurrentEpisode] = useState<number>(1);

  useEffect(() => {
    const fetchCurrentEpisode = async () => {
      const { data } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "current_episode")
        .single();

      if (data) setCurrentEpisode(parseInt(data.value));
    };

    fetchCurrentEpisode();
  }, []);

  useEffect(() => {
    const fetchContestants = async () => {
      const { data } = await supabase.from("contestants").select("*");

      if (data) {
        setContestants(data);

        // Extract unique team names
        const uniqueTeams = Array.from(
          new Set(data.map((c) => c.team))
        );
        setTeams(uniqueTeams);
      }
    };

    fetchContestants();
  }, []);

  const handleSubmit = async () => {
    if (!contestantId || points === "" || !team) {
      alert("Please fill out all required fields.");
      return;
    }

    const { error } = await supabase.from("pending_submissions").insert({
      contestant_id: contestantId,
      points,
      reason,
      episode: currentEpisode,
      submitted_by: team,
      status: "pending",
    });

    if (error) {
      alert("Error submitting suggestion.");
    } else {
      router.push("/projects/survivor-fantasy?submitted=true");
    }
  };

  return (
    <div className="min-h-screen bg-[#F4EFE6] p-6 flex justify-center">
      <div className="bg-white p-6 rounded-2xl shadow-md w-full max-w-md space-y-4">
        <div className="flex flex-col gap-4">
          <h1 className="text-xl font-semibold text-[#3E2F1C]">
            Submit Scoring Suggestion
          </h1>

          {/* Contestant Dropdown */}
          <select
            value={contestantId}
            onChange={(e) => setContestantId(e.target.value)}
            className="bg-white text-base text-[#3E2F1C] placeholder:text-[#3E2F1C]/60 border border-[#3E2F1C]/30 rounded-lg px-3 py-2"
          >
            <option value="">Select Contestant</option>
            {contestants.filter((c) => !c.eliminated).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.team})
              </option>
            ))}
          </select>

          {/* Points */}
          <input
            type="number"
            placeholder="Points (+/-)"
            value={points}
            className="bg-white text-base text-[#3E2F1C] placeholder:text-[#3E2F1C]/60 border border-[#3E2F1C]/30 rounded-lg px-3 py-2"
            onChange={(e) =>
              setPoints(e.target.value === "" ? "" : Number(e.target.value))
            }
          />

          {/* Reason */}
          <input
            placeholder="Reason"
            value={reason}
            className="bg-white text-base text-[#3E2F1C] placeholder:text-[#3E2F1C]/60 border border-[#3E2F1C]/30 rounded-lg px-3 py-2"
            onChange={(e) => setReason(e.target.value)}
          />

          {/* Team Dropdown */}
          <select
            value={team}
            onChange={(e) => setTeam(e.target.value)}
            className="bg-white text-base text-[#3E2F1C] placeholder:text-[#3E2F1C]/60 border border-[#3E2F1C]/30 rounded-lg px-3 py-2"
          >
            <option value="">Your Team</option>
            {teams.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            className="w-full bg-[#F29E4C] text-white py-2 rounded-lg hover:bg-[#ffb85c] transition"
          >
            Submit
          </button>
        </div>
        {/* Back Button */}
        <Link
          href="/projects/survivor-fantasy"
          className="block text-center text-sm text-[#3E2F1C]/80 hover:text-[#3E2F1C] transition pt-2"
        >
          ← Back to Fantasy Tracker
        </Link>
      </div>
    </div>
  );
}
