export const Event = {
    name: "ready",
    runOnce: true,
    run: async (client) => {
        client.user.setActivity({ name: "🌟Made by mushroom0162, Kenium", type: 2, state: "🌊 Powered by AquaLink" });
 
        client.user.setStatus("idle");
        console.log(`logged in ${client.user.tag}`)
    }
}
