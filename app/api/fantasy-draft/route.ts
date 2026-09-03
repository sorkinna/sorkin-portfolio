import { NextResponse } from "next/server";

import type {
  DraftPlayer,
  DraftPick,
  DraftTeam,
  DraftOverlayData,
} from "../../projects/fantasy-draft-overlay/types";

const LEAGUE_ID = "1365310592465780736";

// Keep this populated while testing mock drafts.
// Set to "" before the real draft.
const MOCK_DRAFT_ID = "1401052530070261760";

const REAL_DRAFT_ID = "1365310592478371840";

const SLEEPER_API = "https://api.sleeper.app/v1";

/*
 * League/users/rosters don't change during the draft,
 * so keep them cached in the server process.
 */
const STATIC_CACHE_DURATION = 5 * 60_000;

type SleeperDraft = {
  draft_id: string;
  league_id: string;
  type: string;
  status: string;
  season: string;
  season_type: string;
  start_time: number | null;
  last_picked: number | null;
  last_picked_at: number | null;
  pick_timer: number | null;
  slot_to_roster_id?: Record<string, number>;
  teams?: number;
  rounds?: number;
};

type SleeperLeague = {
  league_id: string;
  name: string;
  status: string;
  total_rosters: number;
};

type SleeperUser = {
  user_id: string;
  username?: string;
  display_name?: string;
  metadata?: {
    team_name?: string;
  };
  settings?: {
    team_name?: string;
  };
};

type SleeperRoster = {
  roster_id: number;
  owner_id: string;
  players?: string[];
  metadata?: {
    team_name?: string;
  };
};

type SleeperPickMetadata = {
  first_name?: string;
  last_name?: string;
  player_id?: string;
  position?: string;
  team?: string;
};

type SleeperPick = {
  draft_id: string;
  draft_slot: number;
  is_keeper: boolean | null;
  metadata?: SleeperPickMetadata;
  pick_no: number;
  picked_by: string | null;
  player_id: string;
  reactions?: unknown;
  roster_id: number | null;
  round: number;
};

type StaticDraftData = {
  league: SleeperLeague;
  users: SleeperUser[];
  rosters: SleeperRoster[];
  realDraft: SleeperDraft;
};

let staticCache: {
  data: StaticDraftData;
  expiresAt: number;
} | null = null;

async function sleeperFetch<T>(path: string): Promise<T> {
  const response = await fetch(`${SLEEPER_API}${path}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `Sleeper API request failed: ${response.status} ${response.statusText}`,
    );
  }

  return response.json() as Promise<T>;
}

/*
 * Use the mock draft while testing.
 *
 * Before the real draft, change MOCK_DRAFT_ID to "".
 */
async function getActiveDraft(): Promise<SleeperDraft> {
  const draftId = MOCK_DRAFT_ID.trim() !== "" ? MOCK_DRAFT_ID : REAL_DRAFT_ID;

  return sleeperFetch<SleeperDraft>(`/draft/${draftId}`);
}

/*
 * League information is static during the draft.
 *
 * This is deliberately kept separate from the live
 * draft data so we don't repeatedly request users,
 * rosters, and the real draft on every poll.
 */
async function getStaticData(): Promise<StaticDraftData> {
  const now = Date.now();

  if (staticCache && staticCache.expiresAt > now) {
    return staticCache.data;
  }

  const [league, users, rosters, realDraft] = await Promise.all([
    sleeperFetch<SleeperLeague>(`/league/${LEAGUE_ID}`),
    sleeperFetch<SleeperUser[]>(`/league/${LEAGUE_ID}/users`),
    sleeperFetch<SleeperRoster[]>(`/league/${LEAGUE_ID}/rosters`),
    sleeperFetch<SleeperDraft>(`/draft/${REAL_DRAFT_ID}`),
  ]);

  const data: StaticDraftData = {
    league,
    users,
    rosters,
    realDraft,
  };

  staticCache = {
    data,
    expiresAt: now + STATIC_CACHE_DURATION,
  };

  return data;
}

function getTeamName(
  user: SleeperUser | undefined,
  roster: SleeperRoster,
  rosterId: number,
): string {
  return (
    roster.metadata?.team_name ??
    user?.metadata?.team_name ??
    user?.settings?.team_name ??
    user?.display_name ??
    user?.username ??
    `Team ${rosterId}`
  );
}

function getUsername(
  user: SleeperUser | undefined,
  roster: SleeperRoster,
): string {
  return user?.username ?? user?.display_name ?? roster.owner_id;
}

/*
 * Player information now comes directly from the
 * draft pick's metadata.
 *
 * This completely eliminates the expensive
 * /players/nfl request.
 */
function normalizePlayer(pick: SleeperPick): DraftPlayer {
  const firstName = pick.metadata?.first_name ?? "";

  const lastName = pick.metadata?.last_name ?? "";

  const name = `${firstName} ${lastName}`.trim() || pick.player_id;

  return {
    playerId: pick.metadata?.player_id ?? pick.player_id,

    name,

    position: pick.metadata?.position ?? "—",

    nflTeam: pick.metadata?.team ?? "FA",

    round: pick.round,

    pickNo: pick.pick_no,
  };
}

function getDraftSlot(
  slotToRosterId: Record<string, number>,
  rosterId: number,
): number | null {
  const entry = Object.entries(slotToRosterId).find(
    ([, mappedRosterId]) => mappedRosterId === rosterId,
  );

  return entry ? Number(entry[0]) : null;
}

/*
 * Fallback for drafts that don't provide draft_slot
 * or roster_id.
 *
 * The league uses a standard snake draft.
 */
function getSnakeDraftSlot(pickNo: number, teamCount: number): number {
  const round = Math.floor((pickNo - 1) / teamCount) + 1;

  const pickWithinRound = ((pickNo - 1) % teamCount) + 1;

  return round % 2 === 1 ? pickWithinRound : teamCount - pickWithinRound + 1;
}

function getTotalPicks(
  draft: SleeperDraft,
  teamCount: number,
  rounds: number,
): number {
  if (typeof draft.teams === "number" && typeof draft.rounds === "number") {
    return draft.teams * draft.rounds;
  }

  return teamCount * rounds;
}

export async function GET() {
  try {
    /*
     * IMPORTANT:
     *
     * These are the only live requests we need on
     * each polling cycle:
     *
     * 1. Current draft state
     * 2. Current draft picks
     *
     * The league/users/rosters data comes from cache.
     */
    const activeDraft = await getActiveDraft();

    const activeDraftId =
      MOCK_DRAFT_ID.trim() !== "" ? MOCK_DRAFT_ID : REAL_DRAFT_ID;

    const [picks, staticData] = await Promise.all([
      sleeperFetch<SleeperPick[]>(`/draft/${activeDraftId}/picks`),
      getStaticData(),
    ]);

    const { league, users, rosters } = staticData;

    /*
     * Build lookup maps once per request.
     */
    const userById = new Map<string, SleeperUser>();

    for (const user of users) {
      userById.set(user.user_id, user);
    }

    const rosterById = new Map<number, SleeperRoster>();

    for (const roster of rosters) {
      rosterById.set(roster.roster_id, roster);
    }

    const teamCount = league.total_rosters || 12;

    const rounds =
      typeof activeDraft.rounds === "number" ? activeDraft.rounds : 16;

    const totalPicks = getTotalPicks(activeDraft, teamCount, rounds);

    /*
     * This mapping belongs to the real league and
     * tells us which roster owns each draft slot.
     *
     * We use it for mock drafts too because the mock
     * draft is using the same league's 12 drafters.
     */
    const realSlotToRosterId = staticData.realDraft.slot_to_roster_id ?? {};

    const rosterByDraftSlot = new Map<number, SleeperRoster>();

    for (const [slot, rosterId] of Object.entries(realSlotToRosterId)) {
      const roster = rosterById.get(rosterId);

      if (roster) {
        rosterByDraftSlot.set(Number(slot), roster);
      }
    }

    /*
     * Normalize Sleeper picks into the data structure
     * used by the overlay.
     */
    const normalizedPicks: DraftPick[] = [...picks]
      .sort((a, b) => a.pick_no - b.pick_no)
      .map((pick) => {
        /*
         * Sleeper mock drafts provide draft_slot
         * directly, so prefer that.
         */
        let draftSlot =
          typeof pick.draft_slot === "number" && pick.draft_slot > 0
            ? pick.draft_slot
            : null;

        let roster: SleeperRoster | undefined;

        /*
         * Real draft:
         * roster_id should identify the roster.
         */
        if (pick.roster_id !== null) {
          roster = rosterById.get(pick.roster_id);

          if (roster && draftSlot === null) {
            draftSlot = getDraftSlot(realSlotToRosterId, pick.roster_id);
          }
        }

        /*
         * Mock draft:
         * use draft_slot to find the real
         * league roster.
         */
        if (!roster && draftSlot !== null) {
          roster = rosterByDraftSlot.get(draftSlot);
        }

        /*
         * Final fallback if Sleeper ever omits
         * draft_slot.
         */
        if (draftSlot === null) {
          draftSlot = getSnakeDraftSlot(pick.pick_no, teamCount);

          roster = roster ?? rosterByDraftSlot.get(draftSlot);
        }

        const user = roster ? userById.get(roster.owner_id) : undefined;

        const rosterId = roster?.roster_id ?? 0;

        const teamName = roster
          ? getTeamName(user, roster, roster.roster_id)
          : `Team ${draftSlot}`;

        const username = roster ? getUsername(user, roster) : "";

        return {
          pickNo: pick.pick_no,

          round: pick.round,

          draftSlot,

          rosterId,

          teamName,

          username,

          player: normalizePlayer(pick),
        };
      });

    const completedPicks = normalizedPicks.length;

    const draftComplete =
      activeDraft.status === "complete" || completedPicks >= totalPicks;

    const nextPickNumber = !draftComplete ? completedPicks + 1 : null;

    const currentRound =
      nextPickNumber !== null
        ? Math.floor((nextPickNumber - 1) / teamCount) + 1
        : null;

    /*
     * Determine who is on the clock.
     */
    const currentDraftSlot =
      nextPickNumber !== null
        ? getSnakeDraftSlot(nextPickNumber, teamCount)
        : null;

    const currentRoster =
      currentDraftSlot !== null
        ? rosterByDraftSlot.get(currentDraftSlot)
        : undefined;

    const currentUser = currentRoster
      ? userById.get(currentRoster.owner_id)
      : undefined;

    /*
     * Build each team's roster from the picks.
     */
    const draftTeams: DraftTeam[] = rosters.map((roster) => {
      const user = userById.get(roster.owner_id);

      const teamPicks = normalizedPicks
        .filter((pick) => pick.rosterId === roster.roster_id)
        .sort((a, b) => a.pickNo - b.pickNo);

      return {
        rosterId: roster.roster_id,

        ownerId: roster.owner_id,

        username: getUsername(user, roster),

        teamName: getTeamName(user, roster, roster.roster_id),

        draftSlot: getDraftSlot(realSlotToRosterId, roster.roster_id),

        players: teamPicks.map((pick) => pick.player),
      };
    });

    /*
     * Current team information.
     */
    const currentTeam =
      currentRoster && currentDraftSlot !== null
        ? {
            rosterId: currentRoster.roster_id,

            username: getUsername(currentUser, currentRoster),

            name: getTeamName(
              currentUser,
              currentRoster,
              currentRoster.roster_id,
            ),

            players:
              draftTeams.find(
                (team) => team.rosterId === currentRoster!.roster_id,
              )?.players ?? [],
          }
        : null;

    /*
     * Most recent pick.
     */
    const lastPick =
      normalizedPicks.length > 0
        ? normalizedPicks[normalizedPicks.length - 1]
        : null;

    /*
     * Last four picks, newest first.
     */
    const lastFourPicks = normalizedPicks
      .slice(-4)
      .reverse()
      .map((pick) => ({
        teamName: pick.teamName,

        username: pick.username,

        player: pick.player,
      }));

    const responseData: DraftOverlayData = {
      league: {
        id: league.league_id,

        name: league.name,

        status: league.status,
      },

      draft: {
        id: activeDraft.draft_id,

        type: activeDraft.type,

        status: activeDraft.status,

        teams: teamCount,

        rounds,

        totalPicks,
      },

      progress: {
        completedPicks,

        nextPickNumber,

        currentRound,

        currentDraftSlot,
      },

      currentTeam,

      lastPick: lastPick
        ? {
            teamName: lastPick.teamName,

            username: lastPick.username,

            player: lastPick.player,
          }
        : {
            teamName: null,

            username: null,

            player: null,
          },

      lastFourPicks,

      teams: draftTeams,

      picks: normalizedPicks,
    };

    return NextResponse.json(responseData, {
      headers: {
        /*
         * Never let the browser/CDN serve an
         * old draft state.
         */
        "Cache-Control":
          "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error) {
    console.error("Fantasy draft API error:", error);

    return NextResponse.json(
      {
        error: "Failed to load fantasy draft data.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
          Pragma: "no-cache",
        },
      },
    );
  }
}
