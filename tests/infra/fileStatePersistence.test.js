jest.mock('fs');

const fs          = require('fs');
const persistence = require('../../server/infra/fileStatePersistence');

const DEFAULT = { status: 'stopped', mode: 'countdown', totalSeconds: 0, remainingSeconds: 0 };

beforeEach(() => jest.clearAllMocks());

describe('fileStatePersistence.load', () => {
  it('returns default state when file does not exist (ENOENT)', () => {
    fs.readFileSync.mockImplementation(() => {
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    });
    expect(persistence.load(DEFAULT)).toEqual(DEFAULT);
  });

  it('returns merged state from disk, always forcing status to stopped', () => {
    fs.readFileSync.mockReturnValue(
      JSON.stringify({ totalSeconds: 60, remainingSeconds: 45, status: 'running' })
    );
    const result = persistence.load(DEFAULT);
    expect(result.totalSeconds).toBe(60);
    expect(result.remainingSeconds).toBe(45);
    expect(result.status).toBe('stopped'); // always reset on boot
  });

  it('returns default when file contains invalid JSON', () => {
    fs.readFileSync.mockReturnValue('not-json{{');
    expect(persistence.load(DEFAULT)).toEqual(DEFAULT);
  });
});

describe('fileStatePersistence.save', () => {
  it('writes JSON state to disk', () => {
    fs.mkdirSync.mockImplementation(() => {});
    fs.writeFileSync.mockImplementation(() => {});
    persistence.save({ status: 'running', remainingSeconds: 30 });
    expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
    const written = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
    expect(written.status).toBe('running');
  });

  it('swallows write errors without throwing', () => {
    fs.mkdirSync.mockImplementation(() => {});
    fs.writeFileSync.mockImplementation(() => { throw new Error('disk full'); });
    expect(() => persistence.save({ status: 'stopped' })).not.toThrow();
  });
});
