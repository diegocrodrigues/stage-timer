/**
 * Routes: timerRouter
 *
 * Translates HTTP requests into TimerService calls.
 * No business logic here — only parsing, delegation, and response.
 *
 * @param {ReturnType<import('../usecases/timerService')>} timerService
 * @returns {import('express').Router}
 */
const { Router } = require('express');
const logger     = require('../infra/logger');

function timerRouter(timerService) {
  const router = Router();

  router.get('/state', (_req, res) => {
    res.json(timerService.getState());
  });

  router.post('/command', (req, res) => {
    const { action, ...params } = req.body ?? {};
    logger.info({ action, params }, 'command received');
    try {
      const state = timerService.execute(action, params);
      res.json(state);
    } catch (err) {
      logger.warn({ action, err: err.message }, 'command rejected');
      res.status(400).json({ error: err.message });
    }
  });

  return router;
}

module.exports = timerRouter;
