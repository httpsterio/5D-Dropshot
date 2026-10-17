import type { Slot } from './types';

/** Recognition + readback language. Change this one constant to use another locale. */
export const VOICE_LANG = 'en-US';

/* ------------------------------------------------------------------ */
/* Minimal Web Speech API types (SpeechRecognition is not in lib.dom). */
/* ------------------------------------------------------------------ */

export interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence: number;
}

export interface SpeechRecognitionResultLike {
  readonly length: number;
  readonly isFinal: boolean;
  [index: number]: SpeechRecognitionAlternativeLike;
}

export interface SpeechRecognitionResultListLike {
  readonly length: number;
  [index: number]: SpeechRecognitionResultLike;
}

export interface SpeechRecognitionEventLike {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultListLike;
}

export interface SpeechRecognitionErrorEventLike {
  readonly error: string;
}

export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
}

export interface SpeechRecognitionCtorLike {
  new (): SpeechRecognitionLike;
}

export function getSpeechRecognitionCtor(): SpeechRecognitionCtorLike | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtorLike;
    webkitSpeechRecognition?: SpeechRecognitionCtorLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function hasSpeechRecognition(): boolean {
  return getSpeechRecognitionCtor() !== null;
}

/* ------------------------------------------------------------------ */
/* Command parsing                                                     */
/* ------------------------------------------------------------------ */

export interface VoicePointCommand {
  kind: 'point';
  slot: Slot;
  shotTypeId: string;
  keyword: string;
  attribution: 'winner' | 'error';
}

export interface VoiceUndoCommand {
  kind: 'undo';
}

export type VoiceCommand = VoicePointCommand | VoiceUndoCommand;

/** Lowercase, strip punctuation, collapse whitespace. */
export function normalizeTranscript(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

const LEFT_WORDS = ['left'];
const RIGHT_WORDS = ['right'];
const LEFT_PHRASES = ['player one', 'player 1', 'player won'];
const RIGHT_PHRASES = ['player two', 'player 2', 'player to', 'player too'];

interface KeywordDef {
  variants: string[];
  shotTypeId: string;
  keyword: string;
  attribution: 'winner' | 'error';
}

/** Keyword -> default shot type ids from src/lib/defaults.ts. */
const KEYWORDS: KeywordDef[] = [
  { variants: ['smash'], shotTypeId: 'winner-smash', keyword: 'smash', attribution: 'winner' },
  { variants: ['drop'], shotTypeId: 'winner-drop', keyword: 'drop', attribution: 'winner' },
  { variants: ['kill'], shotTypeId: 'winner-net', keyword: 'kill', attribution: 'winner' },
  { variants: ['clear'], shotTypeId: 'winner-clear', keyword: 'clear', attribution: 'winner' },
  { variants: ['drive'], shotTypeId: 'winner-drive', keyword: 'drive', attribution: 'winner' },
  { variants: ['service'], shotTypeId: 'error-serve', keyword: 'service', attribution: 'error' },
  { variants: ['net'], shotTypeId: 'error-net', keyword: 'net', attribution: 'error' },
  { variants: ['out'], shotTypeId: 'error-out', keyword: 'out', attribution: 'error' },
  { variants: ['mishit', 'miss hit', 'mis hit'], shotTypeId: 'error-mishit', keyword: 'mishit', attribution: 'error' },
  { variants: ['error'], shotTypeId: 'error-other', keyword: 'error', attribution: 'error' }
];

function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev: number[] = [];
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    const curr: number[] = [i];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = curr;
  }
  return prev[n];
}

function nameTargets(name: string): string[] {
  const normalized = normalizeTranscript(name);
  if (!normalized) return [];
  const first = normalized.split(' ')[0];
  return first === normalized ? [normalized] : [normalized, first];
}

/** 0 = exact, 1 = loose (same first letter, edit distance <= 2), 2 = no match. */
function nameTier(spoken: string, targets: string[]): 0 | 1 | 2 {
  for (const target of targets) {
    if (spoken === target) return 0;
  }
  for (const target of targets) {
    if (spoken[0] === target[0] && editDistance(spoken, target) <= 2) return 1;
  }
  return 2;
}

/** Fixed slot words first, loose name matching last. */
function resolvePlayer(spokenWords: string[], leftName: string, rightName: string): Slot | null {
  const phrase = spokenWords.join(' ');
  // Fixed words first.
  if (spokenWords.some((w) => LEFT_WORDS.includes(w))) return 'left';
  if (spokenWords.some((w) => RIGHT_WORDS.includes(w))) return 'right';
  if (LEFT_PHRASES.includes(phrase)) return 'left';
  if (RIGHT_PHRASES.includes(phrase)) return 'right';

  // Names last.
  const candidates = [...new Set([phrase, ...spokenWords])].filter(Boolean);
  const leftTargets = nameTargets(leftName);
  const rightTargets = nameTargets(rightName);
  let leftTier: 0 | 1 | 2 = 2;
  let rightTier: 0 | 1 | 2 = 2;
  for (const candidate of candidates) {
    const lt = nameTier(candidate, leftTargets);
    if (lt < leftTier) leftTier = lt;
    const rt = nameTier(candidate, rightTargets);
    if (rt < rightTier) rightTier = rt;
  }
  if (leftTier === 2 && rightTier === 2) return null;
  const best = Math.min(leftTier, rightTier);
  const winners: Slot[] = [];
  if (leftTier === best) winners.push('left');
  if (rightTier === best) winners.push('right');
  return winners.length === 1 ? winners[0] : null;
}

function findKeyword(tokens: string[]): { index: number; def: KeywordDef } | null {
  for (let i = 0; i < tokens.length; i++) {
    for (const def of KEYWORDS) {
      for (const variant of def.variants) {
        const parts = variant.split(' ');
        if (parts.length === 1) {
          if (tokens[i] === variant) return { index: i, def };
        } else if (tokens.slice(i, i + parts.length).join(' ') === variant) {
          return { index: i, def };
        }
      }
    }
  }
  return null;
}

export function parseVoiceCommand(
  transcript: string,
  leftName: string,
  rightName: string
): VoiceCommand | null {
  const tokens = normalizeTranscript(transcript).split(' ').filter(Boolean);

  if (tokens.length >= 2 && tokens[0] === 'undo' && tokens[1] === 'undo') {
    return { kind: 'undo' };
  }

  if (tokens.length < 3 || tokens[0] !== 'point') return null;
  const rest = tokens.slice(1);
  const found = findKeyword(rest);
  if (!found || found.index === 0) return null;
  const slot = resolvePlayer(rest.slice(0, found.index), leftName, rightName);
  if (!slot) return null;
  return {
    kind: 'point',
    slot,
    shotTypeId: found.def.shotTypeId,
    keyword: found.def.keyword,
    attribution: found.def.attribution
  };
}

/* ------------------------------------------------------------------ */
/* Readback mute guard: ignore recognition while/after speech plays.   */
/* ------------------------------------------------------------------ */

let speechMuted = false;
let unmuteTimer: number | undefined;
let currentUtterance: SpeechSynthesisUtterance | null = null;

export function isSpeechMuted(): boolean {
  return speechMuted;
}

function scheduleUnmute(): void {
  window.clearTimeout(unmuteTimer);
  unmuteTimer = window.setTimeout(() => {
    speechMuted = false;
  }, 1000);
}

export function speak(text: string): void {
  speechMuted = true;
  window.clearTimeout(unmuteTimer);
  const synth = window.speechSynthesis;
  if (!synth || typeof SpeechSynthesisUtterance === 'undefined') {
    scheduleUnmute();
    return;
  }
  try {
    synth.cancel();
  } catch {
    /* ignore */
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = VOICE_LANG;
  let safetyTimer: number | undefined;
  const finish = () => {
    if (currentUtterance !== utterance) return;
    currentUtterance = null;
    window.clearTimeout(safetyTimer);
    scheduleUnmute();
  };
  utterance.onend = finish;
  utterance.onerror = finish;
  currentUtterance = utterance;
  // Fallback in case onend never fires (keeps the mute guard from sticking).
  safetyTimer = window.setTimeout(() => {
    if (currentUtterance === utterance) {
      currentUtterance = null;
      scheduleUnmute();
    }
  }, 8000);
  try {
    synth.speak(utterance);
  } catch {
    finish();
  }
}

export function cancelSpeech(): void {
  window.clearTimeout(unmuteTimer);
  currentUtterance = null;
  speechMuted = false;
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* ignore */
  }
}
