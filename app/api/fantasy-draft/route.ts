import { NextResponse } from "next/server";
import type {
  DraftPlayer,
  DraftPick,
  DraftTeam,
  DraftOverlayData,
} from "../../projects/fantasy-draft-overlay/types";

const LEAGUE_ID = "1365310592465780736";

/*
 * TESTING:
 *
 * Put your Sleeper mock draft ID here while testing.
 *
 * When you are ready for the real draft, change this to:
 *
 * const MOCK_DRAFT_ID = "";
 *
 * The overlay will then automatically use the real league draft.
 */
const MOCK_DRAFT_ID = "";

const REAL_DRAFT_ID = "1365310592478371840";

const SLEEPER_API = "https://api.sleeper.app/v1";

type SleeperDraft = {
  draft_id: string;
  league_id: string | null;
  status: string;
  type: string;

  settings?: {
    teams?: number;
    rounds?: number;
    pick_timer?: number;
  };

  teams?: number;
  rounds?: number;

  slot_to_roster_id?: Record<string, number>;

  draft_order?: Record<string, number>;

  metadata?: {
    league_id?: string;
  };
};

type SleeperLeague = {
  league_id: string;
  name: string;
  status: string;
  draft_id?: string;
};

type SleeperUser = {
  user_id: string;

  display_name?: string;
  username?: string;

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

  metadata?: {
    team_name?: string;
  };
};

type SleeperPick = {
  pick_no: number;
  round: number;
  draft_slot: number;
  roster_id: number | string;
  player_id: string;

  metadata?: {
    first_name?: string;
    last_name?: string;
    position?: string;
    team?: string;
  };
};

type StaticDraftData = {
  league: SleeperLeague;
  users: SleeperUser[];
  rosters: SleeperRoster[];

  /*
   * Permanent league draft mapping.
   *
   * This translates a Sleeper draft slot into the
   * actual fantasy football roster.
   */
  realDraft: SleeperDraft | null;

  slotToRosterId: Record<string, number>;

  expiresAt: number;
};

let staticCache: StaticDraftData | null = null;

async function sleeperFetch<T>(path: string): Promise<T> {
  const response = await fetch(`${SLEEPER_API}${path}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `Sleeper API request failed: ${response.status} ${response.statusText}`,
    );
  }

  return response.json();
}

function getDraftTeams(draft: SleeperDraft): number {
  return draft.settings?.teams ?? draft.teams ?? 12;
}

function getDraftRounds(draft: SleeperDraft): number {
  return draft.settings?.rounds ?? draft.rounds ?? 16;
}

/**
 * Sleeper can expose the fantasy team name in several
 * different locations depending on the league/draft.
 *
 * Prefer the actual fantasy team name rather than the
 * owner's display name or username.
 */
function getTeamName(
  user: SleeperUser | undefined,
  roster: SleeperRoster | undefined,
  rosterId: number,
): string {
  return (
    roster?.metadata?.team_name ??
    user?.metadata?.team_name ??
    user?.settings?.team_name ??
    user?.display_name ??
    user?.username ??
    `Team ${rosterId}`
  );
}

/**
 * Get the draft that should currently power the overlay.
 *
 * TESTING:
 *   If MOCK_DRAFT_ID is populated, use that draft.
 *
 * REAL DRAFT:
 *   If MOCK_DRAFT_ID is empty, use the real league draft.
 *
 * This means Friday requires only one change:
 *
 *   const MOCK_DRAFT_ID = "";
 */
async function getActiveDraft(): Promise<SleeperDraft> {
  if (MOCK_DRAFT_ID.trim() !== "") {
    return sleeperFetch<SleeperDraft>(`/draft/${MOCK_DRAFT_ID}`);
  }

  return sleeperFetch<SleeperDraft>(`/draft/${REAL_DRAFT_ID}`);
}

/**
 * Static league information changes very rarely.
 *
 * Cache it for 60 seconds so we aren't hammering
 * the Sleeper API with the same information every poll.
 */
async function getStaticData(draft: SleeperDraft): Promise<StaticDraftData> {
  const now = Date.now();

  if (staticCache && staticCache.expiresAt > now) {
    return staticCache;
  }

  const [league, users, rosters] = await Promise.all([
    sleeperFetch<SleeperLeague>(`/league/${LEAGUE_ID}`),

    sleeperFetch<SleeperUser[]>(`/league/${LEAGUE_ID}/users`),

    sleeperFetch<SleeperRoster[]>(`/league/${LEAGUE_ID}/rosters`),
  ]);

  /*
   * The real league draft contains the permanent
   * draft-slot -> roster mapping.
   */
  let realDraft: SleeperDraft | null = null;

  if (league.draft_id) {
    try {
      realDraft = await sleeperFetch<SleeperDraft>(`/draft/${league.draft_id}`);
    } catch {
      realDraft = null;
    }
  }

  /*
   * Prefer the real league mapping.
   *
   * If it isn't available for some reason, fall back
   * to the currently selected draft's mapping.
   */
  const slotToRosterId =
    realDraft?.slot_to_roster_id ?? draft.slot_to_roster_id ?? {};

  staticCache = {
    league,
    users,
    rosters,
    realDraft,
    slotToRosterId,
    expiresAt: now + 60_000,
  };

  return staticCache;
}

function normalizePlayer(pick: SleeperPick): DraftPlayer {
  const firstName = pick.metadata?.first_name ?? "";

  const lastName = pick.metadata?.last_name ?? "";

  return {
    playerId: pick.player_id,

    name: `${firstName} ${lastName}`.trim() || "Unknown Player",

    position: pick.metadata?.position ?? "—",

    nflTeam: pick.metadata?.team ?? "—",

    round: pick.round,

    pickNo: pick.pick_no,
  };
}

export async function GET() {
  try {
    /*
     * Determine whether we're using the mock or
     * real draft.
     */
    let draft = await getActiveDraft();

    /*
     * Fetch the latest draft state and picks.
     *
     * These are the dynamic pieces of information
     * that change throughout the draft.
     */
    const [latestDraft, picks] = await Promise.all([
      sleeperFetch<SleeperDraft>(`/draft/${draft.draft_id}`),

      sleeperFetch<SleeperPick[]>(`/draft/${draft.draft_id}/picks`),
    ]);

    draft = latestDraft;

    const staticData = await getStaticData(draft);

    const { league, users, rosters, slotToRosterId } = staticData;

    const usersById = new Map(users.map((user) => [user.user_id, user]));

    const rostersById = new Map(
      rosters.map((roster) => [roster.roster_id, roster]),
    );

    const teams = getDraftTeams(draft);

    const rounds = getDraftRounds(draft);

    const totalPicks = teams * rounds;

    /*
     * Normalize all picks into the real league roster IDs.
     *
     * This is important because mock drafts can use
     * different roster IDs internally.
     */
    const normalizedPicks: DraftPick[] = picks
      .sort((a, b) => a.pick_no - b.pick_no)
      .map((pick) => {
        const realRosterId =
          slotToRosterId[String(pick.draft_slot)] ?? Number(pick.roster_id);

        const roster = rostersById.get(realRosterId);

        const user = roster ? usersById.get(roster.owner_id) : undefined;

        const teamName = getTeamName(user, roster, realRosterId);

        return {
          pickNo: pick.pick_no,

          round: pick.round,

          draftSlot: pick.draft_slot,

          rosterId: realRosterId,

          teamName,

          player: normalizePlayer(pick),
        };
      });

    const completedPicks = normalizedPicks.length;

    const nextPickNumber =
      completedPicks < totalPicks ? completedPicks + 1 : null;

    /*
     * Calculate the current round and draft slot
     * using snake-draft rules.
     */
    let currentRound: number | null = null;

    let currentDraftSlot: number | null = null;

    if (nextPickNumber !== null) {
      currentRound = Math.floor((nextPickNumber - 1) / teams) + 1;

      const pickWithinRound = ((nextPickNumber - 1) % teams) + 1;

      currentDraftSlot =
        currentRound % 2 === 1 ? pickWithinRound : teams - pickWithinRound + 1;
    }

    /*
     * Determine the current fantasy team.
     */
    let currentTeam: DraftOverlayData["currentTeam"] = null;

    if (currentDraftSlot !== null) {
      const currentRosterId = slotToRosterId[String(currentDraftSlot)];

      if (currentRosterId !== undefined) {
        const roster = rostersById.get(currentRosterId);

        const user = roster ? usersById.get(roster.owner_id) : undefined;

        const teamPlayers = normalizedPicks
          .filter((pick) => pick.rosterId === currentRosterId)
          .map((pick) => pick.player);

        currentTeam = {
          rosterId: currentRosterId,

          name: getTeamName(user, roster, currentRosterId),

          players: teamPlayers,
        };
      }
    }

    /*
     * Build all fantasy teams.
     *
     * draftSlot is included so the frontend can
     * determine the next team after a pick without
     * having to make another API request.
     */
    const draftTeams: DraftTeam[] = Array.from(rostersById.values()).map(
      (roster) => {
        const user = usersById.get(roster.owner_id);

        const players = normalizedPicks
          .filter((pick) => pick.rosterId === roster.roster_id)
          .map((pick) => pick.player);

        const draftSlotEntry = Object.entries(slotToRosterId).find(
          ([, rosterId]) => rosterId === roster.roster_id,
        );

        return {
          rosterId: roster.roster_id,

          ownerId: roster.owner_id,

          teamName: getTeamName(user, roster, roster.roster_id),

          players,

          draftSlot: draftSlotEntry ? Number(draftSlotEntry[0]) : null,
        } as DraftTeam;
      },
    );

    /*
     * Last four overall picks.
     *
     * Newest pick appears first.
     */
    const lastFourPicks = normalizedPicks
      .slice(-4)
      .reverse()
      .map((pick) => ({
        teamName: pick.teamName,

        player: pick.player,
      }));

    const lastPick =
      normalizedPicks.length > 0
        ? normalizedPicks[normalizedPicks.length - 1]
        : null;

    const response: DraftOverlayData = {
      league: {
        id: league.league_id,

        name: league.name,

        status: league.status,
      },

      draft: {
        id: draft.draft_id,

        type: draft.type,

        status: draft.status,

        teams,

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

            player: lastPick.player,
          }
        : {
            teamName: null,

            player: null,
          },

      lastFourPicks,

      teams: draftTeams,

      picks: normalizedPicks,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Fantasy draft API error:", error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      {
        status: 500,
      },
    );
  }
}
