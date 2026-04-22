/**
 * Infra: FileStatePersistence
 *
 * Implements the persistence contract using the local filesystem.
 * Swap this module (e.g. for an in-memory or Redis version) without
 * touching any other layer — Dependency Inversion in practice.
 */

const fs   = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '../../data/state.json');

/**
 * Loads persisted state, merging over defaults.
 * Always resets status to 'stopped' on boot.
 *
 * @param {object} defaultState
 * @returns {object}
 */
function load(defaultState) {
  try {
    const saved = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return { ...defaultState, ...saved, status: 'stopped' };
  } catch {
    return { ...defaultState };
  }
}

/**
 * Persists state to disk. Non-critical — failures are swallowed
 * so a disk error never crashes the timer.
 *
 * @param {object} state
 */
function save(state) {
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(state, null, 2));
  } catch { /* non-critical */ }
}

module.exports = { load, save };
