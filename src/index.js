require('dotenv').config();
const { buildApp } = require('./core/app');

(async () => {
  if (!process.env.TOKEN) throw new Error('Missing TOKEN in .env');
  if (!process.env.CLIENT_ID) throw new Error('Missing CLIENT_ID in .env');

  const app = await buildApp();

  process.on('unhandledRejection', (e) => app.logger.error(e));
  process.on('uncaughtException',  (e) => app.logger.error(e));

  /** Flush logs and destroy voice connections before exiting */
  async function shutdown(signal) {
    app.logger.info(`Received ${signal} — shutting down gracefully...`);
    try {
      // Destroy all active voice connections
      for (const [guildId, q] of app.queues) {
        try { q.destroy(); } catch {}
      }
      // Flush async logger queue
      if (typeof app.logger.flush === 'function') {
        await app.logger.flush();
      }
    } catch {}
    process.exit(0);
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));

  await app.client.login(process.env.TOKEN);
})();
