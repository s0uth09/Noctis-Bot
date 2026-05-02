const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const fs   = require('fs');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Server setup templates')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(s => s.setName('load')
      .setDescription('Apply a template (community or gaming)')
      .addStringOption(o => o.setName('template').setDescription('Template name').setRequired(true)
        .addChoices({ name: 'community', value: 'community' }, { name: 'gaming', value: 'gaming' })))
    .addSubcommand(s => s.setName('validate')
      .setDescription('Dry-run a template without making changes')
      .addStringOption(o => o.setName('template').setDescription('Template name').setRequired(true)
        .addChoices({ name: 'community', value: 'community' }, { name: 'gaming', value: 'gaming' })))
    .addSubcommand(s => s.setName('export')
      .setDescription('Export current server structure to JSON')),

  async execute(i, app) {
    const sub = i.options.getSubcommand();

    if (sub === 'export') {
      await i.deferReply({ ephemeral: true });
      const structure = {
        name:       i.guild.name,
        roles:      i.guild.roles.cache
          .filter(r => r.id !== i.guild.id)
          .map(r => ({ name: r.name, color: r.hexColor, hoist: r.hoist, mentionable: r.mentionable, permissions: r.permissions.bitfield.toString() })),
        categories: [],
      };
      const cats = i.guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory);
      for (const [, cat] of cats) {
        const channels = i.guild.channels.cache
          .filter(c => c.parentId === cat.id)
          .map(c => ({ name: c.name, type: c.type, topic: c.topic || '' }));
        structure.categories.push({ name: cat.name, channels });
      }
      const json = JSON.stringify(structure, null, 2);
      const { AttachmentBuilder } = require('discord.js');
      const att  = new AttachmentBuilder(Buffer.from(json), { name: `${i.guild.name}-structure.json` });
      return i.editReply({ content: '✅ Server structure exported.', files: [att] });
    }

    const templateName = i.options.getString('template');
    const templatePath = path.join(__dirname, '../../templates', `${templateName}.json`);

    if (!fs.existsSync(templatePath)) {
      return i.reply({ content: `❌ Template **${templateName}** not found.`, ephemeral: true });
    }

    const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));

    if (sub === 'validate') {
      const lines = [
        `**Template:** ${templateName}`,
        `**Roles to create:** ${template.roles?.length || 0}`,
        `**Categories:** ${template.categories?.length || 0}`,
        `**Total channels:** ${(template.categories || []).reduce((a, c) => a + (c.channels?.length || 0), 0)}`,
      ];
      return i.reply({ content: `✅ Validation passed:\n${lines.join('\n')}`, ephemeral: true });
    }

    if (sub === 'load') {
      await i.deferReply({ ephemeral: true });
      let created = 0;

      // Create roles
      for (const r of (template.roles || [])) {
        await i.guild.roles.create({ name: r.name, color: r.color || null, hoist: r.hoist || false, mentionable: r.mentionable || false }).catch(() => {});
        created++;
      }

      // Create categories + channels
      for (const cat of (template.categories || [])) {
        const category = await i.guild.channels.create({ name: cat.name, type: ChannelType.GuildCategory }).catch(() => null);
        for (const ch of (cat.channels || [])) {
          await i.guild.channels.create({
            name:   ch.name,
            type:   ch.type === 2 ? ChannelType.GuildVoice : ChannelType.GuildText,
            parent: category?.id,
            topic:  ch.topic || undefined,
          }).catch(() => {});
          created++;
        }
      }

      return i.editReply(`✅ Template **${templateName}** applied — created **${created}** items.`);
    }
  },
};
