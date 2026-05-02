'use strict';

const fs   = require('fs');
const path = require('path');

const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

// Non-blocking write stream — never blocks the event loop
const stream = fs.createWriteStream(path.join(logDir, 'bot.log'), { flags: 'a' });

const COLOUR = { INFO: '\x1b[36m', WARN: '\x1b[33m', ERROR: '\x1b[31m', RESET: '\x1b[0m' };

function stamp() { return new Date().toISOString(); }

function write(level, msg) {
  const text     = msg instanceof Error ? msg.stack : String(msg);
  const plain    = `[${stamp()}] [${level}] ${text}\n`;
  const coloured = `${COLOUR[level]}[${stamp()}] [${level}]${COLOUR.RESET} ${text}\n`;
  process.stdout.write(coloured);
  stream.write(plain);
}

module.exports = {
  info:  (m) => write('INFO',  m),
  warn:  (m) => write('WARN',  m),
  error: (m) => write('ERROR', m),
  /** Flush pending writes before process exit */
  flush: () => new Promise((res) => stream.end(res)),
};
