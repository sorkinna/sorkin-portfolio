"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

type Contestant = { id: string; name: string; team: string; eliminated: boolean; immunity_weight: number;};
type PendingSubmission = {
  id: string;
  contestant_id: string;
  points: number;
  reason: string;
  submitted_by: string;
};

export default function AdminPage() {
  const [contestants, setContestants] = useState<Contestant[]>([]);
  const [pendingSubmissions, setPendingSubmissions] = useState<PendingSubmission[]>([]);
  const [selectedContestant, setSelectedContestant] = useState("");
  const [points, setPoints] = useState("");
  const [reason, setReason] = useState("");
  const [currentEpisode, setCurrentEpisode] = useState(1);
  const [isAdmin, setIsAdmin] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [immunityWinner, setImmunityWinner] = useState("");
  const [eliminatedPlayer, setEliminatedPlayer] = useState("");

  useEffect(() => {
    const flag = localStorage.getItem("is_admin");
    if (flag === "true") setIsAdmin(true);
  }, []);

  // Function to handle login
  const handleLogin = () => {
    if (passwordInput === process.env.NEXT_PUBLIC_ADMIN_KEY) {
      setIsAdmin(true);
      localStorage.setItem("is_admin", "true");
    } else {
      alert("Incorrect password!");
    }
  };

  //toggle eliminated player
  const toggleElimination = async (contestant: Contestant) => {
    const { error } = await supabase
      .from("contestants")
      .update({ eliminated: !contestant.eliminated })
      .eq("id", contestant.id);

    if (error) {
      console.error("Error updating elimination:", error);
      return;
    }

    // Update local state immediately for instant UI feedback
    setContestants((prev) =>
      prev.map((c) =>
        c.id === contestant.id
          ? { ...c, eliminated: !contestant.eliminated }
          : c
      )
    );
  };

  useEffect(() => {
    // Async function to fetch data
    const fetchData = async () => {
      const { data: contestantsData } = await supabase.from("contestants").select("*");
      setContestants(contestantsData || []);

      const { data: submissionsData } = await supabase
        .from("pending_submissions")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      setPendingSubmissions(submissionsData || []);

      const { data: settingsData } = await supabase
        .from("settings")
        .select("*")
        .eq("key", "current_episode")
        .single();
      if (settingsData) setCurrentEpisode(parseInt(settingsData.value));
    };

    fetchData(); // call async function

    // Realtime subscription
    type PendingSubmissionPayload = { new: PendingSubmission };
    const channel = supabase
      .channel("pending-submissions")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "pending_submissions" },
        (payload: PendingSubmissionPayload) =>
          setPendingSubmissions((prev) => [payload.new, ...prev])
      )
      .subscribe();

    // Cleanup function — only remove the channel
    return () => {
      supabase.removeChannel(channel);
    };
  }, []); // <- dependency array


  // Handle admin point entry
  const addPoints = async () => {
    if (!selectedContestant || points === "") return;

    const { error } = await supabase.from("point_events").insert([
      {
        contestant_id: selectedContestant,
        points: parseInt(points),
        reason,
        episode: currentEpisode,
      },
    ]);

    if (!error) {
      setPoints(""); setReason(""); setSelectedContestant("");
    }
  };

  // Handle approve / deny submission
  const handleSubmission = async (submission: PendingSubmission, approve: boolean) => {
    if (approve) {
      await supabase.from("point_events").insert([
        {
          contestant_id: submission.contestant_id,
          points: submission.points,
          reason: submission.reason,
          episode: currentEpisode,
        },
      ]);
    }

    await supabase
      .from("pending_submissions")
      .update({ status: approve ? "approved" : "denied" })
      .eq("id", submission.id);

    setPendingSubmissions((prev) => prev.filter((s) => s.id !== submission.id));
  };

  // Handle prediction calculator
  const gradePredictions = async () => {
    if (!immunityWinner || !eliminatedPlayer) {
      alert("Select results first");
      return;
    }

    // Prevent duplicate grading
    const { data: existing } = await supabase
      .from("point_events")
      .select("id")
      .eq("episode", currentEpisode)
      .eq("type", "team")
      .eq("reason", "Prediction Bonus")
      .limit(1);

    if (existing && existing.length > 0) {
      alert("Already graded for this episode");
      return;
    }

    const eventsToInsert: any[] = [];

    // Public Predictions
    const { data: publicPredictions } = await supabase
      .from("public_predictions")
      .select("*")
      .eq("episode", currentEpisode);

    if (publicPredictions) {
      publicPredictions.forEach((p) => {
        let points = 0;

        if (p.immunity_pick === immunityWinner) {
          points += p.immunity_weight ?? 0;
        }

        if (p.eliminated_pick === eliminatedPlayer) {
          points += 5;
        }

        if (points === 0) return;

        // 🧠 split logic
        if (p.team_2) {
          const split = Math.floor(points / 2);

          eventsToInsert.push(
            {
              team: p.team_1,
              points: split,
              reason: `Guest (${p.name || "Anon"})`,
              episode: currentEpisode,
              type: "team",
              contestant_id: null,
            },
            {
              team: p.team_2,
              points: points - split, // handle odd numbers
              reason: `Guest (${p.name || "Anon"})`,
              episode: currentEpisode,
              type: "team",
              contestant_id: null,
            }
          );
        } else {
          eventsToInsert.push({
            team: p.team_1,
            points,
            reason: `Guest (${p.name || "Anon"})`,
            episode: currentEpisode,
            type: "team",
            contestant_id: null,
          });
        }
      });
    }

    // Get predictions
    const { data: predictions } = await supabase
      .from("predictions")
      .select("*")
      .eq("episode", currentEpisode);

    if (!predictions) return;

    predictions.forEach((p) => {
      let points = 0;

      // Immunity = weighted at time of prediction
      if (p.immunity_pick === immunityWinner) {
        points += p.immunity_weight ?? 0;
      }

      // Eliminated = fixed value (or make configurable later)
      if (p.eliminated_pick === eliminatedPlayer) {
        points += 5;
      }

      if (points === 0) return;

      eventsToInsert.push({
        team: p.team,
        points,
        reason: "Prediction Bonus",
        episode: currentEpisode,
        type: "team", // 👈 key addition
        contestant_id: null,
      });      

    });

    if (eventsToInsert.length > 0) {
      await supabase.from("point_events").insert(eventsToInsert);
    }

    // Save official results
    await supabase.from("episode_results").upsert({
      episode: currentEpisode,
      immunity_winner: immunityWinner,
      eliminated_player: eliminatedPlayer,
    });

    alert("Predictions graded correctly!");
  };

  // Update episode in settings
  const updateEpisode = async () => {
    await supabase
      .from("settings")
      .upsert({ key: "current_episode", value: currentEpisode.toString() });
  };

  //handle login
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F3E9]">
        <div className="p-6 rounded-xl bg-[#E3DCC3] shadow-lg flex flex-col gap-4">
          <h1 className="text-2xl font-semibold text-[#3E2F1C]">Admin Login</h1>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleLogin();
            }}
            className="flex flex-col gap-3"
          >
            <input
              type="password"
              placeholder="Enter admin password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              className="bg-white text-base text-[#3E2F1C] placeholder:text-[#3E2F1C]/60 border border-[#3E2F1C]/30 rounded-lg px-3 py-2"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-[#F29E4C] text-[#3E2F1C] rounded-lg hover:bg-[#ffb85c] transition"
            >
              Login
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4EFE6] p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-4xl font-bold text-[#3E2F1C]">Admin Dashboard</h1>
        <Link
          href="/projects/survivor-fantasy" // or whatever your main fantasy page route is
          className="px-4 py-2 bg-[#F29E4C] text-[#3E2F1C] rounded-lg hover:bg-[#ffb85c] transition"
        >
          Back to Fantasy Tracker
        </Link>
      </div>

      {/* Episode Control */}
      <div className="mb-8 p-4 bg-[#E3DCC3] rounded-xl shadow flex items-center gap-4 max-w-md">
        <label className="font-semibold text-[#3E2F1C]">Current Episode:</label>
        <input
          type="number"
          min={1}
          value={currentEpisode}
          onChange={(e) => setCurrentEpisode(parseInt(e.target.value))}
          className="bg-white text-base text-[#3E2F1C] placeholder:text-[#3E2F1C]/60 border border-[#3E2F1C]/30 rounded-lg px-3 py-2"
        />
        <button
          onClick={updateEpisode}
          className="px-4 py-2 bg-[#F29E4C] text-[#3E2F1C] rounded-lg hover:bg-[#ffb85c] transition"
        >
          Update
        </button>
      </div>

      {/* Admin Point Entry */}
      <div className="mb-8 p-4 bg-[#E3DCC3] rounded-xl shadow max-w-md space-y-4">
        <div className="flex flex-col gap-4">
          <h2 className="text-2xl font-semibold text-[#3E2F1C]">Add Points Manually</h2>
          <select
            value={selectedContestant}
            onChange={(e) => setSelectedContestant(e.target.value)}
            className="bg-white text-base text-[#3E2F1C] placeholder:text-[#3E2F1C]/60 border border-[#3E2F1C]/30 rounded-lg px-3 py-2"
          >
            <option value="">Select Contestant</option>
            {contestants.filter((c) => !c.eliminated).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.team})
              </option>
            ))}
          </select>
          <input
            type="number"
            placeholder="Points (+/-)"
            value={points}
            className="bg-white text-base text-[#3E2F1C] placeholder:text-[#3E2F1C]/60 border border-[#3E2F1C]/30 rounded-lg px-3 py-2"
            onChange={(e) => setPoints(e.target.value)}
          />
          <input
            type="text"
            placeholder="Reason (optional)"
            value={reason}
            className="bg-white text-base text-[#3E2F1C] placeholder:text-[#3E2F1C]/60 border border-[#3E2F1C]/30 rounded-lg px-3 py-2"
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            onClick={addPoints}
            className="w-full px-4 py-2 bg-[#F29E4C] text-[#3E2F1C] rounded-lg hover:bg-[#ffb85c] transition"
          >
            Add Points
          </button>
        </div>
      </div>

      {/* Pending Submissions */}
      <div className="mb-8 p-4 bg-[#E3DCC3] rounded-xl shadow max-w-3xl">
        <h2 className="text-2xl font-semibold text-[#3E2F1C] mb-4">Pending Submissions</h2>
        <div className="space-y-3">
          {pendingSubmissions.map((sub) => {
            const contestant = contestants.find((c) => c.id === sub.contestant_id);
            if (!contestant) return null;

            return (
              <div
                key={sub.id}
                className="flex justify-between items-center p-3 bg-[#F4EFE6] rounded-lg shadow-sm"
              >
                <div className="flex flex-col">
                  <span className="font-medium text-[#3E2F1C]">
                    {contestant.name} ({sub.points > 0 ? "+" : ""}
                    {sub.points}) — {sub.reason || "No reason"}
                  </span>
                  <span className="text-sm text-[#3E2F1C]/70">Submitted by {sub.submitted_by}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSubmission(sub, true)}
                    className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 transition"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleSubmission(sub, false)}
                    className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition"
                  >
                    Deny
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/*Submit Episode Recap*/}
      <div className="mb-8 p-4 bg-[#E3DCC3] rounded-xl shadow max-w-md space-y-4">
        <h2 className="text-2xl font-semibold text-[#3E2F1C]">
          Submit Episode Results
        </h2>

        {/* Immunity Winner */}
        <select
          value={immunityWinner}
          onChange={(e) => setImmunityWinner(e.target.value)}
          className="w-full border p-2 rounded"
        >
          <option value="">Select Immunity Winner</option>
          {contestants
            .filter((c) => !c.eliminated)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </select>

        {/* Eliminated Player */}
        <select
          value={eliminatedPlayer}
          onChange={(e) => setEliminatedPlayer(e.target.value)}
          className="w-full border p-2 rounded"
        >
          <option value="">Select Eliminated Player</option>
          {contestants
            .filter((c) => !c.eliminated)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </select>

        <button
          onClick={gradePredictions}
          className="w-full px-4 py-2 bg-[#F29E4C] text-[#3E2F1C] rounded-lg hover:bg-[#ffb85c] transition"
        >
          Submit Results & Grade Predictions
        </button>
      </div>


      {/* Contestant Management */}
      <div className="mt-10 bg-[#E3DCC3] p-4 rounded-xl shadow max-w-4xl">
        <h2 className="text-2xl font-semibold text-[#3E2F1C] mb-4">
          Contestant Management
        </h2>

        <div className="space-y-2">
          {contestants.sort((a,b)=>Number(a.eliminated) - Number(b.eliminated)).map((c) => (
            <div
              key={c.id}
              className="grid grid-cols-1 sm:grid-cols-3 items-center gap-3 bg-[#F7F3E9] p-3 rounded-lg shadow-sm"
            >
              {/* Name */}
              <div className="font-medium text-[#3E2F1C]">
                <span className={c.eliminated ? "line-through text-red-600 opacity-70" : ""}>
                  {c.name}
                </span>
              </div>

              {/* Immunity Weight */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-[#3E2F1C]/70 whitespace-nowrap">
                  Weight:
                </span>

                <input
                  type="number"
                  min={1}
                  max={15}
                  value={c.immunity_weight ?? 5}
                  onChange={async (e) => {
                    const newWeight = Number(e.target.value);

                    await supabase
                      .from("contestants")
                      .update({ immunity_weight: newWeight })
                      .eq("id", c.id);

                    setContestants((prev) =>
                      prev.map((x) =>
                        x.id === c.id ? { ...x, immunity_weight: newWeight } : x
                      )
                    );
                  }}
                  className="w-20 border border-[#3E2F1C]/30 rounded-lg px-2 py-1 text-center bg-white text-[#3E2F1C]"
                />
              </div>

              {/* Eliminate Button */}
              <div className="flex justify-start sm:justify-end">
                <button
                  onClick={() => toggleElimination(c)}
                  className={`px-4 py-1 rounded-full text-sm transition ${
                    c.eliminated
                      ? "bg-green-200 hover:bg-green-300 text-[#3E2F1C]"
                      : "bg-red-200 hover:bg-red-300 text-[#3E2F1C]"
                  }`}
                >
                  {c.eliminated ? "Reinstate" : "Eliminate"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
