'use strict';

const { check } = require('../infra/rateLimit');

module.exports = async function execute(i, cmd, app) {
  // Rate limit check
  const remaining = check(i.user.id, i.commandName);
  if (remaining > 0) {
    const secs = (remaining / 1000).toFixed(1);
    return i.reply({ content: `⏳ Slow down — try again in **${secs}s**.`, ephemeral: true }).catch(() => {});
  }

  try {
    await cmd.execute(i, app);
  } catch (e) {
    app.logger.error(e);
    const payload = { content: '⚠️ Something went wrong executing that command.', ephemeral: true };
    if (i.deferred || i.replied) {
      await i.editReply(payload).catch(() => {});
    } else {
      await i.reply(payload).catch(() => {});
    }
  }
};
