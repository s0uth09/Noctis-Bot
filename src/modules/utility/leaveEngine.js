'use strict';

module.exports = async function leaveEngine(member, app) {
  const gid  = member.guild.id;
  const chId = app.cfg.get(gid, 'leave_channel');
  if (!chId) return;

  const ch = await app.client.channels.fetch(chId).catch(() => null);
  if (!ch) return;

  const tpl = app.cfg.get(gid, 'leave_message')
    ?? '**{username}** has left **{server}**.';

  await ch.send(
    tpl
      .replace(/{user}/g,     `<@${member.id}>`)
      .replace(/{username}/g, member.user.username)
      .replace(/{server}/g,   member.guild.name)
      .replace(/{count}/g,    String(member.guild.memberCount))
  ).catch(() => {});
};
