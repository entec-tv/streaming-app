const fs = require('fs'); 
['series.tsx', 'movies.tsx', 'catchup.tsx'].forEach(f => { 
  let p = 'c:/streaming/artifacts/streaming/app/(tabs)/' + f; 
  let c = fs.readFileSync(p, 'utf8'); 
  c = c.replace('overflow: "hidden"', 'overflow: "hidden" as const'); 
  fs.writeFileSync(p, c); 
});
