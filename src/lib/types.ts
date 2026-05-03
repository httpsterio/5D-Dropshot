export type ID = string;

export type ShotAttribution = 'winner' | 'error';

export interface ShotType {
  id: ID;
  label: string;
  attribution: ShotAttribution;
}

export interface Player {
  id: ID;
  name: string;
  createdAt: number;
  deletedAt: number | null;
  elo: number;
}

export type Slot = 'left' | 'right';

export interface Point {
  scorerSlot: Slot;
  shotTypeId: ID;
  timestamp: number;
}

export interface ActiveMatch {
  id: ID;
  startedAt: number;
  leftPlayerId: ID | null;
  rightPlayerId: ID | null;
  points: Point[];
  winPromptShown: boolean;
}

export interface FinishedMatch {
  id: ID;
  startedAt: number;
  endedAt: number;
  leftPlayerId: ID;
  rightPlayerId: ID;
  points: Point[];
  leftScore: number;
  rightScore: number;
  winnerId: ID | null;
  loserId: ID | null;
  isTie: boolean;
}

export interface MatchConfig {
  winThreshold: number;
  winByMargin: number;
  theme: string;
}

export interface AppData {
  schemaVersion: number;
  players: Player[];
  shotTypes: ShotType[];
  matches: FinishedMatch[];
  config: MatchConfig;
  activeMatch: ActiveMatch | null;
  historyVersion: number;
}

export interface ExportFile {
  app: 'dropshot';
  schemaVersion: number;
  exportedAt: number;
  data: Omit<AppData, 'activeMatch' | 'historyVersion'>;
}
