import { useState, useEffect, useRef, useCallback } from 'react';

// =============================================================================
// useTimer — Drift-resistant countdown hook
// =============================================================================
// Why a custom hook: Timer logic (setInterval management, cleanup, drift
// correction) is complex enough to warrant isolation from the component.
// Extracting it makes SessionPage simpler and makes the timer testable
// independently.
//
// CRITICAL DESIGN PRINCIPLE: This timer is a VISUAL countdown only. It must
// NEVER be the thing that actually ends the session. The backend's
// completeSession endpoint is the real enforcement — a user could pause JS
// execution, change their system clock, or run in a background tab where
// setInterval is throttled. The frontend timer hitting zero should TRIGGER
// a call to the backend's complete endpoint, but the backend's own timing
// validation is what actually finalizes the session.
// =============================================================================

/**
 * Countdown timer hook that resists drift from setInterval timing inaccuracies.
 *
 * @param {number} initialSeconds — Starting countdown value from the backend's
 *   `remainingTimeSeconds` field. This is the server-authoritative remaining
 *   time, NOT a client-side calculation from startTime.
 *
 * @returns {{
 *   remainingSeconds: number,
 *   isExpired: boolean,
 *   formattedTime: string,
 *   isWarning: boolean
 * }}
 */
export default function useTimer(initialSeconds) {
  // Why a ref for the start timestamp instead of state:
  // We capture Date.now() once when the timer starts and compute remaining
  // time as (initialSeconds - elapsed). This approach is immune to setInterval
  // drift because each tick recalculates from the true wall-clock elapsed time,
  // rather than naively doing `prev - 1` which compounds timing errors over
  // a long interview (e.g., a 30-minute session with setInterval at 1000ms
  // could drift by several seconds with naive decrement).
  const startTimeRef = useRef(null);

  // Store initialSeconds in a ref so we don't re-create the interval when
  // the component re-renders with the same value
  const initialSecondsRef = useRef(initialSeconds);

  const [remainingSeconds, setRemainingSeconds] = useState(() => {
    // Why Math.max(0, ...): Protect against negative initial values from
    // edge cases where the backend returns a slightly negative number due
    // to network latency between calculation and response arrival.
    return Math.max(0, Math.floor(initialSeconds));
  });

  // Compute derived values from remainingSeconds
  const isExpired = remainingSeconds <= 0;

  // Why 60 seconds as the warning threshold: Common UX convention for timed
  // tests — gives the user enough notice to wrap up their current answer
  // without being so early that the warning loses urgency.
  const isWarning = remainingSeconds > 0 && remainingSeconds <= 60;

  // Pre-formatted string for display: "MM:SS"
  const formattedTime = formatTime(remainingSeconds);

  useEffect(() => {
    // Don't start if we have no time or it's already expired
    if (initialSecondsRef.current <= 0) return;

    // Capture the wall-clock timestamp when the timer starts. All subsequent
    // ticks compute elapsed time from this fixed reference point.
    startTimeRef.current = Date.now();

    const intervalId = setInterval(() => {
      const elapsedMs = Date.now() - startTimeRef.current;
      const elapsedSeconds = Math.floor(elapsedMs / 1000);
      const newRemaining = Math.max(0, initialSecondsRef.current - elapsedSeconds);

      setRemainingSeconds(newRemaining);

      // Stop the interval once time expires — no need to keep ticking at 0.
      // The component consuming this hook will react to isExpired becoming true.
      if (newRemaining <= 0) {
        clearInterval(intervalId);
      }
    }, 1000);

    // Cleanup: Clear the interval if the component unmounts or if this
    // effect re-runs. Without this, navigating away from the session page
    // would leave a zombie interval ticking and calling setState on an
    // unmounted component.
    return () => clearInterval(intervalId);
  }, []); // Empty deps — timer starts once on mount and never resets

  return { remainingSeconds, isExpired, formattedTime, isWarning };
}

/**
 * Formats seconds into "MM:SS" string for timer display.
 * @param {number} totalSeconds
 * @returns {string}
 */
function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
