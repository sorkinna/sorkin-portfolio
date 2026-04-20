"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Contestant = {
  id: string;
  name: string;
  team: string;
  eliminated: boolean;
  immunity_weight: number;
};

export default function PredictionsPage() {
  const [contestants, setContestants] = useState<Contestant[]>([]);
  const [teams, setTeams] = useState<string[]>([]);
  const [team, setTeam] = useState("");
  const [immunityPick, setImmunityPick] = useState("");
  const [eliminatedPick, setEliminatedPick] = useState("");
  const [currentEpisode, setCurrentEpisode] = useState(1);

  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      const { data } = await supabase.from("contestants").select("*");

      if (data) {
        setContestants(data);
        setTeams([...new Set(data.map((c) => c.team))]);
      }

      const { data: settings } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "current_episode")
        .single();

      if (settings) setCurrentEpisode(parseInt(settings.value));
    };

    fetchData();
  }, []);

const handleSubmit = async () => {
  if (!team || !immunityPick || !eliminatedPick) {
    alert("Fill everything out");
    return;
  }

  try {
      // Check for existing submission
      const { data: existing } = await supabase
        .from("predictions")
        .select("id")
        .eq("team", team)
        .eq("episode", currentEpisode)
        .limit(1);

      if (existing && existing.length > 0) {
        alert("You already submitted for this episode");
        return;
      }

      const contestant = contestants.find(c => c.id === immunityPick);

      const { error } = await supabase.from("predictions").insert({
        team,
        immunity_pick: immunityPick,
        immunity_weight: contestant?.immunity_weight,
        eliminated_pick: eliminatedPick,
        episode: currentEpisode,
      });

      if (error) throw error;

      router.push("/projects/survivor-fantasy?predicted=true");
    } catch (err) {
      console.error(err);
      alert("Something went wrong");
    }
  };

return (
    <div className="min-h-screen bg-[#F4EFE6] p-6 flex justify-center">
      <div className="bg-white p-6 rounded-2xl shadow-md w-full max-w-md space-y-5">
        
        <h1 className="text-xl font-semibold text-[#3E2F1C]">
          Make Your Predictions
        </h1>

        {/* Team */}
        <select
          value={team}
          onChange={(e) => setTeam(e.target.value)}
          className="w-full bg-white text-base text-[#3E2F1C] border border-[#3E2F1C]/30 rounded-lg px-3 py-2"
        >
          <option value="">Select Team</option>
          {teams.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        {/* Immunity */}
        <select
          value={immunityPick}
          onChange={(e) => setImmunityPick(e.target.value)}
          className="w-full bg-white text-base text-[#3E2F1C] border border-[#3E2F1C]/30 rounded-lg px-3 py-2"
        >
          <option value="">Immunity Winner</option>
          {contestants
            .filter((c) => !c.eliminated)
            .sort((a, b) => a.immunity_weight - b.immunity_weight)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} - ({c.immunity_weight} pts if correct)
              </option>
            ))}
        </select>

        {/* Eliminated */}
        <select
          value={eliminatedPick}
          onChange={(e) => setEliminatedPick(e.target.value)}
          className="w-full bg-white text-base text-[#3E2F1C] border border-[#3E2F1C]/30 rounded-lg px-3 py-2"
        >
          <option value="">Eliminated Player</option>
          {contestants
            .filter((c) => !c.eliminated)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </select>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          className="w-full bg-[#F29E4C] text-white py-2 rounded-lg hover:bg-[#ffb85c] transition"
        >
          Submit Predictions
        </button>

        {/* Back */}
        <Link
          href="/projects/survivor-fantasy"
          className="block text-center text-sm text-neutral-600 hover:text-black transition pt-2"
        >
          ← Back to Fantasy Tracker
        </Link>
      </div>
    </div>
  );
}