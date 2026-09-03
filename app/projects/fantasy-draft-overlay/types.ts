export type DraftPlayer = {
  playerId: string;
  name: string;
  position: string;
  nflTeam: string;
  round: number;
  pickNo: number;
};

export type LastPick = {
  teamName: string;
  username: string;
  player: DraftPlayer;
};

export type DraftPick = {
  pickNo: number;
  round: number;
  draftSlot: number;
  rosterId: number;
  teamName: string;
  username: string;
  player: DraftPlayer;
};

export type DraftTeam = {
  rosterId: number;
  ownerId: string;
  username: string;
  teamName: string;
  draftSlot: number | null;
  players: DraftPlayer[];
};

export type DraftOverlayData = {
  league: {
    id: string;
    name: string;
    status: string;
  };

  draft: {
    id: string;
    type: string;
    status: string;
    teams: number;
    rounds: number;
    totalPicks: number;
  };

  progress: {
    completedPicks: number;
    nextPickNumber: number | null;
    currentRound: number | null;
    currentDraftSlot: number | null;
  };

  currentTeam: {
    rosterId: number;
    username: string;
    name: string | null;
    players: DraftPlayer[];
  } | null;

  lastPick: {
    teamName: string | null;
    username: string | null;
    player: DraftPlayer | null;
  } | null;

  lastFourPicks: LastPick[];

  teams: DraftTeam[];

  picks: DraftPick[];
};
