# Fix: Live TV Buffering — Extensionless Stream Detection & Proxy Fallback

## Root Cause

The player was branching on the URL **string** (`.ts` / `.m3u8` substring checks) to decide which engine to use. But the real stream type can only be known **after** following the HTTP 302 redirect and reading the response headers — not from the original URL. Because the raw IPTV URL has no extension, detection failed, the player fell back to the native `<video>` element, which can't play HLS in Chromium, and a hidden error-handling path then silently re-routed playback back through the local Node.js proxy — reintroducing the exact bottleneck the direct-connection approach was meant to eliminate.

## The Fix, in Three Parts

### 1. Never branch on the URL string — probe the resolved stream first

Since the app already runs with `webSecurity: false`, `fetch()` in the renderer can follow the 302 and inspect the real `Content-Type` and final URL *before* deciding which engine to hand it to. `fetch` follows redirects transparently and exposes the final URL via `response.url`.

```ts
// streamProbe.ts
export type StreamKind = 'hls' | 'ts' | 'unknown';

interface ProbeResult {
  kind: StreamKind;
  resolvedUrl: string;      // URL after following the 302
  contentType: string | null;
}

export async function probeStreamType(rawUrl: string): Promise<ProbeResult> {
  try {
    // HEAD first — cheap, most IPTV origins support it
    let res = await fetch(rawUrl, {
      method: 'HEAD',
      redirect: 'follow',
      headers: { 'User-Agent': 'VLC/3.0.16 LibVLC/3.0.16' },
    });

    // Some providers 405/403 on HEAD — fall back to a ranged GET
    if (!res.ok) {
      res = await fetch(rawUrl, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'User-Agent': 'VLC/3.0.16 LibVLC/3.0.16',
          Range: 'bytes=0-1024',
        },
      });
    }

    const resolvedUrl = res.url || rawUrl;
    const contentType = res.headers.get('content-type');

    const kind = classify(resolvedUrl, contentType);
    return { kind, resolvedUrl, contentType };
  } catch (err) {
    // Network-level failure — let the caller decide (e.g. try mpegts.js blind)
    return { kind: 'unknown', resolvedUrl: rawUrl, contentType: null };
  }
}

function classify(url: string, contentType: string | null): StreamKind {
  const ct = (contentType || '').toLowerCase();

  if (
    ct.includes('mpegurl') ||          // application/x-mpegurl, vnd.apple.mpegurl
    ct.includes('m3u8') ||
    url.includes('.m3u8')
  ) {
    return 'hls';
  }

  if (
    ct.includes('video/mp2t') ||
    ct.includes('mp2t') ||
    ct.includes('application/octet-stream') || // many IPTV panels mislabel raw TS this way
    url.includes('.ts')
  ) {
    return 'ts';
  }

  return 'unknown';
}
```

### 2. Rewire `WebVideoPlayer.tsx` to branch on the probe, not the raw source

```tsx
// WebVideoPlayer.tsx (relevant slice)
import Hls from 'hls.js';
import mpegts from 'mpegts.js';
import { probeStreamType } from './streamProbe';

async function initPlayer(rawSource: string, videoEl: HTMLVideoElement) {
  const { kind, resolvedUrl } = await probeStreamType(rawSource);

  switch (kind) {
    case 'hls': {
      if (Hls.isSupported()) {
        const hls = new Hls({
          // Let hls.js do its own redirect/manifest handling from here on
          xhrSetup: (xhr) => {
            xhr.setRequestHeader('User-Agent', 'VLC/3.0.16 LibVLC/3.0.16');
          },
        });
        hls.loadSource(resolvedUrl);
        hls.attachMedia(videoEl);
        return hls;
      }
      // Safari-only native HLS path — not relevant in Electron/Chromium, but kept for completeness
      videoEl.src = resolvedUrl;
      return null;
    }

    case 'ts': {
      const player = mpegts.createPlayer({
        type: 'mpegts',
        isLive: true,
        url: resolvedUrl,
      });
      player.attachMediaElement(videoEl);
      player.load();
      return player;
    }

    case 'unknown':
    default: {
      // Don't hand this to native <video> — it will just fail silently on HLS.
      // Try mpegts.js first (cheap probe internally), then hls.js as last resort.
      try {
        const player = mpegts.createPlayer({ type: 'mpegts', isLive: true, url: resolvedUrl });
        player.attachMediaElement(videoEl);
        player.load();
        return player;
      } catch {
        if (Hls.isSupported()) {
          const hls = new Hls();
          hls.loadSource(resolvedUrl);
          hls.attachMedia(videoEl);
          return hls;
        }
      }
      throw new Error(`Unable to determine stream type for ${rawSource}`);
    }
  }
}
```

Key change: **`resolvedUrl` (post-redirect) is what gets handed to `hls.js`/`mpegts.js`**, not the original extensionless URL. This also fixes a secondary bug that would surface even after adding type-sniffing: if the *pre-redirect* URL is passed into `hls.js`, it has to re-resolve the 302 itself on every request, adding latency to zapping. Resolving once up front and feeding `hls.js` the final playlist URL avoids that.

### 3. Find and kill the silent proxy fallback

The described "somehow, this failure causes the system to fallback to the old behavior" is almost certainly a `video.onerror` (or `MEDIA_ERR_SRC_NOT_SUPPORTED`) handler somewhere that catches native playback failure and retries through `/proxy?url=`. Search for anything like:

```ts
videoEl.addEventListener('error', () => {
  // this is the leak — find and remove/replace this
  loadViaProxy(originalUrl);
});
```

With the probe-first approach above, native `<video>` never gets an unsupported source in the first place, so that fallback path should never fire — but it's worth explicitly removing or gating it so a future bug doesn't quietly reintroduce the proxy bottleneck. Replace it with a hard failure (toast/error state) instead of a silent fallback, so any future stream-type mis-detection is visible immediately rather than degrading performance invisibly.

## One More Thing to Check

The `onBeforeSendHeaders` spoof is set globally in the main process — confirm it's also applied to the `fetch()` calls above if the probe runs from the renderer (it should inherit automatically since it's a `session`-level webRequest hook, but verify with a network trace, since some IPTV panels are picky about `Referer`/`Origin` too, not just `User-Agent`).

For zapping speed, consider skipping the HEAD/GET probe entirely for channels already watched this session — cache `resolvedUrl` + `kind` per channel ID for the session lifetime, since IPTV panels rarely change a channel's stream type mid-session.
