import { TVFocusable } from '@/components/TVFocusable';
import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  ActivityIndicator, 
  Dimensions, 
  Alert,
  Platform,
  useWindowDimensions
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Lineicons } from '@lineiconshq/react-native-lineicons';
import { MonitorBulk, ArrowRightBulk, ArrowLeftBulk, StopwatchBulk, PlayBulk } from '@lineiconshq/free-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useAppStore } from '@/store/app-store';
import { Channel } from '@/types';
import { useIsFocused } from '@react-navigation/native';
import { base64Decode } from '@/lib/base64';
import { MOCK_CHANNELS } from '@/lib/mock-data';

const SPECIAL_CATEGORIES = [
  { id: '__favorites__', name: 'Favorites' },
  { id: '__recent__', name: 'Recently Watched' }
];

interface EpgProgram {
  id: string;
  title: string;
  description: string;
  start: Date;
  end: Date;
  startTimestamp: number;
  endTimestamp: number;
  isPast: boolean;
  isCurrent: boolean;
  isFuture: boolean;
  rawStart?: string;
}

export default function CatchUpScreen() {
  const isFocused = useIsFocused();
  const colors = useColors();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isLargeScreen = width >= 800 || Platform.isTV;
  const isLandscape = width > height;

  const activePlaylistId = useAppStore((s) => s.activePlaylistId);
  const playlists = useAppStore((s) => s.playlists);
  const getChannelsByType = useAppStore((s) => s.getChannelsByType);
  const searchIndexReady = useAppStore((s) => s.searchIndexReady);

  const [liveChannels, setLiveChannels] = useState<Channel[]>([]);

  useEffect(() => {
    let active = true;
    const isMock = activePlaylistId === 'p1' || activePlaylistId === 'p2' || activePlaylistId === 'p3';
    if (isMock) {
      setLiveChannels(MOCK_CHANNELS.filter(c => c.type === 'live' && c.hasArchive));
    } else if (searchIndexReady) {
      getChannelsByType('live').then((channels: any[]) => {
        if (active) setLiveChannels(channels);
      });
    }
    return () => { active = false; };
  }, [activePlaylistId, getChannelsByType, searchIndexReady]);

  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [epgList, setEpgList] = useState<EpgProgram[]>([]);
  const [loadingEpg, setLoadingEpg] = useState(false);
  
  const days = useMemo(() => {
    const list = [];
    const now = new Date();
    for (let i = 0; i < 3; i++) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      
      const labelEn = i === 0 ? 'Today' : i === 1 ? 'Yesterday' : daysOfWeek[d.getDay()];

      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');

      list.push({
        dateString: `${y}-${m}-${day}`,
        label: `${labelEn} (${day}/${m})`
      });
    }
    return list;
  }, []);

  const [selectedDayIndex, setSelectedDayIndex] = useState(0);

  let catchupChannels = liveChannels.filter(c => c.hasArchive);

  // Pre-select first channel on TV
  useEffect(() => {
    if (isLargeScreen && catchupChannels.length > 0 && !selectedChannel) {
      setSelectedChannel(catchupChannels[0]);
    }
  }, [isLargeScreen, catchupChannels, selectedChannel]);

  useEffect(() => {
    if (!selectedChannel) return;
    
    let active = true;
    async function loadEpg() {
      setLoadingEpg(true);
      
      const p = playlists.find(x => x.id === activePlaylistId);
      const isXtream = p && (p.url.startsWith('xtream://') || p.url.includes('/get.php?'));

      if (isXtream && selectedChannel) {
        let config: any = null;
        try {
          if (p.url.startsWith('xtream://')) {
            config = JSON.parse(base64Decode(p.url.replace('xtream://', '')));
          } else {
            const match = p.url.match(/^(https?:\/\/[^/]+)\/get\.php\?username=([^&]+)&password=([^&]+)/);
            if (match) {
              config = { host: match[1], username: match[2], password: match[3] };
            }
          }
        } catch (e) {}

        if (config) {
          const channelId = selectedChannel.id.replace('xt_live_', '');
          const fetchUrl = `${config.host}/player_api.php?username=${config.username}&password=${config.password}&action=get_simple_data_table&stream_id=${channelId}`;
          
          const targetUrls = [
            fetchUrl
          ];

          let text = '';
          let fetched = false;
          for (let i = 0; i < targetUrls.length; i++) {
            const u = targetUrls[i];
            try {
              text = await new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('GET', u, true);
                xhr.timeout = 20000;
                try {
                  xhr.setRequestHeader('User-Agent', 'TiviMate/4.7.0');
                } catch (_) {}
                xhr.onload = () => {
                  if (xhr.status >= 200 && xhr.status < 300) {
                    if (xhr.responseText && xhr.responseText.trim().length > 0) resolve(xhr.responseText);
                    else reject(new Error('Empty'));
                  } else reject(new Error('HTTP status error'));
                };
                xhr.onerror = () => reject(new Error('Network error'));
                xhr.ontimeout = () => reject(new Error('Timeout'));
                xhr.send();
              });
              fetched = true;
              break;
            } catch (e) {}
          }

          if (fetched && active) {
            try {
              const data = JSON.parse(text);
              const listings = data?.epg_listings || [];
              if (Array.isArray(listings) && listings.length > 0) {
                const nowTime = Date.now();
                const mapped: EpgProgram[] = listings.map((item: any, idx: number) => {
                  const startMs = item.start_timestamp 
                    ? parseInt(item.start_timestamp, 10) * 1000 
                    : new Date(item.start.replace(' ', 'T')).getTime();
                  const endMs = item.stop_timestamp 
                    ? parseInt(item.stop_timestamp, 10) * 1000 
                    : new Date(item.end.replace(' ', 'T')).getTime();
                  
                  const isPast = endMs <= nowTime;
                  const isFuture = startMs > nowTime;
                  const isCurrent = nowTime >= startMs && nowTime < endMs;

                  const rawTitle = item.title || 'Broadcast Program';
                  const rawDesc = item.description || '';
                  
                  let parsedTitle = rawTitle;
                  let parsedDesc = rawDesc;
                  try {
                    if (/^[a-zA-Z0-9+/]+={0,2}$/.test(rawTitle) && rawTitle.length > 4) {
                      parsedTitle = base64Decode(rawTitle);
                    }
                    if (/^[a-zA-Z0-9+/]+={0,2}$/.test(rawDesc) && rawDesc.length > 4) {
                      parsedDesc = base64Decode(rawDesc);
                    }
                  } catch (_) {}

                  return {
                    id: item.id || `epg_l_${idx}`,
                    title: parsedTitle,
                    description: parsedDesc,
                    start: new Date(startMs),
                    end: new Date(endMs),
                    startTimestamp: startMs,
                    endTimestamp: endMs,
                    isPast,
                    isCurrent,
                    isFuture,
                    rawStart: item.start
                  };
                });
                
                setEpgList(mapped.sort((a, b) => a.startTimestamp - b.startTimestamp));
                setLoadingEpg(false);
                return;
              }
            } catch (err) {}
          }
        }
      }

      // Fallback: Generate mock EPG
      if (active) {
        const generated: EpgProgram[] = [];
        const now = new Date();
        for (let i = 0; i < 3; i++) {
          const targetDay = new Date();
          targetDay.setDate(now.getDate() - i);
          
          const slots = [
            { startHour: 0, endHour: 2, title: 'Late Night Movie', desc: 'An exciting thriller movie for late night entertainment.' },
            { startHour: 2, endHour: 6, title: 'Music Mix Live', desc: 'A collection of the greatest music hits of all times.' },
            { startHour: 6, endHour: 8, title: 'Morning EPG News', desc: 'Get the latest national and international news.' },
            { startHour: 8, endHour: 10, title: 'Good Morning', desc: 'Start your day with news, weather, and interviews.' },
            { startHour: 10, endHour: 12, title: 'Cooking Show', desc: 'Learn how to cook amazing international recipes.' },
            { startHour: 12, endHour: 14, title: 'Sports Special', desc: 'Weekly roundup of matches, results, and interviews.' },
            { startHour: 14, endHour: 16, title: 'Documentary Time', desc: 'Explore the wonders of nature and history.' },
            { startHour: 16, endHour: 18, title: 'Evening Series', desc: 'Episode of your favorite drama television series.' },
            { startHour: 18, endHour: 21, title: 'Prime Time Show', desc: 'Celebrity guest interviews and musical performances.' },
            { startHour: 21, endHour: 24, title: 'Blockbuster Cinema', desc: 'Premium award-winning action and drama films.' }
          ];

          slots.forEach((s, idx) => {
            const start = new Date(targetDay);
            start.setHours(s.startHour, 0, 0, 0);
            const end = new Date(targetDay);
            end.setHours(s.endHour, 0, 0, 0);
            
            const startTimestamp = start.getTime();
            const endTimestamp = end.getTime();
            const nowTime = now.getTime();
            
            const isPast = endTimestamp <= nowTime;
            const isFuture = startTimestamp > nowTime;
            const isCurrent = nowTime >= startTimestamp && nowTime < endTimestamp;

            generated.push({
              id: `epg_${i}_${idx}_${startTimestamp}`,
              title: s.title,
              description: s.desc,
              start,
              end,
              startTimestamp,
              endTimestamp,
              isPast,
              isCurrent,
              isFuture,
              rawStart: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')} ${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}:00`
            });
          });
        }
        setEpgList(generated.sort((a, b) => a.startTimestamp - b.startTimestamp));
      }
      setLoadingEpg(false);
    }

    loadEpg();

    return () => {
      active = false;
    };
  }, [selectedChannel, activePlaylistId, playlists]);

  const handlePlayProgram = (program: EpgProgram) => {
    if (!selectedChannel) return;
    if (program.isFuture) {
      Alert.alert(t('warning'), t('future_broadcast'));
      return;
    }

    const p = playlists.find(x => x.id === activePlaylistId);
    const isXtream = p && (p.url.startsWith('xtream://') || p.url.includes('/get.php?'));
    
    let playUrl = selectedChannel.streamUrl;

    if (isXtream) {
      let config: any = null;
      if (p.url.startsWith('xtream://')) {
        config = JSON.parse(base64Decode(p.url.replace('xtream://', '')));
      } else {
        const match = p.url.match(/^(https?:\/\/[^/]+)\/get\.php\?username=([^&]+)&password=([^&]+)/);
        if (match) {
          config = { host: match[1], username: match[2], password: match[3] };
        }
      }

      if (config) {
        const channelId = selectedChannel.id.replace('xt_live_', '');
        let startFormatted = '';
        if (program.rawStart) {
          // parse "2026-07-10 01:00:00" to "2026-07-10:01-00"
          const parts = program.rawStart.split(' ');
          if (parts.length === 2) {
            const timeParts = parts[1].split(':');
            startFormatted = `${parts[0]}:${timeParts[0]}-${timeParts[1]}`;
          }
        }
        
        if (!startFormatted) {
          const date = new Date(program.startTimestamp);
          const y = date.getUTCFullYear();
          const m = String(date.getUTCMonth() + 1).padStart(2, '0');
          const d = String(date.getUTCDate()).padStart(2, '0');
          const h = String(date.getUTCHours()).padStart(2, '0');
          const min = String(date.getUTCMinutes()).padStart(2, '0');
          startFormatted = `${y}-${m}-${d}:${h}-${min}`;
        }
        
        const durationMinutes = Math.max(1, Math.round((program.endTimestamp - program.startTimestamp) / 60000));
        const host = config.host.replace(/\/$/, '');
        // Use standard Xtream Catchup format: /timeshift/user/pass/duration/start/channel_id.m3u8
        playUrl = `${host}/timeshift/${config.username}/${config.password}/${durationMinutes}/${startFormatted}/${channelId}.m3u8`;
      }
    }

    router.push({
      pathname: '/player',
      params: {
        streamUrl: playUrl,
        title: `${selectedChannel.name} - ${program.title}`,
        isLive: 'false',
        quality: selectedChannel.quality || 'HD',
        current: program.title,
        next: ''
      }
    });
  };

  const formatTimeRange = (start: Date, end: Date) => {
    const formatTime = (d: Date) => {
      const h = String(d.getHours()).padStart(2, '0');
      const m = String(d.getMinutes()).padStart(2, '0');
      return `${h}:${m}`;
    };
    return `${formatTime(start)} - ${formatTime(end)}`;
  };

  const filteredEpg = useMemo(() => {
    if (days.length === 0) return [];
    const targetDateStr = days[selectedDayIndex].dateString;
    return epgList.filter(item => {
      const d = new Date(item.startTimestamp);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}` === targetDateStr;
    });
  }, [days, selectedDayIndex, epgList]);



  // --- TV Layout ---
  if (isLargeScreen) {
    const isWeb = Platform.OS === 'web';
    const glassPaneStyle: any = isWeb ? {
      backgroundColor: colors.glass || (colors.card + 'E6'),
      backdropFilter: 'blur(30px)',
      WebkitBackdropFilter: 'blur(30px)',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginTop: 12,
      marginBottom: 32,
      marginRight: 16,
      overflow: 'hidden',
    } : {
      backgroundColor: colors.glass || (colors.card + 'E6'),
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginTop: 12,
      marginBottom: 32,
      marginRight: 16,
      overflow: 'hidden',
    };

    return (
      <View style={[styles.tvContainer, { backgroundColor: 'transparent', paddingLeft: isLargeScreen ? 104 : 24 , display: Platform.OS === 'web' && !isFocused ? 'none' : 'flex' }]}>
        <View style={[{ flexDirection: 'row', flex: 1 }, glassPaneStyle]}>
          {/* Pane 1: Channels */}
          <View nativeID="tour-catchup-list" {...({ id: 'tour-catchup-list' } as any)} style={[styles.tvPaneChannels, { borderRightWidth: 1, borderRightColor: colors.border }]}>
            <View style={styles.tvHeader}>
              <Text style={[styles.tvTitle, { color: colors.text }]}>{t('catch_up')}</Text>
            </View>
          <FlatList
            data={catchupChannels}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const isSelected = selectedChannel?.id === item.id;
              return (
                <TVFocusable
                  onPress={() => setSelectedChannel(item)}
                  style={({ focused }: any) => [
                    styles.tvChannelItem,
                    isSelected && { backgroundColor: 'rgba(212,168,67,0.15)', borderLeftWidth: 3, borderLeftColor: colors.gold },
                    focused && { backgroundColor: colors.gold, transform: [{ scale: 1.02 }] }
                  ]}
                >
                  {({ focused }: any) => (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      {item.logo ? (
                        <Image source={{ uri: item.logo }} style={{ width: 40, height: 40, borderRadius: 20 }} contentFit="cover" />
                      ) : (
                        <View style={[styles.tvChannelIconPlaceholder, { backgroundColor: focused ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.05)' }]}>
                          <Lineicons icon={MonitorBulk} size={20} color={focused ? '#000' : colors.text} />
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.tvChannelText, { color: focused ? '#000' : colors.text, fontWeight: isSelected ? 'bold' : '500' }]} numberOfLines={1}>
                          {item.name}
                        </Text>
                      </View>
                    </View>
                  )}
                </TVFocusable>
              );
            }}
          />
          </View>

          {/* Pane 2: Days */}
          <View style={[styles.tvPaneDays, { borderRightWidth: 1, borderRightColor: colors.border }]}>
            <View style={styles.tvHeader}>
              <Text style={[styles.tvTitle, { color: colors.text }]}>{t('days')}</Text>
            </View>
          {days.map((day, idx) => {
            const isSelected = selectedDayIndex === idx;
            return (
              <TVFocusable
                key={day.dateString}
                onPress={() => setSelectedDayIndex(idx)}
                style={({ focused }: any) => [
                  styles.tvDayItem,
                  isSelected && { backgroundColor: 'rgba(212,168,67,0.15)', borderLeftWidth: 3, borderLeftColor: colors.gold },
                  focused && { backgroundColor: colors.gold, transform: [{ scale: 1.05 }] }
                ]}
              >
                {({ focused }: any) => (
                  <Text style={[styles.tvDayText, { color: focused ? '#000' : (isSelected ? colors.gold : colors.text), fontWeight: isSelected ? 'bold' : '500' }]}>
                    {idx === 0 ? t('today') : idx === 1 ? t('yesterday') : day.label.split(' (')[0]}
                  </Text>
                )}
              </TVFocusable>
            );
          })}
          </View>

          {/* Pane 3: EPG Schedule */}
          <View style={[styles.tvPaneEpg, { flex: 1 }]}>
            <View style={styles.tvHeader}>
              <Text style={[styles.tvTitle, { color: colors.text }]}>{t('schedule')}</Text>
            </View>
          {loadingEpg ? (
            <View style={styles.centerAll}>
              <ActivityIndicator size="large" color={colors.gold} />
            </View>
          ) : (
            <FlatList
              data={filteredEpg}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 24, paddingBottom: 80 }}
              renderItem={({ item }) => (
                <TVFocusable
                  onPress={() => handlePlayProgram(item)}
                  style={({ focused }: any) => [
                    styles.tvEpgCard,
                    { backgroundColor: colors.surface, borderColor: item.isCurrent ? colors.gold : colors.border },
                    focused && { backgroundColor: colors.surface2, transform: [{ scale: 1.02 }], borderColor: colors.gold }
                  ]}
                >
                  <View style={styles.epgTimeContainer}>
                    <Text style={[styles.epgTime, { color: item.isCurrent ? colors.gold : colors.text }]}>
                      {formatTimeRange(item.start, item.end)}
                    </Text>
                    {item.isCurrent && (
                      <View style={styles.nowPlayingBadge}>
                        <Text style={styles.nowPlayingText}>{t('live')}</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.epgInfo}>
                    <Text style={[styles.epgTitle, { color: colors.text }]} numberOfLines={2}>{item.title}</Text>
                    {item.description ? (
                      <Text style={[styles.epgDesc, { color: colors.mutedForeground }]} numberOfLines={2}>{item.description}</Text>
                    ) : null}
                  </View>
                  {!item.isFuture && (
                    <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                       <Lineicons icon={item.isCurrent  ? MonitorBulk : PlayBulk} size={16} color={colors.gold} />
                       <Text style={{ color: colors.gold, fontWeight: 'bold' }}>{item.isCurrent ? t('watch_live') : t('play_catch_up')}</Text>
                    </View>
                  )}
                </TVFocusable>
              )}
            />
          )}
          </View>
        </View>
      </View>
    );
  }

  // --- Mobile Layout ---
  const renderChannelListItem = ({ item }: { item: Channel }) => {
    const isSelected = selectedChannel?.id === item.id;
    return (
      <TVFocusable 
        style={[styles.listItem, { backgroundColor: colors.surface, borderColor: isSelected ? colors.gold : colors.border }, isLandscape && { padding: 8, marginBottom: 6 }]}
        onPress={() => {
          setSelectedChannel(item);
          setEpgList([]);
        }}
      >
        <View style={styles.listLeft}>
          <View style={[styles.listIconBg, { backgroundColor: colors.surface2 }, isLandscape && { width: 32, height: 32 }]}>
            {item.logo ? (
              <Image source={{ uri: item.logo }} style={{ width: isLandscape ? 24 : 28, height: isLandscape ? 24 : 28, borderRadius: 6 }} contentFit="contain" />
            ) : (
              <Lineicons icon={MonitorBulk} size={isLandscape ? 14 : 16} color={colors.text} />
            )}
          </View>
          <Text style={[styles.listName, { color: colors.text }, isLandscape && { fontSize: 14 }]} numberOfLines={isLandscape ? 1 : 2}>{item.name}</Text>
        </View>
        <Lineicons icon={ArrowRightBulk} size={16} color={colors.mutedForeground} />
      </TVFocusable>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: 'transparent' , display: Platform.OS === 'web' && !isFocused ? 'none' : 'flex' }]}>
      {selectedChannel && (
        <View style={[styles.header, { paddingBottom: 0 }, isLandscape && { paddingTop: 4, paddingBottom: 4 }]}>
          <TVFocusable 
            style={[styles.backBtn, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, isLandscape && { width: 30, height: 30 }]} 
            onPress={() => setSelectedChannel(null)}
          >
            <Lineicons icon={ArrowLeftBulk} size={isLandscape ? 16 : 20} color={colors.text} />
          </TVFocusable>
          <Text style={[styles.headerTitle, { color: colors.text, flex: 1, marginLeft: 12 }, isLandscape && { fontSize: 16 }]} numberOfLines={1}>
            {selectedChannel.name}
          </Text>
        </View>
      )}

      {!selectedChannel ? (
        <FlatList
          data={catchupChannels}
          keyExtractor={(item) => item.id}
          renderItem={renderChannelListItem}
          contentContainerStyle={{ padding: 20, paddingTop: 10, paddingBottom: insets.bottom + 20 }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Lineicons icon={StopwatchBulk} size={48} color={colors.mutedForeground} style={{ marginBottom: 16 }} />
              <Text style={[styles.emptyText, { color: colors.text }]}>{t('no_catchup')}</Text>
            </View>
          }
        />
      ) : (
        <View style={{ flex: 1 }}>
          <View style={[styles.daysBar, { borderBottomColor: colors.border }]}>
            {days.map((day, idx) => {
              const isSelected = selectedDayIndex === idx;
              return (
                <TVFocusable
                  key={day.dateString}
                  style={[styles.dayTabItem, isSelected && { borderBottomColor: colors.gold }, isLandscape && { paddingVertical: 8 }]}
                  onPress={() => setSelectedDayIndex(idx)}
                >
                  <Text style={[styles.dayTabLabel, { color: isSelected ? colors.gold : colors.text }, isLandscape && { fontSize: 12 }]}>
                {idx === 0 ? t('today') : idx === 1 ? t('yesterday') : day.label.split(' (')[0]}
                  </Text>
                </TVFocusable>
              );
            })}
          </View>

          {loadingEpg ? (
            <View style={styles.centerAll}>
              <ActivityIndicator size="large" color={colors.gold} />
              <Text style={{ color: colors.mutedForeground, marginTop: 12 }}>{t('syncing_epg')}</Text>
            </View>
          ) : (
            <FlatList
              data={filteredEpg}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 20 }}
              renderItem={({ item }) => (
                <View style={[styles.epgCard, { backgroundColor: colors.surface, borderColor: item.isCurrent ? colors.gold : colors.border, opacity: item.isFuture ? 0.55 : 1 }, isLandscape && { padding: 10, gap: 8, marginBottom: 8 }]}>
                  <View style={styles.epgTimeContainer}>
                    <Text style={[styles.epgTime, { color: item.isCurrent ? colors.gold : colors.text }, isLandscape && { fontSize: 12 }]}>{formatTimeRange(item.start, item.end)}</Text>
                    {item.isCurrent && <View style={[styles.nowPlayingBadge, isLandscape && { paddingVertical: 2 }]}><Text style={styles.nowPlayingText}>{t('live')}</Text></View>}
                  </View>
                  <View style={[styles.epgInfo, isLandscape && { gap: 2 }]}>
                    <Text style={[styles.epgTitle, { color: colors.text }, isLandscape && { fontSize: 14 }]} numberOfLines={isLandscape ? 1 : 2}>{item.title}</Text>
                    {item.description ? <Text style={[styles.epgDesc, { color: colors.mutedForeground }, isLandscape && { fontSize: 11, lineHeight: 14 }]} numberOfLines={isLandscape ? 1 : 2}>{item.description}</Text> : null}
                  </View>
                  {!item.isFuture && (
                    <TVFocusable style={[styles.playBtn, { backgroundColor: item.isCurrent ? colors.gold : 'rgba(255,255,255,0.08)' }, isLandscape && { paddingVertical: 6 }]} onPress={() => handlePlayProgram(item)}>
                      <Lineicons icon={item.isCurrent  ? MonitorBulk : PlayBulk} size={14} color={item.isCurrent ? '#1A1A1A' : colors.text} />
                      <Text style={[styles.playBtnText, { color: item.isCurrent ? '#1A1A1A' : colors.text }, isLandscape && { fontSize: 12 }]}>{item.isCurrent ? t('live_label') : t('catch_up_label')}</Text>
                    </TVFocusable>
                  )}
                </View>
              )}
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerAll: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  
  // TV Styles
  tvContainer: { flex: 1, flexDirection: 'row' },
  tvPaneChannels: { width: 340 },
  tvPaneDays: { width: 140 },
  tvPaneEpg: { flex: 1 },
  tvHeader: { padding: 24, paddingBottom: 16 },
  tvTitle: { fontSize: 24, fontWeight: 'bold' },
  tvChannelItem: { paddingHorizontal: 24, paddingVertical: 12, borderLeftWidth: 3, borderLeftColor: 'transparent' },
  tvChannelText: { fontSize: 15 },
  tvChannelIconPlaceholder: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  tvDayItem: { paddingHorizontal: 24, paddingVertical: 16, borderLeftWidth: 3, borderLeftColor: 'transparent' },
  tvDayText: { fontSize: 15 },
  tvEpgCard: { padding: 20, borderRadius: 12, borderWidth: 1, marginBottom: 16, gap: 12 },

  // Mobile Styles
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  
  // List Styles
  listItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 10 },
  listLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  listIconBg: { width: 42, height: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  listName: { fontSize: 15, fontWeight: '600', flex: 1},
  daysBar: { flexDirection: 'row', borderBottomWidth: 1 },
  dayTabItem: { flex: 1, alignItems: 'center', paddingVertical: 14, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  dayTabLabel: { fontSize: 13, fontWeight: 'bold' },
  epgCard: { borderRadius: 12, borderWidth: 1, padding: 16, marginBottom: 12, gap: 12 },
  epgTimeContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  epgTime: { fontSize: 14, fontWeight: 'bold' },
  nowPlayingBadge: { backgroundColor: '#E53935', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  nowPlayingText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  epgInfo: { gap: 4 },
  epgTitle: { fontSize: 16, fontWeight: 'bold' },
  epgDesc: { fontSize: 13, lineHeight: 18 },
  playBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, borderRadius: 8 },
  playBtnText: { fontSize: 13, fontWeight: 'bold' },
  emptyState: { alignItems: 'center', justifyContent: 'center', padding: 40, marginTop: 80 },
  emptyText: { fontSize: 18, fontWeight: 'bold' }});
