const fs = require('fs');
const path = require('path');

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let changed = false;

      // Replace styles.container, { backgroundColor: colors.background... }
      if (content.includes('backgroundColor: colors.background')) {
        content = content.replace(
          /backgroundColor:\s*colors\.background/g,
          (match, offset, string) => {
            // If it's a card or input, don't replace
            const context = string.substring(Math.max(0, offset - 50), Math.min(string.length, offset + 50));
            if (context.includes('styles.container') || context.includes('flex: 1') || fullPath.includes('login.tsx') || fullPath.includes('search.tsx') || context.includes('position: \'absolute\'')) {
              changed = true;
              return "backgroundColor: 'transparent'";
            }
            return match;
          }
        );
      }

      // Also fix index.tsx TV Layout specifically
      if (fullPath.endsWith('index.tsx') && content.includes("backgroundColor: '#000', opacity: isFocused")) {
        content = content.replace("backgroundColor: '#000', opacity: isFocused", "backgroundColor: 'transparent', opacity: isFocused");
        changed = true;
      }

      if (changed) {
        fs.writeFileSync(fullPath, content);
        console.log('Fixed', fullPath);
      }
    }
  }
}

processDir('c:/streaming/artifacts/streaming/app');
