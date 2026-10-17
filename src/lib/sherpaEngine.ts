import { isSpeechMuted } from './voice';
import type { VoiceEngine, VoiceEngineHandlers } from './voiceEngine';

/* ------------------------------------------------------------------ */
/* sherpa-onnx WebAssembly (streaming zipformer, English, int8)        */
/* Files served from /voice/, see public/voice/.                       */
/* ------------------------------------------------------------------ */

const SAMPLE_RATE = 16000;

const MODEL_FILES = [
  { name: 'encoder.int8.onnx', bytes: 42_845_182 },
  { name: 'decoder.int8.onnx', bytes: 539_499 },
  { name: 'joiner.int8.onnx', bytes: 259_572 },
  { name: 'tokens.txt', bytes: 5_048 }
];

const RUNTIME_BYTES = 53_867 + 82_688 + 13_150_239; // wrapper js + glue js + wasm

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
const progressListeners = new Set<ProgressFn>();

export function isSherpaLoaded(): boolean {
  return recognizer !== null;
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
  onLoaded: (bytes: number) => void
): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download ${url} (${response.status})`);
  const reader = response.body?.getReader();
  if (!reader) {
    const buffer = new Uint8Array(await response.arrayBuffer());
    onLoaded(buffer.byteLength);
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
      onLoaded(value.length);
    }
  }
  const result = new Uint8Array(received || expectedBytes);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return offset === result.byteLength ? result : result.subarray(0, offset);
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
    init.onRuntimeInitialized = () => resolve();
    init.onAbort = () => reject(new Error('sherpa-onnx wasm failed to start'));
  });
  window.Module = init;
  await loadScript('/voice/sherpa-onnx-wasm-main-asr.js');
  await runtimeReady;

  // The runtime attached the FS helpers to the same object.
  const mod = init as SherpaModule;

  // Download the model into the wasm file system.
  mod.FS_createPath('/', 'voice', true, true);
  mod.FS_createPath('/voice', 'model', true, true);
  const total = MODEL_FILES.reduce((sum, file) => sum + file.bytes, 0);
  let loaded = 0;
  for (const file of MODEL_FILES) {
    const data = await fetchWithProgress(`/voice/model/${file.name}`, file.bytes, (bytes) => {
      reportProgress(loaded + bytes, total);
    });
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
    rule1MinTrailingSilence: 2.4,
    rule2MinTrailingSilence: 1.2,
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

  start(handlers: VoiceEngineHandlers): void {
    this.handlers = handlers;
    this.running = true;
    void this.startAsync();
  }

  stop(): void {
    this.running = false;
    this.stopAudio();
    this.stream?.free();
    this.stream = null;
    this.wasMuted = false;
    this.lastPartial = '';
  }

  private async startAsync(): Promise<void> {
    const handlers = this.handlers;
    if (!handlers) return;
    try {
      handlers.onState('loading', 'Loading model… 0%');
      await loadSherpaModel((loaded, total) => {
        if (!this.running) return;
        const percent = total > 0 ? Math.floor((loaded / total) * 100) : 0;
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
      handlers.onState('listening');
    } catch (error) {
      this.stopAudio();
      const message = error instanceof Error ? error.message : String(error);
      if (this.running) {
        this.running = false;
        handlers.onState('error', message);
      }
    }
  }

  private async startAudio(rec: SherpaRecognizer): Promise<void> {
    this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
    this.source = this.audioContext.createMediaStreamSource(this.micStream);
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    this.processor.onaudioprocess = (event) => {
      this.onAudio(event, rec);
    };
    this.source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
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
    this.micStream?.getTracks().forEach((track) => track.stop());
    this.micStream = null;
    if (this.audioContext) {
      void this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
  }

  private onAudio(event: AudioProcessingEvent, rec: SherpaRecognizer): void {
    const stream = this.stream;
    if (!this.running || !stream) return;

    if (isSpeechMuted()) {
      // Speech or a tone is playing: do not feed, drop any partial text.
      if (this.lastPartial) {
        this.lastPartial = '';
        this.handlers?.onPartial('');
      }
      this.wasMuted = true;
      return;
    }

    const rate = this.audioContext?.sampleRate ?? SAMPLE_RATE;
    let samples: Float32Array = new Float32Array(event.inputBuffer.getChannelData(0));
    if (rate !== SAMPLE_RATE) samples = downsampleTo16k(samples, rate);

    if (this.wasMuted) {
      // Feed again only after resetting the recognizer stream.
      this.wasMuted = false;
      rec.reset(stream);
      this.lastPartial = '';
    }

    stream.acceptWaveform(SAMPLE_RATE, samples);
    while (rec.isReady(stream)) rec.decode(stream);

    const text = rec.getResult(stream).text;
    if (text !== this.lastPartial) {
      this.lastPartial = text;
      this.handlers?.onPartial(text);
    }

    if (rec.isEndpoint(stream)) {
      if (text) this.handlers?.onFinal(text);
      rec.reset(stream);
      this.lastPartial = '';
      this.handlers?.onPartial('');
    }
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
