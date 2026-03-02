"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

type Contestant = { id: string; name: string; team: string; eliminated: boolean; };
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

  // Function to handle login
  const handleLogin = () => {
    if (passwordInput === process.env.NEXT_PUBLIC_ADMIN_KEY) {
      setIsAdmin(true);
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

      {/* Pending Submissions */}
      <div className="p-4 bg-[#E3DCC3] rounded-xl shadow max-w-3xl">
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
      {contestants.map((c) => (
        <div
          key={c.id}
          className="flex items-center justify-between bg-[#F7F3E9] p-3 rounded-lg shadow-sm"
        >
          <span
            className={`font-medium ${
              c.eliminated ? "text-red-600 line-through opacity-70" : ""
            }`}
          >
            {c.name}
          </span>

          <button
            onClick={() => toggleElimination(c)}
            className={`px-3 py-1 text-sm rounded-full transition ${
              c.eliminated
                ? "bg-green-200 hover:bg-green-300"
                : "bg-red-200 hover:bg-red-300"
            }`}
          >
            {c.eliminated ? "Reinstate" : "Eliminate"}
          </button>
        </div>
      ))}
    </div>
  );
}
