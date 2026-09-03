"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { DraftOverlayData, DraftPick, DraftPlayer } from "../types";

const POLL_INTERVAL = 500;

/*
 * How long the PICK IS IN graphic stays on screen.
 */
const PICK_ANNOUNCEMENT_DURATION = 3800;

const BETWEEN_PICK_DELAY = 200;

/*
 * Width of the draft panel on the right side.
 *
 * The pick announcement is centered in everything LEFT
 * of this panel, which is the live-stream/camera area.
 */
const DRAFT_PANEL_WIDTH = 360;

const positionStyles: Record<string, string> = {
  QB: "bg-blue-500/20 text-blue-300 border-blue-400/30",
  RB: "bg-green-500/20 text-green-300 border-green-400/30",
  WR: "bg-yellow-500/20 text-yellow-300 border-yellow-400/30",
  TE: "bg-purple-500/20 text-purple-300 border-purple-400/30",
  K: "bg-red-500/20 text-red-300 border-red-400/30",
  DEF: "bg-cyan-500/20 text-cyan-300 border-cyan-400/30",
  DST: "bg-cyan-500/20 text-cyan-300 border-cyan-400/30",
};

const drafterImages: Record<string, string> = {
  cooter12: "/draft-overlay/drafters/Cooter12.png",
  erpawela: "/draft-overlay/drafters/erpawela.png",
  johnilevin21: "/draft-overlay/drafters/johnilevin21.png",
  shupdaddy: "/draft-overlay/drafters/shupdaddy.png",
  extremelsu: "/draft-overlay/drafters/extremelsu.png",
  sorknado: "/draft-overlay/drafters/sorknado.png",
  jernigaga: "/draft-overlay/drafters/Jernigaga.png",
  tepper17: "/draft-overlay/drafters/tepper17.png",
  michaelsweeney44: "/draft-overlay/drafters/michaelsweeney44.png",
  nonofrio: "/draft-overlay/drafters/nonofrio.png",
  mcdirty4: "/draft-overlay/drafters/mcdirty4.png",
  nitlion: "/draft-overlay/drafters/Nitlion.png",
};

function getDrafterImage(username: string): string | null {
  return drafterImages[username.trim().toLowerCase()] ?? null;
}

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

        {currentTeam.players.length > 7 && (
          <div className="mt-1.5 text-center text-[8px] font-semibold text-white/20">
            +{currentTeam.players.length - 7} more
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
  const image = getDrafterImage(pick.username);

  return (
    /*
     * IMPORTANT:
     *
     * The announcement is no longer centered against the
     * entire viewport.
     *
     * `right: 360px` reserves the entire draft panel on the
     * right, so this flex container represents only the
     * live-stream area.
     */
    <div
      className="pointer-events-none fixed inset-y-0 left-0 z-50 flex items-center justify-center px-6"
      style={{
        right: `${DRAFT_PANEL_WIDTH}px`,
      }}
    >
      <div
        key={`${pick.pickNo}-${pick.player.playerId}`}
        className="relative flex min-h-[420px] w-[620px] items-end rounded-2xl border border-white/10 bg-slate-900 px-10 pb-8 pt-6 shadow-2xl"
        style={{
          animation:
            "draftPickCardIn 500ms cubic-bezier(0.16, 1, 0.3, 1) forwards",
        }}
      >
        {image && (
          <img
            src={image}
            alt=""
            className="absolute bottom-0 left-1/2 z-0 object-contain object-bottom"
            style={{
              width: "auto",
              height: "auto",
              maxHeight: "calc(100% + 40px)",
              maxWidth: "calc(100% - 20px)",
              transform: "translateX(-50%)",
              animation:
                "draftDrafterIn 650ms cubic-bezier(0.16, 1, 0.3, 1) forwards",
            }}
          />
        )}

        <div className="pointer-events-none absolute inset-0 z-10 rounded-2xl bg-gradient-to-t from-slate-950 via-slate-950/55 to-transparent" />

        <div className="pointer-events-none absolute inset-0 z-10 rounded-2xl bg-gradient-to-b from-transparent via-transparent to-slate-950/20" />

        <div
          className="relative z-20 w-full text-center"
          style={{
            animation:
              "draftTextIn 450ms 150ms cubic-bezier(0.16, 1, 0.3, 1) both",
          }}
        >
          <div className="text-[11px] font-black uppercase tracking-[0.3em] text-white/50">
            Pick Is In
          </div>

          <div className="mt-2 text-[13px] font-bold uppercase tracking-[0.18em] text-white/60">
            {pick.username}
          </div>

          <div className="mt-1 text-4xl font-black tracking-tight text-white">
            {pick.player.name}
          </div>

          <div className="mt-2 flex items-center justify-center gap-2">
            <PositionBadge position={pick.player.position} />

            <span className="text-xs font-semibold text-white/60">
              {pick.player.nflTeam}
            </span>
          </div>

          <div className="mt-3 text-xs font-semibold text-white/40">
            {pick.teamName}
            {" • "}
            Pick {pick.pickNo}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes draftPickCardIn {
          0% {
            opacity: 0;
            transform: scale(0.9) translateY(20px);
          }

          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        @keyframes draftDrafterIn {
          0% {
            opacity: 0;
            transform: translateX(-50%) translateY(80px) scale(0.92);
          }

          100% {
            opacity: 1;
            transform: translateX(-50%) translateY(0) scale(1);
          }
        }

        @keyframes draftTextIn {
          0% {
            opacity: 0;
            transform: translateY(12px);
          }

          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
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

        setAnnouncementPick(pick);

        await sleep(PICK_ANNOUNCEMENT_DURATION);

        setAnnouncementPick(null);

        await sleep(BETWEEN_PICK_DELAY);

        setDisplayedCurrentTeam((currentTeam) => {
          return currentTeam;
        });
      }
    } finally {
      processingQueueRef.current = false;
    }
  }, []);

  const fetchDraft = useCallback(async () => {
    try {
      const response = await fetch(`/api/fantasy-draft?_=${Date.now()}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        return;
      }

      const nextData = (await response.json()) as DraftOverlayData;

      if (!initializedRef.current) {
        highestSeenPickRef.current = nextData.progress.completedPicks;

        initializedRef.current = true;

        setData(nextData);
        setDisplayedCurrentTeam(nextData.currentTeam);

        return;
      }

      setData(nextData);

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
       * Keep the displayed team synced with the API
       * whenever we're not currently showing a pick.
       */
      if (!processingQueueRef.current && !announcementPick) {
        setDisplayedCurrentTeam(nextData.currentTeam);
      }
    } catch (error) {
      console.error("Failed to fetch fantasy draft:", error);
    }
  }, [processQueue, announcementPick]);

  /*
   * Keep polling independent from announcement state.
   *
   * This prevents the polling timer from being destroyed
   * and recreated every time PICK IS IN appears/disappears.
   */
  const fetchDraftRef = useRef(fetchDraft);

  useEffect(() => {
    fetchDraftRef.current = fetchDraft;
  }, [fetchDraft]);

  useEffect(() => {
    fetchDraftRef.current();

    const interval = window.setInterval(() => {
      fetchDraftRef.current();
    }, POLL_INTERVAL);

    return () => window.clearInterval(interval);
  }, []);

  if (!data) {
    return null;
  }

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
