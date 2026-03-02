"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

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
  const [showBanner, setShowBanner] = useState(false);
  const [searchSubmitted, setSearchSubmitted] = useState(false);


  useEffect(() => {
    // only run this in the browser
    const params = new URLSearchParams(window.location.search);
    if (params.get("submitted") === "true") {
      setShowBanner(true);
      setSearchSubmitted(true);

      const timer = setTimeout(() => setShowBanner(false), 3000);
      return () => clearTimeout(timer);
    }
  }, []);

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
          if (!payload || !payload.new) return;
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

  const sortedTeams = Object.entries(teamTotals).sort((a, b) => b[1] - a[1]);

  return (
    <div className="min-h-screen px-4 sm:px-6 py-12 sm:py-20 max-w-6xl mx-auto bg-[#F7F3E9]">
      <h1 className="text-3xl sm:text-5xl font-bold mb-8 sm:mb-12 text-[#3E2F1C] text-center">
        Survivor Fantasy League
      </h1>

      {/*Banner*/}
      {showBanner && (
        <div className="mb-8 max-w-xl mx-auto">
          <div className="bg-green-100 border border-green-300 text-green-800 px-4 py-3 rounded-xl shadow-md text-center animate-fade-in">
            Submission sent for review 👌
          </div>
        </div>
      )}

      {/*Page Redirects*/}
      <div className="flex justify-end gap-3 mb-4">
        <Link
          href="/projects/survivor-fantasy/submit"
          className="text-sm px-3 py-1 rounded-full bg-[#EADFC8] text-[#3E2F1C] hover:bg-[#D9C9AA] transition"
        >
          Submit Point Entry
        </Link>

        <Link
          href="/projects/survivor-fantasy/admin"
          className="text-sm px-3 py-1 rounded-full bg-[#D4B483] text-[#3E2F1C] hover:bg-[#C6A36F] transition"
        >
          Admin
        </Link>
      </div>

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
                      onError={(e) => { (e.target as HTMLImageElement).src = '/images/placeholder.png'; }}
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
                            onError={(e) => { (e.target as HTMLImageElement).src = '/images/placeholder.png'; }}
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

      {/*Scoring System Key*/}
      <details className="mt-16 max-w-3xl mx-auto bg-[#E3DCC3] p-6 rounded-2xl shadow-md cursor-pointer">
        <summary className="text-2xl font-bold mb-4 text-[#3E2F1C]">
          Scoring System
        </summary>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-[#3E2F1C] text-sm sm:text-base">

          {/* Challenges */}
          <div>
            <h3 className="font-semibold text-lg mb-3">🏆 Challenges</h3>
            <ul className="space-y-1">
              <li>Individual Immunity Win – <strong>6 pts</strong></li>
              <li>Team Immunity Win – <strong>4 pts</strong></li>
              <li>Team Immunity 2nd Place – <strong>2 pts</strong></li>
              <li>Individual Reward Win – <strong>3 pts</strong></li>
              <li>Team Reward Win – <strong>2 pts</strong></li>
              <li>Team Reward 2nd Place – <strong>1 pt</strong></li>
            </ul>
          </div>

          {/* MILESTONES */}
          <div>
            <h3 className="font-semibold text-lg mb-3">🔥 Milestones</h3>
            <ul className="space-y-1">
              <li>Sole Survivor – <strong>15 pts</strong></li>
              <li>Makes the Merge – <strong>5 pts</strong></li>
              <li>Find Hidden Immunity Idol – <strong>6 pts</strong></li>
              <li>Receive Advantage – <strong>2 pts</strong></li>
              <li>Receive Disadvantage – <strong>-1 pt</strong></li>
            </ul>
          </div>

          {/* Tribal */}
          <div>
            <h3 className="font-semibold text-lg mb-3">🗳 Tribal</h3>
            <ul className="space-y-1">
              <li>Vote Correctly – <strong>1 pt</strong></li>
              <li>Vote Incorrectly – <strong>-1 pt</strong></li>
              <li>Play Idol Correctly – <strong>10 pts</strong></li>
              <li>Play Idol Incorrectly – <strong>-4 pts</strong></li>
            </ul>
          </div>

          {/* Sorkin */}
          <div>
            <h3 className="font-semibold text-lg mb-3">😈 Sorkin Meter</h3>
            <ul className="space-y-1">
              <li>Good Confessional – <strong>? pts</strong></li>
              <li>Iconic Moment – <strong>? pts</strong></li>
              <li>Orchestrated Blindside – <strong>? pts</strong></li>
              <li>Cringe Status – <strong>-? pts</strong></li>
            </ul>
          </div>
        </div>
      </details>

    </div>
  );
}
