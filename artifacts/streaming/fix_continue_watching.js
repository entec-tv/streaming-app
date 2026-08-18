const fs = require('fs');
const file = 'c:/streaming/artifacts/streaming/components/ContinueWatchingCard.tsx';

let content = fs.readFileSync(file, 'utf8');

// Fix formatDuration
content = content.replace(
  /function formatDuration\(sec: number\) {[\s\S]*?return `\$\{m\}:\$\{String\(s\)\.padStart\(2, '0'\)\}`;\n}/,
  `function formatDuration(sec: number) {
  if (sec == null || isNaN(sec) || sec <= 0) return '';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  
  if (h > 0) return \`\${h}:\${String(m).padStart(2, '0')}:\${String(s).padStart(2, '0')}\`;
  return \`\${m}:\${String(s).padStart(2, '0')}\`;
}`
);

// Fix title and time render
content = content.replace(
  /<Text style=\{styles\.title\} numberOfLines=\{1\}>\{item\.title\}<\/Text>\s*<Text style=\{styles\.time\}>\{formatDuration\(item\.duration\)\}<\/Text>/,
  `<Text style={styles.title} numberOfLines={1}>{item.title || 'Unknown'}</Text>
              <Text style={styles.time}>{item.isLive ? 'LIVE' : formatDuration(item.duration)}</Text>`
);

// Fix progress bar
content = content.replace(
  /<View style=\{styles\.progressContainer\}>\s*<View style=\{\[styles\.progressBar, \{ width: `\$\{percent\}%`, backgroundColor: colors\.gold \}\]\} \/>\s*<\/View>/,
  `{!item.isLive && (
              <View style={styles.progressContainer}>
                 <View style={[styles.progressBar, { width: \`\${percent}%\`, backgroundColor: colors.gold }]} />
              </View>
            )}`
);

fs.writeFileSync(file, content);
console.log('Fixed ContinueWatchingCard.tsx');
