/**
 * Domain: TimerState
 *
 * Pure functions — no side effects, no I/O, fully testable.
 * Each function receives a state and returns a NEW state (immutable transitions).
 *
 * @typedef {'stopped'|'running'|'paused'} TimerStatus
 * @typedef {'countdown'|'countup'}        TimerMode
 * @typedef {'normal'|'warning'|'danger'|'zero'} AlertLevel
 * @typedef {{ status: TimerStatus, mode: TimerMode, totalSeconds: number, remainingSeconds: number, emergencyMessage: string|null }} TimerState
 */

/** @returns {TimerState} */
function create(overrides = {}) {
  return {
    status: 'stopped',
    mode: 'countdown',
    totalSeconds: 0,
    remainingSeconds: 0,
    emergencyMessage: null,
    ...overrides,
  };
}

/** @param {TimerState} state @returns {TimerState} */
function tick(state) {
  if (state.mode === 'countup') {
    return { ...state, remainingSeconds: state.remainingSeconds + 1 };
  }
  const remaining = Math.max(0, state.remainingSeconds - 1);
  return {
    ...state,
    remainingSeconds: remaining,
    status: remaining === 0 ? 'stopped' : state.status,
  };
}

/** @param {TimerState} state @returns {TimerState} */
function start(state) {
  if (state.status === 'running') return state;
  if (state.mode === 'countdown' && state.remainingSeconds <= 0)
    throw new Error('no time set');
  return { ...state, status: 'running' };
}

/** @param {TimerState} state @returns {TimerState} */
function pause(state) {
  if (state.status !== 'running') return state;
  return { ...state, status: 'paused' };
}

/** @param {TimerState} state @returns {TimerState} */
function resume(state) {
  if (state.status !== 'paused') return state;
  return { ...state, status: 'running' };
}

/** @param {TimerState} state @returns {TimerState} */
function reset(state) {
  return { ...state, status: 'stopped', remainingSeconds: state.totalSeconds };
}

/**
 * @param {TimerState} state
 * @param {number}     seconds
 * @returns {TimerState}
 */
function setTime(state, seconds) {
  if (typeof seconds !== 'number' || seconds < 0)
    throw new Error('invalid seconds');
  return {
    ...state,
    status: 'stopped',
    totalSeconds: seconds,
    remainingSeconds: seconds,
    mode: seconds > 0 ? 'countdown' : 'countup',
  };
}

/**
 * Sets an emergency message visible on the display.
 * Validation: text must be non-empty after trim.
 * Sanitization (strip HTML) is done at the HTTP boundary before reaching here.
 *
 * @param {TimerState} state
 * @param {string}     text
 * @returns {TimerState}
 */
function setMessage(state, text) {
  if (!text || !text.trim()) throw new Error('message cannot be empty');
  return { ...state, emergencyMessage: text.trim() };
}

/**
 * Clears the emergency message, returning to the timer view.
 *
 * @param {TimerState} state
 * @returns {TimerState}
 */
function clearMessage(state) {
  return { ...state, emergencyMessage: null };
}

/**
 * Derives the visual alert level from the current timer state.
 * Business rule lives here — not in the display.
 *
 * Rules (countdown only):
 *   remaining = 0 and totalSeconds > 0  → 'zero'    (persists until RESET)
 *   remaining / total ≤ 20%             → 'danger'
 *   remaining / total ≤ 30%             → 'warning'
 *   otherwise (or countup / no time)    → 'normal'
 *
 * @param {TimerState} state
 * @returns {AlertLevel}
 */
function alertLevel(state) {
  if (state.mode === 'countup' || state.totalSeconds === 0) return 'normal';
  if (state.remainingSeconds === 0) return 'zero';
  const ratio = state.remainingSeconds / state.totalSeconds;
  if (ratio <= 0.20) return 'danger';
  if (ratio <= 0.30) return 'warning';
  return 'normal';
}

module.exports = { create, tick, start, pause, resume, reset, setTime, setMessage, clearMessage, alertLevel };
