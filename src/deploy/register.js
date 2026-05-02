require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs   = require('fs');
const path = require('path');

const commands = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(full); continue; }
    if (!entry.name.endsWith('.js')) continue;

    const SKIP = new Set([
      'engine', 'musicQueue', 'resolver', 'rankCard',
      'modActions', 'funCommands', 'utilityCommands', 'controls',
      'buttonHandler', 'reactionHandler', 'welcomeEngine',
      'leaveEngine', 'afkEngine', 'selectHandler',
    ]);

    if (SKIP.has(entry.name.replace('.js', ''))) continue;

    try {
      const mod = require(full);
      if (mod?.data?.toJSON) {
        commands.push(mod.data.toJSON());
        console.log(`  ✓ ${mod.data.name}`);
      }
    } catch {}
  }
}

console.log('Collecting commands…');
walk(path.join(__dirname, '../modules'));
console.log(`\nRegistering ${commands.length} commands…`);

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
  await rest.put(
    Routes.applicationCommands(process.env.CLIENT_ID),
    { body: commands },
  );
  console.log('\n✅ All commands registered globally.');
})().catch(console.error);
