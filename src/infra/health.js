'use strict';

const http = require('http');

/**
 * Tiny HTTP health server for Railway / Render / uptime monitors.
 * Responds to GET / with JSON: { status, guilds, uptime, version }
 * Port is read from process.env.HEALTH_PORT (default 3000).
 * Set HEALTH_PORT=0 to disable.
 */
module.exports = function startHealth(app) {
  const port = Number(process.env.HEALTH_PORT ?? 3000);
  if (port === 0) return;

  const server = http.createServer((req, res) => {
    if (req.method !== 'GET') {
      res.writeHead(405).end();
      return;
    }
    const body = JSON.stringify({
      status:  'ok',
      guilds:  app.client.guilds.cache.size,
      uptime:  Math.floor(process.uptime()),
      version: process.env.npm_package_version ?? 'unknown',
    });
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(body);
  });

  server.listen(port, () => {
    app.logger.info(`🏥 Health endpoint listening on port ${port}`);
  });

  server.on('error', (e) => app.logger.warn(`Health server error: ${e.message}`));

  return server;
};
