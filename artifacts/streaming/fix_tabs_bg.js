const fs = require('fs');

const file = 'c:/streaming/artifacts/streaming/app/(tabs)/_layout.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /colors=\{\['rgba\(5,7,10,1\)', 'rgba\(5,7,10,1\)', 'rgba\(5,7,10,1\)', 'rgba\(28,49,89,0\.35\)'\]\}/g,
  `colors={['transparent', 'transparent', 'rgba(5,7,10,0.5)', 'rgba(5,7,10,0.8)']}`
);

content = content.replace(
  /style=\{\[StyleSheet\.absoluteFillObject, \{ backgroundColor: '#05070a' \}\]\}/g,
  `style={[StyleSheet.absoluteFillObject]}`
);

fs.writeFileSync(file, content);
console.log('Fixed _layout.tsx (tabs)');
