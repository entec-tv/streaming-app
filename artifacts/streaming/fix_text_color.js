const fs = require('fs');
const files = [
  'c:/streaming/artifacts/streaming/app/(tabs)/movies.tsx',
  'c:/streaming/artifacts/streaming/app/(tabs)/series.tsx',
  'c:/streaming/artifacts/streaming/app/(tabs)/catchup.tsx'
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  
  // Fix the category list text color
  content = content.replace(
    /color: focused \|\| isSelected \? colors\.gold : colors\.mutedForeground/g,
    'color: focused || isSelected ? colors.gold : colors.text'
  );
  
  fs.writeFileSync(file, content);
  console.log(`Updated text color in ${file}`);
});
