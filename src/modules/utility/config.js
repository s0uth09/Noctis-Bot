'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

const SETTINGS = [
  { key: 'mod_log',             label: 'Mod log channel',                   type: 'channel' },
  { key: 'audit_channel',       label: 'Audit log channel',                 type: 'channel' },
  { key: 'birthday_channel',    label: 'Birthday announcement channel',     type: 'channel' },
  { key: 'birthday_role',       label: 'Birthday role (24h)',               type: 'role'    },
  { key: 'levelup_channel',     label: 'Level-up notification channel',     type: 'channel' },
  { key: 'xp_rate',             label: 'XP per message (default: 15)',      type: 'integer' },
  { key: 'xp_cooldown',         label: 'XP cooldown ms (default: 60000)',   type: 'integer' },
  { key: 'dj_role',             label: 'DJ role name',                      type: 'string'  },
  { key: 'warn_threshold',      label: 'Warn count that triggers auto-timeout', type: 'integer' },
  { key: 'warn_timeout',        label: 'Auto-timeout duration (minutes)',   type: 'integer' },
  { key: 'starboard_channel',   label: 'Starboard channel',                 type: 'channel' },
  { key: 'starboard_threshold', label: 'Starboard minimum ⭐ count (default: 3)', type: 'integer' },
];

module.exports = {
  data: (() => {
    const cmd = new SlashCommandBuilder()
      .setName('config')
      .setDescription('Configure bot settings for this server')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

    for (const s of SETTINGS) {
      cmd.addSubcommand(sub => {
        sub.setName(s.key).setDescription(s.label);
        if (s.type === 'channel') {
          sub.addChannelOption(o => o.setName('value').setDescription(s.label).setRequired(true));
        } else if (s.type === 'role') {
          sub.addRoleOption(o => o.setName('value').setDescription(s.label).setRequired(true));
        } else if (s.type === 'integer') {
          sub.addIntegerOption(o => o.setName('value').setDescription(s.label).setRequired(true).setMinValue(0));
        } else {
          sub.addStringOption(o => o.setName('value').setDescription(s.label).setRequired(true));
        }
        return sub;
      });
    }

    cmd.addSubcommand(s => s.setName('view').setDescription('View all current settings'));
    return cmd;
  })(),

  async execute(i, app) {
    const sub = i.options.getSubcommand();
    const gid = i.guild.id;

    if (sub === 'view') {
      const all   = app.cfg.getAll(gid);
      const embed = new EmbedBuilder()
        .setColor(0x7c3aed)
        .setTitle(`⚙️ Config — ${i.guild.name}`)
        .setDescription(
          SETTINGS.map(s => `**${s.key}**: \`${all[s.key] ?? '—'}\``).join('\n')
        );
      return i.reply({ embeds: [embed], ephemeral: true });
    }

    const setting = SETTINGS.find(s => s.key === sub);
    if (!setting) return i.reply({ content: '❌ Unknown setting.', ephemeral: true });

    let value;
    if (setting.type === 'channel')     value = i.options.getChannel('value').id;
    else if (setting.type === 'role')   value = i.options.getRole('value').id;
    else if (setting.type === 'integer')value = String(i.options.getInteger('value'));
    else                                 value = i.options.getString('value');

    app.cfg.set(gid, sub, value);
    return i.reply({ content: `✅ **${sub}** → \`${value}\``, ephemeral: true });
  },
};
