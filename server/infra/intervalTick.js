/**
 * Infra: IntervalTick
 *
 * Thin wrapper around setInterval.
 * Isolated here so the use-case layer never imports timers directly
 * (easier to test and replace with a fake in future).
 *
 * @param {() => void} onTick  Called every second while running.
 * @returns {{ start: () => void, stop: () => void, isRunning: () => boolean }}
 */
function IntervalTick(onTick) {
  let timer = null;

  return {
    start() {
      if (timer) return;
      timer = setInterval(onTick, 1000);
    },
    stop() {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    },
    isRunning() {
      return timer !== null;
    },
  };
}

module.exports = IntervalTick;
