import {
    EmbedBuilder,
    PermissionsBitField,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} from "discord.js";

const REQUIRED_PERMISSIONS = [
    PermissionsBitField.Flags.SendMessages,
    PermissionsBitField.Flags.ViewChannel,
    PermissionsBitField.Flags.EmbedLinks,
    PermissionsBitField.Flags.AttachFiles
];

function createWelcomeEmbed(client) {
    return new EmbedBuilder()
        .setColor(0x000000)
        .setTitle('About Kenium - Your Open Source Bot')
        .setDescription(`
**🎶 Thanks for inviting Kenium!**
**Key Features:**
- 🎵 **Optimized Music**: Fast playback and support for YouTube, Spotify, SoundCloud, and more.
- 🎶 **Search & Queue**: Manage your queue and search easily.
- 📁 **Playlist Management**: Import/Export playlists in .txt or .pdf.
- 📜 **Lyrics Support**: Powered by Genius & LyricFind.
- ⚡ **24/7 Uptime**: Hosted for performance.
- 🎶 **Start now**: Using </play:1254868331748528302>
        `.trim())
        .setTimestamp()
        .setFooter({
            text: 'By mushroom0162 | Kenium v2.7.0',
            iconURL: client.user.displayAvatarURL()
        })
        .setThumbnail(client.user.displayAvatarURL());
}

function createActionRow() {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setLabel('Top.gg')
                .setURL('https://top.gg/bot/1202232935311495209')
                .setStyle(ButtonStyle.Link),
            new ButtonBuilder()
                .setLabel('Invite to Discord')
                .setURL('https://discord.com/oauth2/authorize?client_id=1202232935311495209')
                .setStyle(ButtonStyle.Link),
            new ButtonBuilder()
                .setLabel('Github')
                .setURL('https://github.com/ToddyTheNoobDud/Kenium-Music')
                .setStyle(ButtonStyle.Link)
        );
}

async function findSuitableChannel(guild, client) {
    const channels = [
        guild.publicUpdatesChannel,
        ...guild.channels.cache
            .filter(c => c.type === 0)
            .values()
    ];
    return channels.find(channel =>
        channel?.viewable &&
        channel?.permissionsFor(client.user)?.has(REQUIRED_PERMISSIONS)
    );
}
export const Event = {
    name: "guildCreate",
    runOnce: false,
    run: async (client, guild) => {
        const suitableChannel = await findSuitableChannel(guild, client);
        if (suitableChannel) {
            const welcomeEmbed = createWelcomeEmbed(client);
            const actionRow = createActionRow();
            await suitableChannel.send({ embeds: [welcomeEmbed], components: [actionRow] });
        } else {
            console.log(`No suitable channel found in guild: ${guild.name}`);
        }
    }
};