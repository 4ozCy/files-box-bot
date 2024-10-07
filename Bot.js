const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, ActivityType } = require('discord.js');
const axios = require('axios');
const FormData = require('form-data');
const express = require('express');
const app = express();
const port = process.env.PORT || 8080;
require('dotenv').config();

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

app.get('/', (req, res) => {
    res.send('online');
});

const commands = [
    new SlashCommandBuilder()
        .setName('upload')
        .setDescription('Upload a file to the file hosting service')
        .addAttachmentOption(option =>
            option.setName('file')
                .setDescription('The file to upload')
                .setRequired(true)),
];

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT),
            { body: commands },
        );
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error('Error loading commands:', error);
    }
})();

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);

    client.user.setActivity({
        name: "https://files-box.vercel.app",
        type: ActivityType.Watching,
    });
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;

    if (interaction.commandName === 'upload') {
        const file = interaction.options.getAttachment('file');
        const fileUrl = file.url;

        const uploadingEmbed = new EmbedBuilder()
            .setTitle('Uploading Your File')
            .setDescription('Your file is now being uploaded. Please wait...')
            .setFooter({ text: 'Powered by: @n.int' });

        await interaction.deferReply({ ephemeral: false });
        await interaction.editReply({ embeds: [uploadingEmbed] });

        try {
            const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
            const formData = new FormData();
            formData.append('file', response.data, file.name);

            const uploadResponse = await axios.post('http://files-box.vercel.app/api/file/hosting', formData, {
                headers: formData.getHeaders(),
            });

            const hostedFileUrl = uploadResponse.data.fileUrl;

            const successEmbed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('File Uploaded Successfully')
                .setDescription(`(${hostedFileUrl})`)
                .setFooter({ text: 'Powered by: @n.int' });

            try {
                await interaction.user.send({ embeds: [successEmbed] });

                const dmSuccessEmbed = new EmbedBuilder()
                    .setTitle('File Uploaded')
                    .setDescription('Your file has been successfully uploaded! Check your DMs for the link.')
                    .setColor('#00FF00')
                    .setFooter({ text: 'Powered by: @n.int' });

                await interaction.editReply({ embeds: [dmSuccessEmbed], ephemeral: false });
            } catch (dmError) {
                console.error('Error sending DM:', dmError);

                const dmErrorEmbed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('DM Error')
                    .setDescription('Could not send the file link to your DMs. Please make sure your DMs are enabled.')
                    .setFooter({ text: 'Powered by: @n.int' });

                await interaction.editReply({ embeds: [dmErrorEmbed], ephemeral: false });
            }
        } catch (error) {
            console.error('Error uploading file:', error);

            const errorEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('File Upload Failed')
                .setDescription('There was an error uploading your file. Please try again later.')
                .setFooter({ text: 'Powered by: @n.int' });

            await interaction.editReply({ embeds: [errorEmbed], ephemeral: false });
        }
    }
});

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});

client.login(process.env.TOKEN);
