/**
 * Use Case: TimerService
 *
 * Orchestrates domain transitions, tick scheduling, and persistence.
 * Knows nothing about Express or HTTP — pure application logic.
 *
 * Follows DIP: receives `persistence` as a dependency (injectable),
 * not a hardcoded import, enabling easy swapping and testing.
 *
 * @param {{ load: Function, save: Function }} persistence
 */
const timerState   = require('../domain/timerState');
const IntervalTick = require('../infra/intervalTick');

const COMMAND_HANDLERS = {
  START:    (state)          => timerState.start(state),
  PAUSE:    (state)          => timerState.pause(state),
  RESUME:   (state)          => timerState.resume(state),
  RESET:    (state)          => timerState.reset(state),
  SET_TIME: (state, { seconds }) => timerState.setTime(state, seconds),
};

function TimerService(persistence) {
  let state = persistence.load(timerState.create());
  let tick  = null;

  function onTick() {
    state = timerState.tick(state);
    if (state.status === 'stopped') tick.stop();
    persistence.save(state);
  }

  tick = IntervalTick(onTick);

  function getState() {
    return state;
  }

  function execute(action, params = {}) {
    const handler = COMMAND_HANDLERS[action];
    if (!handler) throw new Error(`unknown action: ${action}`);

    const prevStatus = state.status;
    state = handler(state, params);

    const shouldRun = state.status === 'running';
    const wasRunning = prevStatus === 'running';

    if (shouldRun && !tick.isRunning()) tick.start();
    if (!shouldRun && wasRunning)       tick.stop();

    persistence.save(state);
    return state;
  }

  return { getState, execute };
}

module.exports = TimerService;
