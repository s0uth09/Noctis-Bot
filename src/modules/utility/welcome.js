'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('welcome')
    .setDescription('Configure welcome and leave messages')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s.setName('setchannel')
      .setDescription('Set the welcome channel')
      .addChannelOption(o => o.setName('channel').setDescription('Channel').setRequired(true)))
    .addSubcommand(s => s.setName('setmessage')
      .setDescription('Set welcome message (variables: {user} {username} {server} {count})')
      .addStringOption(o => o.setName('message').setDescription('Template').setRequired(true)))
    .addSubcommand(s => s.setName('setdm')
      .setDescription('Set DM message sent on join (leave blank to disable)')
      .addStringOption(o => o.setName('message').setDescription('Template')))
    .addSubcommand(s => s.setName('setleave')
      .setDescription('Set leave channel and optional message')
      .addChannelOption(o => o.setName('channel').setDescription('Channel').setRequired(true))
      .addStringOption(o => o.setName('message').setDescription('Template')))
    .addSubcommand(s => s.setName('autorole')
      .setDescription('Set a role automatically assigned on join')
      .addRoleOption(o => o.setName('role').setDescription('Role (omit to clear)'))),

  async execute(i, app) {
    const sub = i.options.getSubcommand();
    const gid = i.guild.id;

    if (sub === 'setchannel') {
      app.cfg.set(gid, 'welcome_channel', i.options.getChannel('channel').id);
      return i.reply({ content: '✅ Welcome channel set.', ephemeral: true });
    }
    if (sub === 'setmessage') {
      app.cfg.set(gid, 'welcome_message', i.options.getString('message'));
      return i.reply({ content: '✅ Welcome message set.', ephemeral: true });
    }
    if (sub === 'setdm') {
      const msg = i.options.getString('message');
      msg ? app.cfg.set(gid, 'welcome_dm', msg) : app.cfg.del(gid, 'welcome_dm');
      return i.reply({ content: msg ? '✅ DM on join set.' : '✅ DM on join disabled.', ephemeral: true });
    }
    if (sub === 'setleave') {
      app.cfg.set(gid, 'leave_channel', i.options.getChannel('channel').id);
      const msg = i.options.getString('message');
      if (msg) app.cfg.set(gid, 'leave_message', msg);
      return i.reply({ content: '✅ Leave settings updated.', ephemeral: true });
    }
    if (sub === 'autorole') {
      const role = i.options.getRole('role');
      role ? app.cfg.set(gid, 'autorole', role.id) : app.cfg.del(gid, 'autorole');
      return i.reply({ content: role ? `✅ Auto-role → <@&${role.id}>.` : '✅ Auto-role cleared.', ephemeral: true });
    }
  },
};
