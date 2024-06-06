const { Client, Intents, MessageActionRow, MessageButton, MessageEmbed, MessageAttachment } = require('discord.js');
const fs = require('fs');

const client = new Client({ 
    intents: [
        Intents.FLAGS.GUILDS,
        Intents.FLAGS.GUILD_MEMBERS,
        Intents.FLAGS.GUILD_BANS,
        Intents.FLAGS.GUILD_EMOJIS_AND_STICKERS,
        Intents.FLAGS.GUILD_INTEGRATIONS,
        Intents.FLAGS.GUILD_WEBHOOKS,
        Intents.FLAGS.GUILD_INVITES,
        Intents.FLAGS.GUILD_VOICE_STATES,
        Intents.FLAGS.GUILD_PRESENCES,
        Intents.FLAGS.GUILD_MESSAGES,
        Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
        Intents.FLAGS.GUILD_MESSAGE_TYPING,
        Intents.FLAGS.DIRECT_MESSAGES,
        Intents.FLAGS.DIRECT_MESSAGE_REACTIONS,
        Intents.FLAGS.DIRECT_MESSAGE_TYPING
    ]
});

const TOKEN = "";
const TICKET_CHANNEL_ID = "1119852476053598219";
const CATEGORY_ID = "1119961280040685569";
const SUPPORT_ROLE_ID = "1119846870525681694";
const TRANSCRIPT_CHANNEL_ID = "1246640831654526986";

const cooldowns = new Map();

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
    client.user.setActivity('tickets!', { type: 'WATCHING' });
});

client.on('messageCreate', async message => {
    if (message.channel.id === TICKET_CHANNEL_ID && message.content.toLowerCase() === '!openticket') {
        const now = Date.now();
        const cooldownAmount = 5 * 60 * 1000; // 5 minutes cooldown

        if (cooldowns.has(message.author.id)) {
            const expirationTime = cooldowns.get(message.author.id) + cooldownAmount;

            if (now < expirationTime) {
                const timeLeft = (expirationTime - now) / 1000;
                return message.reply(`Please wait ${timeLeft.toFixed(1)} more seconds before using this command again.`);
            }
        }

        cooldowns.set(message.author.id, now);
        setTimeout(() => cooldowns.delete(message.author.id), cooldownAmount);

        const embed = new MessageEmbed()
            .setTitle('Open a Ticket')
            .setDescription('Click the button below to open a ticket.')
            .setColor('#00AAFF');

        const row = new MessageActionRow()
            .addComponents(
                new MessageButton()
                    .setCustomId('open_ticket')
                    .setLabel('Open Ticket')
                    .setStyle('PRIMARY'),
            );

        await message.channel.send({ embeds: [embed], components: [row] });
    }

    if (message.content.toLowerCase() === '!ping') {
        const ping = Date.now() - message.createdTimestamp;
        message.reply(`Pong! Your ping is ${ping}ms`);
    }

    if (message.content.toLowerCase() === '!uptime') {
        const totalSeconds = (client.uptime / 1000);
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor(totalSeconds / 3600) % 24;
        const minutes = Math.floor(totalSeconds / 60) % 60;
        const seconds = Math.floor(totalSeconds % 60);
        const uptime = `${days}d ${hours}h ${minutes}m ${seconds}s`;
        message.reply(`Uptime: ${uptime}`);
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'open_ticket') {
        const ticketChannel = await interaction.guild.channels.create(interaction.user.username, {
            type: 'GUILD_TEXT',
            parent: CATEGORY_ID,
            permissionOverwrites: [
                {
                    id: interaction.guild.id,
                    deny: ['VIEW_CHANNEL'],
                },
                {
                    id: interaction.user.id,
                    allow: ['VIEW_CHANNEL', 'SEND_MESSAGES', 'READ_MESSAGE_HISTORY', 'ATTACH_FILES'],
                },
                {
                    id: SUPPORT_ROLE_ID,
                    allow: ['VIEW_CHANNEL', 'SEND_MESSAGES', 'READ_MESSAGE_HISTORY', 'ATTACH_FILES'],
                },
            ],
        });

        const ticketEmbed = new MessageEmbed()
            .setTitle('Ticket')
            .setDescription('Support will be with you shortly.\nClick the button below to close this ticket.')
            .setColor('#00AAFF');

        const row = new MessageActionRow()
            .addComponents(
                new MessageButton()
                    .setCustomId('close_ticket')
                    .setLabel('Close Ticket')
                    .setStyle('DANGER'),
            );

        await ticketChannel.send({ embeds: [ticketEmbed], components: [row] });
        await interaction.reply({ content: `Ticket created: ${ticketChannel}`, ephemeral: true });
    }

    if (interaction.customId === 'close_ticket') {
        const ticketChannel = interaction.channel;
        const messages = await fetchMessages(ticketChannel);
        const transcript = createTranscript(messages);
        const filename = `transcript-${ticketChannel.id}.txt`;

        fs.writeFileSync(filename, transcript);

        const transcriptChannel = client.channels.cache.get(TRANSCRIPT_CHANNEL_ID);
        const attachment = new MessageAttachment(filename);

        await transcriptChannel.send({ files: [attachment] });

        const users = [...new Set(messages.map(msg => msg.author.username))].join(', ');

        const transcriptEmbed = new MessageEmbed()
            .setTitle('Ticket Closed')
            .addField('Ticket Creator', interaction.user.username, true)
            .addField('Users Involved', users, true)
            .setColor('#FF0000');

        await transcriptChannel.send({ embeds: [transcriptEmbed] });

        fs.unlinkSync(filename);
        await ticketChannel.delete();
    }
});

async function fetchMessages(channel) {
    let messages = [];
    let lastMessageId = null;

    while (true) {
        const fetchedMessages = await channel.messages.fetch({ limit: 100, before: lastMessageId });
        if (fetchedMessages.size === 0) break;
        messages = messages.concat(Array.from(fetchedMessages.values()));
        lastMessageId = fetchedMessages.last().id;
    }

    return messages.reverse(); // Return messages in chronological order
}

function createTranscript(messages) {
    return messages.map(msg => `${msg.author.username}: ${msg.content}`).join('\n');
}

client.login(TOKEN);
