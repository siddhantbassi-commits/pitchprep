'use client';

import { useEffect, useRef, useState } from 'react';
import type { BriefResult } from '@/lib/types';
import { briefToSpeech } from '@/lib/speech';

/** Reads the brief aloud with the browser's built-in voice (nothing is sent anywhere). Hidden where speech is not supported. */
export default function ListenButton({ result, className = 'btn' }: { result: BriefResult; className?: string }) {
  const [supported, setSupported] = useState(false);
  const [state, setState] = useState<'idle' | 'playing' | 'paused'>('idle');
  const stopped = useRef(false);

  useEffect(() => { setSupported(typeof window !== 'undefined' && 'speechSynthesis' in window); return () => { stopped.current = true; window.speechSynthesis?.cancel(); }; }, []);
  if (!supported) return null;

  function play() {
    const synth = window.speechSynthesis;
    synth.cancel(); stopped.current = false;
    const lines = briefToSpeech(result);
    const voice = synth.getVoices().find((v) => /en[-_]IN/i.test(v.lang)) ?? synth.getVoices().find((v) => /^en/i.test(v.lang));
    lines.forEach((text, i) => {
      const u = new SpeechSynthesisUtterance(text);
      if (voice) u.voice = voice;
      u.lang = voice?.lang ?? 'en-IN'; u.rate = 1.02;
      if (i === lines.length - 1) u.onend = () => { if (!stopped.current) setState('idle'); };
      synth.speak(u);
    });
    setState('playing');
  }
  function pauseResume() { const s = window.speechSynthesis; if (state === 'playing') { s.pause(); setState('paused'); } else { s.resume(); setState('playing'); } }
  function stop() { stopped.current = true; window.speechSynthesis.cancel(); setState('idle'); }

  return state === 'idle' ? (
    <button className={className} onClick={play} aria-label="Listen to this brief read aloud">Listen</button>
  ) : (
    <span className="inline-flex gap-2" role="group" aria-label="Listening controls">
      <button className={className} onClick={pauseResume}>{state === 'playing' ? 'Pause' : 'Resume'}</button>
      <button className={className} onClick={stop}>Stop</button>
    </span>
  );
}
