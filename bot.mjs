import {
  Client,
  GatewayIntentBits,
  Collection,
  EmbedBuilder,
  GatewayDispatchEvents
} from "discord.js";
import { token, mongourl } from "./config.mjs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Aqua } = require('aqualink');

const nodes = [{
  host: "23.132.28.2",
  password: "manialwaysforgettoupdatethisongithub",
  port: 1030,
  secure: false,
  name: "toddy's"
}];

const __dirname = dirname(fileURLToPath(import.meta.url));
export const rootPath = __dirname;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: ["CHANNEL"],
});


client.slashCommands = new Collection();
client.events = new Collection();
client.selectMenus = new Collection();
await import("./src/handlers/Command.mjs").then(({ CommandHandler }) => CommandHandler(client, rootPath));
await import("./src/handlers/Events.mjs").then(({ EventHandler }) => EventHandler(client, rootPath));
client.login(token);