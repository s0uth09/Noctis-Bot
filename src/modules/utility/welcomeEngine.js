'use strict';

module.exports = async function welcomeEngine(member, app) {
  const gid = member.guild.id;
  const cfg = (key, def = null) => app.cfg.get(gid, key) ?? def;

  function render(tpl) {
    return tpl
      .replace(/{user}/g,     `<@${member.id}>`)
      .replace(/{username}/g, member.user.username)
      .replace(/{server}/g,   member.guild.name)
      .replace(/{count}/g,    String(member.guild.memberCount));
  }

  const chId = cfg('welcome_channel');
  if (chId) {
    const ch  = await app.client.channels.fetch(chId).catch(() => null);
    const tpl = cfg('welcome_message', 'Welcome {user} to **{server}**! You are member #{count}.');
    if (ch) await ch.send(render(tpl)).catch(() => {});
  }

  const dm = cfg('welcome_dm');
  if (dm) await member.send(render(dm)).catch(() => {});

  const roleId = cfg('autorole');
  if (roleId) await member.roles.add(roleId).catch(() => {});
};
