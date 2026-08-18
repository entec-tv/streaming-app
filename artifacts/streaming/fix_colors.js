const fs = require('fs');
const files = [
  'c:/streaming/artifacts/streaming/app/(tabs)/movies.tsx',
  'c:/streaming/artifacts/streaming/app/(tabs)/series.tsx',
  'c:/streaming/artifacts/streaming/app/(tabs)/catchup.tsx'
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  
  // Fix the floatingCardStyle
  content = content.replace(
    /backgroundColor:\s*"#0F1115",\s*borderRadius:\s*24,\s*borderWidth:\s*1,\s*borderColor:\s*"rgba\(255,255,255,0\.03\)"/g,
    'backgroundColor: colors.card,\n      borderRadius: 16,\n      borderWidth: 1,\n      borderColor: colors.border'
  );
  
  fs.writeFileSync(file, content);
  console.log(`Updated ${file}`);
});
