/**
 * Domain: TimerState
 *
 * Pure functions — no side effects, no I/O, fully testable.
 * Each function receives a state and returns a NEW state (immutable transitions).
 *
 * @typedef {'stopped'|'running'|'paused'} TimerStatus
 * @typedef {'countdown'|'countup'}        TimerMode
 * @typedef {{ status: TimerStatus, mode: TimerMode, totalSeconds: number, remainingSeconds: number }} TimerState
 */

/** @returns {TimerState} */
function create(overrides = {}) {
  return {
    status: 'stopped',
    mode: 'countdown',
    totalSeconds: 0,
    remainingSeconds: 0,
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

module.exports = { create, tick, start, pause, resume, reset, setTime };
