const fs = require('fs');

const indexFile = 'c:/streaming/artifacts/streaming/app/(tabs)/index.tsx';
let idxContent = fs.readFileSync(indexFile, 'utf8');

idxContent = idxContent.replace(
  /const continueWatching = useAppStore\(\(state\) => state\.continueWatching\);/g,
  `const rawContinueWatching = useAppStore((state) => state.continueWatching);
  const continueWatching = React.useMemo(() => {
    return (rawContinueWatching || []).filter(item => 
      item && item.title && (item.type === 'live' || (item.duration > 0 && !isNaN(item.duration)))
    );
  }, [rawContinueWatching]);`
);

fs.writeFileSync(indexFile, idxContent);

const cwFile = 'c:/streaming/artifacts/streaming/app/continue-watching.tsx';
let cwContent = fs.readFileSync(cwFile, 'utf8');

cwContent = cwContent.replace(
  /const continueWatching = useAppStore\(\(s\) => s\.continueWatching\) \|\| \[\];/g,
  `const rawContinueWatching = useAppStore((s) => s.continueWatching) || [];
  const continueWatching = React.useMemo(() => {
    return rawContinueWatching.filter(item => 
      item && item.title && (item.type === 'live' || (item.duration > 0 && !isNaN(item.duration)))
    );
  }, [rawContinueWatching]);`
);

fs.writeFileSync(cwFile, cwContent);

console.log('Fixed Continue Watching list filtering');
