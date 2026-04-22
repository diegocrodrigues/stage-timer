/**
 * Use Case: TimerService
 *
 * Orchestrates domain transitions, tick scheduling, persistence, and
 * state change notifications.
 *
 * Follows DIP: receives both `persistence` and `onStateChange` as injected
 * dependencies — no concrete infra imports here.
 *
 * @param {{ load: Function, save: Function }} persistence
 * @param {(state: object) => void}            onStateChange  Called after every state mutation.
 */
const timerState   = require('../domain/timerState');
const IntervalTick = require('../infra/intervalTick');

const COMMAND_HANDLERS = {
  START:    (state)               => timerState.start(state),
  PAUSE:    (state)               => timerState.pause(state),
  RESUME:   (state)               => timerState.resume(state),
  RESET:    (state)               => timerState.reset(state),
  SET_TIME: (state, { seconds })  => timerState.setTime(state, seconds),
};

function TimerService(persistence, onStateChange = () => {}) {
  let state = persistence.load(timerState.create());
  let tick  = null;

  function notifyAndSave() {
    persistence.save(state);
    onStateChange(state);
  }

  function onTick() {
    state = timerState.tick(state);
    if (state.status === 'stopped') tick.stop();
    notifyAndSave();
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

    notifyAndSave();
    return state;
  }

  return { getState, execute };
}

module.exports = TimerService;
