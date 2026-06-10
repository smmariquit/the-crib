const fs = require('fs');

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    // 1. Remove canvas container
    content = content.replace(/<div id="canvas-container"><\/div>\n?/, '');

    // 2. Update :root variables
    content = content.replace(/--accent-main: #00FFFF;/g, '--accent-main: #3B82F6;'); // Blue 500
    content = content.replace(/--accent-dark: #008B8B;/g, '--accent-dark: #2563EB;'); // Blue 600
    content = content.replace(/--accent-green: #00FFAA;/g, '--accent-green: #10B981;'); // Emerald 500
    content = content.replace(/--panel-border: rgba\(0, 255, 255, 0.15\);/g, '--panel-border: #1E293B;');

    // 3. Update body background
    content = content.replace(/background: radial-gradient\(.*?\);/g, 'background-color: #3b2b1f;');

    // 4. Remove neon glows
    content = content.replace(/box-shadow: 0 0 15px rgba\(0, 255, 255, 0.2\);/g, 'box-shadow: 0 4px 6px rgba(0,0,0,0.3);');
    content = content.replace(/filter: drop-shadow\(0 0 15px rgba\(0, 255, 255, 0.2\)\);/g, '');
    
    // 5. Update gradient texts
    content = content.replace(/linear-gradient\(135deg, #00FFFF 0%, #008B8B 100%\)/g, 'linear-gradient(135deg, #60A5FA 0%, #3B82F6 100%)');
    
    // 6. Update copy button background
    content = content.replace(/linear-gradient\(135deg, rgba\(0, 255, 255, 0.2\), rgba\(0, 139, 139, 0.3\)\)/g, '#2563EB');
    content = content.replace(/linear-gradient\(135deg, rgba\(0, 255, 255, 0.3\), rgba\(0, 139, 139, 0.5\)\)/g, '#1D4ED8');
    
    // 7. Update discord button background
    content = content.replace(/linear-gradient\(135deg, rgba\(88, 101, 242, 0.2\), rgba\(64, 78, 237, 0.4\)\)/g, '#5865F2');
    content = content.replace(/linear-gradient\(135deg, rgba\(88, 101, 242, 0.3\), rgba\(64, 78, 237, 0.6\)\)/g, '#4752C4');

    // 8. Update back button background (wiki)
    content = content.replace(/linear-gradient\(135deg, rgba\(0, 255, 255, 0.1\), rgba\(0, 139, 139, 0.2\)\)/g, '#1E293B');
    content = content.replace(/linear-gradient\(135deg, rgba\(0, 255, 255, 0.2\), rgba\(0, 139, 139, 0.4\)\)/g, '#334155');

    // Remove text shadows and neon box shadows
    content = content.replace(/text-shadow: 0 2px 4px rgba\(0,0,0,0.5\);/g, '');
    content = content.replace(/text-shadow: 0 0 10px rgba\(0, 255, 255, 0.5\);/g, '');
    content = content.replace(/box-shadow: 0 0 20px rgba\(0, 255, 255, 0.15\), inset 0 0 15px rgba\(0, 255, 255, 0.1\);/g, '');
    content = content.replace(/box-shadow: 0 10px 25px rgba\(0, 255, 255, 0.3\), inset 0 0 20px rgba\(0, 255, 255, 0.2\);/g, '');
    content = content.replace(/box-shadow: 0 0 20px rgba\(88, 101, 242, 0.15\), inset 0 0 15px rgba\(88, 101, 242, 0.1\);/g, '');
    content = content.replace(/box-shadow: 0 10px 25px rgba\(88, 101, 242, 0.3\), inset 0 0 20px rgba\(88, 101, 242, 0.2\);/g, '');
    content = content.replace(/box-shadow: 0 0 15px rgba\(0, 255, 255, 0.1\), inset 0 0 10px rgba\(0, 255, 255, 0.1\);/g, '');
    content = content.replace(/box-shadow: 0 10px 20px rgba\(0, 255, 255, 0.2\), inset 0 0 15px rgba\(0, 255, 255, 0.15\);/g, '');
    content = content.replace(/box-shadow: 0 0 10px var\(--accent-main\);/g, '');
    content = content.replace(/0 0 30px rgba\(0, 255, 255, 0.05\), /g, '');

    // 9. Replace scripts
    const dirtScript = `
    <script>
        function applyDirtBackground() {
            const canvas = document.createElement('canvas');
            canvas.width = 64; 
            canvas.height = 64;
            const ctx = canvas.getContext('2d');
            
            ctx.fillStyle = '#866043';
            ctx.fillRect(0, 0, 64, 64);
            
            const colors = ['#735238', '#5b3f29', '#966c4a', '#4c3321'];
            for(let i = 0; i < 16; i++) {
                for(let j = 0; j < 16; j++) {
                    if(Math.random() > 0.3) {
                        ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
                        ctx.fillRect(i * 4, j * 4, 4, 4);
                    }
                }
            }
            
            document.body.style.backgroundImage = 'url(' + canvas.toDataURL() + ')';
            document.body.style.backgroundRepeat = 'repeat';
            document.body.style.backgroundAttachment = 'fixed';
            
            // Add a dark overlay so panels remain highly readable
            const overlay = document.createElement('div');
            overlay.style.position = 'fixed';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.width = '100vw';
            overlay.style.height = '100vh';
            overlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
            overlay.style.zIndex = '-1';
            document.body.appendChild(overlay);
        }
        applyDirtBackground();
    </script>
</body>`;

    content = content.replace(/<script src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/three\.js[\s\S]*?<\/script>\s*<\/body>/, dirtScript);

    // Fix copy IP JS colors to match new non-neon
    content = content.replace(/linear-gradient\(135deg, rgba\(0, 255, 170, 0.2\), rgba\(0, 150, 100, 0.4\)\)/g, '#10B981');

    fs.writeFileSync(filePath, content);
}

processFile('index.html');
processFile('wiki/index.html');
console.log('Update complete.');
