import type { ExportFile, FinishedMatch, Player, ShotType, MatchConfig, Point } from './types';

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isString(v: unknown): v is string {
  return typeof v === 'string';
}

function isNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function isBoolean(v: unknown): v is boolean {
  return typeof v === 'boolean';
}

function isShotType(v: unknown): v is ShotType {
  return isObject(v)
    && isString(v.id)
    && isString(v.label)
    && (v.attribution === 'winner' || v.attribution === 'error');
}

function isPlayer(v: unknown): v is Player {
  return isObject(v)
    && isString(v.id)
    && isString(v.name)
    && isNumber(v.createdAt)
    && (v.deletedAt === null || isNumber(v.deletedAt));
}

function isPoint(v: unknown): v is Point {
  return isObject(v)
    && (v.scorerSlot === 'left' || v.scorerSlot === 'right')
    && isString(v.shotTypeId)
    && isNumber(v.timestamp);
}

function isMatch(v: unknown): v is FinishedMatch {
  return isObject(v)
    && isString(v.id)
    && isNumber(v.startedAt)
    && isNumber(v.endedAt)
    && isString(v.leftPlayerId)
    && isString(v.rightPlayerId)
    && Array.isArray(v.points) && v.points.every(isPoint)
    && isNumber(v.leftScore)
    && isNumber(v.rightScore)
    && (v.winnerId === null || isString(v.winnerId))
    && (v.loserId === null || isString(v.loserId))
    && isBoolean(v.isTie);
}

function isConfig(v: unknown): v is MatchConfig {
  return isObject(v) 
    && isNumber(v.winThreshold) 
    && isNumber(v.winByMargin)
    && (v.theme === undefined || isString(v.theme)); // Optional for backward compatibility on import
}

export function validateExportFile(raw: unknown): Result<ExportFile> {
  if (!isObject(raw)) return { ok: false, error: 'Not an object' };
  if (raw.app !== 'dropshot') return { ok: false, error: 'Not a DropShot export' };
  if (!isNumber(raw.schemaVersion)) return { ok: false, error: 'Missing schemaVersion' };
  if (!isNumber(raw.exportedAt)) return { ok: false, error: 'Missing exportedAt' };
  if (!isObject(raw.data)) return { ok: false, error: 'Missing data' };

  const data = raw.data;
  if (!Array.isArray(data.players) || !data.players.every(isPlayer))
    return { ok: false, error: 'Invalid players list' };
  if (!Array.isArray(data.shotTypes) || !data.shotTypes.every(isShotType))
    return { ok: false, error: 'Invalid shot types list' };
  if (!Array.isArray(data.matches) || !data.matches.every(isMatch))
    return { ok: false, error: 'Invalid matches list' };
  if (!isConfig(data.config)) return { ok: false, error: 'Invalid config' };

  return { ok: true, value: raw as unknown as ExportFile };
}
