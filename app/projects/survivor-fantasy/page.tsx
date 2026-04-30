"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

type Contestant = { id: string; name: string; team: string; eliminated: boolean; };
type PointEvent = { contestant_id: string; points: number; episode: number; reason?: string; created_at: string; team: string; type: string;};

export default function SurvivorFantasy() {
  const [contestants, setContestants] = useState<Contestant[]>([]);
  const [pointEvents, setPointEvents] = useState<PointEvent[]>([]);
  const [showBannerS, setShowBannerS] = useState(false);
  const [showBannerP, setShowBannerP] = useState(false);
  const [searchSubmitted, setSearchSubmitted] = useState(false);
  const [selectedContestant, setSelectedContestant] = useState<Contestant | null>(null);
  const [contestantEvents, setContestantEvents] = useState<PointEvent[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [teamPredictions, setTeamPredictions] = useState<any[]>([]);
  const [publicPredictions, setPublicPredictions] = useState<any[]>([]);
  const [episodeResults, setEpisodeResults] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const flag = localStorage.getItem("is_admin");
    if (flag === "true") setIsAdmin(true);
  }, []);

  useEffect(() => {
    // only run this in the browser
    const params = new URLSearchParams(window.location.search);
    if (params.get("submitted") === "true") {
      setShowBannerS(true);
      setSearchSubmitted(true);

      const timer = setTimeout(() => setShowBannerS(false), 3000);
      return () => clearTimeout(timer);
    }
    if (params.get("predicted") === "true") {
      setShowBannerP(true);

      const timer = setTimeout(() => setShowBannerP(false), 3000);
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

  //1. Contestant points
  contestantsWithPoints.forEach((c) => {
    teamTotals[c.team] = (teamTotals[c.team] || 0) + c.points;
  });

  // 2. team-based events (prediction bonuses)
  pointEvents
    .filter((e) => e.type === "team" && e.team)
    .forEach((e) => {
      teamTotals[e.team!] = (teamTotals[e.team!] || 0) + e.points;
    });

  const sortedTeams = Object.entries(teamTotals).sort((a, b) => b[1] - a[1]);

  const openContestantHistory = (contestant: Contestant) => {
    setSelectedContestant(contestant);

    const events = pointEvents
      .filter((e) => e.contestant_id === contestant.id)
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() -
          new Date(a.created_at).getTime()
      )
      .slice(0, 50);

    setContestantEvents(events);
  };

  //Open team history
  const openTeamModal = async (team: string) => {
    setSelectedTeam(team);

    const { data: predictionsData } = await supabase
      .from("predictions")
      .select("*")
      .eq("team", team)
      .order("episode", { ascending: false });

    const { data: publicData } = await supabase
      .from("public_predictions")
      .select("*");

    const { data: resultsData } = await supabase
      .from("episode_results")
      .select("*");

    if (predictionsData) setTeamPredictions(predictionsData);
    if (resultsData) setEpisodeResults(resultsData);
    if (publicData) setPublicPredictions(publicData);
  };

  const resultsMap = episodeResults.reduce((acc, r) => {
    acc[r.episode] = r;
    return acc;
  }, {} as Record<number, any>);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedContestant(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const selectedContestantPoints = selectedContestant
    ? pointEvents
        .filter((e) => e.contestant_id === selectedContestant.id)
        .reduce((sum, e) => sum + e.points, 0)
    : 0;

  const groupedEvents = contestantEvents.reduce((groups: Record<number, PointEvent[]>, event) => {
    if (!groups[event.episode]) {
      groups[event.episode] = [];
    }
    groups[event.episode].push(event);
    return groups;
  }, {});

  const visibleEvents = pointEvents
    .filter((e) => e.type !== "team")
    .slice(-20)
    .reverse();

  return (
    <div className="min-h-screen px-4 sm:px-6 pt-4 sm:pt-8 pb-12 max-w-6xl mx-auto bg-[#F7F3E9]">
      <h1 className="text-3xl sm:text-5xl font-bold mb-4 sm:mb-12 text-[#3E2F1C] text-center">
        Survivor Fantasy League
      </h1>

      {/*Banner*/}
      {showBannerS && (
        <div className="mb-8 max-w-xl mx-auto">
          <div className="bg-green-100 border border-green-300 text-green-800 px-4 py-3 rounded-xl shadow-md text-center animate-fade-in">
            Submission sent for review 👌
          </div>
        </div>
      )}

      {showBannerP && (
        <div className="mb-8 max-w-xl mx-auto">
          <div className="bg-green-100 border border-green-300 text-green-800 px-4 py-3 rounded-xl shadow-md text-center animate-fade-in">
            Prediction submitted 🔮
          </div>
        </div>
      )}

      {/* Page Redirects */}
      <div className="flex flex-col sm:flex-row sm:justify-end gap-2 sm:gap-3 mb-3 sm:mb-4">
        
        <Link
          href="/projects/survivor-fantasy/predictions"
          className="flex items-center justify-center text-sm sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-[#EADFC8] text-[#3E2F1C] hover:bg-[#D9C9AA] transition shadow-sm active:scale-[0.98]"
        >
          Make Episode Prediction
        </Link>

        <Link
          href="/projects/survivor-fantasy/submit"
          className="flex items-center justify-center text-sm sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-[#EADFC8] text-[#3E2F1C] hover:bg-[#D9C9AA] transition shadow-sm active:scale-[0.98]"
        >
          Submit Point Entry
        </Link>

        {isAdmin && (
          <Link
            href="/projects/survivor-fantasy/admin"
            className="flex items-center justify-center text-sm sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-[#EADFC8] text-[#3E2F1C] hover:bg-[#D9C9AA] transition shadow-sm active:scale-[0.98]"
          >
            Admin
          </Link>
        )}

      </div>

      {/* Recent Activity */}
      <section className="mb-10">
        <h2 className="text-2xl sm:text-3xl font-bold mb-3 sm:mb-4 text-[#3E2F1C]">Recent Activity</h2>
        <div className="relative max-w-2xl">
          <div className="space-y-2 sm:space-y-3 max-w-2xl max-h-[38vh] sm:max-h-[580px] overflow-y-auto pr-1">
            <div className="space-y-2 sm:space-y-3 max-w-2xl">
              <AnimatePresence>
                {visibleEvents.map((event, idx) => {
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
          </div>
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-30 bg-gradient-to-t from-[#F7F3E9] to-transparent" />
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
                  <button
                    onClick={() => openTeamModal(team)}
                    className="text-2xl font-bold text-[#3E2F1C] hover:underline"
                  >
                    {team}
                  </button>
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
                      <button
                        key={member.id}
                        onClick={() => openContestantHistory(member)}
                        className="flex items-center justify-between bg-[#F7F3E9] rounded-lg p-2 sm:p-3 shadow-sm w-full hover:bg-[#EFE7D3] transition"
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={`/images/contestants/${imgName}.png`}
                            alt={member.name}
                            onError={(e) => { (e.target as HTMLImageElement).src = '/images/placeholder.png'; }}
                            className="w-14 h-20 sm:w-16 sm:h-24 object-contain rounded-lg bg-neutral-200"
                          />
                          <span className={`text-lg font-medium ${member.eliminated ? "text-red-600 line-through opacity-70": "text-[#3E2F1C]"}`}>
                            {member.name}
                          </span>
                        </div>

                        <span className="text-[#3E2F1C]/90 text-lg font-semibold">
                          {member.points} pts
                        </span>
                      </button>
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

      {/* Modal for showing survivor contestant recent points */}
      {selectedContestant && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedContestant(null)}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-4 mb-4">

              {(() => {
                const imgName = selectedContestant.name.replace(/ /g, "_");
                return (
                  <img
                    src={`/images/contestants/${imgName}.png`}
                    alt={selectedContestant.name}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/images/placeholder.png";
                    }}
                    className="w-16 h-24 object-contain rounded-lg bg-neutral-200"
                  />
                );
              })()}

              <div className="flex-1">
                <h2 className="text-xl font-semibold text-[#3E2F1C]">
                  {selectedContestant.name}
                </h2>

                <p className="text-sm text-[#3E2F1C]/70">
                  {selectedContestantPoints} total points
                </p>
              </div>

              <button
                onClick={() => setSelectedContestant(null)}
                className="text-lg text-gray-500 hover:text-black"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 max-h-[400px] overflow-y-auto">

              {contestantEvents.length === 0 && (
                <p className="text-sm text-gray-500">No scoring events yet.</p>
              )}

              {Object.entries(groupedEvents).sort((a, b) => Number(b[0]) - Number(a[0])).map(([episode, events]) => (
                <div key={episode} className="mb-3">

                  <h3 className="text-sm font-semibold text-[#3E2F1C]/70 mb-1">
                    Episode {episode} -  {events.reduce((sum, e) => sum + e.points, 0)} pts
                  </h3>

                  <div className="space-y-2">
                    {events.map((event, i) => (
                      <div
                        key={i}
                        className="flex justify-between bg-[#F7F3E9] p-2 rounded-lg"
                      >
                        <span className="text-[#3E2F1C] text-sm">
                          {event.reason || "No reason"}
                        </span>

                        <span
                          className={`font-semibold ${
                            event.points > 0 ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {event.points > 0 ? "+" : ""}
                          {event.points}
                        </span>
                      </div>
                    ))}
                  </div>

                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/*Modal for showing team points*/}
      {selectedTeam && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedTeam(null)}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-[#3E2F1C]">
                {selectedTeam} Predictions
              </h2>

              <button
                onClick={() => setSelectedTeam(null)}
                className="text-gray-500 hover:text-black"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {teamPredictions.length === 0 && (
                <p className="text-sm text-gray-500">
                  No predictions yet.
                </p>
              )}

              {teamPredictions.map((p, i) => {
                const result = episodeResults.find(
                  (r) => r.episode === p.episode
                );

                const guestEventsForEpisode = pointEvents.filter(
                  (e) =>
                    e.type === "team" &&
                    e.team === selectedTeam &&
                    e.episode === p.episode &&
                    e.reason?.startsWith("Guest (")
                );

                const guestBreakdown = guestEventsForEpisode.map((e) => {
                  const guestName = e.reason?.match(/Guest \((.*?)\)/)?.[1] || "Guest";

                  const prediction = publicPredictions.find(
                    (gp) =>
                      gp.episode === e.episode &&
                      (gp.team_1 === selectedTeam || gp.team_2 === selectedTeam) &&
                      gp.name === guestName
                  );

                  if (!prediction) return null;

                  const result = episodeResults.find(r => r.episode === e.episode);

                  const immunityCorrect =
                    prediction.immunity_pick === result?.immunity_winner;

                  const eliminatedCorrect =
                    prediction.eliminated_pick === result?.eliminated_player;

                  const immunityName =
                    contestants.find(c => c.id === prediction.immunity_pick)?.name;

                  const eliminatedName =
                    contestants.find(c => c.id === prediction.eliminated_pick)?.name;

                  return {
                    guestName,
                    immunityCorrect,
                    eliminatedCorrect,
                    immunityName,
                    eliminatedName,
                    totalPoints: e.points,
                  };
                }).filter((g): g is NonNullable<typeof g> => g !== null);

                const immunityCorrect =
                  result && p.immunity_pick === result.immunity_winner;

                const eliminatedCorrect =
                  result && p.eliminated_pick === result.eliminated_player;

                const totalPoints =
                  (immunityCorrect ? p.immunity_weight_snapshot : 0) + (eliminatedCorrect ? 5 : 0);

                return (
                  <div key={i} className="bg-[#F7F3E9] p-3 rounded-lg">
                    
                    {/* Episode header */}
                    <div className="text-sm text-[#3E2F1C]/70 mb-1">
                      Episode {p.episode}
                    </div>

                    {/* Results */}
                    <div className="mt-2 text-sm text-[#3E2F1C] space-y-1">

                      {(() => {
                        const immunityPickName =
                          contestants.find(c => c.id === p.immunity_pick)?.name || "—";

                        const eliminatedPickName =
                          contestants.find(c => c.id === p.eliminated_pick)?.name || "—";

                        const result = episodeResults.find(r => r.episode === p.episode);

                        // 🟡 UNRESOLVED STATE
                        if (!result) {
                          return (
                            <div className="space-y-1">
                              <div>🛡 Immunity Pick: {immunityPickName}</div>
                              <div>🔥 Eliminated Pick: {eliminatedPickName}</div>
                              <div className="text-gray-400 italic">
                                Episode is unresolved
                              </div>
                            </div>
                          );
                        }

                        // 🟢 RESOLVED STATE
                        const actualImmunity =
                          contestants.find(c => c.id === result.immunity_winner)?.name || "—";

                        const actualEliminated =
                          contestants.find(c => c.id === result.eliminated_player)?.name || "—";

                        const immunityCorrect = p.immunity_pick === result.immunity_winner;
                        const eliminatedCorrect = p.eliminated_pick === result.eliminated_player;

                        const totalPoints =
                          (immunityCorrect ? p.immunity_weight : 0) + (eliminatedCorrect ? 5 : 0);

                        return (
                          <div className="space-y-1">
                            
                            <div>
                              🛡 Immunity Pick: {immunityPickName}{" "}
                              <span className={immunityCorrect ? "text-green-600" : "text-red-600"}>
                                {immunityCorrect ? "✔" : "✖"}
                              </span>

                              {!immunityCorrect && (
                                <span className="text-[#3E2F1C]/70">
                                  {" "}was {actualImmunity}
                                </span>
                              )}
                            </div>

                            <div>
                              🔥 Eliminated Pick: {eliminatedPickName}{" "}
                              <span className={eliminatedCorrect ? "text-green-600" : "text-red-600"}>
                                {eliminatedCorrect ? "✔" : "✖"}
                              </span>

                              {!eliminatedCorrect && (
                                <span className="text-[#3E2F1C]/70">
                                  {" "}was {actualEliminated}
                                </span>
                              )}
                            </div>

                            <div className="font-semibold">
                              +{totalPoints} pts
                            </div>

                            {/* Guest Prediction Points */}
                            {guestBreakdown.length > 0 && (
                              <div className="mt-2 space-y-1 text-sm">
                                {guestBreakdown.map((g, idx) => (
                                  <div key={idx} className="text-[#3E2F1C]/80">
                                    
                                    {g.immunityCorrect && (
                                      <div>
                                        {g.guestName} predicted {g.immunityName} to win immunity —{" "}
                                        <span className="text-green-600 font-medium">
                                          +{g.totalPoints - (g.eliminatedCorrect ? 5 : 0)} pts
                                        </span>
                                      </div>
                                    )}

                                    {g.eliminatedCorrect && (
                                      <div>
                                        {g.guestName} predicted {g.eliminatedName} to be eliminated —{" "}
                                        <span className="text-green-600 font-medium">
                                          +5 pts
                                        </span>
                                      </div>
                                    )}

                                  </div>
                                ))}
                              </div>
                            )}

                          </div>
                        );
                      })()}

                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
