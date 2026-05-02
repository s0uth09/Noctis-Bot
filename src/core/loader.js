const fs   = require('fs');
const path = require('path');

module.exports = function loader(app) {
  const modulesDir = path.join(__dirname, '../modules');

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!entry.name.endsWith('.js')) continue;

      const mod = require(full);

      // slash command module
      if (mod && mod.data && mod.execute) {
        app.commands.set(mod.data.name, mod);
        continue;
      }

      // event-listener / system bootstrap module (function)
      if (typeof mod === 'function') {
        mod(app);
      }
    }
  }

  walk(modulesDir);
  app.logger.info(`Loaded ${app.commands.size} commands`);
};
