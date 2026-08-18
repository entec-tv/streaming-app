import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, useWindowDimensions, Platform, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';


import { HeroCarousel } from '@/components/HeroCarousel';
import { ContentRow } from '@/components/ContentRow';
import { ChannelCard } from '@/components/ChannelCard';
import { MovieCard } from '@/components/MovieCard';
import { ContinueWatchingCard } from '@/components/ContinueWatchingCard';
import { HeroSkeleton } from '@/components/HeroSkeleton';
import { TVFocusable } from '@/components/TVFocusable';
import { router } from 'expo-router';
import { useAppStore } from '@/store/app-store';
import { Channel } from '@/types';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { base64Decode } from '@/lib/base64';
import { useIsFocused } from '@react-navigation/native';

export default function HomeScreen() {
  const isFocused = useIsFocused();
  const colors = useColors();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isLargeScreen = width >= 1024 || Platform.isTV;

  const activePlaylistId = useAppStore((s) => s.activePlaylistId);
  const activeCategories = useAppStore((s) => s.activeCategories);
  const getChannelsForCategory = useAppStore((s) => s.getChannelsForCategory);
  const setPlaybackQueue = useAppStore((s) => s.setPlaybackQueue);
  const playlists = useAppStore((s) => s.playlists);
  const cachedHomeContent = useAppStore((s) => s.cachedHomeContent);
  const setCachedHomeContent = useAppStore((s) => s.setCachedHomeContent);

  const [loading, setLoading] = useState(true);
  const [contentRows, setContentRows] = useState<{ title: string; type: 'live' | 'vod' | 'series'; categoryId: string; items: any[] }[]>([]);
  const [featuredItems, setFeaturedItems] = useState<any[]>([]);
  const [tvHeroIndex, setTvHeroIndex] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const hasAutoPlayed = useRef(false);

  useEffect(() => {
    if (!isLargeScreen || featuredItems.length <= 1 || !isFocused) return;
    const interval = setInterval(() => {
      setTvHeroIndex(prev => (prev + 1) % Math.min(featuredItems.length, 4));
    }, 6000);
    return () => clearInterval(interval);
  }, [isLargeScreen, featuredItems.length, isFocused]);
  const subscriptionExpired = useAppStore((s) => s.subscriptionExpired);
  const setSubscriptionExpired = useAppStore((s) => s.setSubscriptionExpired);
  
  
  const appIsReady = useAppStore((s) => s.appIsReady);

  const continueWatching = useAppStore((s) => s.continueWatching) || [];
  const favoriteItems = useAppStore((s) => s.favoriteItems) || [];
  const favoriteChannels = favoriteItems.filter((item) => item.type === 'live' || item.isLive === true || (item.isLive as unknown) === 'true');
  const [refreshKey, setRefreshKey] = useState(0);

  const onRefresh = () => {
    setRefreshing(true);
    setRefreshKey(prev => prev + 1);
  };



  useEffect(() => {
    let active = true;

    async function loadHomeContent() {
      if (!activePlaylistId || !activeCategories) {
        setLoading(false);
        return;
      }

      const hasValidCache = cachedHomeContent && cachedHomeContent.playlistId === activePlaylistId && cachedHomeContent.rows.length > 0;

      if (hasValidCache) {
        setContentRows(cachedHomeContent.rows);
        setFeaturedItems(cachedHomeContent.featured);
        
        if (refreshKey === 0) {
          setLoading(false);
          return;
        }
        
        // When refreshing, don't show the full page skeleton
        setLoading(false);
      } else {
        setLoading(true);
      }

      setSubscriptionExpired(false);
      try {
        const activePlaylist = playlists.find(p => p.id === activePlaylistId);
        let config: any = null;
        if (activePlaylist && activePlaylist.url) {
          if (activePlaylist.url.startsWith('xtream://')) {
            try { config = JSON.parse(base64Decode(activePlaylist.url.replace('xtream://', ''))); } catch (e) { }
          } else {
            const match = activePlaylist.url.match(/^(https?:\/\/[^/]+)\/get\.php\?username=([^&]+)&password=([^&]+)/);
            if (match) config = { host: match[1], username: match[2], password: match[3] };
          }
          if (config) {
            try {
              // Quick check for expired subscription to avoid infinite loading loop
              const authRes = await Promise.race([
                fetch(`${config.host}/player_api.php?username=${config.username}&password=${config.password}`, {
                  headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                  }
                }),
                new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 5000))
              ]) as Response;

              if (authRes.ok) {
                const data = await authRes.json();
                if (data && data.user_info && data.user_info.status !== 'Active') {
                  if (active) {
                    setSubscriptionExpired(true);
                    setLoading(false);
                  }
                  return;
                }
              }
            } catch (err) {
              console.warn('Auth check failed or timed out, proceeding with stream fetch...', err);
            }
          }
        }

        if (active && !hasValidCache) {
          setContentRows([]);
          setFeaturedItems([]);
        }

        let primaryHeroPool: Channel[] = [];
        let fallbackHeroPool: Channel[] = [];
        let accumulatedRows: any[] = [];

        const addRow = async (type: 'live' | 'vod' | 'series', category: any) => {
          if (!category) return false;
          const items = await getChannelsForCategory(activePlaylistId, type, category.id, category.name);
          if (items.length > 0) {
            if (type !== 'live') fallbackHeroPool.push(...items);
            if (type === 'series') primaryHeroPool.push(...items);
            const mapped = items.slice(0, 15).map(m => {
              if (type === 'live') return m;
              return {
                id: m.id,
                title: m.name,
                poster: m.logo || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.name)}&background=1A1A1A&color=${colors.gold.replace('#', '')}&bold=true&size=300&format=svg`,
                backdrop: m.logo,
                rating: 0,
                year: 0,
                duration: '',
                quality: m.quality,
                genres: [m.category],
                description: '',
                streamUrl: m.streamUrl,
              };
            });
            const newRow = {
              title: category.name,
              type,
              categoryId: category.id,
              items: mapped
            };
            if (active) {
              accumulatedRows.push(newRow);
            }
            return true;
          }
          return false;
        };

        let rowCount = 0;
        const MAX_ROWS = 6;

        const fillRows = async (type: 'live' | 'vod' | 'series', categories: any[], targetRows: number) => {
          let count = 0;
          for (let i = 0; i < categories.length; i++) {
            if (rowCount >= MAX_ROWS || count >= targetRows) break;
            const added = await addRow(type, categories[i]);
            if (added) {
              count++;
              rowCount++;
              // Removed 400ms delay for faster loading (since we now have caching)
            }
          }
        };

        // Shuffle categories to get dynamic rows and diverse hero pool on every load
        const shuffledSeries = [...(activeCategories.series || [])].sort(() => 0.5 - Math.random());
        const shuffledVod = [...(activeCategories.vod || [])].sort(() => 0.5 - Math.random());
        const shuffledLive = [...(activeCategories.live || [])].sort(() => 0.5 - Math.random());

        // Load series, vod, and live rows in parallel to speed up home screen loading
        await Promise.all([
          fillRows('series', shuffledSeries, 2),
          fillRows('vod', shuffledVod, 2),
          fillRows('live', shuffledLive, 2),
        ]);

        if (!active) return;

        let priorityHeroItems: Channel[] = [];
        const arabicNowSeriesCategory = activeCategories.series?.find(c => c.name.includes('يعرض الآن عربي'));
        const isNotUpcoming = (i: any) => {
          const name = i.name || '';
          const nameLower = name.toLowerCase();
          return !name.includes('قريبا') && !name.includes('قريباً') && !name.includes('قريباٌ') && !nameLower.includes('coming soon');
        };

        if (arabicNowSeriesCategory) {
          const items = await getChannelsForCategory(activePlaylistId, 'series', arabicNowSeriesCategory.id, arabicNowSeriesCategory.name);
          if (items && items.length > 0) {
            priorityHeroItems = [...items].filter(isNotUpcoming).sort(() => 0.5 - Math.random()).slice(0, 4);
          }
        }

        const pool = primaryHeroPool.length > 0 ? primaryHeroPool : fallbackHeroPool;
        const shuffledPool = [...pool].filter(isNotUpcoming).sort(() => 0.5 - Math.random());
        const fallbackItems = shuffledPool.slice(0, 4 - priorityHeroItems.length);
        
        const top4 = [...priorityHeroItems, ...fallbackItems];

        const mappedFeatured = await Promise.all(top4.map(async (item) => {
          let backdropUri = item.logo || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name)}&background=1A1A1A&color=${colors.gold.replace('#', '')}&bold=true&size=300&format=svg`;
          let description = item.type === 'live' ? `Live Channel · ${item.category}` : item.type === 'series' ? `TV Series · ${item.category}` : `Movie VOD · ${item.category}`;

          if (item.type === 'series' && config && item.id.startsWith('xt_series_')) {
            try {
              const seriesId = item.id.replace('xt_series_', '');
              const fetchUrl = `${config.host}/player_api.php?username=${config.username}&password=${config.password}&action=get_series_info&series_id=${seriesId}`;

              const text = await new Promise<string>((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('GET', fetchUrl, true);
                xhr.timeout = 10000;
                xhr.onload = () => {
                  if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.responseText || '');
                  else reject(new Error('error'));
                };
                xhr.onerror = () => reject(new Error('error'));
                xhr.ontimeout = () => reject(new Error('timeout'));
                xhr.send();
              });

              const data = JSON.parse(text);
              if (data && data.info) {
                const fetchedBackdrop = data.info.backdrop_path && Array.isArray(data.info.backdrop_path) && data.info.backdrop_path.length > 0
                  ? data.info.backdrop_path[0]
                  : data.info.backdrop_path && typeof data.info.backdrop_path === 'string'
                    ? data.info.backdrop_path
                    : '';
                if (fetchedBackdrop) {
                  backdropUri = fetchedBackdrop;
                }
                if (data.info.plot) {
                  description = data.info.plot;
                }
              }
            } catch (err) {
              // Ignore failure for individual items
            }
          }

          return {
            id: item.id,
            title: item.name,
            subtitle: item.type === 'live' ? t('featured_live') : item.type === 'series' ? t('featured_series') : t('featured_movie'),
            backdrop: { uri: backdropUri },
            poster: { uri: item.logo },
            description,
            rating: 8.5,
            year: 2026,
            duration: item.type === 'live' ? 'LIVE' : 'VOD',
            genres: [item.category],
            streamUrl: item.streamUrl,
            originalItem: item,
          };
        }));

        if (active) {
          setContentRows(accumulatedRows);
          setFeaturedItems(mappedFeatured);
          setCachedHomeContent(activePlaylistId, accumulatedRows, mappedFeatured);
        }
        
        if (active && useAppStore.getState().autoPlayOnStartup && !hasAutoPlayed.current) {
          hasAutoPlayed.current = true;
          const last = useAppStore.getState().lastWatchedChannel;
          if (last && last.type === 'live') {
             router.push(`/live/player?id=${encodeURIComponent(last.id)}&title=${encodeURIComponent(last.title)}&url=${encodeURIComponent(last.streamUrl)}` as any);
          } else {
             const liveRow = accumulatedRows.find(r => r.type === 'live');
             if (liveRow && liveRow.items.length > 0) {
                const item = liveRow.items[0];
                router.push(`/live/player?id=${encodeURIComponent(item.id)}&title=${encodeURIComponent(item.title)}&url=${encodeURIComponent(item.streamUrl)}` as any);
             }
          }
        }

      } catch (err) {
        console.error('Error loading Home content:', err);
      } finally {
        if (active) {
          setRefreshing(false);
          setLoading(false);
        }
      }
    }

    loadHomeContent();

    return () => {
      active = false;
    };
  }, [activePlaylistId, activeCategories, refreshKey]);

  useEffect(() => {
    if (subscriptionExpired) {
      console.log('LOGOUT TRIGGERED FROM INDEX.TSX');
      useAppStore.getState().logout();
      router.replace('/activation');
    }
  }, [subscriptionExpired]);



  if (!activePlaylistId) {
    return (
      <View style={[styles.container, { backgroundColor: 'transparent', justifyContent: 'center', alignItems: 'center', padding: 20 , display: Platform.OS === 'web' && !isFocused ? 'none' : 'flex' }]}>
        <Ionicons name="tv-outline" size={48} color={colors.mutedForeground} />
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold', marginTop: 12 }}>{t('no_playlist_active')}</Text>
        <TVFocusable
          style={{ marginTop: 16, backgroundColor: colors.gold, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 }}
          onPress={() => router.push('/playlists')}
        >
          <Text style={{ color: '#1A1A1A', fontWeight: 'bold' }}>{t('manage_playlists')}</Text>
        </TVFocusable>
      </View>
    );
  }

  // --- TV Layout ---
  if (isLargeScreen) {
    const heroItem = featuredItems[tvHeroIndex] || featuredItems[0]; // Use current slider item

    return (
      <View style={[styles.container, { backgroundColor: 'transparent' , display: Platform.OS === 'web' && !isFocused ? 'none' : 'flex' }]}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
          {loading ? (
            <HeroSkeleton />
          ) : heroItem ? (
            <View nativeID="hero-carousel" style={{ width: width + 80, height: height * 0.7, marginLeft: -80, marginBottom: 40 }}>
              <Image source={heroItem.backdrop} style={StyleSheet.absoluteFill} contentFit="cover" transition={500} />
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.4)', colors.overlay]}
                locations={[0, 0.5, 1]}
                style={StyleSheet.absoluteFill}
              />
              <LinearGradient
                colors={[colors.overlay, 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0.5, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
              {featuredItems.length > 1 && (
                <>
                </>
              )}
              <View style={[styles.tvHeroContent, { position: 'absolute', bottom: 80, left: 120 }]}>
                <Text style={[styles.tvHeroSubtitle, { color: colors.gold }]}>{heroItem.subtitle}</Text>
                <Text style={styles.tvHeroTitle} numberOfLines={1}>{heroItem.title}</Text>
                <View style={[styles.tvHeroActions, { flexDirection: 'row', gap: 16 }]}>
                  <TVFocusable
                    style={({ focused }: any) => [
                      styles.tvHeroBtnPrimary,
                      { backgroundColor: focused ? colors.gold : '#FFF' }
                    ]}
                    onPress={() => {
                      if (heroItem.originalItem.type === 'live') {
                        router.push({ pathname: '/player', params: { streamUrl: heroItem.streamUrl || '', title: heroItem.title, isLive: 'true', quality: 'HD' } });
                      } else if (heroItem.originalItem.type === 'series') {
                        router.push({ pathname: '/series-detail', params: { id: heroItem.id, title: heroItem.title, poster: heroItem.backdrop?.uri, backdrop: heroItem.backdrop?.uri, genres: heroItem.genres.join(','), description: heroItem.description, streamUrl: heroItem.streamUrl || '', autoPlay: 'true' } });
                      } else {
                        router.push({ pathname: '/player', params: { streamUrl: heroItem.streamUrl || '', title: heroItem.title, quality: 'HD', poster: heroItem.backdrop?.uri } });
                      }
                    }}
                    scaleAmount={1.05}
                  >
                    {({ focused }: any) => (
                      <>
                        <Ionicons name="play" size={20} color="#000" />
                        <Text style={[styles.tvHeroBtnPrimaryText, { color: '#000' }]}>{t('play_now')}</Text>
                      </>
                    )}
                  </TVFocusable>
                  
                  {heroItem.originalItem.type !== 'live' && (
                    <TVFocusable
                      style={({ focused }: any) => [
                        styles.tvHeroBtnPrimary,
                        { backgroundColor: focused ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)', borderWidth: 2, borderColor: focused ? '#FFF' : 'transparent' }
                      ]}
                      onPress={() => {
                        if (heroItem.originalItem.type === 'series') {
                          router.push({ pathname: '/series-detail', params: { id: heroItem.id, title: heroItem.title, poster: heroItem.backdrop?.uri, backdrop: heroItem.backdrop?.uri, genres: heroItem.genres.join(','), description: heroItem.description, streamUrl: heroItem.streamUrl || '' } });
                        } else {
                          router.push({ pathname: '/movie-detail', params: { id: heroItem.id, title: heroItem.title, poster: heroItem.backdrop?.uri, backdrop: heroItem.backdrop?.uri, quality: 'HD', genres: heroItem.genres.join(','), description: heroItem.description, streamUrl: heroItem.streamUrl || '' } });
                        }
                      }}
                      scaleAmount={1.05}
                    >
                      {({ focused }: any) => (
                        <>
                          <Ionicons name="information-circle-outline" size={20} color="#FFF" />
                          <Text style={[styles.tvHeroBtnPrimaryText, { color: '#FFF' }]}>More Info</Text>
                        </>
                      )}
                    </TVFocusable>
                  )}
                </View>

                {featuredItems.length > 1 && (
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
                    {featuredItems.slice(0, 4).map((_, i) => (
                      <View 
                        key={i} 
                        style={{ 
                          width: i === tvHeroIndex ? 24 : 8, 
                          height: 8, 
                          borderRadius: 4, 
                          backgroundColor: i === tvHeroIndex ? colors.gold : 'rgba(255,255,255,0.3)',
                        }} 
                      />
                    ))}
                  </View>
                )}
              </View>
            </View>
          ) : null}

          <View style={[styles.tvBottomContent]}>
            {favoriteChannels.length > 0 && (
              <ContentRow
                title={t('favorite_channels')}
                data={favoriteChannels}
                onSeeAll={() => router.push('/(tabs)/favorites')}
                renderItem={({ item, index: itemIndex }) => (
                  <ChannelCard
                    channel={item}
                    width={200}
                    onPress={() => {
                      setPlaybackQueue(favoriteChannels, itemIndex);
                      router.push({
                        pathname: '/player',
                        params: {
                          id: item.id,
                          streamUrl: item.streamUrl,
                          title: item.name || item.title,
                          isLive: 'true',
                          current: item.current || '',
                          next: item.next || '',
                          quality: item.quality || 'HD',
                          logo: item.logo || item.poster || '',
                          category: item.category || ''
                        }
                      });
                    }}
                  />
                )}
              />
            )}
            {continueWatching.length > 0 && (
              <View nativeID="tour-continue-watching" {...({ id: 'tour-continue-watching' } as any)}>
                <ContentRow
                  title={t('continue_watching')}
                  data={continueWatching}
                  onSeeAll={() => router.push('/continue-watching')}
                  renderItem={({ item }) => (
                  <ContinueWatchingCard
                    item={item}
                    onPress={() => {
                      router.push({
                        pathname: '/player',
                        params: { id: item.id, streamUrl: item.streamUrl, title: item.title, isLive: item.type === 'live' ? 'true' : 'false', current: item.current || '', next: item.next || '', quality: item.quality, logo: item.poster || item.backdrop || '', category: item.category || '', autoResume: 'true' }
                      });
                    }}
                  />
                )}
              />
              </View>
            )}
            {contentRows.map((row, index) => (
              <ContentRow
                key={`tv-row-${index}`}
                title={row.title}
                data={row.items}
                onSeeAll={() => {
                  const tab = row.type === 'live' ? '/(tabs)/live' : row.type === 'vod' ? '/(tabs)/movies' : '/(tabs)/series';
                  router.push({ pathname: tab, params: { categoryId: row.categoryId } });
                }}
                renderItem={({ item, index: itemIndex }) =>
                  row.type === 'live' ? (
                    <ChannelCard
                      channel={item}
                      width={200}
                      onPress={() => {
                        setPlaybackQueue(row.items, itemIndex);
                        router.push({ pathname: '/player', params: { id: item.id, streamUrl: item.streamUrl, title: item.name, isLive: 'true', current: item.current, next: item.next, quality: item.quality, logo: item.logo || '', category: item.category || '' } });
                      }}
                    />
                  ) : (
                    <MovieCard
                      movie={item}
                      width={160}
                      onPress={() => {
                        if (row.type === 'series') {
                          router.push({
                            pathname: '/series-detail',
                            params: { id: item.id, title: item.title || item.name, poster: item.poster || item.logo, backdrop: item.backdrop || item.poster || item.logo, quality: item.quality, genres: item.genres?.join(',') || '', description: item.description, streamUrl: item.streamUrl || '' },
                          });
                        } else {
                          router.push({
                            pathname: '/movie-detail',
                            params: { id: item.id, title: item.title, poster: item.poster, backdrop: item.backdrop || item.poster, quality: item.quality, genres: item.genres.join(','), description: item.description, streamUrl: item.streamUrl || '' },
                          });
                        }
                      }}
                    />
                  )
                }
              />
            ))}
          </View>
        </ScrollView>
      </View>
    );
  }

  // --- Mobile Layout ---
  return (
    <View style={[styles.container, { backgroundColor: 'transparent' , display: Platform.OS === 'web' && !isFocused ? 'none' : 'flex' }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
        scrollEventThrottle={100}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />
        }
      >

        {loading ? (
          <HeroSkeleton />
        ) : featuredItems.length > 0 ? (
          <View nativeID="hero-carousel">
            <HeroCarousel
              items={featuredItems}
              onPlay={(hero: any) => {
                const item = hero as any;
                const isLive = item.type === 'live' ? 'true' : 'false';
                router.push({
                  pathname: '/player',
                  params: {
                    id: item.id,
                    streamUrl: item.streamUrl || '',
                    title: item.title,
                    isLive,
                    quality: item.quality,
                    logo: item.poster?.uri || item.poster || '',
                    category: item.category || ''
                  }
                });
              }}
              onInfo={(hero: any) => {
                const item = hero as any;
                if (item.type === 'series') {
                  router.push({
                    pathname: '/series-detail',
                    params: { id: item.id, title: item.title, poster: item.poster?.uri || item.poster, backdrop: item.backdrop?.uri || item.backdrop, genres: item.category, description: item.description, streamUrl: item.streamUrl || '' },
                  });
                } else if (item.type === 'vod') {
                  router.push({
                    pathname: '/movie-detail',
                    params: { id: item.id, title: item.title, poster: item.poster?.uri || item.poster, backdrop: item.backdrop?.uri || item.backdrop, quality: item.quality, genres: item.category, description: item.description, streamUrl: item.streamUrl || '' },
                  });
                }
              }}
            />
          </View>
        ) : (
          <View style={{ height: 100 }} />
        )}

        <View style={styles.content}>
          {favoriteChannels.length > 0 && (
            <ContentRow
              title={t('favorite_channels')}
              data={favoriteChannels}
              onSeeAll={() => router.push('/(tabs)/favorites')}
              renderItem={({ item, index: itemIndex }) => (
                <ChannelCard
                  channel={item}
                  width={160}
                  onPress={() => {
                    setPlaybackQueue(favoriteChannels, itemIndex);
                    router.push({
                      pathname: '/player',
                      params: {
                        id: item.id,
                        streamUrl: item.streamUrl,
                        title: item.name || item.title,
                        isLive: 'true',
                        current: item.current || '',
                        next: item.next || '',
                        quality: item.quality || 'HD',
                        logo: item.logo || item.poster || '',
                        category: item.category || ''
                      }
                    });
                  }}
                />
              )}
            />
          )}
          {continueWatching.length > 0 && (
            <View nativeID="tour-continue-watching" {...({ id: 'tour-continue-watching' } as any)}>
              <ContentRow
                title={t('continue_watching')}
                data={continueWatching}
                onSeeAll={() => router.push('/continue-watching')}
                renderItem={({ item }) => (
                  <ContinueWatchingCard
                    item={item}
                  onPress={() => {
                    router.push({
                      pathname: '/player',
                      params: {
                        id: item.id,
                        streamUrl: item.streamUrl,
                        title: item.title,
                        isLive: item.type === 'live' ? 'true' : 'false',
                        quality: item.quality || 'HD',
                        poster: typeof item.poster === 'object' ? item.poster?.uri : item.poster,
                        backdrop: typeof item.backdrop === 'object' ? item.backdrop?.uri : item.backdrop,
                        description: item.description,
                        category: item.category,
                        autoResume: 'true'
                      }
                    });
                  }}
                />
              )}
            />
            </View>
          )}

          {contentRows.map((row, index) => (
            <ContentRow
              key={`mobile-row-${index}`}
              title={row.title}
              data={row.items}
              onSeeAll={() => {
                const tab = row.type === 'live' ? '/(tabs)/live' : row.type === 'vod' ? '/(tabs)/movies' : '/(tabs)/series';
                router.push({ pathname: tab, params: { categoryId: row.categoryId } });
              }}
              renderItem={({ item, index: itemIndex }) =>
                row.type === 'live' ? (
                  <ChannelCard
                    channel={item}
                    width={160}
                    onPress={() => {
                      setPlaybackQueue(row.items, itemIndex);
                      router.push({ pathname: '/player', params: { id: item.id, streamUrl: item.streamUrl, title: item.name, isLive: 'true', current: item.current, next: item.next, quality: item.quality, logo: item.logo || '', category: item.category || '' } });
                    }}
                  />
                ) : row.type === 'series' ? (
                  <MovieCard
                    movie={item}
                    width={110}
                    onPress={() => {
                      router.push({
                        pathname: '/series-detail',
                        params: { id: item.id, title: item.title, poster: item.poster, backdrop: item.backdrop || item.poster, genres: item.genres.join(','), description: item.description, streamUrl: item.streamUrl || '' },
                      });
                    }}
                  />
                ) : (
                  <MovieCard
                    movie={item}
                    width={110}
                    onPress={() => {
                      router.push({
                        pathname: '/movie-detail',
                        params: { id: item.id, title: item.title, poster: item.poster, backdrop: item.backdrop || item.poster, quality: item.quality, genres: item.genres.join(','), description: item.description, streamUrl: item.streamUrl || '' },
                      });
                    }}
                  />
                )
              }
            />
          ))}

          {contentRows.length === 0 && (
            <View style={{ alignItems: 'center', padding: 40, gap: 12 }}>
              <Ionicons name="tv-outline" size={48} color={colors.mutedForeground} />
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: 'bold' }}>{t('playlist_no_content')}</Text>
              <Text style={{ color: colors.mutedForeground, textAlign: 'center' }}>{t('add_playlist_wait')}</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  // TV Styles
  tvHeroContent: { paddingLeft: 32, width: '60%', position: 'absolute', bottom: 80 },
  tvHeroSubtitle: { fontSize: 16, fontWeight: 'bold', letterSpacing: 2, marginBottom: 12 },
  tvHeroTitle: { fontSize: 36, fontWeight: '900', color: '#FFF', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 4 }, textShadowRadius: 10, marginBottom: 12 },
  tvHeroMeta: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
  tvHeroMetaText: { color: 'rgba(255,255,255,0.8)', fontSize: 16, fontWeight: '600' },
  tvHeroDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.5)' },
  tvHeroDesc: { fontSize: 16, color: 'rgba(255,255,255,0.7)', lineHeight: 24, marginBottom: 24, maxWidth: '90%' },
  tvHeroActions: { flexDirection: 'row', gap: 16 },
  tvHeroBtnPrimary: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 30 },
  tvHeroBtnPrimaryText: { fontSize: 16, fontWeight: 'bold' },
  tvHeroBtnSecondary: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 32, paddingVertical: 16, borderRadius: 30, borderWidth: 2, borderColor: 'transparent' },
  tvHeroBtnSecondaryText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  tvBottomContent: { paddingLeft: 24, marginTop: -32 },

  // Mobile Styles
  header: { position: 'absolute', zIndex: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logoText: { fontSize: 20, fontWeight: '900', textShadowColor: 'rgba(0,0,0,1)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8 },
  headerRight: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  iconButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  subscribeBtn: { backgroundColor: '#FFF', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  subscribeText: { color: '#000', fontWeight: 'bold', fontSize: 13 },
  content: { paddingTop: 24 }
});
