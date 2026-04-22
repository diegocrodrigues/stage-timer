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
    let { action, ...params } = req.body ?? {};

    // Sanitize message text at the HTTP boundary — strip HTML tags before
    // passing to domain. Domain only validates (non-empty); it does not sanitize.
    if (typeof params.text === 'string') {
      params = { ...params, text: params.text.replace(/<[^>]*>/g, '').trim() };
    }

    logger.info({ action }, 'command received');
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
