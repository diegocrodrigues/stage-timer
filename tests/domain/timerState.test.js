const t = require('../../server/domain/timerState');

describe('timerState.create', () => {
  it('returns default state', () => {
    expect(t.create()).toEqual({
      status: 'stopped',
      mode: 'countdown',
      totalSeconds: 0,
      remainingSeconds: 0,
      emergencyMessage: null,
    });
  });

  it('merges overrides', () => {
    const state = t.create({ totalSeconds: 60, remainingSeconds: 60 });
    expect(state.totalSeconds).toBe(60);
    expect(state.status).toBe('stopped');
  });
});

describe('timerState.tick', () => {
  it('decrements countdown by 1', () => {
    const state = t.create({ mode: 'countdown', remainingSeconds: 10, status: 'running' });
    expect(t.tick(state).remainingSeconds).toBe(9);
  });

  it('does not go below 0', () => {
    const state = t.create({ mode: 'countdown', remainingSeconds: 0, status: 'running' });
    expect(t.tick(state).remainingSeconds).toBe(0);
  });

  it('sets status to stopped when countdown reaches 0', () => {
    const state = t.create({ mode: 'countdown', remainingSeconds: 1, status: 'running' });
    expect(t.tick(state).status).toBe('stopped');
  });

  it('increments countup by 1', () => {
    const state = t.create({ mode: 'countup', remainingSeconds: 5, status: 'running' });
    expect(t.tick(state).remainingSeconds).toBe(6);
  });

  it('does not stop countup at 0', () => {
    const state = t.create({ mode: 'countup', remainingSeconds: 0, status: 'running' });
    expect(t.tick(state).status).toBe('running');
  });

  it('does not mutate the original state', () => {
    const state = t.create({ mode: 'countdown', remainingSeconds: 5, status: 'running' });
    t.tick(state);
    expect(state.remainingSeconds).toBe(5);
  });
});

describe('timerState.start', () => {
  it('transitions stopped → running', () => {
    const state = t.create({ mode: 'countdown', totalSeconds: 60, remainingSeconds: 60 });
    expect(t.start(state).status).toBe('running');
  });

  it('is idempotent when already running', () => {
    const state = t.create({ status: 'running', totalSeconds: 60, remainingSeconds: 60 });
    expect(t.start(state).status).toBe('running');
  });

  it('throws when countdown has no time set', () => {
    const state = t.create({ mode: 'countdown', remainingSeconds: 0 });
    expect(() => t.start(state)).toThrow('no time set');
  });

  it('starts countup even with 0 seconds', () => {
    const state = t.create({ mode: 'countup', remainingSeconds: 0 });
    expect(t.start(state).status).toBe('running');
  });
});

describe('timerState.pause', () => {
  it('transitions running → paused', () => {
    const state = t.create({ status: 'running' });
    expect(t.pause(state).status).toBe('paused');
  });

  it('is idempotent when already paused', () => {
    const state = t.create({ status: 'paused' });
    expect(t.pause(state).status).toBe('paused');
  });

  it('does not pause a stopped timer', () => {
    const state = t.create({ status: 'stopped' });
    expect(t.pause(state).status).toBe('stopped');
  });
});

describe('timerState.resume', () => {
  it('transitions paused → running', () => {
    const state = t.create({ status: 'paused' });
    expect(t.resume(state).status).toBe('running');
  });

  it('does not resume a stopped timer', () => {
    const state = t.create({ status: 'stopped' });
    expect(t.resume(state).status).toBe('stopped');
  });
});

describe('timerState.reset', () => {
  it('restores remainingSeconds to totalSeconds', () => {
    const state = t.create({ totalSeconds: 60, remainingSeconds: 20, status: 'running' });
    const reset = t.reset(state);
    expect(reset.remainingSeconds).toBe(60);
    expect(reset.status).toBe('stopped');
  });

  it('does not mutate original', () => {
    const state = t.create({ totalSeconds: 60, remainingSeconds: 20 });
    t.reset(state);
    expect(state.remainingSeconds).toBe(20);
  });
});

describe('timerState.setMessage', () => {
  it('sets emergencyMessage on state', () => {
    const state = t.create();
    expect(t.setMessage(state, 'ACABOU').emergencyMessage).toBe('ACABOU');
  });

  it('trims whitespace from message', () => {
    expect(t.setMessage(t.create(), '  ACABOU  ').emergencyMessage).toBe('ACABOU');
  });

  it('throws for empty string', () => {
    expect(() => t.setMessage(t.create(), '')).toThrow('message cannot be empty');
  });

  it('throws for whitespace-only string', () => {
    expect(() => t.setMessage(t.create(), '   ')).toThrow('message cannot be empty');
  });

  it('does not mutate original state', () => {
    const state = t.create({ emergencyMessage: null });
    t.setMessage(state, 'TEST');
    expect(state.emergencyMessage).toBeNull();
  });
});

describe('timerState.clearMessage', () => {
  it('sets emergencyMessage to null', () => {
    const state = t.create({ emergencyMessage: 'ACABOU' });
    expect(t.clearMessage(state).emergencyMessage).toBeNull();
  });

  it('is idempotent when already null', () => {
    expect(t.clearMessage(t.create()).emergencyMessage).toBeNull();
  });
});

describe('timerState.alertLevel', () => {
  it('returns normal for countup mode', () => {
    const state = t.create({ mode: 'countup', totalSeconds: 0, remainingSeconds: 10 });
    expect(t.alertLevel(state)).toBe('normal');
  });

  it('returns normal when totalSeconds is 0 (initial state)', () => {
    expect(t.alertLevel(t.create())).toBe('normal');
  });

  it('returns zero when remainingSeconds reaches 0 on a countdown', () => {
    const state = t.create({ mode: 'countdown', totalSeconds: 60, remainingSeconds: 0 });
    expect(t.alertLevel(state)).toBe('zero');
  });

  it('returns danger at exactly 20% remaining', () => {
    const state = t.create({ mode: 'countdown', totalSeconds: 100, remainingSeconds: 20 });
    expect(t.alertLevel(state)).toBe('danger');
  });

  it('returns danger below 20%', () => {
    const state = t.create({ mode: 'countdown', totalSeconds: 100, remainingSeconds: 10 });
    expect(t.alertLevel(state)).toBe('danger');
  });

  it('returns warning at exactly 30% remaining', () => {
    const state = t.create({ mode: 'countdown', totalSeconds: 100, remainingSeconds: 30 });
    expect(t.alertLevel(state)).toBe('warning');
  });

  it('returns warning between 20% and 30%', () => {
    const state = t.create({ mode: 'countdown', totalSeconds: 100, remainingSeconds: 25 });
    expect(t.alertLevel(state)).toBe('warning');
  });

  it('returns normal above 30%', () => {
    const state = t.create({ mode: 'countdown', totalSeconds: 100, remainingSeconds: 80 });
    expect(t.alertLevel(state)).toBe('normal');
  });
});

describe('timerState.setTime', () => {
  it('sets countdown mode when seconds > 0', () => {
    const state = t.setTime(t.create(), 300);
    expect(state.mode).toBe('countdown');
    expect(state.totalSeconds).toBe(300);
    expect(state.remainingSeconds).toBe(300);
    expect(state.status).toBe('stopped');
  });

  it('sets countup mode when seconds = 0', () => {
    const state = t.setTime(t.create(), 0);
    expect(state.mode).toBe('countup');
  });

  it('throws for negative seconds', () => {
    expect(() => t.setTime(t.create(), -1)).toThrow('invalid seconds');
  });

  it('throws for non-numeric input', () => {
    expect(() => t.setTime(t.create(), 'abc')).toThrow('invalid seconds');
    expect(() => t.setTime(t.create(), null)).toThrow('invalid seconds');
  });

  it('does not mutate original', () => {
    const state = t.create({ totalSeconds: 10 });
    t.setTime(state, 999);
    expect(state.totalSeconds).toBe(10);
  });
});
