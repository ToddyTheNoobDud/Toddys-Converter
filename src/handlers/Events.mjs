import fs from "fs/promises";
import path from "path";

export const EventHandler = async (client, rootPath) => {
    if (!client || !rootPath) {
        throw new Error('Client and rootPath are required parameters');
    }
    
    const eventsDir = path.join(rootPath, "src", "events");
    let eventFiles;

    try {
        eventFiles = await fs.readdir(eventsDir, { withFileTypes: true });
    } catch (error) {
        console.error("Failed to read events directory:", error);
        throw error; 
    }

    const validEventFiles = eventFiles.filter(file => 
        file.isFile() && /\.(js|mjs)$/.test(file.name)
    );

    const eventPromises = validEventFiles.map(async (eventFile) => {
        const eventPath = path.join(eventsDir, eventFile.name);
        try {
            const { Event } = await import(new URL(`file://${eventPath}`, import.meta.url));
            if (!Event || Event.ignore) return;

            const eventFunction = (...args) => {
                try {
                    return Event.run(client, ...args);
                } catch (error) {
                    console.error(`Error in event ${Event.name}:`, error);
                    client.removeListener(Event.name, eventFunction);
                }
            };

            if (Event.runOnce) {
                client.once(Event.name, eventFunction);
            } else {
                client.on(Event.name, eventFunction);
            }
        } catch (error) {
            console.error(`Failed to load event from file: ${eventPath}`, error);
        }
    });

    await Promise.allSettled(eventPromises);
};