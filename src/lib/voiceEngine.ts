import {
  VOICE_LANG,
  getSpeechRecognitionCtor,
  isSpeechMuted,
  type SpeechRecognitionEventLike,
  type SpeechRecognitionLike
} from './voice';

/** Audio-to-text engines for voice scoring. */
export type VoiceEngineState = 'loading' | 'listening' | 'error';

/** Live snapshot an engine can report for on-screen troubleshooting. */
export interface EngineDiagnostics {
  state: 'idle' | VoiceEngineState;
  lastError: string;
  getUserMedia: string;
  audioContextState: string;
  audioContextSampleRate: number;
  inputLevel: number;
  chunksFed: number;
  partialText: string;
}

export interface VoiceEngineHandlers {
  /** Live partial text while the user speaks (may never fire for some engines). */
  onPartial(text: string): void;
  /** Final text of one utterance. */
  onFinal(text: string): void;
  /** Engine state; detail carries a progress label or an error message. */
  onState(state: VoiceEngineState, detail?: string): void;
  /** Optional live diagnostics for the match screen. */
  onDiagnostics?(diagnostics: EngineDiagnostics): void;
}

export interface VoiceEngine {
  start(handlers: VoiceEngineHandlers): void;
  stop(): void;
}

/** True when the browser offers SpeechRecognition. */
export function hasChromeEngine(): boolean {
  return getSpeechRecognitionCtor() !== null;
}

export function createChromeEngine(): VoiceEngine {
  return new ChromeEngine();
}

/**
 * Chrome's SpeechRecognition behind the VoiceEngine interface.
 * Same behavior as before: continuous mode, restart on end, fatal
 * permission errors reported through onState, results muted while
 * speech or a tone plays.
 */
class ChromeEngine implements VoiceEngine {
  private handlers: VoiceEngineHandlers | null = null;
  private recognition: SpeechRecognitionLike | null = null;
  private running = false;
  private recognitionRunning = false;
  private restartTimer: number | undefined;

  start(handlers: VoiceEngineHandlers): void {
    this.handlers = handlers;
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      handlers.onState('error', 'Speech recognition unavailable');
      return;
    }
    this.running = true;
    if (!this.recognition) {
      const rec = new Ctor();
      rec.lang = VOICE_LANG;
      rec.continuous = true;
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.onstart = () => {
        this.recognitionRunning = true;
      };
      rec.onend = () => {
        this.recognitionRunning = false;
        if (!this.running) return;
        // Chrome on Android ends the session after silence; restart it.
        window.clearTimeout(this.restartTimer);
        this.restartTimer = window.setTimeout(() => {
          if (this.running) this.startRecognition();
        }, 250);
      };
      rec.onresult = (event) => {
        this.onResult(event);
      };
      rec.onerror = (event) => {
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          this.running = false;
          window.clearTimeout(this.restartTimer);
          try {
            this.recognition?.abort();
          } catch {
            /* ignore */
          }
          this.handlers?.onState('error', `Voice error: ${event.error}`);
        }
      };
      this.recognition = rec;
    }
    handlers.onState('listening');
    this.startRecognition();
  }

  stop(): void {
    this.running = false;
    window.clearTimeout(this.restartTimer);
    this.recognitionRunning = false;
    try {
      this.recognition?.abort();
    } catch {
      /* ignore */
    }
  }

  private startRecognition(): void {
    if (!this.running || !this.recognition || this.recognitionRunning) return;
    try {
      this.recognition.start();
    } catch {
      /* already started or not available */
    }
  }

  private onResult(event: SpeechRecognitionEventLike): void {
    if (!this.running || isSpeechMuted()) return;
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (!result.isFinal) continue;
      this.handlers?.onFinal(result[0]?.transcript ?? '');
    }
  }
}
