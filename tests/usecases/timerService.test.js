const TimerService = require('../../server/usecases/timerService');

// In-memory persistence stub
const memPersistence = () => ({
  load: (d) => ({ ...d }),
  save: jest.fn(),
});

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('TimerService — initialization', () => {
  it('loads state from persistence on creation', () => {
    const persistence = {
      load: () => ({ status: 'stopped', mode: 'countdown', totalSeconds: 120, remainingSeconds: 120 }),
      save: jest.fn(),
    };
    const svc = TimerService(persistence);
    expect(svc.getState().totalSeconds).toBe(120);
  });
});

describe('TimerService — execute', () => {
  it('SET_TIME sets time and saves', () => {
    const persistence = memPersistence();
    const svc = TimerService(persistence);
    svc.execute('SET_TIME', { seconds: 60 });
    expect(svc.getState().totalSeconds).toBe(60);
    expect(persistence.save).toHaveBeenCalled();
  });

  it('START transitions to running and calls onStateChange', () => {
    const onChange = jest.fn();
    const svc = TimerService(memPersistence(), onChange);
    svc.execute('SET_TIME', { seconds: 30 });
    onChange.mockClear();
    svc.execute('START');
    expect(svc.getState().status).toBe('running');
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ status: 'running' }));
  });

  it('PAUSE stops the tick', () => {
    const svc = TimerService(memPersistence());
    svc.execute('SET_TIME', { seconds: 10 });
    svc.execute('START');
    jest.advanceTimersByTime(2000);
    svc.execute('PAUSE');
    const afterPause = svc.getState().remainingSeconds;
    jest.advanceTimersByTime(5000);
    expect(svc.getState().remainingSeconds).toBe(afterPause);
    expect(svc.getState().status).toBe('paused');
  });

  it('RESUME restarts the tick from paused', () => {
    const svc = TimerService(memPersistence());
    svc.execute('SET_TIME', { seconds: 10 });
    svc.execute('START');
    jest.advanceTimersByTime(2000);
    svc.execute('PAUSE');
    svc.execute('RESUME');
    jest.advanceTimersByTime(3000);
    expect(svc.getState().remainingSeconds).toBe(5);
  });

  it('RESET restores remaining to total', () => {
    const svc = TimerService(memPersistence());
    svc.execute('SET_TIME', { seconds: 10 });
    svc.execute('START');
    jest.advanceTimersByTime(4000);
    svc.execute('RESET');
    expect(svc.getState().remainingSeconds).toBe(10);
    expect(svc.getState().status).toBe('stopped');
  });

  it('timer auto-stops when countdown reaches 0', () => {
    const svc = TimerService(memPersistence());
    svc.execute('SET_TIME', { seconds: 3 });
    svc.execute('START');
    jest.advanceTimersByTime(3000);
    expect(svc.getState().remainingSeconds).toBe(0);
    expect(svc.getState().status).toBe('stopped');
  });

  it('unknown action throws', () => {
    const svc = TimerService(memPersistence());
    expect(() => svc.execute('BORK')).toThrow('unknown action: BORK');
  });

  it('START without time throws', () => {
    const svc = TimerService(memPersistence());
    expect(() => svc.execute('START')).toThrow('no time set');
  });
});
