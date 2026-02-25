"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";

type Contestant = { id: string; name: string; team: string };
type PointEvent = { contestant_id: string; points: number; episode: number; reason?: string; };

export default function SurvivorFantasy() {
  const [contestants, setContestants] = useState<Contestant[]>([]);
  const [pointEvents, setPointEvents] = useState<PointEvent[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedContestant, setSelectedContestant] = useState("");
  const [points, setPoints] = useState("");
  const [reason, setReason] = useState("");
  const [episode, setEpisode] = useState("");
  const [currentEpisode, setCurrentEpisode] = useState(1);


  useEffect(() => {
    async function fetchData() {
      const { data: contestantsData } = await supabase
        .from("contestants")
        .select("*");
      const { data: eventsData } = await supabase.from("point_events").select("*");
      setContestants(contestantsData || []);
      setPointEvents(eventsData || []);
    }

    fetchData();

    const channel = supabase
      .channel("point-events")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "point_events" },
        (payload) => {
          const newEvent = payload.new as PointEvent;
          setPointEvents((prev) => [...prev, newEvent]);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  // Aggregate totals
  const totals: Record<string, number> = {};
  pointEvents.forEach((event) => {
    totals[event.contestant_id] = (totals[event.contestant_id] || 0) + event.points;
  });

  const contestantsWithPoints = contestants.map((c) => ({
    ...c,
    points: totals[c.id] || 0,
  }));

  const teamTotals: Record<string, number> = {};
  contestantsWithPoints.forEach((c) => {
    teamTotals[c.team] = (teamTotals[c.team] || 0) + c.points;
  });
        const handleAdminToggle = () => {
        if (!isAdmin) {
          const input = prompt("Enter admin key:");
          if (input === process.env.NEXT_PUBLIC_ADMIN_KEY) {
            setIsAdmin(true);
          } else {
            alert("Incorrect key!");
          }
        } else {
          setIsAdmin(false);
        }
      };

  const sortedTeams = Object.entries(teamTotals).sort((a, b) => b[1] - a[1]);

  return (
    <div className="min-h-screen px-4 sm:px-6 py-12 sm:py-20 max-w-6xl mx-auto bg-[#F7F3E9]">
      <h1 className="text-3xl sm:text-5xl font-bold mb-8 sm:mb-12 text-[#3E2F1C] text-center">
        Survivor Fantasy League
      </h1>

      {/* Admin Toggle */}
      <div className="flex justify-center mb-10">
      <button
        className="px-6 py-3 bg-[#F29E4C] text-[#3E2F1C] font-semibold rounded-xl shadow-md hover:bg-[#ffb85c] transition"
        onClick={handleAdminToggle}
      >
        {isAdmin ? "Exit Admin Mode" : "Enter Admin Mode"}
      </button>
      </div>

      {/* Admin Panel */}
      {isAdmin && (
        <div className="mb-12 sm:mb-16 p-4 sm:p-6 rounded-2xl bg-[#E3DCC3] shadow-lg max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3 sm:mb-4 text-[#3E2F1C]">Add Scoring Event</h2>

          <div className="flex items-center gap-4 mb-4">
            <label className="font-medium text-[#3E2F1C]">Episode:</label>
            <input
              type="number"
              min={1}
              value={currentEpisode}
              onChange={(e) => setCurrentEpisode(parseInt(e.target.value))}
              className="border p-2 rounded w-20 text-[#3E2F1C]"
            />
          </div>

          <form
            className="flex flex-col gap-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!selectedContestant) return;
              const { error } = await supabase.from("point_events").insert([
                {
                  contestant_id: selectedContestant,
                  points: parseInt(points),
                  reason,
                  episode: currentEpisode,
                },
              ]);
              if (error) alert("Error adding points: " + error.message);
              else {
                setPoints(""); setReason(""); setEpisode("");
              }
            }}
          >
            <select
              className="border p-2 rounded text-[#3E2F1C]"
              value={selectedContestant}
              onChange={(e) => setSelectedContestant(e.target.value)}
              required
            >
              <option value="">Select Contestant</option>
              {contestants.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.team})
                </option>
              ))}
            </select>

            <input
              type="number"
              placeholder="Points (+/-)"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              className="border p-2 rounded text-[#3E2F1C]"
              required
            />

            <input
              type="text"
              placeholder="Reason (optional)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="border p-2 rounded text-[#3E2F1C]"
            />

            <button
              type="submit"
              className="px-4 py-2 bg-[#F29E4C] text-[#3E2F1C] rounded-lg shadow hover:bg-[#ffb85c] transition"
            >
              Add Event
            </button>
          </form>
        </div>
      )}

      {/* Recent Activity */}
      <section className="mb-10">
        <h2 className="text-2xl sm:text-3xl font-bold mb-3 sm:mb-4 text-[#3E2F1C]">Recent Activity</h2>

        <div className="space-y-2 sm:space-y-3 max-w-2xl">
          <AnimatePresence>
            {pointEvents.slice(-8).reverse().map((event, idx) => {
              const contestant = contestants.find(
                (c) => c.id === event.contestant_id
              );
              if (!contestant) return null;

              const imgName = contestant.name.replace(/ /g, "_");

              return (
                <motion.div
                  key={`${event.contestant_id}-${event.points}-${idx}`}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex justify-between bg-[#F7F3E9] p-3 rounded-lg shadow-sm border-l-4 border-[#F29E4C]"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={`/images/contestants/${imgName}.png`}
                      alt={contestant.name}
                      className="w-12 h-16 sm:w-14 sm:h-20 object-contain rounded-lg bg-neutral-200"
                    />

                    <span
                      className={`font-medium text-lg ${
                        event.points > 0 ? "text-green-700" : "text-red-700"
                      }`}
                    >
                      <span
                        className={`font-medium text-lg ${
                          event.points > 0 ? "text-green-700" : "text-red-700"
                        }`}
                      >
                        {contestant.name} ({event.points > 0 ? "+" : ""}
                        {event.points})
                      </span>
                    </span>
                  </div>

                  <span className="text-[#3E2F1C]/80 italic text-sm">
                    {event.reason || "No reason"}
                  </span>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </section>

      {/*Team Ranking Section*/}
      <section className="mb-10">
        <h2 className="text-2xl sm:text-3xl font-bold mb-3 sm:mb-4 text-[#3E2F1C]">Team Rankings</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {sortedTeams.map(([team, teamPoints]) => {
            const teamMembers = contestantsWithPoints
              .filter((c) => c.team === team)
              .sort((a, b) => b.points - a.points);

            return (
              <div
                key={team}
                className="p-4 sm:p-6 rounded-2xl bg-[#E3DCC3] shadow-md border border-[#A4B494]"
              >
                {/* Team Header */}
                <div className="flex justify-between mb-4">
                  <span className="text-2xl font-bold text-[#3E2F1C]">{team}</span>
                  <motion.span
                    key={teamPoints}
                    initial={{ scale: 1.1 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.2 }}
                    className="text-2xl font-semibold text-[#3E2F1C]"
                  >
                    {teamPoints} pts
                  </motion.span>
                </div>

                {/* Team Members */}
                <div className="space-y-3">
                  {teamMembers.map((member) => {
                    const imgName = member.name.replace(/ /g, "_");
                    return (
                      <div
                        key={member.id}
                        className="flex items-center justify-between bg-[#F7F3E9] rounded-lg p-2 sm:p-3 shadow-sm"
                      >
                        <div className="flex items-center gap-3">
                          {/* Rectangular image instead of cropped circle */}
                          <img
                            src={`/images/contestants/${imgName}.png`}
                            alt={member.name}
                            className="w-14 h-20 sm:w-16 sm:h-24 object-contain rounded-lg bg-neutral-200"
                          />
                          <span className="text-[#3E2F1C] text-lg font-medium">{member.name}</span>
                        </div>
                        <span className="text-[#3E2F1C]/90 text-lg font-semibold">{member.points} pts</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

    </div>
  );
}
