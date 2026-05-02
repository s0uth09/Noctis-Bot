const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const EIGHTBALL = [
  'It is certain.','It is decidedly so.','Without a doubt.','Yes, definitely.',
  'You may rely on it.','As I see it, yes.','Most likely.','Outlook good.',
  'Yes.','Signs point to yes.','Reply hazy, try again.','Ask again later.',
  'Better not tell you now.','Cannot predict now.','Concentrate and ask again.',
  "Don't count on it.",'My reply is no.','My sources say no.',
  'Outlook not so good.','Very doubtful.',
];

const fun = {
  data: new SlashCommandBuilder()
    .setName('fun')
    .setDescription('Fun commands')
    .addSubcommand(s => s.setName('coinflip').setDescription('Flip a coin'))
    .addSubcommand(s => s.setName('8ball')
      .setDescription('Ask the magic 8-ball')
      .addStringOption(o => o.setName('question').setDescription('Your question').setRequired(true)))
    .addSubcommand(s => s.setName('choose')
      .setDescription('Choose between options')
      .addStringOption(o => o.setName('options').setDescription('Options separated by |').setRequired(true)))
    .addSubcommand(s => s.setName('roll')
      .setDescription('Roll dice')
      .addStringOption(o => o.setName('dice').setDescription('Dice notation e.g. 2d6 (default 1d6)')))
    .addSubcommand(s => s.setName('reverse')
      .setDescription('Reverse a string')
      .addStringOption(o => o.setName('text').setDescription('Text to reverse').setRequired(true))),

  async execute(i) {
    const sub = i.options.getSubcommand();

    if (sub === 'coinflip') {
      const result = Math.random() < 0.5 ? 'Heads 🪙' : 'Tails 🔵';
      return i.reply(`**${result}**`);
    }

    if (sub === '8ball') {
      const question = i.options.getString('question');
      const answer   = EIGHTBALL[Math.floor(Math.random() * EIGHTBALL.length)];
      const embed    = new EmbedBuilder()
        .setColor(0x7c3aed)
        .setTitle('🎱 Magic 8-Ball')
        .addFields(
          { name: 'Question', value: question },
          { name: 'Answer',   value: answer   },
        );
      return i.reply({ embeds: [embed] });
    }

    if (sub === 'choose') {
      const opts   = i.options.getString('options').split('|').map(o => o.trim()).filter(Boolean);
      const chosen = opts[Math.floor(Math.random() * opts.length)];
      return i.reply(`🎲 I choose: **${chosen}**`);
    }

    if (sub === 'roll') {
      const raw   = i.options.getString('dice') || '1d6';
      const match = raw.match(/^(\d+)d(\d+)$/i);
      if (!match) return i.reply({ content: '❌ Use notation like `2d6`.', ephemeral: true });
      const count = Math.min(parseInt(match[1]), 20);
      const sides = Math.min(parseInt(match[2]), 1000);
      const rolls = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1);
      const total = rolls.reduce((a, b) => a + b, 0);
      return i.reply(`🎲 **${raw}**: [${rolls.join(', ')}] = **${total}**`);
    }

    if (sub === 'reverse') {
      const text = i.options.getString('text');
      return i.reply(`🔄 **${[...text].reverse().join('')}**`);
    }
  },
};

module.exports = { fun };
