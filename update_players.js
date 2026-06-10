const fs = require('fs');

async function updatePlayers() {
    try {
        const response = await fetch('https://mcapi.us/server/status?ip=mc.stimmie.dev');
        const data = await response.json();
        const players = data.online ? data.players.now : 0;
        
        let content = fs.readFileSync('index.html', 'utf8');
        
        // Update the descriptions
        content = content.replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="Stimmie's survival Minecraft server that never resets! Join ${players} players currently online via mc.stimmie.dev">`);
        content = content.replace(/<meta name="twitter:description" content="[^"]*">/, `<meta name="twitter:description" content="Stimmie's survival Minecraft server that never resets! Join ${players} players currently online via mc.stimmie.dev">`);
        content = content.replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="Stimmie's survival Minecraft server that never resets! Join ${players} players currently online via Java & Bedrock crossplay at mc.stimmie.dev">`);
        
        fs.writeFileSync('index.html', content);
        console.log(`Updated player count to ${players}`);
    } catch (error) {
        console.error('Failed to fetch player count:', error);
        process.exit(1);
    }
}

updatePlayers();
