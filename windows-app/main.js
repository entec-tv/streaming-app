const { app, BrowserWindow } = require('electron');
const path = require('path');
const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');
const os = require('os');
const cp = require('child_process');
let ffmpeg = require('ffmpeg-static');
if (ffmpeg.includes('app.asar')) ffmpeg = ffmpeg.replace('app.asar', 'app.asar.unpacked');

let ffprobe = require('@ffprobe-installer/ffprobe').path;
if (ffprobe.includes('app.asar')) ffprobe = ffprobe.replace('app.asar', 'app.asar.unpacked');

// ==========================================
// GOOGLE SPEECH-TO-TEXT API KEYS
// ==========================================
// To enable webkitSpeechRecognition in Electron, place your Google API keys here:
// process.env.GOOGLE_API_KEY = 'YOUR_GOOGLE_API_KEY';
// process.env.GOOGLE_DEFAULT_CLIENT_ID = 'YOUR_CLIENT_ID';
// process.env.GOOGLE_DEFAULT_CLIENT_SECRET = 'YOUR_CLIENT_SECRET';
// ==========================================

const httpAgent = new http.Agent({ maxSockets: 100, keepAlive: true });
const httpsAgent = new https.Agent({ maxSockets: 100, rejectUnauthorized: false, keepAlive: true });

app.commandLine.appendSwitch('ignore-certificate-errors', 'true');
app.commandLine.appendSwitch('enable-features', 'PlatformHEVCDecoderSupport,ClearKeyCdm,Widevine,WebAudio');
app.commandLine.appendSwitch('enable-spatial-navigation');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('disable-features', 'AutoplayIgnoreWebAudio');
app.commandLine.appendSwitch('use-fake-ui-for-media-stream');
app.commandLine.appendSwitch('enable-precise-memory-info');

app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  event.preventDefault();
  callback(true);
});

process.on('uncaughtException', (err) => {
  console.error('[MAIN PROCESS UNCAUGHT EXCEPTION]:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[MAIN PROCESS UNHANDLED REJECTION]:', reason);
});

let mainWindow;
let server;
let serverPort = 1337;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    show: false,
    frame: false,
    thickFrame: true,
    autoHideMenuBar: true,
    title: 'ENTEC Streaming',
    icon: path.join(__dirname, 'build/icon.png'),
    backgroundColor: '#05070a',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      autoplayPolicy: 'no-user-gesture-required',
    },
  });

  mainWindow.setMenu(null);

  const isDev = process.argv.includes('--dev');
  mainWindow.loadURL(isDev ? 'http://localhost:8081' : `http://localhost:${serverPort}`);

  mainWindow.once('ready-to-show', async () => {
    mainWindow.webContents.setAudioMuted(false);
    mainWindow.setFullScreen(true);
    mainWindow.show();
  });

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[FRONTEND]: ${message}`);
  });

  // Keep title even if page changes it
  mainWindow.on('page-title-updated', (e) => {
    e.preventDefault();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.session.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
    if (permission === 'media') {
      return true;
    }
    return false;
  });

  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback, details) => {
    if (permission === 'media') {
      callback(true);
    } else {
      callback(false);
    }
  });

  // Spoof User-Agent to match VLC so IPTV providers don't block direct connections
  mainWindow.webContents.session.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['User-Agent'] = 'VLC/3.0.16 LibVLC/3.0.16';
    callback({ cancel: false, requestHeaders: details.requestHeaders });
  });
}

function startServer() {
  return new Promise((resolve) => {
    const expressApp = express();

    expressApp.use((req, res, next) => {
      if (req.url !== '/is_maximized') {
        console.log(`[SERVER GET]: ${req.url}`);
      }
      res.set({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Range',
        'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges, Content-Type'
      });
      if (req.method === 'OPTIONS' && !req.path.startsWith('/proxy')) {
        return res.status(204).end();
      }
      next();
    });

    expressApp.get('/log_error', (req, res) => {
      console.error('\n=== CLIENT ERROR ===\n', req.query.msg, req.query.stack, '\n====================\n');
      res.send('ok');
    });

    let dictationProcess;
    function getDictationProcess() {
      if (!dictationProcess) {
        const { spawn } = require('child_process');
        dictationProcess = spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', '-']);
        const initScript = `
          Add-Type -TypeDefinition @"
          using System;
          using System.Runtime.InteropServices;
          public class KeySender {
              [DllImport("user32.dll")]
              public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, int dwExtraInfo);
              public static void SendWinH() {
                  keybd_event(0x5B, 0, 0, 0); // LWIN down
                  keybd_event(0x48, 0, 0, 0); // H down
                  keybd_event(0x48, 0, 2, 0); // H up
                  keybd_event(0x5B, 0, 2, 0); // LWIN up
              }
          }
"@
        `;
        dictationProcess.stdin.write(initScript + "\n");
        dictationProcess.on('error', (err) => console.error('Dictation PS error', err));
        dictationProcess.on('exit', () => { dictationProcess = null; });
      }
      return dictationProcess;
    }
    // Initialize it immediately so it compiles in the background
    getDictationProcess();

    expressApp.get('/api/dictate', (req, res) => {
      const ps = getDictationProcess();
      ps.stdin.write("[KeySender]::SendWinH()\n");
      res.send('ok');
    });

    expressApp.use(express.json({ limit: '200mb' }));
    expressApp.use(express.static(path.join(__dirname, 'app')));

    const appDataPath = path.join(app.getPath('userData'), 'AppCache');
    if (!fs.existsSync(appDataPath)) fs.mkdirSync(appDataPath, { recursive: true });

    expressApp.post('/api/cache/write', (req, res) => {
      try {
        const { key, data } = req.body;
        if (!key) {
          console.log('[CACHE WRITE ERROR] Missing key. Body keys:', Object.keys(req.body));
          return res.status(400).send('No key');
        }
        const p = path.join(appDataPath, key + '.json');
        console.log(`[CACHE WRITE] Writing ${data ? data.length : 0} bytes to ${p}`);
        fs.writeFileSync(p, data);
        res.send('ok');
      } catch (e) {
        console.error('[CACHE WRITE CATCH ERROR]:', e);
        res.status(500).send(e.message);
      }
    });

    expressApp.get('/api/cache/read', (req, res) => {
      try {
        const key = req.query.key;
        if (!key) return res.status(400).send('No key');
        const p = path.join(appDataPath, key + '.json');
        console.log(`[CACHE READ] Requested key: ${key}`);
        if (fs.existsSync(p)) {
          console.log(`[CACHE READ] Found ${key}.json`);
          res.sendFile(p);
        } else {
          console.log(`[CACHE READ] NOT FOUND: ${key}.json`);
          res.status(404).send('Not found');
        }
      } catch (e) {
        console.error('[CACHE READ ERROR]:', e);
        res.status(500).send(e.message);
      }
    });

    expressApp.delete('/api/cache/delete', (req, res) => {
      try {
        const key = req.query.key;
        if (!key) return res.status(400).send('No key');
        const p = path.join(appDataPath, key + '.json');
        if (fs.existsSync(p)) fs.unlinkSync(p);
        res.send('ok');
      } catch (e) {
        console.error('Cache delete error:', e);
        res.status(500).send(e.message);
      }
    });

    const activeConnections = new Map();

    expressApp.options('/proxy*', (req, res) => {
      res.set({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Range',
        'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges, Content-Type'
      });
      res.status(204).end();
    });

    expressApp.options('/proxy-vod', (req, res) => {
      res.set({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Range',
        'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges, Content-Type'
      });
      res.status(204).end();
    });

    const codecCache = new Map(); // url -> codec

    expressApp.get('/probe-vod', (req, res) => {
      const targetUrl = req.query.url;
      if (!targetUrl) return res.status(400).send('Missing url');

      const lowerTarget = (targetUrl || '').toLowerCase();
      const isLiveStream = lowerTarget.includes('/live/') || 
        lowerTarget.endsWith('.ts') || 
        lowerTarget.includes('.ts?');
      if (isLiveStream) {
        return res.json({ duration: 0, codec: 'h264', isLive: true });
      }

      if (codecCache.has(targetUrl)) {
         const cached = codecCache.get(targetUrl);
         return res.json({ duration: cached.duration || 0, codec: cached.codec || 'h264', cached: true });
      }

      res.set({
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      });

      const probeProcess = cp.spawn(ffmpeg, ['-i', targetUrl, '-t', '0']);
      let stderrData = '';
      probeProcess.stderr.on('data', (data) => {
        stderrData += data.toString();
      });
      
      const timeout = setTimeout(() => {
        probeProcess.kill();
        if (!res.headersSent) res.json({ duration: 0, codec: 'unknown' });
      }, 10000);

      probeProcess.on('close', () => {
        clearTimeout(timeout);
        let duration = 0;
        let codec = 'unknown';

        const durMatch = stderrData.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
        if (durMatch) {
           duration = parseInt(durMatch[1]) * 3600 + parseInt(durMatch[2]) * 60 + parseFloat(durMatch[3]);
        }

        const codecMatch = stderrData.match(/Stream #\d+:\d+(?:\[0x[0-9a-f]+\])?(?:\([a-z]+\))?: Video: ([a-zA-Z0-9_-]+)/);
        if (codecMatch && codecMatch[1]) {
           codec = codecMatch[1].toLowerCase();
        }

        codecCache.set(targetUrl, { codec, duration });
        if (!res.headersSent) res.json({ duration, codec });
      });
      probeProcess.on('error', () => {
        clearTimeout(timeout);
        if (!res.headersSent) res.json({ duration: 0, codec: 'unknown' });
      });
    });

    expressApp.options('/proxy-live', (req, res) => {
      res.set({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Range',
        'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges, Content-Type'
      });
      res.status(204).end();
    });

    expressApp.get('/probe-tracks', (req, res) => {
      const targetUrl = req.query.url;
      if (!targetUrl) return res.status(400).send('Missing url');

      const internalProxyUrl = `http://127.0.0.1:${serverPort}/proxy?url=${encodeURIComponent(targetUrl)}`;

      const args = [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_streams',
        internalProxyUrl
      ];

      cp.execFile(ffprobe, args, { maxBuffer: 1024 * 1024 * 10 }, (err, stdout, stderr) => {
        if (err) {
          console.error('[PROBE] ffprobe error:', err.message);
          return res.status(500).json({ error: 'Failed to probe tracks' });
        }
        try {
          const info = JSON.parse(stdout);
          const audioTracks = [];
          const subtitleTracks = [];

          info.streams?.forEach(stream => {
            if (stream.codec_type === 'audio') {
              const lang = stream.tags?.language;
              const defaultTitle = lang ? `Audio (${lang.toUpperCase()})` : `Audio ${stream.index}`;
              audioTracks.push({
                id: stream.index,
                language: lang || 'Unknown',
                title: stream.tags?.title || defaultTitle
              });
            } else if (stream.codec_type === 'subtitle') {
              const lang = stream.tags?.language;
              const defaultTitle = lang ? `Subtitle (${lang.toUpperCase()})` : `Subtitle ${stream.index}`;
              subtitleTracks.push({
                id: stream.index,
                language: lang || 'Unknown',
                title: stream.tags?.title || defaultTitle
              });
            }
          });
          res.json({ audioTracks, subtitleTracks });
        } catch (e) {
          res.status(500).json({ error: 'Failed to parse ffprobe output' });
        }
      });
    });

    expressApp.get('/proxy-sub', (req, res) => {
      const targetUrl = req.query.url;
      const trackId = req.query.track;
      console.log(`[PROXY-SUB] Requested subtitle track ${trackId} for ${targetUrl}`);
      if (!targetUrl || !trackId) return res.status(400).send('Missing params');

      const internalProxyUrl = `http://127.0.0.1:${serverPort}/proxy?url=${encodeURIComponent(targetUrl)}`;

      res.set({
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'text/vtt'
      });

      const ffmpegArgs = [
        '-i', internalProxyUrl,
        '-map', `0:${trackId}`,
        '-f', 'webvtt',
        'pipe:1'
      ];

      const ffmpegProcess = cp.spawn(ffmpeg, ffmpegArgs);
      ffmpegProcess.stdout.pipe(res);
      ffmpegProcess.stderr.on('data', d => console.log('[PROXY-SUB FFMPEG]:', d.toString()));
      
      req.on('close', () => {
        ffmpegProcess.kill('SIGKILL');
      });
    });

    expressApp.get('/proxy-live', (req, res) => {
      const targetUrl = req.query.url;
      if (!targetUrl) return res.status(400).send('Missing url');

      res.set({
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'video/x-matroska',
        'Transfer-Encoding': 'chunked'
      });

      const ffmpegArgs = [
        '-reconnect', '1',
        '-reconnect_streamed', '1',
        '-reconnect_delay_max', '5',
        '-i', targetUrl,
        '-c', 'copy',
        '-f', 'matroska',
        'pipe:1'
      ];

      const ffmpegProcess = cp.spawn(ffmpeg, ffmpegArgs);
      ffmpegProcess.stdout.pipe(res);

      req.on('close', () => {
        ffmpegProcess.kill('SIGKILL');
      });

      ffmpegProcess.on('error', (err) => {
        if (!res.headersSent) res.status(500).send('Transcoding Error');
      });
    });



    expressApp.get('/proxy-vod', (req, res) => {
      const targetUrl = req.query.url;
      const startTime = req.query.t;
      const clientCodec = req.query.codec;
      const audioTrack = req.query.audioTrack;
      if (!targetUrl) return res.status(400).send('Missing url');

      const forceTranscode = req.query.transcode === '1';
      let cached = codecCache.get(targetUrl);
      let codec = clientCodec || (cached ? cached.codec : null) || 'h264';
      
      const isHevc = codec === 'hevc' || codec === 'h265';
      const isMkv = targetUrl.toLowerCase().includes('.mkv');
      const unknownCodec = codec === 'unknown' || codec === 'h264';
      
      console.log(`[PROXY-VOD] Streaming VOD: ${targetUrl} starting at ${startTime || 0}s, codec: ${codec}`);

      res.set({
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'video/mp4',
        'Transfer-Encoding': 'chunked'
      });

      const ffmpegArgs = [
        '-reconnect', '1',
        '-reconnect_streamed', '1',
        '-reconnect_delay_max', '5',
        '-fflags', '+genpts+discardcorrupt',
        '-avoid_negative_ts', 'make_zero'
      ];

      if (startTime) {
        ffmpegArgs.push('-ss', startTime.toString());
      }

      const internalProxyUrl = `http://127.0.0.1:${serverPort}/proxy?url=${encodeURIComponent(targetUrl)}`;
      ffmpegArgs.push('-i', internalProxyUrl);
      
      if (audioTrack) {
        ffmpegArgs.push('-map', '0:v:0', '-map', `0:${audioTrack}`);
      }


      if (isHevc || forceTranscode || (isMkv && unknownCodec)) {
         ffmpegArgs.push('-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23');
      } else {
         ffmpegArgs.push('-c:v', 'copy');
      }

      ffmpegArgs.push(
        '-c:a', 'aac',
        '-b:a', '192k',
        '-f', 'mp4',
        '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
        '-frag_duration', '500000',
        'pipe:1'
      );

      const ffmpegProcess = cp.spawn(ffmpeg, ffmpegArgs);

      ffmpegProcess.stdout.pipe(res);

      ffmpegProcess.stderr.on('data', (data) => {
        console.log(`[ffmpeg]: ${data.toString()}`);
      });

      req.on('close', () => {
        console.log(`[PROXY-VOD] Client disconnected, killing ffmpeg`);
        ffmpegProcess.kill('SIGKILL');
      });

      ffmpegProcess.on('error', (err) => {
        console.error(`[PROXY-VOD] FFmpeg error: ${err.message}`);
        if (!res.headersSent) res.status(500).send('Transcoding Error');
      });
    });

    expressApp.all('/proxy*', async (req, res) => {
      let initialTargetUrl = req.query.url;
      if (!initialTargetUrl) return res.status(400).send('Missing url');

      // Removed forced conversion of live .ts to .m3u8 to allow raw MPEG-TS streaming.

      const isOriginalPlaylist = initialTargetUrl.includes('.m3u8') || initialTargetUrl.includes('.m3u');
      const streamKey = isOriginalPlaylist ? initialTargetUrl : null;

      if (streamKey && activeConnections.has(streamKey)) {
        console.log(`[PROXY] Closing previous connection for ${streamKey} to free up IPTV slot...`);
        const oldReq = activeConnections.get(streamKey);
        try { oldReq.destroy(); } catch (e) { }
        activeConnections.delete(streamKey);
      }

      if (req.destroyed) return;

      const makeRequest = (targetUrl, redirectsLeft) => {
        if (req.destroyed) return;

        console.log(`\n[PROXY START] ${req.method} Requesting: ${targetUrl}`);
        let parsedUrl;
        try {
          parsedUrl = new URL(targetUrl);
        } catch (err) {
          if (!res.headersSent) res.status(500).send('Invalid URL');
          return;
        }

        const isHttps = parsedUrl.protocol === 'https:';
        const client = isHttps ? https : http;

        const options = {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port,
          path: parsedUrl.pathname + parsedUrl.search,
          method: req.method,
          headers: {
            'User-Agent': 'VLC/3.0.16 LibVLC/3.0.16',
            'Accept': '*/*',
            'host': parsedUrl.host,
            ...(req.headers.range ? { 'Range': req.headers.range } : {})
          },
          agent: isHttps ? httpsAgent : httpAgent,
          rejectUnauthorized: false
        };

        const proxyReq = client.request(options, (proxyRes) => {
          console.log(`[PROXY RESPONSE] Status: ${proxyRes.statusCode}`);

          if ([301, 302, 303, 307, 308].includes(proxyRes.statusCode) && proxyRes.headers.location) {
            let redirectUrl = proxyRes.headers.location;
            if (!redirectUrl.startsWith('http')) {
              redirectUrl = new URL(redirectUrl, targetUrl).href;
            }

            if (redirectsLeft > 0) {
              console.log(`[PROXY REDIRECT] Following internal redirect to: ${redirectUrl}`);
              proxyRes.on('data', () => {}); // drain
              return makeRequest(redirectUrl, redirectsLeft - 1);
            } else {
              console.log(`[PROXY REDIRECT] Too many redirects, passing to client: ${redirectUrl}`);
              if (!res.headersSent) {
                const corsHeaders = {
                  'Access-Control-Allow-Origin': '*',
                  'Access-Control-Allow-Methods': 'GET, OPTIONS',
                  'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Range',
                  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges, Content-Type'
                };
                const newHeaders = { ...corsHeaders };
                newHeaders['Location'] = `/proxy?url=${encodeURIComponent(redirectUrl)}`;
                res.writeHead(proxyRes.statusCode, newHeaders);
                res.end();
              }
              proxyRes.on('data', () => {}); // drain
              return;
            }
          }

          const contentType = (proxyRes.headers['content-type'] || '').toLowerCase();
          const isPlaylistResponse = contentType.includes('mpegurl') || targetUrl.includes('.m3u8') || isOriginalPlaylist;
          console.log(`[PROXY RESPONSE] Content-Type: ${contentType}, isPlaylist: ${isPlaylistResponse}`);

          const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Range',
            'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges, Content-Type'
          };

          if (isPlaylistResponse && proxyRes.statusCode >= 200 && proxyRes.statusCode < 300) {
            let bodyBuffer = [];
            proxyRes.on('data', chunk => bodyBuffer.push(chunk));
            proxyRes.on('end', () => {
              const body = Buffer.concat(bodyBuffer).toString('utf-8');
              const lines = body.split('\n');
              const rewritten = lines.map(line => {
                line = line.trim();
                if (line && !line.startsWith('#')) {
                  if (!line.startsWith('http')) {
                    line = new URL(line, targetUrl).href;
                  }
                  return `/proxy?url=${encodeURIComponent(line)}`;
                }
                return line;
              });

              const newHeaders = { ...proxyRes.headers, ...corsHeaders };
              delete newHeaders['content-length'];

              if (!res.headersSent) {
                res.writeHead(proxyRes.statusCode, newHeaders);
                res.end(rewritten.join('\n'));
                console.log(`[PROXY PLAYLIST] Rewritten and sent.`);
              }
            });
          } else {
            const newHeaders = { ...proxyRes.headers, ...corsHeaders };
            if (!res.headersSent) {
              res.writeHead(proxyRes.statusCode, newHeaders);
              proxyRes.pipe(res);
            }
          }
        });

        proxyReq.on('error', (err) => {
          console.error(`[PROXY ERROR] ${err.message}`);
          if (!res.headersSent && !req.destroyed && !res.writableEnded) {
            try {
              res.status(500).send('Proxy Error');
            } catch (e) {
              console.error('[RES ERROR]', e.message);
            }
          }
        });

        if (streamKey) {
          activeConnections.set(streamKey, proxyReq);
        }

        req.on('close', () => {
          if (streamKey && activeConnections.get(streamKey) === proxyReq) {
            activeConnections.delete(streamKey);
          }
          if (!res.writableEnded) {
            proxyReq.destroy();
          }
        });

        proxyReq.end();
      };

      makeRequest(initialTargetUrl, 5);
    });

    expressApp.use(express.static(path.join(__dirname, 'app')));

    expressApp.get('/exit_app', (req, res) => {
      res.send('ok');
      app.quit();
    });

    expressApp.get('/api/local-video', (req, res) => {
      const videoPath = req.query.path;
      if (!videoPath || !fs.existsSync(videoPath)) {
        return res.status(404).send('Video not found');
      }

      const stat = fs.statSync(videoPath);
      const fileSize = stat.size;
      const range = req.headers.range;

      const ext = path.extname(videoPath).toLowerCase();
      let contentType = 'video/mp4';
      if (ext === '.mkv') contentType = 'video/x-matroska';
      else if (ext === '.webm') contentType = 'video/webm';

      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : Math.max(0, fileSize - 1);
        const chunksize = Math.max(0, (end - start) + 1);
        const file = fs.createReadStream(videoPath, { start, end });
        const head = {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': contentType,
        };
        res.writeHead(206, head);
        file.pipe(res);
      } else {
        const head = {
          'Content-Length': fileSize,
          'Content-Type': contentType,
        };
        res.writeHead(200, head);
        fs.createReadStream(videoPath).pipe(res);
      }
    });

    const activeDownloadsApp = new Map();

    expressApp.get('/api/download/start', (req, res) => {
      let urlStr = req.query.url;
      const id = req.query.id;
      if (!urlStr || !id) return res.status(400).send('Missing url or id');

      const downloadsDir = path.join(os.homedir(), 'Downloads', 'ENTEC');
      if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir, { recursive: true });

      const destPath = path.join(downloadsDir, `${id}.mp4`);

      // Clean up previous instance for this ID if any
      if (activeDownloadsApp.has(id)) {
        const old = activeDownloadsApp.get(id);
        old.status = 'canceled';
        if (old.watchdogTimer) clearInterval(old.watchdogTimer);
        if (old.response) {
          try { old.response.destroy(); } catch (e) {}
          old.response = null;
        }
        if (old.request) {
          try { old.request.destroy(); } catch (e) {}
          old.request = null;
        }
        if (old.fileStream) {
          try { old.fileStream.destroy(); } catch (e) {}
          old.fileStream = null;
        }
        activeDownloadsApp.delete(id);
      }

      // Check if file partially exists on disk to support auto-resume
      let initialDownloaded = 0;
      if (fs.existsSync(destPath)) {
        try {
          initialDownloaded = fs.statSync(destPath).size;
        } catch (e) {}
      }

      const item = {
        id,
        progress: 0,
        status: 'downloading',
        localUri: destPath,
        request: null,
        response: null,
        fileStream: null,
        url: urlStr,
        downloadedBytes: initialDownloaded,
        totalBytes: 0,
        retryCount: 0,
        lastDataTime: Date.now(),
        watchdogTimer: null,
        resumeFunction: null
      };
      activeDownloadsApp.set(id, item);
      res.json({ localUri: destPath });

      const downloadFile = (targetUrl, redirectsLeft = 5, isResume = false) => {
        let parsedUrl;
        try { parsedUrl = new URL(targetUrl); } catch (e) {
          console.error(`[DOWNLOAD] Invalid URL: ${targetUrl}`);
          item.status = 'error';
          return;
        }

        const headers = { 
          'User-Agent': 'VLC/3.0.18 LibVLC/3.0.18', 
          'Accept': '*/*',
          'Accept-Encoding': 'identity',
          'Connection': 'keep-alive'
        };
        if (item.downloadedBytes > 0) {
          headers['Range'] = `bytes=${item.downloadedBytes}-`;
        }

        const client = parsedUrl.protocol === 'https:' ? https : http;
        const request = client.get(targetUrl, {
          headers: headers,
          agent: parsedUrl.protocol === 'https:' ? httpsAgent : httpAgent,
        }, (response) => {
          item.response = response;
          if (item.status === 'canceled' || item.status === 'paused') {
            response.destroy();
            return;
          }

          if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
            let redirectUrl = response.headers.location;
            if (!redirectUrl.startsWith('http')) {
              redirectUrl = new URL(redirectUrl, targetUrl).href;
            }
            if (redirectsLeft > 0) {
              response.resume(); // drain
              return downloadFile(redirectUrl, redirectsLeft - 1, isResume);
            }
          }

          // Handle 416 Range Not Satisfiable (file already fully downloaded)
          if (response.statusCode === 416) {
            response.resume();
            if (item.downloadedBytes > 0) {
              item.status = 'completed';
              item.progress = 1;
              console.log(`[DOWNLOAD COMPLETED] (${id}): 416 Range fully satisfied.`);
            } else {
              item.status = 'error';
            }
            return;
          }

          // Handle HTTP server errors (e.g. 502 Bad Gateway from IPTV CDN, 503, 429)
          if (response.statusCode >= 400) {
            console.warn(`[DOWNLOAD HTTP ${response.statusCode}] (${id}) from ${targetUrl}`);
            response.resume();
            if (item.retryCount < 10 && item.status === 'downloading') {
              item.retryCount++;
              const backoff = Math.min(10000, 1500 * item.retryCount);
              console.log(`[DOWNLOAD RETRY] (${id}): Server returned ${response.statusCode}. Retrying in ${backoff}ms (attempt ${item.retryCount}/10)...`);
              setTimeout(() => {
                if (item.status === 'downloading') {
                  downloadFile(item.url, 5, true);
                }
              }, backoff);
            } else {
              item.status = 'error';
            }
            return;
          }

          // Reset retry count on successful response
          item.retryCount = 0;

          // Extract totalBytes from Content-Range or Content-Length
          const contentRange = response.headers['content-range'];
          if (contentRange) {
            const match = contentRange.match(/\/(\d+)/);
            if (match) item.totalBytes = parseInt(match[1], 10);
          }
          if (!item.totalBytes) {
            const contentLength = parseInt(response.headers['content-length'] || '0', 10);
            if (contentLength > 0) {
              item.totalBytes = contentLength + (response.statusCode === 206 ? item.downloadedBytes : 0);
            }
          }

          if (item.totalBytes > 0 && item.downloadedBytes > 0) {
            item.progress = Math.min(1, item.downloadedBytes / item.totalBytes);
          }

          try {
            if (item.fileStream) {
              try { item.fileStream.destroy(); } catch (e) {}
              item.fileStream = null;
            }

            const useAppend = (item.downloadedBytes > 0 && response.statusCode === 206);
            if (!useAppend && !isResume) {
              item.downloadedBytes = 0;
            }

            const fileStream = fs.createWriteStream(item.localUri, { flags: useAppend ? 'a' : 'w' });
            fileStream.on('error', (fsErr) => {
              console.error(`[DOWNLOAD FILESTREAM ERROR] (${id}):`, fsErr.message);
              item.status = 'error';
              if (item.watchdogTimer) clearInterval(item.watchdogTimer);
              if (item.request) {
                try { item.request.destroy(); } catch (e) {}
                item.request = null;
              }
            });
            item.fileStream = fileStream;

            item.lastDataTime = Date.now();
            if (item.watchdogTimer) clearInterval(item.watchdogTimer);
            item.watchdogTimer = setInterval(() => {
              if (item.status !== 'downloading') {
                clearInterval(item.watchdogTimer);
                return;
              }
              // If no data chunks arrived for 20 seconds, connection has stalled
              if (Date.now() - item.lastDataTime > 20000) {
                console.warn(`[DOWNLOAD STALL DETECTED] (${id}): No data for 20s. Auto-reconnecting...`);
                clearInterval(item.watchdogTimer);
                if (item.request) {
                  try { item.request.destroy(); } catch (e) {}
                  item.request = null;
                }
                if (item.fileStream) {
                  try { item.fileStream.destroy(); } catch (e) {}
                  item.fileStream = null;
                }
                if (item.retryCount < 10) {
                  item.retryCount++;
                  setTimeout(() => {
                    if (item.status === 'downloading') {
                      downloadFile(item.url, 5, true);
                    }
                  }, 2000);
                } else {
                  item.status = 'error';
                }
              }
            }, 5000);

            response.on('data', (chunk) => {
              if (item.status === 'canceled' || item.status === 'paused') {
                response.destroy();
                return;
              }
              item.lastDataTime = Date.now();
              item.downloadedBytes += chunk.length;
              if (item.totalBytes > 0) {
                item.progress = Math.min(1, item.downloadedBytes / item.totalBytes);
              }
            });

            response.pipe(fileStream);

            const handleStreamFinished = () => {
              if (item.watchdogTimer) clearInterval(item.watchdogTimer);
              if (item.status === 'canceled' || item.status === 'paused') return;

              // Check if completed or closed prematurely by server/CDN
              if (item.totalBytes > 0 && item.downloadedBytes < item.totalBytes) {
                console.warn(`[DOWNLOAD PREMATURE CLOSE] (${id}): Received ${item.downloadedBytes} of ${item.totalBytes} bytes. Auto-resuming in 2s...`);
                if (item.fileStream) {
                  try { item.fileStream.destroy(); } catch (e) {}
                  item.fileStream = null;
                }
                if (item.retryCount < 15) {
                  item.retryCount++;
                  setTimeout(() => {
                    if (item.status === 'downloading') {
                      downloadFile(item.url, 5, true);
                    }
                  }, 2000);
                } else {
                  item.status = 'error';
                }
              } else {
                item.status = 'completed';
                item.progress = 1;
                console.log(`[DOWNLOAD COMPLETED] (${id}): Successfully finished downloading ${item.downloadedBytes} bytes.`);
              }
            };

            response.on('end', handleStreamFinished);
            response.on('close', () => {
              if (!response.complete && item.status === 'downloading') {
                handleStreamFinished();
              }
            });
          } catch (streamErr) {
            console.error(`[DOWNLOAD STREAM INIT ERROR] (${id}):`, streamErr);
            item.status = 'error';
          }
        });

        request.setTimeout(25000, () => {
          console.warn(`[DOWNLOAD SOCKET TIMEOUT] (${id}): Socket timed out after 25s`);
          request.destroy(new Error('Socket timeout'));
        });

        request.on('error', (err) => {
          if (item.watchdogTimer) clearInterval(item.watchdogTimer);
          if (item.status === 'paused' || item.status === 'canceled') {
            return;
          }
          console.warn(`[DOWNLOAD HTTP ERROR] (${id}): ${err.message}. Retrying...`);
          if (item.fileStream) {
            try { item.fileStream.destroy(); } catch (e) {}
            item.fileStream = null;
          }
          if (item.retryCount < 10) {
            item.retryCount++;
            const delay = Math.min(10000, 2000 * item.retryCount);
            setTimeout(() => {
              if (item.status === 'downloading') {
                downloadFile(item.url, 5, true);
              }
            }, delay);
          } else {
            item.status = 'error';
          }
        });

        item.request = request;
      };

      item.resumeFunction = () => {
        if (fs.existsSync(destPath)) {
          try {
            item.downloadedBytes = fs.statSync(destPath).size;
          } catch (e) {}
        }
        item.retryCount = 0;
        downloadFile(item.url, 5, true);
      };

      downloadFile(urlStr, 5, initialDownloaded > 0);
    });

    expressApp.get('/api/download/status', (req, res) => {
      const result = {};
      for (const [id, data] of activeDownloadsApp.entries()) {
        result[id] = { 
          progress: data.progress, 
          status: data.status, 
          localUri: data.localUri,
          downloadedBytes: data.downloadedBytes,
          totalBytes: data.totalBytes
        };
      }
      res.json(result);
    });

    expressApp.get('/api/download/pause', (req, res) => {
      const id = req.query.id;
      if (activeDownloadsApp.has(id)) {
        const item = activeDownloadsApp.get(id);
        item.status = 'paused';
        if (item.watchdogTimer) clearInterval(item.watchdogTimer);
        if (item.response) {
          try { item.response.destroy(); } catch (e) {}
          item.response = null;
        }
        if (item.request) {
          try { item.request.destroy(); } catch (e) {}
          item.request = null;
        }
        if (item.fileStream) {
          try { item.fileStream.end(); } catch (e) {}
          item.fileStream = null;
        }
      }
      res.send('ok');
    });

    expressApp.get('/api/download/resume', (req, res) => {
      const id = req.query.id;
      const urlStr = req.query.url;
      if (activeDownloadsApp.has(id)) {
        const item = activeDownloadsApp.get(id);
        if (item.status === 'paused' || item.status === 'error') {
          item.status = 'downloading';
          if (item.resumeFunction) {
            item.resumeFunction();
          }
        }
      } else if (id && urlStr) {
        // Re-initiate if activeDownloadsApp lost it (e.g. app restart)
        const downloadsDir = path.join(os.homedir(), 'Downloads', 'ENTEC');
        const destPath = path.join(downloadsDir, `${id}.mp4`);
        if (fs.existsSync(destPath)) {
          // Trigger start which will auto-resume from existing size
          req.url = `/api/download/start?id=${encodeURIComponent(id)}&url=${encodeURIComponent(urlStr)}`;
        }
      }
      res.send('ok');
    });

    expressApp.get('/api/download/cancel', (req, res) => {
      const id = req.query.id;
      if (!id) return res.send('ok');

      let targetPath = null;
      if (activeDownloadsApp.has(id)) {
        const data = activeDownloadsApp.get(id);
        data.status = 'canceled';
        if (data.watchdogTimer) clearInterval(data.watchdogTimer);
        if (data.response) {
          try { data.response.destroy(); } catch (e) {}
          data.response = null;
        }
        if (data.request) {
          try { data.request.destroy(); } catch (e) {}
          data.request = null;
        }
        if (data.fileStream) {
          try { data.fileStream.destroy(); } catch (e) {}
          data.fileStream = null;
        }
        targetPath = data.localUri;
        activeDownloadsApp.delete(id);
      }

      if (!targetPath) {
        const downloadsDir = path.join(os.homedir(), 'Downloads', 'ENTEC');
        targetPath = path.join(downloadsDir, `${id}.mp4`);
      }

      const attemptUnlink = (retries = 5) => {
        fs.unlink(targetPath, (err) => {
          if (err && retries > 0 && (err.code === 'EPERM' || err.code === 'EBUSY')) {
            setTimeout(() => attemptUnlink(retries - 1), 250);
          }
        });
      };
      setTimeout(attemptUnlink, 100);
      res.send('ok');
    });

    expressApp.get('/exit_app', (req, res) => {
      res.send('ok');
      app.quit();
    });

    expressApp.get('/minimize_app', (req, res) => {
      res.send('ok');
      if (mainWindow) mainWindow.minimize();
    });

    expressApp.get('/maximize_app', (req, res) => {
      res.send('ok');
      if (mainWindow) {
        if (mainWindow.isFullScreen()) {
          mainWindow.setFullScreen(false);
          if (!mainWindow.isMaximized()) {
            mainWindow.maximize();
          }
        } else if (mainWindow.isMaximized()) {
          mainWindow.unmaximize();
        } else {
          mainWindow.maximize();
        }
      }
    });

    expressApp.get('/is_maximized', (req, res) => {
      if (mainWindow) {
        res.json({ isMaximized: mainWindow.isMaximized() });
      } else {
        res.json({ isMaximized: false });
      }
    });

    expressApp.get('/open_network_settings', (req, res) => {
      if (process.platform === 'win32') {
        cp.exec('start ms-settings:network-wifi', (err) => {
          if (err) console.error('Failed to open network settings:', err);
        });
      } else if (process.platform === 'darwin') {
        cp.exec('open x-apple.systempreferences:com.apple.preference.network', (err) => {
          if (err) console.error('Failed to open network settings:', err);
        });
      } else {
        cp.exec('nm-connection-editor', (err) => {
          if (err) console.error('Failed to open network settings:', err);
        });
      }
      res.json({ success: true });
    });

    expressApp.get('/open_settings', (req, res) => {
      if (process.platform === 'win32') {
        cp.exec('start ms-settings:', (err) => {
          if (err) console.error('Failed to open settings:', err);
        });
      } else if (process.platform === 'darwin') {
        cp.exec('open x-apple.systempreferences:', (err) => {
          if (err) console.error('Failed to open settings:', err);
        });
      } else {
        cp.exec('gnome-control-center', (err) => {
          if (err) console.error('Failed to open settings:', err);
        });
      }
      res.json({ success: true });
    });

    expressApp.get('/set_auto_boot', (req, res) => {
      const enabled = req.query.enabled === 'true';
      console.log(`[SERVER]: Setting auto-boot to ${enabled}`);
      app.setLoginItemSettings({
        openAtLogin: enabled,
        path: app.getPath('exe'),
      });
      res.json({ success: true });
    });

    expressApp.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'app/index.html'));
    });

    server = expressApp.listen(0, () => {
      serverPort = server.address().port;
      resolve();
    });
  });
}

app.whenReady().then(async () => {
  await startServer();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('quit', () => {
  if (server) {
    server.close();
  }
});
