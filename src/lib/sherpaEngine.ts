import { isSpeechMuted } from './voice';
import type { EngineDiagnostics, VoiceEngine, VoiceEngineHandlers, VoiceEngineState } from './voiceEngine';

/* ------------------------------------------------------------------ */
/* sherpa-onnx WebAssembly (streaming zipformer, English, int8)        */
/* Files served from /voice/, see public/voice/.                       */
/* ------------------------------------------------------------------ */

const SAMPLE_RATE = 16000;
/** A complete command in a partial result is finalized after this silence. */
const PARTIAL_FINAL_MS = 500;

const MODEL_FILES = [
  { name: 'encoder.int8.onnx', bytes: 42_845_182 },
  { name: 'decoder.int8.onnx', bytes: 539_499 },
  { name: 'joiner.int8.onnx', bytes: 259_572 },
  { name: 'tokens.txt', bytes: 5_048 }
];

const RUNTIME_FILES = [
  { name: 'sherpa-onnx-asr.js', bytes: 53_867 },
  { name: 'sherpa-onnx-wasm-main-asr.js', bytes: 82_688 },
  { name: 'sherpa-onnx-wasm-main-asr.wasm', bytes: 13_150_239 }
];
// Bump this when replacing the bundled model or runtime files.
export const SHERPA_CACHE_NAME = 'dropshot-sherpa-v1';
const ASSETS = [
  ...RUNTIME_FILES.map((file) => ({ ...file, url: `/voice/${file.name}` })),
  ...MODEL_FILES.map((file) => ({ ...file, url: `/voice/model/${file.name}` }))
];
const RUNTIME_BYTES = RUNTIME_FILES.reduce((sum, file) => sum + file.bytes, 0);

/** Total download for the offline engine, in whole decimal megabytes. */
export const SHERPA_DOWNLOAD_MB = Math.round(
  (RUNTIME_BYTES + MODEL_FILES.reduce((sum, file) => sum + file.bytes, 0)) / 1_000_000
);

interface SherpaStream {
  acceptWaveform(sampleRate: number, samples: Float32Array): void;
  free(): void;
}

interface SherpaRecognizer {
  handle?: unknown;
  createStream(): SherpaStream;
  isReady(stream: SherpaStream): boolean;
  decode(stream: SherpaStream): void;
  isEndpoint(stream: SherpaStream): boolean;
  reset(stream: SherpaStream): void;
  getResult(stream: SherpaStream): { text: string };
}

interface SherpaModuleInit {
  onRuntimeInitialized?: () => void;
  onAbort?: (what: unknown) => void;
  getPreloadedPackage?: (name: string, size: number) => ArrayBuffer;
  locateFile?: (path: string, prefix: string) => string;
}

interface SherpaModule extends SherpaModuleInit {
  FS_createPath(parent: string, name: string, canRead: boolean, canWrite: boolean): void;
  FS_createDataFile(
    parent: string,
    name: string,
    data: Uint8Array,
    canRead: boolean,
    canWrite: boolean,
    canOwn: boolean
  ): void;
}

declare global {
  interface Window {
    Module?: SherpaModuleInit;
    createOnlineRecognizer?: (module: SherpaModuleInit, config: unknown) => SherpaRecognizer;
  }
}

type ProgressFn = (loaded: number, total: number) => void;

let recognizer: SherpaRecognizer | null = null;
let loadPromise: Promise<void> | null = null;
let downloadPromise: Promise<void> | null = null;
const progressListeners = new Set<ProgressFn>();

/**
 * The audio context must be created/resumed inside the mic button's tap
 * handler; created later (after awaits) Android Chrome keeps it suspended
 * and no audio callbacks ever fire.
 */
let primedAudioContext: AudioContext | null = null;

export function primeSherpaAudioContext(): AudioContext | null {
  try {
    if (!primedAudioContext || primedAudioContext.state === 'closed') {
      try {
        primedAudioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
      } catch {
        // Some devices reject a forced sample rate; the engine downsamples.
        primedAudioContext = new AudioContext();
      }
    }
    if (primedAudioContext.state === 'suspended') {
      // Called synchronously from the tap handler, so this resume is allowed.
      void primedAudioContext.resume().catch(() => {
        /* state stays visible in the diagnostics block */
      });
    }
    return primedAudioContext;
  } catch {
    return null;
  }
}

export function isSherpaLoaded(): boolean {
  return recognizer !== null;
}

/** A cached response must be complete; a partially written model is not usable offline. */
async function cachedAsset(cache: Cache, url: string, bytes: number): Promise<Response | undefined> {
  const response = await cache.match(url);
  if (!response) return undefined;
  const length = Number(response.headers.get('content-length'));
  if (response.ok && length === bytes) return response;
  await cache.delete(url);
  return undefined;
}

export async function isSherpaCached(): Promise<boolean> {
  if (typeof caches === 'undefined') return false;
  const cache = await caches.open(SHERPA_CACHE_NAME);
  for (const asset of ASSETS) {
    if (!(await cachedAsset(cache, asset.url, asset.bytes))) return false;
  }
  return true;
}

/** Download all offline assets without starting the recognizer or requesting the mic. */
export function downloadSherpaAssets(onProgress?: ProgressFn): Promise<void> {
  if (!downloadPromise) {
    downloadPromise = doDownload().finally(() => { downloadPromise = null; });
  }
  if (onProgress) {
    progressListeners.add(onProgress);
    void downloadPromise.finally(() => progressListeners.delete(onProgress)).catch(() => {});
  }
  return downloadPromise;
}

async function doDownload(): Promise<void> {
  if (typeof caches === 'undefined') throw new Error('Offline storage is not available in this browser');
  const cache = await caches.open(SHERPA_CACHE_NAME);
  const total = ASSETS.reduce((sum, file) => sum + file.bytes, 0);
  let loaded = 0;
  for (const asset of ASSETS) {
    if (!(await cachedAsset(cache, asset.url, asset.bytes))) {
      await fetchWithProgress(asset.url, asset.bytes, (bytes) => {
        reportProgress(loaded + bytes, total);
      }, cache);
    }
    loaded += asset.bytes;
    reportProgress(loaded, total);
  }
}

/** Loads the wasm runtime and the model once; later calls reuse the same promise. */
export function loadSherpaModel(onProgress?: ProgressFn): Promise<void> {
  if (recognizer) return Promise.resolve();
  if (!loadPromise) {
    loadPromise = doLoad().catch((error) => {
      loadPromise = null;
      throw error;
    });
  }
  if (onProgress) {
    progressListeners.add(onProgress);
    void loadPromise.then(
      () => progressListeners.delete(onProgress),
      () => progressListeners.delete(onProgress)
    );
  }
  return loadPromise;
}

function reportProgress(loaded: number, total: number): void {
  for (const listener of progressListeners) {
    try {
      listener(loaded, total);
    } catch {
      /* ignore */
    }
  }
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

async function fetchWithProgress(
  url: string,
  expectedBytes: number,
  onLoaded: (bytes: number) => void,
  cache?: Cache
): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download ${url} (${response.status})`);
  const reader = response.body?.getReader();
  if (!reader) {
    const buffer = new Uint8Array(await response.arrayBuffer());
    if (buffer.byteLength !== expectedBytes) throw new Error(`Incomplete download: ${url}`);
    onLoaded(buffer.byteLength);
    if (cache) await cache.put(url, new Response(buffer, { headers: { 'content-length': String(expectedBytes) } }));
    return buffer;
  }
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      received += value.length;
      onLoaded(received);
    }
  }
  if (received !== expectedBytes) throw new Error(`Incomplete download: ${url}`);
  const result = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  if (cache) await cache.put(url, new Response(result, { headers: { 'content-length': String(expectedBytes) } }));
  return result;
}

async function doLoad(): Promise<void> {
  await loadScript('/voice/sherpa-onnx-asr.js');

  const init: SherpaModuleInit = {
    // The bundled demo ships a 183 MB preloaded model; we load our own model
    // instead, so hand the preload step an empty package (files become stubs).
    getPreloadedPackage: () => new ArrayBuffer(0),
    locateFile: (path) => `/voice/${path}`
  };
  const runtimeReady = new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error('Timed out while starting the wasm runtime'));
    }, 120_000);
    init.onRuntimeInitialized = () => {
      window.clearTimeout(timer);
      resolve();
    };
    init.onAbort = () => {
      window.clearTimeout(timer);
      reject(new Error('sherpa-onnx wasm failed to start'));
    };
  });
  window.Module = init;
  await loadScript('/voice/sherpa-onnx-wasm-main-asr.js');
  await runtimeReady;

  // The runtime attached the FS helpers to the same object.
  const mod = init as SherpaModule;

  // Copy the persistent model into the wasm file system (which is memory-only).
  mod.FS_createPath('/', 'voice', true, true);
  mod.FS_createPath('/voice', 'model', true, true);
  const total = MODEL_FILES.reduce((sum, file) => sum + file.bytes, 0);
  let loaded = 0;
  const cache = typeof caches === 'undefined' ? null : await caches.open(SHERPA_CACHE_NAME);
  for (const file of MODEL_FILES) {
    const url = `/voice/model/${file.name}`;
    const cached = cache && await cachedAsset(cache, url, file.bytes);
    const data = cached
      ? new Uint8Array(await cached.arrayBuffer())
      : await fetchWithProgress(url, file.bytes, (bytes) => {
          reportProgress(loaded + bytes, total);
        }, cache ?? undefined);
    mod.FS_createDataFile('/voice/model', file.name, data, true, true, true);
    loaded += file.bytes;
    reportProgress(loaded, total);
  }

  const create = window.createOnlineRecognizer;
  if (!create) throw new Error('sherpa-onnx wrapper failed to load');
  recognizer = create(mod, {
    featConfig: { sampleRate: SAMPLE_RATE, featureDim: 80 },
    modelConfig: {
      transducer: {
        encoder: '/voice/model/encoder.int8.onnx',
        decoder: '/voice/model/decoder.int8.onnx',
        joiner: '/voice/model/joiner.int8.onnx'
      },
      tokens: '/voice/model/tokens.txt',
      numThreads: 1,
      provider: 'cpu',
      debug: 0,
      modelType: '',
      modelingUnit: 'cjkchar',
      bpeVocab: ''
    },
    decodingMethod: 'greedy_search',
    maxActivePaths: 4,
    enableEndpoint: 1,
    rule1MinTrailingSilence: 0.8,
    rule2MinTrailingSilence: 0.8,
    rule3MinUtteranceLength: 20,
    hotwordsFile: '',
    hotwordsScore: 1.5,
    ctcFstDecoderConfig: { graph: '', maxActive: 3000 },
    ruleFsts: '',
    ruleFars: ''
  });
  if (!recognizer || !recognizer.handle) {
    recognizer = null;
    throw new Error('Failed to create the offline recognizer');
  }
}

export function createSherpaEngine(): VoiceEngine {
  return new SherpaEngine();
}

/**
 * Continuous microphone -> sherpa-onnx streaming recognition.
 * One getUserMedia stream, 16 kHz samples, endpoint detection per utterance.
 * While speech or a tone plays (plus 1 s), audio feeding stops and the
 * recognizer stream is reset, so the readback can never be recognized.
 * Every failure is reported through onState and the diagnostics snapshot.
 */
class SherpaEngine implements VoiceEngine {
  private handlers: VoiceEngineHandlers | null = null;
  private stream: SherpaStream | null = null;
  private running = false;
  private wasMuted = false;
  private lastPartial = '';
  private audioContext: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private diagState: 'idle' | VoiceEngineState = 'idle';
  private diagError = '';
  private diagGetUserMedia = 'not requested';
  private inputLevel = 0;
  private chunksFed = 0;
  private finalCount = 0;
  private endpointCount = 0;
  private lastFinalText = '';
  private partialTimer: number | undefined;

  start(handlers: VoiceEngineHandlers): void {
    this.handlers = handlers;
    this.running = true;
    void this.startAsync().catch((error) => {
      this.fail(error);
    });
  }

  stop(): void {
    this.running = false;
    this.clearPartialTimer();
    try {
      this.stopAudio();
    } catch {
      /* ignore */
    }
    try {
      this.stream?.free();
    } catch {
      /* ignore */
    }
    this.stream = null;
    this.wasMuted = false;
    this.lastPartial = '';
  }

  private emitDiagnostics(): void {
    const diagnostics: EngineDiagnostics = {
      state: this.diagState,
      lastError: this.diagError,
      getUserMedia: this.diagGetUserMedia,
      audioContextState: this.audioContext?.state ?? primedAudioContext?.state ?? 'none',
      audioContextSampleRate: this.audioContext?.sampleRate ?? primedAudioContext?.sampleRate ?? 0,
      inputLevel: this.inputLevel,
      chunksFed: this.chunksFed,
      partialText: this.lastPartial,
      finalCount: this.finalCount,
      endpointCount: this.endpointCount,
      lastFinalText: this.lastFinalText
    };
    this.handlers?.onDiagnostics?.(diagnostics);
  }

  /** Emits one text through the same path for endpoints and stable partials. */
  private emitFinal(text: string): void {
    if (!text) return;
    this.finalCount += 1;
    this.lastFinalText = text;
    this.handlers?.onFinal(text);
  }

  private clearPartialTimer(): void {
    window.clearTimeout(this.partialTimer);
    this.partialTimer = undefined;
  }

  /** Single place where engine failures land. */
  private fail(error: unknown): void {
    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    const alreadyFailed = this.diagState === 'error';
    this.running = false;
    this.clearPartialTimer();
    this.diagState = 'error';
    this.diagError = message;
    try {
      this.stopAudio();
    } catch {
      /* ignore */
    }
    try {
      this.stream?.free();
    } catch {
      /* ignore */
    }
    this.stream = null;
    this.emitDiagnostics();
    if (!alreadyFailed) {
      this.handlers?.onState('error', message);
    }
  }

  private async startAsync(): Promise<void> {
    const handlers = this.handlers;
    if (!handlers) return;
    try {
      this.diagState = 'loading';
      this.diagError = '';
      this.emitDiagnostics();
      handlers.onState('loading', 'Starting offline recognizer…');
      await loadSherpaModel((loaded, total) => {
        if (!this.running) return;
        const percent = total > 0 ? Math.floor((loaded / total) * 100) : 0;
        this.diagState = 'loading';
        this.emitDiagnostics();
        this.handlers?.onState('loading', `Loading model… ${percent}%`);
      });
      if (!this.running) return;
      const rec = recognizer;
      if (!rec) throw new Error('Model not loaded');
      await this.startAudio(rec);
      if (!this.running) {
        this.stopAudio();
        return;
      }
      this.stream = rec.createStream();
      this.lastPartial = '';
      this.wasMuted = false;
      this.clearPartialTimer();
      this.finalCount = 0;
      this.endpointCount = 0;
      this.lastFinalText = '';
      this.diagState = 'listening';
      this.emitDiagnostics();
      handlers.onState('listening');
    } catch (error) {
      this.fail(error);
    }
  }

  private async startAudio(rec: SherpaRecognizer): Promise<void> {
    // Created/resumed in the tap handler when available; fall back for safety.
    this.audioContext = primeSherpaAudioContext();
    if (!this.audioContext) throw new Error('Could not create the audio context');
    if (this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
      } catch (error) {
        // Not fatal on its own: the diagnostics block shows the state.
        this.diagError = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      }
    }
    if (this.audioContext.state !== 'running') {
      this.diagError = `AudioContext is ${this.audioContext.state} after resume`;
    }
    // Report context state/sample rate before the first chunk arrives.
    this.emitDiagnostics();

    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.diagGetUserMedia = 'granted';
    } catch (error) {
      this.diagGetUserMedia =
        error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      this.emitDiagnostics();
      throw error;
    }

    this.source = this.audioContext.createMediaStreamSource(this.micStream);
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    this.processor.onaudioprocess = (event) => {
      this.onAudio(event, rec);
    };
    this.source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
    this.emitDiagnostics();
  }

  private stopAudio(): void {
    try {
      this.processor?.disconnect();
    } catch {
      /* ignore */
    }
    try {
      this.source?.disconnect();
    } catch {
      /* ignore */
    }
    this.processor = null;
    this.source = null;
    this.micStream?.getTracks().forEach((track) => {
      try {
        track.stop();
      } catch {
        /* ignore */
      }
    });
    this.micStream = null;
    const contexts = new Set<AudioContext>();
    if (this.audioContext) contexts.add(this.audioContext);
    if (primedAudioContext) contexts.add(primedAudioContext);
    for (const context of contexts) {
      void context.close().catch(() => {});
    }
    if (primedAudioContext && contexts.has(primedAudioContext)) primedAudioContext = null;
    this.audioContext = null;
  }

  private onAudio(event: AudioProcessingEvent, rec: SherpaRecognizer): void {
    try {
      this.processChunk(event, rec);
    } catch (error) {
      this.fail(error);
    }
  }

  private processChunk(event: AudioProcessingEvent, rec: SherpaRecognizer): void {
    const stream = this.stream;
    if (!this.running || !stream) return;

    const raw = event.inputBuffer.getChannelData(0);

    // RMS input level for the diagnostics meter.
    let sum = 0;
    for (let i = 0; i < raw.length; i++) sum += raw[i] * raw[i];
    this.inputLevel = raw.length > 0 ? Math.sqrt(sum / raw.length) : 0;

    if (isSpeechMuted()) {
      // Speech or a tone is playing: do not feed, drop any partial text.
      this.clearPartialTimer();
      if (this.lastPartial) {
        this.lastPartial = '';
        this.handlers?.onPartial('');
      }
      this.wasMuted = true;
      this.emitDiagnostics();
      return;
    }

    const rate = this.audioContext?.sampleRate ?? SAMPLE_RATE;
    let samples: Float32Array = new Float32Array(raw);
    if (rate !== SAMPLE_RATE) samples = downsampleTo16k(samples, rate);

    if (this.wasMuted) {
      // Feed again only after resetting the recognizer stream.
      this.wasMuted = false;
      rec.reset(stream);
      this.lastPartial = '';
    }

    stream.acceptWaveform(SAMPLE_RATE, samples);
    this.chunksFed += 1;

    while (rec.isReady(stream)) rec.decode(stream);

    const text = rec.getResult(stream).text;
    if (text !== this.lastPartial) {
      this.lastPartial = text;
      this.handlers?.onPartial(text);

      // Partials often never reach an endpoint on this model. If the text is
      // already a complete command, finalize it once it stops changing.
      this.clearPartialTimer();
      if (text && this.handlers?.isCompletePartial?.(text)) {
        const stableStream = stream;
        this.partialTimer = window.setTimeout(() => {
          this.partialTimer = undefined;
          if (
            !this.running ||
            this.stream !== stableStream ||
            this.lastPartial !== text ||
            isSpeechMuted()
          ) {
            return;
          }
          this.emitFinal(text);
          rec.reset(stableStream);
          this.lastPartial = '';
          this.handlers?.onPartial('');
          this.emitDiagnostics();
        }, PARTIAL_FINAL_MS);
      }
    } else if (!text) {
      this.clearPartialTimer();
    }

    if (rec.isEndpoint(stream)) {
      this.endpointCount += 1;
      this.clearPartialTimer();
      if (text) this.emitFinal(text);
      rec.reset(stream);
      this.lastPartial = '';
      this.handlers?.onPartial('');
    }

    this.emitDiagnostics();
  }
}

function downsampleTo16k(buffer: Float32Array, inputRate: number): Float32Array {
  const ratio = inputRate / SAMPLE_RATE;
  const length = Math.round(buffer.length / ratio);
  const result = new Float32Array(length);
  let offsetResult = 0;
  let offsetBuffer = 0;
  while (offsetResult < length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
      accum += buffer[i];
      count++;
    }
    result[offsetResult] = count > 0 ? accum / count : 0;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }
  return result;
}
