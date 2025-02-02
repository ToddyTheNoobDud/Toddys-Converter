import { REST, Routes } from "discord.js";
import { token, id } from "../../config.mjs";
import { Filereader } from "./filereader.mjs";

export const CommandHandler = async (client, rootPath) => {
    const rest = new REST({ version: "10" }).setToken(token);
    
    try {
        const allFiles = await Filereader(`${rootPath}/src/commands`);
        const commandsArray = [];

        for (const commandFile of allFiles) {
            try {
                const { Command } = await import(`file://${commandFile}`);

                if (!Command?.name || !Command?.description || Command?.ignore) continue;

                commandsArray.push({
                    name: Command.name,
                    description: Command.description,
                    type: 1,
                    options: Command.options || [],
                    autocomplete: Command.autocomplete || false,
                });
                client.slashCommands.set(Command.name, Command);
            } catch (err) {
                console.error(`Error loading command from ${commandFile}:`, err);
            }
        }

        if (commandsArray.length) {
            console.log("Started refreshing application (/) commands.");
            await rest.put(Routes.applicationCommands(id), { body: commandsArray });
            console.log(`Successfully reloaded ${commandsArray.length} application (/) commands.`);
        }

    } catch (error) {
        console.error("Failed to refresh application commands:", error);
        throw error;
    }
};