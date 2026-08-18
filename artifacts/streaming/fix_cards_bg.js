const fs = require('fs');
const path = require('path');

const dir = 'c:/streaming/artifacts/streaming/app/(tabs)';
const files = ['movies.tsx', 'series.tsx', 'live.tsx', 'catchup.tsx'];

for (const file of files) {
  const fullPath = path.join(dir, file);
  if (fs.existsSync(fullPath)) {
    let content = fs.readFileSync(fullPath, 'utf8');
    
    // Replace backgroundColor: colors.card inside floatingCardStyle
    // Usually it looks like:
    // const floatingCardStyle = isLargeScreen ? {
    //   backgroundColor: colors.card,
    
    content = content.replace(
      /backgroundColor:\s*colors\.card,/g,
      "backgroundColor: colors.glass,"
    );
    
    fs.writeFileSync(fullPath, content);
    console.log('Fixed', file);
  }
}
