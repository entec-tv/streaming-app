export type StreamKind = 'hls' | 'ts' | 'unknown';

interface ProbeResult {
  kind: StreamKind;
  resolvedUrl: string;      // URL after following the 302
  contentType: string | null;
}

// Simple in-memory cache to speed up zapping for channels we already probed
const probeCache = new Map<string, ProbeResult>();

export async function probeStreamType(rawUrl: string): Promise<ProbeResult> {
  if (probeCache.has(rawUrl)) {
    return probeCache.get(rawUrl)!;
  }

  try {
    // HEAD first — cheap, most IPTV origins support it
    let res = await fetch(rawUrl, {
      method: 'HEAD',
      redirect: 'follow',
    });

    // Some providers 405/403 on HEAD — fall back to a ranged GET
    if (!res.ok) {
      res = await fetch(rawUrl, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          Range: 'bytes=0-1024',
        },
      });
    }

    const resolvedUrl = res.url || rawUrl;
    const contentType = res.headers.get('content-type');

    const kind = classify(resolvedUrl, contentType);
    const result = { kind, resolvedUrl, contentType };
    
    // Cache the result for this session
    probeCache.set(rawUrl, result);
    return result;
  } catch (err) {
    console.warn('[streamProbe] Network-level failure during probe:', err);
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
