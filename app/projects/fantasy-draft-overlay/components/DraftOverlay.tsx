"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { DraftOverlayData, DraftPick, DraftPlayer } from "../types";

const POLL_INTERVAL = 250;

const PICK_ANNOUNCEMENT_DURATION = 1800;

const BETWEEN_PICK_DELAY = 200;

const positionStyles: Record<string, string> = {
  QB: "bg-blue-500/20 text-blue-300 border-blue-400/30",

  RB: "bg-green-500/20 text-green-300 border-green-400/30",

  WR: "bg-yellow-500/20 text-yellow-300 border-yellow-400/30",

  TE: "bg-purple-500/20 text-purple-300 border-purple-400/30",

  K: "bg-red-500/20 text-red-300 border-red-400/30",

  DEF: "bg-cyan-500/20 text-cyan-300 border-cyan-400/30",

  DST: "bg-cyan-500/20 text-cyan-300 border-cyan-400/30",
};

function PositionBadge({ position }: { position: string }) {
  const style =
    positionStyles[position] ?? "bg-white/10 text-white/70 border-white/10";

  return (
    <span
      className={`inline-flex h-6 min-w-[34px] shrink-0 items-center justify-center rounded px-1.5 text-[10px] font-extrabold ${style}`}
    >
      {position}
    </span>
  );
}

function RosterPlayer({ player }: { player: DraftPlayer }) {
  return (
    <div className="flex h-[38px] items-center gap-2 rounded-md bg-white/[0.06] px-2">
      <PositionBadge position={player.position} />

      <div className="min-w-0 flex-1">
        <div className="truncate text-[12px] font-bold leading-tight text-white">
          {player.name}
        </div>

        <div className="text-[9px] leading-tight text-white/35">
          {player.nflTeam}
        </div>
      </div>
    </div>
  );
}

function LastPickRow({
  teamName,
  player,
}: {
  teamName: string;
  player: DraftPlayer;
}) {
  return (
    <div className="flex h-[42px] items-center gap-2 rounded-md bg-white/[0.05] px-2.5">
      <PositionBadge position={player.position} />

      <div className="min-w-0 flex-1">
        <div className="truncate text-[11px] font-bold leading-tight text-white">
          {player.name}
        </div>

        <div className="truncate text-[9px] leading-tight text-white/40">
          {teamName}
        </div>
      </div>
    </div>
  );
}

function DraftStatusPanel({
  data,
  displayedCurrentTeam,
}: {
  data: DraftOverlayData;
  displayedCurrentTeam: DraftOverlayData["currentTeam"];
}) {
  const currentTeam = displayedCurrentTeam;

  if (!currentTeam) {
    return (
      <div className="flex h-screen w-[360px] items-center justify-center bg-slate-900 text-white/40">
        <div className="text-xs font-semibold uppercase tracking-widest">
          Waiting for draft
        </div>
      </div>
    );
  }

  const players = currentTeam.players.slice(0, 7);

  return (
    <div className="flex h-screen w-[360px] flex-col overflow-hidden bg-slate-900 text-white shadow-2xl">
      {/* HEADER */}
      <div className="shrink-0 border-b border-white/10 px-4 pb-3 pt-4">
        <div className="flex items-center justify-between">
          <div className="text-[9px] font-extrabold uppercase tracking-[0.22em] text-white/35">
            On the Clock
          </div>

          <div className="text-[10px] font-semibold text-white/35">
            R{data.progress.currentRound ?? "—"}
            {" • "}P{data.progress.nextPickNumber ?? "—"}
          </div>
        </div>

        <div className="mt-1 truncate text-[23px] font-black leading-tight tracking-tight text-white">
          {currentTeam.name}
        </div>
      </div>

      {/* CURRENT ROSTER */}
      <div className="shrink-0 border-b border-white/10 px-4 py-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-white/35">
            Current Roster
          </div>

          <div className="text-[9px] font-semibold text-white/25">
            {currentTeam.players.length}/16
          </div>
        </div>

        <div className="space-y-1">
          {players.length === 0 ? (
            <div className="flex h-[38px] items-center rounded-md bg-white/[0.04] px-2 text-[10px] text-white/25">
              No players drafted
            </div>
          ) : (
            players.map((player) => (
              <RosterPlayer
                key={`${player.pickNo}-${player.playerId}`}
                player={player}
              />
            ))
          )}
        </div>

        {currentTeam.players.length > 5 && (
          <div className="mt-1.5 text-center text-[8px] font-semibold text-white/20">
            +{currentTeam.players.length - 5} more
          </div>
        )}
      </div>

      {/* LAST FOUR */}
      <div className="min-h-0 flex-1 px-4 py-3">
        <div className="mb-2 text-[9px] font-extrabold uppercase tracking-[0.18em] text-white/35">
          Last 4 Picks
        </div>

        <div className="space-y-1">
          {data.lastFourPicks.map((pick) => (
            <LastPickRow
              key={`${pick.player.pickNo}-${pick.player.playerId}`}
              teamName={pick.teamName}
              player={pick.player}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function PickAnnouncement({ pick }: { pick: DraftPick }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
      <div className="rounded-xl border border-white/10 bg-slate-900 px-9 py-7 text-center shadow-2xl">
        <div className="text-[11px] font-black uppercase tracking-[0.28em] text-white/40">
          Pick Is In
        </div>

        <div className="mt-2 text-3xl font-black tracking-tight text-white">
          {pick.player.name}
        </div>

        <div className="mt-2 flex items-center justify-center gap-2">
          <PositionBadge position={pick.player.position} />

          <span className="text-xs font-semibold text-white/50">
            {pick.player.nflTeam}
          </span>
        </div>

        <div className="mt-3 text-xs font-semibold text-white/35">
          {pick.teamName}
          {" • "}
          Pick {pick.pickNo}
        </div>
      </div>
    </div>
  );
}

export default function DraftOverlay() {
  const [data, setData] = useState<DraftOverlayData | null>(null);

  const [displayedCurrentTeam, setDisplayedCurrentTeam] =
    useState<DraftOverlayData["currentTeam"]>(null);

  const [announcementPick, setAnnouncementPick] = useState<DraftPick | null>(
    null,
  );

  const pickQueueRef = useRef<DraftPick[]>([]);

  const highestSeenPickRef = useRef(0);

  const processingQueueRef = useRef(false);

  const initializedRef = useRef(false);

  const sleep = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms));

  const processQueue = useCallback(async () => {
    if (processingQueueRef.current) {
      return;
    }

    processingQueueRef.current = true;

    try {
      while (pickQueueRef.current.length > 0) {
        const pick = pickQueueRef.current.shift();

        if (!pick) {
          break;
        }

        /*
         * SHOW PICK
         */
        setAnnouncementPick(pick);

        await sleep(PICK_ANNOUNCEMENT_DURATION);

        /*
         * PICK IS DONE.
         *
         * Now determine the team that should
         * actually be on the clock for the
         * next pick.
         */
        setData((currentData) => {
          if (!currentData) {
            return currentData;
          }

          const nextPickNumber = pick.pickNo + 1;

          if (nextPickNumber > currentData.draft.totalPicks) {
            return currentData;
          }

          const teamCount = currentData.draft.teams;

          const nextRound = Math.floor((nextPickNumber - 1) / teamCount) + 1;

          const pickWithinRound = ((nextPickNumber - 1) % teamCount) + 1;

          const nextSlot =
            nextRound % 2 === 1
              ? pickWithinRound
              : teamCount - pickWithinRound + 1;

          const nextRosterId = Object.entries(
            currentData.teams.reduce<Record<string, number>>((map, team) => {
              /*
               * The teams array itself doesn't
               * expose draft slots, so the latest
               * API currentTeam is used below when
               * available.
               */
              map[String(team.rosterId)] = team.rosterId;

              return map;
            }, {}),
          ).find(() => false);

          void nextSlot;
          void nextRosterId;

          /*
           * If Sleeper has already caught up,
           * immediately show its current team.
           *
           * Otherwise the next poll will update it.
           */
          if (
            currentData.progress.nextPickNumber === nextPickNumber &&
            currentData.currentTeam
          ) {
            setDisplayedCurrentTeam(currentData.currentTeam);
          }

          return currentData;
        });

        setAnnouncementPick(null);

        await sleep(BETWEEN_PICK_DELAY);
      }
    } finally {
      processingQueueRef.current = false;
    }
  }, []);

  const fetchDraft = useCallback(async () => {
    try {
      const response = await fetch("/api/fantasy-draft", {
        cache: "no-store",
      });

      if (!response.ok) {
        return;
      }

      const nextData = (await response.json()) as DraftOverlayData;

      /*
       * First load:
       *
       * Don't replay every pick that already exists.
       */
      if (!initializedRef.current) {
        highestSeenPickRef.current = nextData.progress.completedPicks;

        initializedRef.current = true;

        setData(nextData);

        setDisplayedCurrentTeam(nextData.currentTeam);

        return;
      }

      setData(nextData);

      /*
       * Find newly completed picks.
       */
      const newPicks = nextData.picks.filter(
        (pick) => pick.pickNo > highestSeenPickRef.current,
      );

      if (newPicks.length > 0) {
        newPicks.sort((a, b) => a.pickNo - b.pickNo);

        highestSeenPickRef.current = newPicks[newPicks.length - 1].pickNo;

        pickQueueRef.current.push(...newPicks);

        void processQueue();

        return;
      }

      /*
       * No new pick is being processed.
       * It's safe to synchronize the clock normally.
       */
      if (!processingQueueRef.current && !announcementPick) {
        setDisplayedCurrentTeam(nextData.currentTeam);
      }
    } catch (error) {
      console.error("Failed to fetch fantasy draft:", error);
    }
  }, [announcementPick, processQueue]);

  useEffect(() => {
    fetchDraft();

    const interval = window.setInterval(fetchDraft, POLL_INTERVAL);

    return () => window.clearInterval(interval);
  }, [fetchDraft]);

  if (!data) {
    return null;
  }

  /*
   * Don't show the overlay until the draft is actually active.
   */
  if (data.draft.status === "pre_draft" && data.progress.completedPicks === 0) {
    return (
      <div className="fixed right-0 top-0 h-screen w-[360px]">
        <div className="flex h-full items-center justify-center bg-slate-900">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">
            Waiting for draft...
          </div>
        </div>
      </div>
    );
  }

  if (data.progress.completedPicks >= data.draft.totalPicks) {
    return (
      <div className="fixed right-0 top-0 h-screen w-[360px]">
        <div className="flex h-full items-center justify-center bg-slate-900">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">
            Draft Complete
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="fixed right-0 top-0 h-screen">
        <DraftStatusPanel
          data={data}
          displayedCurrentTeam={displayedCurrentTeam}
        />
      </div>

      {announcementPick && <PickAnnouncement pick={announcementPick} />}
    </>
  );
}
