'use client';

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!sharedAudioCtx) {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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
 * Speaks a Nepali Devanagari syllable, word, or sentence using the browser's Web Speech API
 * (preferring 'ne-NP' or 'hi-IN' voices) alongside a warm acoustic bell cue.
 */
export function speakNepaliPhonics(devanagariText: string, romanizedFallback?: string): void {
  playWaypointChime(2);

  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return;
  }

  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(devanagariText);
    const voices = window.speechSynthesis.getVoices();
    const nepaliVoice =
      voices.find((v) => v.lang.toLowerCase().startsWith('ne')) ||
      voices.find((v) => v.lang.toLowerCase().startsWith('hi'));

    if (nepaliVoice) {
      utterance.voice = nepaliVoice;
      utterance.lang = nepaliVoice.lang;
    } else {
      utterance.lang = 'ne-NP';
      if (romanizedFallback && voices.length > 0) {
        utterance.text = `${devanagariText}`;
      }
    }

    utterance.rate = 0.85;
    utterance.pitch = 1.05;
    window.speechSynthesis.speak(utterance);
  } catch {
    // Fallback chime already played above
  }
}

