'use client';

let sharedAudioCtx: AudioContext | null = null;

export interface PhonicsVoiceOption {
  voiceURI: string;
  name: string;
  lang: string;
  localService: boolean;
  isDevanagariCapable: boolean;
  isNepali: boolean;
  qualityTier: 'neural' | 'enhanced' | 'standard' | 'compact';
  score: number;
}

export interface VoiceSettings {
  /** 'auto' (best available), 'chime-only' (mute TTS), or a specific SpeechSynthesisVoice.voiceURI */
  voiceURI: string;
  /** Speech rate (0.6 - 1.25, default 0.9) */
  rate: number;
  /** Speech pitch (0.8 - 1.2, default 1.0 to avoid phase-vocoder warble on compact voices) */
  pitch: number;
}

const VOICE_SETTINGS_STORAGE_KEY = 'akshara:voice-settings';

const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  voiceURI: 'auto',
  rate: 0.9,
  pitch: 1.0,
};

let currentVoiceSettings: VoiceSettings = { ...DEFAULT_VOICE_SETTINGS };
let settingsLoadedFromStorage = false;
const settingsListeners = new Set<() => void>();

function loadStoredVoiceSettings(): VoiceSettings {
  if (typeof window === 'undefined') return currentVoiceSettings;
  if (!settingsLoadedFromStorage) {
    settingsLoadedFromStorage = true;
    try {
      const raw = window.localStorage.getItem(VOICE_SETTINGS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<VoiceSettings>;
        currentVoiceSettings = {
          voiceURI: typeof parsed.voiceURI === 'string' ? parsed.voiceURI : 'auto',
          rate:
            typeof parsed.rate === 'number' && parsed.rate >= 0.5 && parsed.rate <= 1.5
              ? parsed.rate
              : DEFAULT_VOICE_SETTINGS.rate,
          pitch:
            typeof parsed.pitch === 'number' && parsed.pitch >= 0.7 && parsed.pitch <= 1.3
              ? parsed.pitch
              : DEFAULT_VOICE_SETTINGS.pitch,
        };
      }
    } catch {
      // Ignore storage access errors in private/sandboxed browsing
    }
  }
  return currentVoiceSettings;
}

export function getVoiceSettings(): VoiceSettings {
  return { ...loadStoredVoiceSettings() };
}

export function updateVoiceSettings(patch: Partial<VoiceSettings>): VoiceSettings {
  const prev = loadStoredVoiceSettings();
  currentVoiceSettings = {
    voiceURI: patch.voiceURI ?? prev.voiceURI,
    rate:
      typeof patch.rate === 'number'
        ? Math.max(0.5, Math.min(1.5, Number(patch.rate.toFixed(2))))
        : prev.rate,
    pitch:
      typeof patch.pitch === 'number'
        ? Math.max(0.7, Math.min(1.3, Number(patch.pitch.toFixed(2))))
        : prev.pitch,
  };
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(
        VOICE_SETTINGS_STORAGE_KEY,
        JSON.stringify(currentVoiceSettings)
      );
    } catch {
      // Ignore storage write errors
    }
  }
  settingsListeners.forEach((cb) => cb());
  return { ...currentVoiceSettings };
}

const DEVANAGARI_LANG_PREFIXES = ['ne', 'hi', 'mr', 'sa', 'kok', 'mai', 'bho'];
const INDIC_LANG_PREFIXES = [
  ...DEVANAGARI_LANG_PREFIXES,
  'bn',
  'gu',
  'pa',
  'as',
  'or',
  'ta',
  'te',
  'kn',
  'ml',
];

function classifyVoiceOption(voice: SpeechSynthesisVoice): PhonicsVoiceOption {
  const langLower = (voice.lang || '').toLowerCase();
  const nameLower = (voice.name || '').toLowerCase();

  const isNepali = langLower.startsWith('ne') || nameLower.includes('nepali');
  const isHindi = langLower.startsWith('hi') || nameLower.includes('hindi') || nameLower.includes('हिन्दी');
  const isOtherDevanagari = DEVANAGARI_LANG_PREFIXES.some((p) => langLower.startsWith(p));
  const isIndic = INDIC_LANG_PREFIXES.some((p) => langLower.startsWith(p));
  const isDevanagariCapable = isNepali || isHindi || isOtherDevanagari;

  let qualityTier: PhonicsVoiceOption['qualityTier'] = 'standard';
  if (
    !voice.localService ||
    nameLower.includes('natural') ||
    nameLower.includes('neural') ||
    nameLower.includes('online') ||
    nameLower.includes('google')
  ) {
    qualityTier = 'neural';
  } else if (
    nameLower.includes('premium') ||
    nameLower.includes('enhanced') ||
    nameLower.includes('siri') ||
    nameLower.includes('kiyara') ||
    nameLower.includes('neel')
  ) {
    qualityTier = 'enhanced';
  } else if (nameLower.includes('lekha') || nameLower.includes('compact')) {
    qualityTier = 'compact';
  }

  let score = 0;
  if (isNepali) score += 1000;
  else if (isHindi) score += 700;
  else if (isOtherDevanagari) score += 550;
  else if (isIndic || langLower.endsWith('-in')) score += 200;

  if (qualityTier === 'neural') score += 300;
  else if (qualityTier === 'enhanced') score += 200;
  else if (qualityTier === 'standard') score += 50;
  else if (qualityTier === 'compact') score -= 80;

  return {
    voiceURI: voice.voiceURI,
    name: voice.name,
    lang: voice.lang,
    localService: voice.localService,
    isDevanagariCapable,
    isNepali,
    qualityTier,
    score,
  };
}

/**
 * Returns all browser SpeechSynthesis voices ranked with Nepali & neural Devanagari voices first.
 */
export function getAvailablePhonicsVoices(): PhonicsVoiceOption[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return [];
  }
  const rawVoices = window.speechSynthesis.getVoices() || [];
  const seen = new Set<string>();
  const options: PhonicsVoiceOption[] = [];

  for (const v of rawVoices) {
    if (seen.has(v.voiceURI)) continue;
    seen.add(v.voiceURI);
    options.push(classifyVoiceOption(v));
  }

  options.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return options;
}

/**
 * Resolves the active SpeechSynthesisVoice for the current user settings.
 */
export function resolveActiveVoice(): {
  voice: SpeechSynthesisVoice | null;
  option: PhonicsVoiceOption | null;
} {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return { voice: null, option: null };
  }
  const settings = loadStoredVoiceSettings();
  if (settings.voiceURI === 'chime-only') {
    return { voice: null, option: null };
  }

  const rawVoices = window.speechSynthesis.getVoices() || [];
  const ranked = getAvailablePhonicsVoices();

  if (settings.voiceURI !== 'auto') {
    const chosenVoice = rawVoices.find((v) => v.voiceURI === settings.voiceURI);
    const chosenOption = ranked.find((o) => o.voiceURI === settings.voiceURI) ?? null;
    if (chosenVoice) {
      return { voice: chosenVoice, option: chosenOption };
    }
  }

  // Auto mode (or fallback if saved voiceURI is unavailable): pick highest-scoring Devanagari voice
  const bestDevanagari = ranked.find((o) => o.isDevanagariCapable) ?? ranked[0] ?? null;
  if (!bestDevanagari) {
    return { voice: null, option: null };
  }
  const matchedVoice = rawVoices.find((v) => v.voiceURI === bestDevanagari.voiceURI) ?? null;
  return { voice: matchedVoice, option: bestDevanagari };
}

/**
 * Subscribes to changes in browser voices or user voice settings.
 */
export function subscribeToVoiceUpdates(callback: () => void): () => void {
  settingsListeners.add(callback);
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    const handleVoicesChanged = () => callback();
    window.speechSynthesis.addEventListener?.('voiceschanged', handleVoicesChanged);
    return () => {
      settingsListeners.delete(callback);
      window.speechSynthesis.removeEventListener?.('voiceschanged', handleVoicesChanged);
    };
  }
  return () => {
    settingsListeners.delete(callback);
  };
}

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!sharedAudioCtx) {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) {
      sharedAudioCtx = new AudioCtx();
    }
  }
  if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

/**
 * Plays an ascending pentatonic chime when a learner unlocks a waypoint on the Pati slate.
 */
export function playWaypointChime(waypointIndex: number): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const pentatonicFreqs = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
  const freq = pentatonicFreqs[waypointIndex % pentatonicFreqs.length];

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, now);

  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(0.14, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.24);
}

/**
 * Plays a celebratory Himalayan chord arpeggio on stroke or full letter completion.
 */
export function playStrokeSuccessSound(isLetterComplete = false): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const notes = isLetterComplete
    ? [523.25, 659.25, 783.99, 1046.5]
    : [587.33, 783.99];

  const now = ctx.currentTime;
  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const start = now + idx * 0.075;

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, start);

    gain.gain.setValueAtTime(0.001, start);
    gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.38);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(start);
    osc.stop(start + 0.4);
  });
}

/**
 * Plays a gentle wooden slate tap when a topological rule (e.g., Shirorekha-last) is violated.
 */
export function playTopologicalWarningSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(195, now);
  osc.frequency.exponentialRampToValueAtTime(135, now + 0.18);

  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.22);
}

/**
 * Cleans punctuation (such as em-dashes in "क — कपुरी क") so TTS engines pause naturally
 * rather than reading punctuation names or rushing through syllables.
 */
function formatDevanagariUtteranceText(text: string): string {
  return text.replace(/\s*[—–•]\s*/g, ', ').trim();
}

/**
 * Speaks a Nepali Devanagari syllable, word, or sentence using the user's selected Web Speech
 * voice (or the highest-ranked neural Nepali/Devanagari voice in Auto mode).
 */
export function speakNepaliPhonics(devanagariText: string, romanizedFallback?: string): void {
  playWaypointChime(2);

  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return;
  }

  const settings = loadStoredVoiceSettings();
  if (settings.voiceURI === 'chime-only') {
    return;
  }

  try {
    window.speechSynthesis.cancel();
    const { voice, option } = resolveActiveVoice();
    const cleanedDevanagari = formatDevanagariUtteranceText(devanagariText);

    // If the user explicitly picked a non-Devanagari voice (e.g. an English voice) and a
    // romanized fallback is available, speak the romanized pronunciation so the engine doesn't stay silent.
    const useRomanized =
      option !== null && !option.isDevanagariCapable && Boolean(romanizedFallback);
    const spokenText = useRomanized ? romanizedFallback! : cleanedDevanagari;

    const utterance = new SpeechSynthesisUtterance(spokenText);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = 'ne-NP';
    }

    utterance.rate = settings.rate;
    utterance.pitch = settings.pitch;
    window.speechSynthesis.speak(utterance);
  } catch {
    // Fallback chime already played above
  }
}
