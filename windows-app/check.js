const https = require('http');
https.get('http://tv.business-cdn-8k.com/live/bander/v4do31a759/54721.ts', (res) => {
  console.log('Live Status:', res.statusCode);
  res.destroy();
});
