import { useState, useCallback } from 'react';
import { ALLOWED_RATES, readStoredRate, writeStoredRate } from './voicePlaybackRateStore.js';

/**
 * Hook that manages the user's preferred voice-message playback rate.
 *
 * - Reads the initial value from localStorage (falls back to 1×).
 * - Persists every change back to localStorage.
 * - Validates against the allowed set [0.5, 1, 1.5, 2].
 *
 * Each VoicePlayer instance calls this independently — they all
 * share the same localStorage key so the preference is consistent.
 */
export default function useVoicePlaybackRate() {
  const [rate, setRateState] = useState(readStoredRate);

  const setRate = useCallback((nextRate) => {
    const validated = ALLOWED_RATES.includes(nextRate) ? nextRate : 1;
    setRateState(validated);
    writeStoredRate(validated);
  }, []);

  return { rate, setRate, ALLOWED_RATES };
}
