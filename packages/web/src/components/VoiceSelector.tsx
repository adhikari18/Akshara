'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Sliders, Volume2, VolumeX, Check, Sparkles } from 'lucide-react';
import {
  getAvailablePhonicsVoices,
  getVoiceSettings,
  resolveActiveVoice,
  speakNepaliPhonics,
  subscribeToVoiceUpdates,
  updateVoiceSettings,
  type PhonicsVoiceOption,
  type VoiceSettings,
} from '@/lib/audio';

const TIER_BADGE: Record<
  PhonicsVoiceOption['qualityTier'],
  { label: string; className: string }
> = {
  neural: {
    label: 'Neural / Cloud',
    className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  },
  enhanced: {
    label: 'Enhanced',
    className: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  },
  standard: {
    label: 'System',
    className: 'bg-slate-800 text-slate-300 border-slate-700',
  },
  compact: {
    label: 'Compact',
    className: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  },
};

export const VoiceSelector: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [voices, setVoices] = useState<PhonicsVoiceOption[]>([]);
  const [settings, setSettings] = useState<VoiceSettings>(() => getVoiceSettings());
  const [activeOption, setActiveOption] = useState<PhonicsVoiceOption | null>(null);
  const [showAllVoices, setShowAllVoices] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const sync = () => {
      setVoices(getAvailablePhonicsVoices());
      setSettings(getVoiceSettings());
      setActiveOption(resolveActiveVoice().option);
    };
    sync();
    return subscribeToVoiceUpdates(sync);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const devanagariVoices = voices.filter((v) => v.isDevanagariCapable);
  const otherVoices = voices.filter((v) => !v.isDevanagariCapable);

  const handleSelectVoice = (voiceURI: string) => {
    updateVoiceSettings({ voiceURI });
    if (voiceURI !== 'chime-only') {
      speakNepaliPhonics('क — कपुरी क', 'ka');
    }
  };

  const buttonSummary =
    settings.voiceURI === 'chime-only'
      ? 'Chime Only'
      : activeOption
        ? settings.voiceURI === 'auto'
          ? `Auto (${activeOption.name})`
          : activeOption.name
        : 'Voice';

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        title="Configure Phonics Voice, Speed & Pitch"
        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition ${
          isOpen
            ? 'bg-amber-500/20 text-amber-200 border-amber-500/50'
            : 'bg-slate-900/90 text-slate-200 border-slate-800 hover:border-amber-500/40 hover:text-white'
        }`}
      >
        {settings.voiceURI === 'chime-only' ? (
          <VolumeX className="w-3.5 h-3.5 text-slate-400" />
        ) : (
          <Volume2 className="w-3.5 h-3.5 text-amber-400" />
        )}
        <span className="max-w-[150px] truncate">{buttonSummary}</span>
        <Sliders className="w-3 h-3 text-slate-400" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-slate-950/95 border border-slate-800 shadow-2xl shadow-black/70 backdrop-blur-xl p-4 z-50 space-y-3.5">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5" />
                Phonics Voice &amp; Speech Settings
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Choose a Nepali or Devanagari voice and tune speed &amp; pitch.
              </p>
            </div>
            <button
              type="button"
              onClick={() => speakNepaliPhonics('नमस्ते! क — कपुरी क। कलम।', 'namaste, ka, kalam')}
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-amber-500 text-slate-950 hover:bg-amber-400 transition shrink-0"
            >
              Test Voice
            </button>
          </div>

          {/* Voice List */}
          <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
            {/* Auto Best Available */}
            <button
              type="button"
              onClick={() => handleSelectVoice('auto')}
              className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition ${
                settings.voiceURI === 'auto'
                  ? 'bg-amber-500/15 border-amber-500/50 text-white'
                  : 'bg-slate-900/70 border-slate-800/80 text-slate-300 hover:border-slate-700'
              }`}
            >
              <div className="min-w-0 pr-2">
                <div className="text-xs font-semibold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Auto (Best Available)</span>
                </div>
                <div className="text-[11px] text-slate-400 truncate mt-0.5">
                  {activeOption && settings.voiceURI === 'auto'
                    ? `Using ${activeOption.name} (${activeOption.lang})`
                    : 'Automatically picks highest-quality Nepali/Devanagari voice'}
                </div>
              </div>
              {settings.voiceURI === 'auto' && (
                <Check className="w-4 h-4 text-amber-400 shrink-0" />
              )}
            </button>

            {/* Devanagari Capable Voices */}
            {devanagariVoices.length > 0 ? (
              <div className="pt-1 space-y-1">
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 px-1">
                  Devanagari Voices ({devanagariVoices.length})
                </div>
                {devanagariVoices.map((v) => {
                  const selected = settings.voiceURI === v.voiceURI;
                  const badge = TIER_BADGE[v.qualityTier];
                  return (
                    <button
                      key={v.voiceURI}
                      type="button"
                      onClick={() => handleSelectVoice(v.voiceURI)}
                      className={`w-full flex items-center justify-between p-2 rounded-xl border text-left transition ${
                        selected
                          ? 'bg-amber-500/15 border-amber-500/50 text-white'
                          : 'bg-slate-900/60 border-slate-800/80 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="text-xs font-semibold flex items-center gap-1.5 flex-wrap">
                          <span className="truncate">{v.name}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-sky-300">
                            {v.lang}
                          </span>
                          <span
                            className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                        </div>
                      </div>
                      {selected && <Check className="w-4 h-4 text-amber-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-2.5 rounded-xl bg-amber-950/30 border border-amber-500/30 text-[11px] text-amber-200/90">
                No Nepali (`ne-NP`) or Hindi (`hi-IN`) voice detected in this browser.
              </div>
            )}

            {/* Chime Only option */}
            <button
              type="button"
              onClick={() => handleSelectVoice('chime-only')}
              className={`w-full flex items-center justify-between p-2 rounded-xl border text-left transition ${
                settings.voiceURI === 'chime-only'
                  ? 'bg-amber-500/15 border-amber-500/50 text-white'
                  : 'bg-slate-900/60 border-slate-800/80 text-slate-300 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <VolumeX className="w-3.5 h-3.5 text-slate-400" />
                <div>
                  <div className="text-xs font-semibold">Chime Only (Mute Speech)</div>
                  <div className="text-[10px] text-slate-400">
                    Play musical Pati chimes without synthetic voice
                  </div>
                </div>
              </div>
              {settings.voiceURI === 'chime-only' && (
                <Check className="w-4 h-4 text-amber-400 shrink-0" />
              )}
            </button>

            {/* Optional Other Voices (English / Latin fallback) */}
            {otherVoices.length > 0 && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowAllVoices((prev) => !prev)}
                  className="text-[11px] text-sky-400 hover:text-sky-300 font-medium px-1"
                >
                  {showAllVoices
                    ? 'Hide non-Devanagari system voices'
                    : `Show ${otherVoices.length} other system voices (Romanized fallback)`}
                </button>
                {showAllVoices && (
                  <div className="mt-1.5 space-y-1">
                    {otherVoices.map((v) => {
                      const selected = settings.voiceURI === v.voiceURI;
                      return (
                        <button
                          key={v.voiceURI}
                          type="button"
                          onClick={() => handleSelectVoice(v.voiceURI)}
                          className={`w-full flex items-center justify-between p-2 rounded-xl border text-left transition ${
                            selected
                              ? 'bg-amber-500/15 border-amber-500/50 text-white'
                              : 'bg-slate-900/40 border-slate-800/60 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          <div className="min-w-0 pr-2 flex items-center gap-1.5">
                            <span className="text-xs truncate">{v.name}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                              {v.lang}
                            </span>
                          </div>
                          {selected && <Check className="w-4 h-4 text-amber-400 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Rate & Pitch Sliders */}
          <div className="pt-2 border-t border-slate-800/80 grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between text-[11px] text-slate-300 mb-1">
                <span>Speed (Rate)</span>
                <span className="font-mono text-amber-300">{settings.rate.toFixed(2)}×</span>
              </div>
              <input
                type="range"
                min={0.6}
                max={1.2}
                step={0.05}
                value={settings.rate}
                onChange={(e) => updateVoiceSettings({ rate: Number(e.target.value) })}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>
            <div>
              <div className="flex items-center justify-between text-[11px] text-slate-300 mb-1">
                <span>Pitch</span>
                <span className="font-mono text-amber-300">{settings.pitch.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0.8}
                max={1.2}
                step={0.05}
                value={settings.pitch}
                onChange={(e) => updateVoiceSettings({ pitch: Number(e.target.value) })}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>
          </div>

          {/* Helpful tip when only compact voice is present */}
          {activeOption?.qualityTier === 'compact' && (
            <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-400 leading-relaxed">
              <strong className="text-amber-300">Tip for better audio:</strong> macOS&apos;s built-in{' '}
              <code>Lekha</code> voice is a compact synth. For natural neural speech, open in{' '}
              <strong className="text-slate-200">Chrome</strong> (<code>Google हिन्दी</code>) or{' '}
              <strong className="text-slate-200">Edge</strong> (<code>Microsoft Hemkala ne-NP</code>),
              or download <strong className="text-slate-200">Kiyara / Neel (Enhanced)</strong> in{' '}
              <code>System Settings ➔ Accessibility ➔ Spoken Content ➔ System Voice</code>.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
