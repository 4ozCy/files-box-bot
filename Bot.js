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

        if (!file) {
            const errorEmbed = new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle('Error')
                .setDescription('Please attach a valid file.')
                .setTimestamp();

            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            return;
        }

        const initiationEmbed = new EmbedBuilder()
            .setTitle('File Upload Initiated')
            .setDescription(`Uploading **${file.name}**. Please wait...`)
            .setTimestamp();

        await interaction.reply({ embeds: [initiationEmbed], ephemeral: true });

        try {
            const formData = new FormData();
            formData.append('file', file.url, file.name);

            const response = await axios.post('https://files-box.onrender.com/api/file/host', formData, {
                headers: formData.getHeaders(),
            });

            if (response.status === 200 && response.data && response.data.url) {
                const hostedFileLink = response.data.url;

                const fileEmbed = new EmbedBuilder()
                    .setTitle('File Uploaded Successfully!')
                    .setDescription('Your file has been uploaded to the file hosting service.')
                    .addFields(
                        { name: 'File Name', value: file.name },
                        { name: 'Hosted File Link', value: `(${hostedFileLink})` }
                    )
                    .setTimestamp();

                try {
                    await interaction.user.send({ embeds: [fileEmbed] });

                    const dmConfirmationEmbed = new EmbedBuilder()
                        .setTitle('File Uploaded')
                        .setDescription('Check your DMs for the hosted file link.')
                        .setTimestamp();

                    await interaction.editReply({ embeds: [dmConfirmationEmbed], ephemeral: false });
                } catch (dmError) {
                    console.error('Error sending DM:', dmError);

                    const dmErrorEmbed = new EmbedBuilder()
                        .setColor(0xff0000)
                        .setTitle('DM Error')
                        .setDescription('Could not send the file link to your DMs. Please make sure your DMs are enabled.')
                        .setTimestamp();

                    await interaction.editReply({ embeds: [dmErrorEmbed], ephemeral: true });
                }
            } else {
                const uploadErrorEmbed = new EmbedBuilder()
                    .setColor(0xff0000)
                    .setTitle('Upload Error')
                    .setDescription('There was an error uploading the file. Please try again later.')
                    .setTimestamp();

                await interaction.editReply({ embeds: [uploadErrorEmbed], ephemeral: true });
            }
        } catch (error) {
            console.error('Error uploading the file:', error);

            const apiErrorEmbed = new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle('API Error')
                .setDescription('An error occurred while uploading the file. Please try again later.')
                .setTimestamp();

            await interaction.editReply({ embeds: [apiErrorEmbed], ephemeral: true });
        }
    }
});

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});

client.login(process.env.TOKEN);
