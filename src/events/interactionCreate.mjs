export const Event = {
    name: "interactionCreate",
    async run(client, interaction) {
        const command =
            client.slashCommands.get(interaction.commandName) ||
            (interaction.isStringSelectMenu() &&
                (client.selectMenus.get(interaction.customId) ||
                    client.selectMenus.get(interaction.values[0])));

        if (!command) return;

        try {
            if (interaction.isAutocomplete()) {
                await command.autocomplete(client, interaction);
            } else {
                await command.run(client, interaction);
            }
        } catch (error) {
            console.error("Error handling Error:", error);
        }
    },
};



