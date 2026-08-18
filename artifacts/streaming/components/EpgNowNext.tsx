import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAppStore } from '@/store/app-store';
import { useColors } from '@/hooks/useColors';
import { base64Decode } from '@/lib/base64';

interface EpgNowNextProps {
  streamId: string;
}

interface EpgInfo {
  now?: string;
  next?: string;
  nowTime?: string;
  nextTime?: string;
}

// Global memory cache for EPG to prevent spamming the API
const epgCache = new Map<string, { data: EpgInfo, timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function EpgNowNext({ streamId }: EpgNowNextProps) {
  const colors = useColors();
  const [epgData, setEpgData] = useState<EpgInfo | null>(null);
  
  const activePlaylistId = useAppStore(s => s.activePlaylistId);
  const playlists = useAppStore(s => s.playlists);
  const moreOptions = useAppStore(s => s.moreOptions);

  const formatTime = (timeStr: string) => {
    try {
      if (!timeStr) return '';
      const date = new Date(timeStr.replace(' ', 'T'));
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const decodeIfNeeded = (str: string) => {
    if (!str) return '';
    try {
      if (/^[a-zA-Z0-9+/]+={0,2}$/.test(str) && str.length > 4 && !str.includes(' ')) {
        return base64Decode(str);
      }
      return str;
    } catch {
      return str;
    }
  };

  useEffect(() => {
    if (!moreOptions.liveTvEpg) return;
    if (!streamId) return;

    let isActive = true;
    const cacheKey = `${activePlaylistId}_${streamId}`;

    const cached = epgCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setEpgData(cached.data);
      return;
    }

    const timer = setTimeout(async () => {
      const p = playlists.find(x => x.id === activePlaylistId);
      if (!p) return;

      let config: any = null;
      if (p.url.startsWith('xtream://')) {
        try { config = JSON.parse(base64Decode(p.url.replace('xtream://', ''))); } catch {}
      } else {
        const match = p.url.match(/^(https?:\/\/[^/]+)\/get\.php\?username=([^&]+)&password=([^&]+)/);
        if (match) config = { host: match[1], username: match[2], password: match[3] };
      }

      if (!config) return;

      try {
        const url = `${config.host}/player_api.php?username=${config.username}&password=${config.password}&action=get_short_epg&stream_id=${streamId}&limit=2`;
        const res = await fetch(url);
        const data = await res.json();
        
        if (isActive && data && data.epg_listings && data.epg_listings.length > 0) {
          const listings = data.epg_listings;
          
          let nowTitle = '';
          let nowTime = '';
          let nextTitle = '';
          let nextTime = '';

          // Find current and next relative to now
          const nowMs = Date.now();
          
          for (const item of listings) {
            const startMs = item.start_timestamp ? parseInt(item.start_timestamp, 10) * 1000 : new Date(item.start.replace(' ', 'T')).getTime();
            const endMs = item.stop_timestamp ? parseInt(item.stop_timestamp, 10) * 1000 : new Date(item.end.replace(' ', 'T')).getTime();
            
            if (nowMs >= startMs && nowMs < endMs) {
              nowTitle = decodeIfNeeded(item.title);
              nowTime = `${formatTime(item.start)} - ${formatTime(item.end)}`;
            } else if (startMs > nowMs && !nextTitle) {
              nextTitle = decodeIfNeeded(item.title);
              nextTime = `${formatTime(item.start)} - ${formatTime(item.end)}`;
            }
          }

          // Fallback if timestamps are weird (just use index 0 and 1)
          if (!nowTitle && listings.length > 0) {
            nowTitle = decodeIfNeeded(listings[0].title);
            nowTime = `${formatTime(listings[0].start)} - ${formatTime(listings[0].end)}`;
            if (listings.length > 1) {
              nextTitle = decodeIfNeeded(listings[1].title);
              nextTime = `${formatTime(listings[1].start)} - ${formatTime(listings[1].end)}`;
            }
          }

          const info: EpgInfo = { now: nowTitle, nowTime, next: nextTitle, nextTime };
          if (info.now || info.next) {
            epgCache.set(cacheKey, { data: info, timestamp: Date.now() });
            setEpgData(info);
          }
        }
      } catch (err) {
        // Silently fail if EPG is not available for this channel
      }
    }, 500); // 500ms debounce

    return () => {
      isActive = false;
      clearTimeout(timer);
    };
  }, [streamId, activePlaylistId, playlists, moreOptions.liveTvEpg]);

  if (!moreOptions.liveTvEpg || (!epgData?.now && !epgData?.next)) {
    return null;
  }

  return (
    <View style={styles.container}>
      {epgData.now ? (
        <Text style={[styles.text, { color: colors.gold }]} numberOfLines={1}>
          ▶ {epgData.now} {epgData.nowTime ? `(${epgData.nowTime})` : ''}
        </Text>
      ) : null}
      {epgData.next ? (
        <Text style={[styles.text, { color: colors.mutedForeground }]} numberOfLines={1}>
          ⏭ {epgData.next} {epgData.nextTime ? `(${epgData.nextTime})` : ''}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 4,
    gap: 2,
  },
  text: {
    fontSize: 11,
    lineHeight: 14,
  }
});
