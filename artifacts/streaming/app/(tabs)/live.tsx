import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, useWindowDimensions, Platform, BackHandler, ScrollView, TextInput, Modal } from 'react-native';
import { Image } from 'expo-image';
import QRCode from 'react-native-qrcode-svg';
import { TVFocusable } from '@/components/TVFocusable';
import { SearchKeyboardModal } from '@/components/SearchKeyboardModal';
import { PinModal } from '@/components/PinModal';
import { MarqueeText } from '@/components/MarqueeText';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { Lineicons } from '@lineiconshq/react-native-lineicons';
import { MonitorBulk, DashboardSquare1Bulk, Folder1Bulk, ArrowRightBulk, HeartBulk, Search1Bulk, ArrowLeftBulk } from '@lineiconshq/free-icons';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { ChannelCard } from '@/components/ChannelCard';
import { router, useNavigation, useLocalSearchParams } from 'expo-router';
import { useAppStore } from '@/store/app-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Channel } from '@/types';
import { useVideoPlayer, VideoView } from 'expo-video';
import { WebVideoPlayer } from '@/components/WebVideoPlayer';
import { EpgNowNext } from '@/components/EpgNowNext';


function toChannel(item: any): Channel {
  return {
    id: String(item.id || ''),
    name: String(item.name || item.title || 'Channel'),
    logo: typeof item.logo === 'string' ? item.logo : (typeof item.poster === 'string' ? item.poster : ''),
    category: String(item.category || 'Live TV'),
    streamUrl: String(item.streamUrl || ''),
    current: String(item.current || ''),
    next: String(item.next || ''),
    quality: (item.quality || 'HD') as '4K' | 'FHD' | 'HD',
    isLive: true,
    type: 'live'
  };
}

export default function LiveScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const { width, height } = useWindowDimensions();
  const rawIsLandscape = width > height;
  const rawMobileNumColumns = Math.max(2, Math.floor((width - 40) / 160));
  const rawIsLargeScreen = width >= 1024 || Platform.isTV;

  const [layoutState, setLayoutState] = useState({
    isLandscape: rawIsLandscape,
    isLargeScreen: rawIsLargeScreen,
    mobileNumColumns: rawMobileNumColumns
  });

  useEffect(() => {
    if (isFocused) {
      setLayoutState({
        isLandscape: rawIsLandscape,
        isLargeScreen: rawIsLargeScreen,
        mobileNumColumns: rawMobileNumColumns
      });
    }
  }, [isFocused, rawIsLandscape, rawIsLargeScreen, rawMobileNumColumns]);

  const { isLandscape, isLargeScreen, mobileNumColumns } = layoutState;
  const isParentalLocked = useAppStore((s) => s.isParentalLocked);
  const unlockCategory = useAppStore((s) => s.unlockCategory);
  const favorites = useAppStore((s) => s.favorites);
  const isChannelLocked = useAppStore((s) => s.isChannelLocked);
  const toggleChannelLock = useAppStore((s) => s.toggleChannelLock);
  const lockedChannels = useAppStore((s) => s.lockedChannels);
  const unlockChannel = useAppStore((s) => s.unlockChannel);
  const parentalPin = useAppStore((s) => s.parentalPin);

  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [pendingCategory, setPendingCategory] = useState<any>(null);
  const [pendingChannelLock, setPendingChannelLock] = useState<string | null>(null);
  const [pendingChannelPlay, setPendingChannelPlay] = useState<any>(null);

  const activePlaylistId = useAppStore((s) => s.activePlaylistId);
  const activeCategories = useAppStore((s) => s.activeCategories);
  const getChannelsForCategory = useAppStore((s) => s.getChannelsForCategory);
  const setPlaybackQueue = useAppStore((s) => s.setPlaybackQueue);
  const favoriteItems = useAppStore((s) => s.favoriteItems) || [];
  const continueWatching = useAppStore((s) => s.continueWatching) || [];
  const updateContinueWatching = useAppStore((s) => s.updateContinueWatching);
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);
  const moreOptions = useAppStore((s) => s.moreOptions);
  const [selectedCategory, setSelectedCategory] = useState<{ id: string; name: string } | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [localChannels, setLocalChannels] = useState<Channel[]>([]);
  const [displayCount, setDisplayCount] = useState(50);
  const [loading, setLoading] = useState(false);
  const [isVideoBuffering, setIsVideoBuffering] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [aspectMode, setAspectMode] = useState(0); // 0: contain, 1: fill, 2: cover, 3: wide, 4: squish
  const toggleAspectMode = () => setAspectMode(prev => (prev + 1) % 5);
  const isFullscreen = useAppStore((s) => s.isFullscreen);
  const setIsFullscreen = useAppStore((s) => s.setIsFullscreen);
  const hasDefaulted = useRef(false);
  const webVideoRef = useRef<any>(null);
  const [showFullscreenHint, setShowFullscreenHint] = useState(false);
  const [channelSearch, setChannelSearch] = useState('');
  const [showChannelKeyboard, setShowChannelKeyboard] = useState(false);
  const [unlockedForSession, setUnlockedForSession] = useState<string[]>([]);
  const [showSwitchPageModal, setShowSwitchPageModal] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const categoryPreferences = useAppStore(s => s.categoryPreferences);
  const defaultPrefs = useMemo(() => ({ hiddenIds: [], liveOrder: [], vodOrder: [], seriesOrder: [] }), []);
  const prefs = categoryPreferences[activePlaylistId] || defaultPrefs;

  const orderedLiveCats = useMemo(() => {
    if (!activeCategories?.live) return [];
    
    let filtered = activeCategories.live.filter((c: any) => 
      !prefs.hiddenIds.includes(c.id) && 
      !c.name.toLowerCase().includes('remote search')
    );
    
    if (prefs.liveOrder && prefs.liveOrder.length > 0) {
      const orderMap = new Map<string, number>(prefs.liveOrder.map((id, index) => [id, index]));
      filtered.sort((a: any, b: any) => {
        const idxA = orderMap.has(a.id) ? orderMap.get(a.id)! : 999999;
        const idxB = orderMap.has(b.id) ? orderMap.get(b.id)! : 999999;
        return idxA - idxB;
      });
    }
    return filtered;
  }, [activeCategories?.live, prefs]);

  const [categorySearch, setCategorySearch] = useState('');
  const [showCategoryKeyboard, setShowCategoryKeyboard] = useState(false);

  const categories = useMemo(() => [
    { id: '__all__', name: t('all') || 'All' },
    { id: '__search__', name: t('remote_search') },
    { id: '__favorites__', name: t('favorites') },
    { id: '__recent__', name: t('continue_watching') },
    ...orderedLiveCats
  ], [orderedLiveCats, t]);

  const filteredCategories = useMemo(() => {
    if (!categorySearch.trim()) return categories;
    const q = categorySearch.toLowerCase().trim();
    return categories.filter(c => c.name.toLowerCase().includes(q));
  }, [categories, categorySearch]);

  const filteredChannels = useMemo(() => {
    if (!channelSearch.trim()) return localChannels;
    const q = channelSearch.toLowerCase().trim();
    return localChannels.filter(ch => ch.name.toLowerCase().includes(q));
  }, [localChannels, channelSearch]);

  // Category reordering is now handled in settings > manage categories

  const moveChannel = async (direction: 'up' | 'down') => {
    if (!selectedChannel || !selectedCategory || selectedCategory.id === '__favorites__' || selectedCategory.id === '__recent__') return;
    
    if (channelSearch.trim().length > 0) return;

    const currentIndex = localChannels.findIndex(c => c.id === selectedChannel.id);
    if (currentIndex === -1) return;
    if (direction === 'up' && currentIndex === 0) return;
    if (direction === 'down' && currentIndex === localChannels.length - 1) return;

    const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    const newChannels = [...localChannels];
    const temp = newChannels[currentIndex];
    newChannels[currentIndex] = newChannels[swapIndex];
    newChannels[swapIndex] = temp;

    setLocalChannels(newChannels);
    
    try {
      const newOrder = newChannels.map(c => c.id);
      await AsyncStorage.setItem(`channel_order_${selectedCategory.id}`, JSON.stringify(newOrder));
    } catch (e) {
      console.error("Failed to save custom order:", e);
    }
  };

  const navigateChannel = (direction: 'prev' | 'next') => {
    if (!selectedChannel || localChannels.length === 0) return;
    const currentIndex = localChannels.findIndex(c => c.id === selectedChannel.id);
    if (currentIndex === -1) return;
    
    let nextIndex;
    if (direction === 'prev') {
      nextIndex = currentIndex === 0 ? localChannels.length - 1 : currentIndex - 1;
    } else {
      nextIndex = currentIndex === localChannels.length - 1 ? 0 : currentIndex + 1;
    }
    
    const newChannel = localChannels[nextIndex];
    setSelectedChannel(newChannel);
  };

  const isFavorite = useMemo(() => {
    if (!selectedChannel) return false;
    return favoriteItems.some(item => item.id === selectedChannel.id || item.streamUrl === selectedChannel.streamUrl);
  }, [favoriteItems, selectedChannel]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isFullscreen) {
        setIsFullscreen(false);
        return true;
      }
      return false;
    });
    
    const handleKeyDown = (e: any) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    if (Platform.OS === 'web') {
      window.addEventListener('keydown', handleKeyDown);
    }

    if (isFullscreen) {
      setShowFullscreenHint(true);
      const timer = setTimeout(() => setShowFullscreenHint(false), 4000);
      return () => {
        backHandler.remove();
        if (Platform.OS === 'web') window.removeEventListener('keydown', handleKeyDown);
        clearTimeout(timer);
      };
    }

    return () => {
      backHandler.remove();
      if (Platform.OS === 'web') {
        window.removeEventListener('keydown', handleKeyDown);
      }
    };
  }, [isFullscreen]);

  // Load channels when category changes
  const loadCategory = useCallback(async (cat: { id: string; name: string }) => {
    if (!activePlaylistId && cat.id !== '__favorites__' && cat.id !== '__recent__') return;
    setLoading(true);
    setDisplayCount(50);

    try {
      if (cat.id === '__all__') {
        const liveCats = useAppStore.getState().activeCategories?.live || [];
        if (liveCats.length > 0) {
          const randomCats = [...liveCats].sort(() => 0.5 - Math.random()).slice(0, 5);
          const chunks = await Promise.all(
            randomCats.map(c => getChannelsForCategory(activePlaylistId, 'live', c.id, c.name).catch(() => []))
          );
          const shuffled = chunks.flat().sort(() => 0.5 - Math.random());
          setLocalChannels(shuffled);
          if (isLargeScreen && shuffled.length > 0) {
            setSelectedChannel(shuffled[0]);
          } else if (shuffled.length === 0) {
            setSelectedChannel(null);
          }
        }
      } else if (cat.id === '__favorites__') {
        const storeFavs = useAppStore.getState().favoriteItems || [];
        const favs = storeFavs
          .filter((item: any) => item.type === 'live' || item.isLive === true || (item.isLive as unknown) === 'true')
          .map(toChannel);
        setLocalChannels(favs);
        if (isLargeScreen && favs.length > 0) {
          setSelectedChannel(favs[0]);
        } else if (favs.length === 0) {
          setSelectedChannel(null);
        }
      } else if (cat.id === '__recent__') {
        const storeRecent = useAppStore.getState().continueWatching || [];
        const recents = storeRecent
          .filter((item: any) => item.type === 'live' || item.isLive === true || (item.isLive as unknown) === 'true')
          .map(toChannel);
        setLocalChannels(recents);
        if (isLargeScreen && recents.length > 0) {
          setSelectedChannel(recents[0]);
        } else if (recents.length === 0) {
          setSelectedChannel(null);
        }
      } else {
        const result = await getChannelsForCategory(activePlaylistId, 'live', cat.id, cat.name);
        
        try {
          const orderStr = await AsyncStorage.getItem(`channel_order_${cat.id}`);
          if (orderStr) {
            const orderArr = JSON.parse(orderStr);
            const orderMap = new Map<string, number>(orderArr.map((id: string, index: number) => [id, index]));
            const sortedResult = [...result].sort((a, b) => {
              const idxA = orderMap.has(a.id) ? orderMap.get(a.id) as number : 999999;
              const idxB = orderMap.has(b.id) ? orderMap.get(b.id) as number : 999999;
              return idxA - idxB;
            });
            setLocalChannels(sortedResult);
            if (isLargeScreen && sortedResult.length > 0) {
              setSelectedChannel(sortedResult[0]);
            }
            return;
          }
        } catch (e) {
          console.error("Failed to load custom order:", e);
        }

        setLocalChannels(result);
        if (isLargeScreen && result.length > 0) {
          setSelectedChannel(result[0]);
        }
      }
    } catch (e) {
      setLocalChannels([]);
    } finally {
      setLoading(false);
    }
  }, [activePlaylistId, getChannelsForCategory, isLargeScreen]);

  useEffect(() => {
    if (selectedCategory) {
      loadCategory(selectedCategory);
    }
  }, [selectedCategory, loadCategory]);

  useEffect(() => {
    if (orderedLiveCats.length > 0 && !hasDefaulted.current) {
      setSelectedCategory(categories.find(c => c.id === '__recent__') || null);
      hasDefaulted.current = true;
    }
  }, [orderedLiveCats, isLargeScreen, isParentalLocked]);

  useEffect(() => {
    hasDefaulted.current = false;
  }, [activePlaylistId]);

  useEffect(() => {
    if (selectedCategory?.id === '__favorites__') {
      const favs = (favoriteItems || [])
        .filter((item: any) => item.type === 'live' || item.isLive === true || (item.isLive as unknown) === 'true')
        .map(toChannel);
      setLocalChannels(favs);
    } else if (selectedCategory?.id === '__recent__') {
      const recents = (continueWatching || [])
        .filter((item: any) => item.type === 'live' || item.isLive === true || (item.isLive as unknown) === 'true')
        .map(toChannel);
      setLocalChannels(recents);
    }
  }, [favoriteItems, continueWatching, selectedCategory?.id]);

  const { categoryId, focusId } = useLocalSearchParams<{ categoryId?: string; focusId?: string }>();

  useEffect(() => {
    if (focusId && localChannels.length > 0) {
      const idx = localChannels.findIndex(m => m.id === focusId);
      if (idx >= 0) {
        setSelectedChannel(localChannels[idx]);
        if (idx >= displayCount) {
          setDisplayCount(idx + 20);
        }
        setTimeout(() => {
          flatListRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 });
        }, 500);
      }
    }
  }, [localChannels, focusId]);

  // Auto-select category: Defaults to Favorites (SPECIAL_CATEGORIES[0])
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (categoryId && categories.length > 0) {
        const targetCat = categories.find(c => c.id === categoryId);
        if (targetCat) {
          if (!selectedCategory || selectedCategory.id !== targetCat.id) {
            setSelectedCategory(targetCat);
          }
          hasDefaulted.current = true;
          router.setParams({ categoryId: '' });
          return;
        }
      }

      if (categories.length > 0) {
        if (!selectedCategory) {
          const defaultCat = categories.find(c => !['__search__', '__favorites__', '__recent__'].includes(c.id)) || categories.find(c => c.id === '__favorites__') || categories[0];
          setSelectedCategory(defaultCat);
        }
        hasDefaulted.current = true;
      } else {
        if (selectedCategory) {
          setSelectedCategory(null);
        }
        hasDefaulted.current = false;
      }
    });

    return unsubscribe;
  }, [navigation, categories, categoryId, selectedCategory]);

  useEffect(() => {
    if (categories.length > 0 && !hasDefaulted.current) {
      if (isLargeScreen) {
        const defaultCat = categories.find(c => !['__search__', '__favorites__', '__recent__'].includes(c.id)) || categories.find(c => c.id === '__favorites__') || categories[0];
        setSelectedCategory(defaultCat);
      }
      hasDefaulted.current = true;
    }
  }, [categories, isLargeScreen]);

  useEffect(() => {
    hasDefaulted.current = false;
    setSelectedCategory(null);
    setLocalChannels([]);
    setSelectedChannel(null);
  }, [activePlaylistId]);

  const isSelectedLocked = selectedChannel ? (isChannelLocked(selectedChannel.id) && !unlockedForSession.includes(selectedChannel.id)) : false;

  const player = useVideoPlayer(isLargeScreen && selectedChannel && isFocused && !isSelectedLocked ? selectedChannel.streamUrl : null, (p) => {
    p.volume = 1;
    p.play();
  });

  // Track buffering for native video player
  useEffect(() => {
    if (!isLargeScreen || Platform.OS === 'web' || !player) return;
    const subscription = player.addListener('statusChange', (payload) => {
      setIsVideoBuffering(payload.status !== 'readyToPlay');
    });
    return () => subscription.remove();
  }, [player, isLargeScreen]);

  useEffect(() => {
    if (selectedChannel) {
      setIsVideoBuffering(true);
    }
  }, [selectedChannel?.id]);

  const playChannelMobile = useCallback((channel: Channel, index: number) => {
    setPlaybackQueue(filteredChannels, index);
    updateContinueWatching({
      id: channel.id,
      title: channel.name,
      name: channel.name,
      poster: channel.logo || '',
      logo: channel.logo || '',
      category: channel.category || 'Live TV',
      streamUrl: channel.streamUrl,
      current: channel.current || '',
      next: channel.next || '',
      quality: channel.quality || 'HD',
      isLive: true,
      type: 'live',
      timestamp: Date.now()
    } as any);
    router.push({
      pathname: '/player',
      params: {
        id: channel.id,
        streamUrl: channel.streamUrl,
        title: channel.name,
        isLive: 'true',
        current: channel.current,
        next: channel.next,
        quality: channel.quality,
        logo: channel.logo || '',
        category: channel.category || '',
      },
    });
  }, [filteredChannels, setPlaybackQueue, updateContinueWatching]);

  const openBigPlayer = useCallback((channel: Channel) => {
    const queueToUse = filteredChannels.length > 0 ? filteredChannels : localChannels;
    const channelIdx = queueToUse.findIndex(c => c.id === channel.id);
    if (channelIdx >= 0) {
      setPlaybackQueue(queueToUse, channelIdx);
    }
    
    updateContinueWatching({
      id: channel.id,
      title: channel.name,
      name: channel.name,
      poster: channel.logo || '',
      logo: channel.logo || '',
      category: channel.category || 'Live TV',
      streamUrl: channel.streamUrl,
      current: channel.current || '',
      next: channel.next || '',
      quality: channel.quality || 'HD',
      isLive: true,
      type: 'live',
      timestamp: Date.now()
    } as any);

    setIsFullscreen(true);
  }, [filteredChannels, localChannels, setPlaybackQueue, updateContinueWatching]);



  if (isLargeScreen) {
    const isWeb = Platform.OS === 'web';
    const glassPaneStyle: any = isWeb ? {
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      backdropFilter: 'blur(30px)',
      WebkitBackdropFilter: 'blur(30px)',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
      marginTop: 12,
      marginBottom: 32,
      marginRight: 16,
      overflow: 'hidden',
    } : {
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
      marginTop: 12,
      marginBottom: 32,
      marginRight: 16,
      overflow: 'hidden',
    };

    return (
      <View style={[styles.tvContainer, { backgroundColor: isLargeScreen ? 'transparent' : colors.background, paddingLeft: isFullscreen ? 0 : 24, opacity: isFocused ? 1 : 0, pointerEvents: isFocused ? 'auto' : 'none' }]}>
        <View style={[{ flexDirection: 'row', width: 630 }, glassPaneStyle]}>
          {/* Pane 1: Categories */}
          <View nativeID="tour-live-categories" {...({ id: 'tour-live-categories' } as any)} style={[styles.tvPaneCategories, { borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.08)' }]}>
            <View style={styles.tvHeader}>
              <Text style={[styles.tvTitle, { color: colors.text }]}>{t('categories')}</Text>
              <View style={[styles.searchBox, { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.1)' }]}>
                <Ionicons name="search" size={14} color={colors.mutedForeground} />
                {isLargeScreen ? (
                  <TVFocusable onPress={() => setShowCategoryKeyboard(true)} style={{ flex: 1, paddingVertical: 4 }}>
                    <Text style={[styles.searchInput, { color: categorySearch ? colors.text : colors.mutedForeground, marginTop: 4 }]}>
                      {categorySearch || t('search_categories')}
                    </Text>
                  </TVFocusable>
                ) : (
                  <TextInput
                    style={[styles.searchInput, { color: colors.text }]}
                    placeholder={t('search_categories')}
                    placeholderTextColor={colors.mutedForeground}
                    value={categorySearch}
                    onChangeText={setCategorySearch}
                  />
                )}
                {categorySearch ? (
                  <TVFocusable onPress={() => { setCategorySearch(''); setShowCategoryKeyboard(false); }} disableBorder>
                    <Ionicons name="close-circle" size={18} color={colors.mutedForeground} style={{ padding: 4 }} />
                  </TVFocusable>
                ) : null}
              </View>
            </View>


            <ScrollView style={{ flex: 1 }}>
              {filteredCategories.map((item: any, index) => {
                const isSelected = selectedCategory?.id === item.id;
                const isSpecial = item.id.startsWith('__');
                return (
                  <View 
                    key={item.id}
                    style={[
                      styles.tvCategoryItem,
                      { padding: 0, paddingHorizontal: 0, paddingVertical: 0, flexDirection: 'row', alignItems: 'stretch' },
                      isSelected && { backgroundColor: 'rgba(212,168,67,0.15)', borderLeftWidth: 3, borderLeftColor: colors.gold }
                    ]}
                  >
                    <TVFocusable
                      hasTVPreferredFocus={isSelected}
                      onPress={() => {
                        if (item.id === '__search__') {
                          router.push({ pathname: '/search', params: { tab: 'live' } });
                        } else {
                          if (isParentalLocked(item.id)) {
                            setPendingCategory(item);
                            setPinModalVisible(true);
                          } else {
                            setSelectedCategory(item);
                          }
                        }
                      }}
                      style={({ focused }: any) => [
                        { flex: 1, padding: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 8 },
                        focused && { backgroundColor: colors.gold, transform: [{ scale: 1.02 }] }
                      ]}
                    >
                      {({ focused }: any) => (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                          {item.id === '__search__' && (
                            <Lineicons icon={Search1Bulk} size={16} color={focused ? '#000' : (isSelected ? colors.gold : colors.text)} />
                          )}
                          {item.id === '__favorites__' && (
                            <Lineicons icon={HeartBulk} size={16} color={focused ? '#000' : (isSelected ? colors.gold : colors.text)} />
                          )}
                          {item.id === '__recent__' && (
                            <Ionicons name="time" size={16} color={focused ? '#000' : (isSelected ? colors.gold : colors.text)} />
                          )}
                          <MarqueeText 
                            text={`${item.name}${item.count !== undefined ? ` (${item.count})` : ''}`}
                            isFocused={focused || isSelected}
                            style={[
                              styles.tvCategoryText, 
                              { color: focused ? '#000' : (isSelected ? colors.gold : colors.text), fontWeight: isSelected || isSpecial ? 'bold' : '500' }
                            ]} 
                          />
                        </View>
                      )}
                    </TVFocusable>
                  </View>
                );
              })}
            </ScrollView>
          </View>

          {/* Pane 2: Channels */}
          <View style={[styles.tvPaneChannels]}>
            <View style={styles.tvHeader}>
              <Text style={[styles.tvTitle, { color: colors.text }]}>{t('channels')}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
                <View style={[styles.searchBox, { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.1)' }]}>
                  <Ionicons name="search" size={14} color={colors.mutedForeground} />
                  {isLargeScreen ? (
                    <TVFocusable onPress={() => setShowChannelKeyboard(true)} style={{ flex: 1, paddingVertical: 4 }}>
                      <Text style={[styles.searchInput, { color: channelSearch ? colors.text : colors.mutedForeground, marginTop: Platform.OS === 'web' ? 4 : 0 }]}>
                        {channelSearch || t('search_channels')}
                      </Text>
                    </TVFocusable>
                  ) : (
                    <TextInput
                      style={[styles.searchInput, { color: colors.text }]}
                      placeholder={t('search_channels')}
                      placeholderTextColor={colors.mutedForeground}
                      value={channelSearch}
                      onChangeText={setChannelSearch}
                    />
                  )}
                  {channelSearch ? (
                    <TVFocusable onPress={() => { setChannelSearch(''); setShowChannelKeyboard(false); }} disableBorder>
                      <Ionicons name="close-circle" size={18} color={colors.mutedForeground} style={{ padding: 4 }} />
                    </TVFocusable>
                  ) : null}
                </View>
              </View>
            </View>
            {filteredChannels.length === 0 && !loading ? (
              <View style={styles.centerAll}>
                <Lineicons icon={MonitorBulk} size={48} color={colors.mutedForeground} />
                <Text style={[styles.emptyTitle, { color: colors.text, marginTop: 12 }]}>{t('no_channels')}</Text>
              </View>
            ) : (
              <View style={{ flex: 1, opacity: loading ? 0.5 : 1 }}>
                <FlatList
                  ref={flatListRef}
                  onScrollToIndexFailed={(info) => {
                    const offset = info.averageItemLength * info.index;
                    flatListRef.current?.scrollToOffset({ offset, animated: false });
                    setTimeout(() => {
                      try {
                        flatListRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0.5 });
                      } catch (e) {}
                    }, 300);
                  }}
                  removeClippedSubviews={true}
                  initialNumToRender={8}
                  maxToRenderPerBatch={12}
                  windowSize={5}
                  data={filteredChannels.slice(0, displayCount)}
                  onEndReached={() => setDisplayCount(prev => prev + 50)}
                  onEndReachedThreshold={0.5}
                  keyExtractor={(item) => item.id}
                  style={{ flex: 1 }}
                  renderItem={({ item, index }) => {
                    const isSelected = selectedChannel?.id === item.id;
                    return (
                      <TVFocusable
                        hasTVPreferredFocus={focusId === item.id}
                        onPress={() => {
                          if (isChannelLocked(item.id) && !unlockedForSession.includes(item.id)) {
                            setPendingChannelPlay({ ...item, index });
                            setPinModalVisible(true);
                            return;
                          }
                          setSelectedChannel(item);
                          setShowChannelKeyboard(false);
                          setShowCategoryKeyboard(false);
                        }}
                        style={({ focused }: any) => [
                          styles.tvChannelItem,
                          (isSelected || focusId === item.id) && { backgroundColor: 'rgba(212,168,67,0.15)', borderLeftWidth: 3, borderLeftColor: colors.gold },
                          focused && { backgroundColor: colors.gold, transform: [{ scale: 1.02 }] }
                        ]}
                      >
                        {({ focused }: any) => (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            {item.logo ? (
                               <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                                 <Image 
                                    source={{ 
                                      uri: item.logo,
                                      headers: {
                                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                                      }
                                    }} 
                                    style={{ width: '100%', height: '100%' }} contentFit="contain" />
                               </View>
                            ) : (
                              <View style={[styles.tvChannelIconPlaceholder, { backgroundColor: focused ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.05)' }]}>
                                <Lineicons icon={MonitorBulk} size={20} color={focused ? '#000' : colors.text} />
                              </View>
                            )}
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.tvChannelText, { color: focused ? '#000' : colors.text, fontWeight: isSelected ? 'bold' : '500' }]} numberOfLines={1}>
                                {item.num ? `${item.num} - ` : ''}{item.name}
                              </Text>
                              {item.id.startsWith('xt_live_') && (
                                <EpgNowNext streamId={item.id.replace('xt_live_', '')} />
                              )}
                            </View>
                          </View>
                        )}
                      </TVFocusable>
                    );
                  }}
                />
              </View>
            )}
          </View>
        </View>

        {/* Pane 3: Video Player */}
        <View style={isFullscreen ? [StyleSheet.absoluteFill, { zIndex: 9999, backgroundColor: '#000' }] : [styles.tvPanePlayer, glassPaneStyle, { marginRight: 32 }]}>
          {showCategoryKeyboard ? (
            <SearchKeyboardModal 
              visible={showCategoryKeyboard}
              value={categorySearch}
              onChangeText={setCategorySearch}
              onClose={() => setShowCategoryKeyboard(false)}
              placeholder={t('search_categories')}
              inline
            />
          ) : showChannelKeyboard ? (
            <SearchKeyboardModal 
              visible={showChannelKeyboard}
              value={channelSearch}
              onChangeText={setChannelSearch}
              onClose={() => setShowChannelKeyboard(false)}
              placeholder={t('search_channels')}
              inline
            />
          ) : selectedChannel ? (
            <>
              <TVFocusable
                style={[styles.tvPlayerWrapper, isFullscreen && { aspectRatio: undefined, borderRadius: 0, ...StyleSheet.absoluteFillObject }]}
                onPress={() => {
                  if (isSelectedLocked) {
                    setPendingChannelPlay({ ...selectedChannel, index: 0 });
                    setPinModalVisible(true);
                  } else if (!isFullscreen) openBigPlayer(selectedChannel);
                }}
              >
                {isSelectedLocked ? (
                  <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' }]}>
                    <Ionicons name="lock-closed" size={64} color={colors.gold} />
                    <Text style={{ color: colors.text, marginTop: 16, fontSize: 18, fontWeight: 'bold' }}>Channel Locked</Text>
                    <Text style={{ color: colors.mutedForeground, marginTop: 8 }}>Press to unlock</Text>
                  </View>
                ) : Platform.OS === 'web' ? (
                  isFocused ? (
                    <WebVideoPlayer
                      ref={webVideoRef}
                      source={`/proxy?url=${encodeURIComponent(selectedChannel.streamUrl)}`}
                      style={StyleSheet.absoluteFill}
                      paused={isPaused}
                      muted={isMuted}
                      controls={false}
                      aspectMode={aspectMode}
                      onFullscreenExit={() => setIsFullscreen(false)}
                      onReady={() => setIsVideoBuffering(false)}
                    />
                  ) : null
                ) : (
                  isFocused ? <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" /> : null
                )}
                {isVideoBuffering && (
                  <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }]} pointerEvents="none">
                    <ActivityIndicator size="large" color={colors.gold} />
                  </View>
                )}
              </TVFocusable>

              {isFullscreen && (
                <View style={[StyleSheet.absoluteFill, { padding: 32, pointerEvents: 'box-none', zIndex: 99999, justifyContent: 'space-between' }]}>
                   <View style={{ flexDirection: 'row', alignItems: 'center', gap: 24, pointerEvents: 'box-none' }}>
                     <TVFocusable 
                       onPress={() => setIsFullscreen(false)}
                       style={({ focused }: any) => [
                         { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
                         focused && { backgroundColor: colors.gold, transform: [{ scale: 1.1 }] }
                       ]}
                     >
                       {({ focused }: any) => <Lineicons icon={ArrowLeftBulk} size={32} color={focused ? "#000" : "#FFF"} />}
                     </TVFocusable>
                     <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#FFF', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 }}>
                       {selectedChannel.num ? `${selectedChannel.num} - ` : ''}{selectedChannel.name}
                     </Text>
                   </View>

                   <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 32, paddingBottom: 20, pointerEvents: 'box-none' }}>
                     {selectedCategory && selectedCategory.id !== '__favorites__' && selectedCategory.id !== '__recent__' && !channelSearch && (
                       <TVFocusable 
                         onPress={() => navigateChannel('prev')}
                         style={({ focused }: any) => [
                           { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
                           focused && { backgroundColor: colors.gold, transform: [{ scale: 1.1 }] }
                         ]}
                       >
                         {({ focused }: any) => <Ionicons name="play-skip-back" size={24} color={focused ? "#000" : "#FFF"} />}
                       </TVFocusable>
                     )}

                     <TVFocusable 
                       onPress={() => setIsPaused(!isPaused)}
                       style={({ focused }: any) => [
                         { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', paddingLeft: isPaused ? 4 : 0 },
                         focused && { backgroundColor: colors.gold, transform: [{ scale: 1.1 }] }
                       ]}
                     >
                       {({ focused }: any) => <Ionicons name={isPaused ? "play" : "pause"} size={32} color={focused ? "#000" : "#FFF"} />}
                     </TVFocusable>

                     {selectedCategory && selectedCategory.id !== '__favorites__' && selectedCategory.id !== '__recent__' && !channelSearch && (
                       <TVFocusable 
                         onPress={() => navigateChannel('next')}
                         style={({ focused }: any) => [
                           { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
                           focused && { backgroundColor: colors.gold, transform: [{ scale: 1.1 }] }
                         ]}
                       >
                         {({ focused }: any) => <Ionicons name="play-skip-forward" size={24} color={focused ? "#000" : "#FFF"} />}
                       </TVFocusable>
                     )}
                   </View>

                   <View style={{ position: 'absolute', right: 32, bottom: 52, flexDirection: 'row', alignItems: 'center', gap: 16, pointerEvents: 'box-none' }}>
                     <TVFocusable 
                       onPress={toggleAspectMode}
                       style={({ focused }: any) => [
                         { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
                         focused && { backgroundColor: colors.gold, transform: [{ scale: 1.1 }] }
                       ]}
                     >
                       {({ focused }: any) => <MaterialCommunityIcons name={aspectMode === 0 ? "aspect-ratio" : aspectMode === 1 ? "stretch-to-page-outline" : aspectMode === 2 ? "crop-free" : aspectMode === 3 ? "panorama-wide-angle" : "panorama-vertical"} size={28} color={focused ? "#000" : "#FFF"} />}
                     </TVFocusable>

                     <TVFocusable 
                       onPress={() => webVideoRef.current?.togglePiP?.()}
                       style={({ focused }: any) => [
                         { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
                         focused && { backgroundColor: colors.gold, transform: [{ scale: 1.1 }] }
                       ]}
                     >
                       {({ focused }: any) => <Ionicons name="layers" size={28} color={focused ? "#000" : "#FFF"} />}
                     </TVFocusable>

                     <TVFocusable 
                       onPress={() => setIsMuted(!isMuted)}
                       style={({ focused }: any) => [
                         { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
                         focused && { backgroundColor: colors.gold, transform: [{ scale: 1.1 }] }
                       ]}
                     >
                       {({ focused }: any) => <Ionicons name={isMuted ? "volume-mute" : "volume-high"} size={28} color={focused ? "#000" : "#FFF"} />}
                     </TVFocusable>
                   </View>
                </View>
              )}

              {!isFullscreen && (
                <View style={[styles.tvPlayerInfo, { backgroundColor: 'rgba(20,20,20,0.95)', borderTopColor: colors.border }]}>
                  <Text style={[styles.tvPlayerTitle, { color: colors.text }]} numberOfLines={2} adjustsFontSizeToFit>{selectedChannel.name}</Text>
                  <Text style={{ color: colors.mutedForeground, marginTop: 4 }}>Now Playing • {selectedChannel.category}</Text>
                  <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
                    <TVFocusable
                      onPress={() => {
                        if (!selectedChannel) return;
                        const channelItem: any = {
                          id: selectedChannel.id,
                          name: selectedChannel.name,
                          logo: selectedChannel.logo || '',
                          category: selectedChannel.category || 'Live TV',
                          streamUrl: selectedChannel.streamUrl,
                          current: selectedChannel.current || '',
                          next: selectedChannel.next || '',
                          quality: selectedChannel.quality || 'HD',
                          isLive: true,
                          type: 'live'
                        };
                        toggleFavorite(channelItem);
                      }}
                      style={({ focused }: any) => [
                        styles.tvFavoriteBtn,
                        { backgroundColor: focused ? colors.gold : 'rgba(255,255,255,0.05)', borderColor: isFavorite ? colors.gold : colors.border, marginTop: 0, paddingHorizontal: 16 }
                      ]}
                    >
                      {({ focused }: any) => (
                        <Lineicons icon={HeartBulk} size={22} color={focused ? '#000' : (isFavorite ? colors.gold : colors.text)} />
                      )}
                    </TVFocusable>
                    <TVFocusable
                      onPress={() => {
                        console.log('LOCK BUTTON PRESSED in live.tsx. Selected channel:', selectedChannel?.id, 'parentalPin:', parentalPin);
                        if (!selectedChannel) return;
                        if (parentalPin) {
                          console.log('parentalPin exists, showing PinModal');
                          setPendingChannelLock(selectedChannel.id);
                          setPinModalVisible(true);
                        } else {
                          console.log('parentalPin does not exist, directly locking channel');
                          toggleChannelLock(selectedChannel.id);
                        }
                      }}
                      style={({ focused }: any) => [
                        styles.tvFavoriteBtn,
                        { backgroundColor: focused ? colors.gold : 'rgba(255,255,255,0.05)', borderColor: isChannelLocked(selectedChannel.id) ? colors.gold : colors.border, marginTop: 0, paddingHorizontal: 16 }
                      ]}
                    >
                      {({ focused }: any) => (
                        <Ionicons name="lock-closed" size={22} color={focused ? '#000' : (isChannelLocked(selectedChannel.id) ? colors.gold : colors.text)} />
                      )}
                    </TVFocusable>
                    <TVFocusable
                      onPress={() => setShowSwitchPageModal(true)}
                      style={({ focused }: any) => [
                        styles.tvFavoriteBtn,
                        { backgroundColor: focused ? colors.gold : 'rgba(255,255,255,0.05)', borderColor: colors.border, marginTop: 0, paddingHorizontal: 16 }
                      ]}
                    >
                      {({ focused }: any) => (
                        <Ionicons name="apps" size={22} color={focused ? '#000' : colors.text} />
                      )}
                    </TVFocusable>
                    
                    {selectedCategory && selectedCategory.id !== '__favorites__' && selectedCategory.id !== '__recent__' && !channelSearch && (
                      <>
                        <TVFocusable
                          onPress={() => moveChannel('up')}
                          style={({ focused }: any) => [
                            styles.tvFavoriteBtn,
                            { backgroundColor: focused ? colors.gold : 'rgba(255,255,255,0.05)', borderColor: colors.border, marginTop: 0, paddingHorizontal: 16 }
                          ]}
                        >
                          {({ focused }: any) => (
                            <Ionicons name="chevron-up" size={22} color={focused ? '#000' : colors.text} />
                          )}
                        </TVFocusable>

                        <TVFocusable
                          onPress={() => moveChannel('down')}
                          style={({ focused }: any) => [
                            styles.tvFavoriteBtn,
                            { backgroundColor: focused ? colors.gold : 'rgba(255,255,255,0.05)', borderColor: colors.border, marginTop: 0, paddingHorizontal: 16 }
                          ]}
                        >
                          {({ focused }: any) => (
                            <Ionicons name="chevron-down" size={22} color={focused ? '#000' : colors.text} />
                          )}
                        </TVFocusable>
                      </>
                    )}
                  </View>
                </View>
              )}
              {showFullscreenHint && (
                <View style={{ position: 'absolute', top: 40, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, zIndex: 99999 }}>
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>Press ESC to exit Full Screen</Text>
                </View>
              )}
            </>
          ) : (
            <View style={styles.centerAll}>
              <Lineicons icon={MonitorBulk} size={48} color={colors.mutedForeground} />
              <Text style={{ color: colors.mutedForeground, marginTop: 16 }}>Select a channel to play</Text>
            </View>
          )}
        </View>

        {/* Switch Page Modal */}
        <Modal 
          visible={showSwitchPageModal} 
          transparent 
          animationType="fade"
          onRequestClose={() => setShowSwitchPageModal(false)}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' }}>
            <View style={{ backgroundColor: colors.surface, padding: 32, borderRadius: 24, borderWidth: 1, borderColor: colors.border, width: 600 }}>
              <Text style={{ color: colors.text, fontSize: 24, fontWeight: 'bold', marginBottom: 24, textAlign: 'center' }}>Switch Page</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, justifyContent: 'center' }}>
                {[
                   { name: 'Home', path: '/', icon: 'home' },
                   { name: 'Live TV', path: '/live', icon: 'tv' },
                   { name: 'Movies', path: '/movies', icon: 'film' },
                   { name: 'Series', path: '/series', icon: 'albums' },
                   { name: 'Catch Up', path: '/catchup', icon: 'time' },
                ].map((page, index) => (
                  <TVFocusable
                    key={page.path}
                    hasTVPreferredFocus={index === 0}
                    onPress={() => {
                      setShowSwitchPageModal(false);
                      router.replace(page.path as any);
                    }}
                    style={({ focused }: any) => [
                      { alignItems: 'center', padding: 20, borderRadius: 16, width: 140, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'transparent' },
                      focused && { backgroundColor: colors.gold, borderColor: colors.gold, transform: [{ scale: 1.05 }] }
                    ]}
                  >
                    {({ focused }: any) => (
                      <>
                        <Ionicons name={page.icon as any} size={32} color={focused ? '#000' : colors.text} style={{ marginBottom: 12 }} />
                        <Text style={{ color: focused ? '#000' : colors.text, fontWeight: 'bold', fontSize: 16 }}>{page.name}</Text>
                      </>
                    )}
                  </TVFocusable>
                ))}
              </View>
              <TVFocusable 
                onPress={() => setShowSwitchPageModal(false)}
                style={({ focused }: any) => [
                  { marginTop: 32, paddingVertical: 12, paddingHorizontal: 32, borderRadius: 100, alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.1)' },
                  focused && { backgroundColor: colors.gold }
                ]}
              >
                {({ focused }: any) => (
                  <Text style={{ color: focused ? '#000' : colors.text, fontWeight: 'bold' }}>Close</Text>
                )}
              </TVFocusable>
            </View>
          </View>
        </Modal>
        <PinModal 
          visible={pinModalVisible} 
          expectedPin={parentalPin}
          onCancel={() => {
            setPinModalVisible(false);
            setPendingCategory(null);
            setPendingChannelPlay(null);
            setPendingChannelLock(null);
          }}
          onSuccess={() => {
            setPinModalVisible(false);
            if (pendingCategory) {
              setSelectedCategory(pendingCategory);
              setPendingCategory(null);
            } else if (pendingChannelPlay) {
              setUnlockedForSession(prev => [...prev, pendingChannelPlay.id]);
              setSelectedChannel(pendingChannelPlay);
              setShowChannelKeyboard(false);
              setShowCategoryKeyboard(false);
              setPendingChannelPlay(null);
            } else if (pendingChannelLock) {
              toggleChannelLock(pendingChannelLock);
              setPendingChannelLock(null);
            }
          }}
        />
      </View>
    );
  }

  // Mobile layout below
  if (selectedCategory) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top, opacity: isFocused ? 1 : 0, pointerEvents: isFocused ? 'auto' : 'none' }]}>
        <View style={[styles.header, isLandscape && { paddingTop: 4, paddingBottom: 4 }]}>
          <TVFocusable 
            onPress={() => setSelectedCategory(null)} 
            style={{ marginRight: 8, padding: 8, zIndex: 9999, elevation: 9999 }}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
            disableBorder
          >
             <View pointerEvents="none">
               <Lineicons icon={ArrowRightBulk} size={24} color={colors.text} style={{ transform: [{ rotate: '180deg' }] }} />
             </View>
          </TVFocusable>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={[styles.title, { color: colors.text, fontSize: isLandscape ? 18 : 20 }]} numberOfLines={1}>
              {selectedCategory.name}
            </Text>
            <Text style={[styles.count, { color: colors.mutedForeground, fontSize: isLandscape ? 11 : 13 }]}>
              {filteredChannels.length.toLocaleString()} channels
            </Text>
          </View>
        </View>

        <View style={{ paddingHorizontal: 20, marginBottom: 10 }}>
          <View style={[styles.searchBox, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
            <Ionicons name="search" size={16} color={colors.mutedForeground} />
            <TVFocusable onPress={() => setShowChannelKeyboard(true)} style={{ flex: 1, paddingVertical: 4 }}>
              <Text style={[styles.searchInput, { color: channelSearch ? colors.text : colors.mutedForeground, marginTop: 4 }]}>
                {channelSearch || t('search_channels')}
              </Text>
            </TVFocusable>
            {channelSearch ? (
              <TVFocusable disableBorder onPress={() => setChannelSearch('')}>
                <Ionicons name="close-circle" size={16} color={colors.mutedForeground} />
              </TVFocusable>
            ) : null}
          </View>
        </View>
        <SearchKeyboardModal 
          visible={showChannelKeyboard}
          value={channelSearch}
          onChangeText={setChannelSearch}
          onClose={() => setShowChannelKeyboard(false)}
          placeholder={t('search_channels')}
          inline={false}
        />

        {loading ? (
          <View style={styles.centerAll}>
            <ActivityIndicator size="large" color={colors.gold} />
          </View>
        ) : filteredChannels.length === 0 ? (
          <View style={styles.centerAll}>
            <Lineicons icon={MonitorBulk} size={48} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.text, marginTop: 12 }]}>No channels found</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            onScrollToIndexFailed={(info) => {
              const offset = info.averageItemLength * info.index;
              flatListRef.current?.scrollToOffset({ offset, animated: false });
              setTimeout(() => {
                try {
                  flatListRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0.5 });
                } catch (e) {}
              }, 300);
            }}
            removeClippedSubviews={true}
            initialNumToRender={8}
            maxToRenderPerBatch={12}
            windowSize={5}
            key="channels_list"
            data={filteredChannels.slice(0, displayCount)}
            onEndReached={() => setDisplayCount(prev => prev + 50)}
            onEndReachedThreshold={0.5}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => (
              <TVFocusable
                onPress={() => {
                  if (isChannelLocked(item.id)) {
                    setPendingChannelPlay({ ...item, index });
                    setPinModalVisible(true);
                    return;
                  }
                  playChannelMobile(item, index);
                }}
                style={({ focused }: any) => [
                  styles.mobileChannelListContent,
                  { borderColor: focused ? colors.gold : colors.border, backgroundColor: focused ? colors.surface : colors.surface2 },
                  { flexDirection: 'row', padding: 12, alignItems: 'center', gap: 12 }
                ]}
              >
                <View style={styles.mobileChannelListLogoContainer}>
                  {item.logo ? (
                    <Image 
                      source={{ 
                        uri: item.logo,
                        headers: {
                          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                        }
                      }} 
                      style={styles.mobileChannelListLogo} contentFit="contain" />
                  ) : (
                    <View style={styles.mobileChannelListLogoPlaceholder}>
                      <Lineicons icon={MonitorBulk} size={24} color={colors.text} />
                    </View>
                  )}
                </View>
                <View style={styles.mobileChannelListTextContainer}>
                  <Text style={[styles.mobileChannelListName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
                  {item.current ? (
                    <Text style={[styles.mobileChannelListCurrent, { color: colors.mutedForeground }]} numberOfLines={1}>{item.current}</Text>
                  ) : null}
                </View>
                <View style={styles.mobileChannelListBadgeContainer}>
                   <View style={{ backgroundColor: '#EF4444', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                     <Text style={{ color: '#FFF', fontSize: 10, fontWeight: 'bold' }}>LIVE</Text>
                   </View>
                </View>
              </TVFocusable>
            )}
            contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 120 }]}
          />
        )}

        {!isLandscape && (
          <TVFocusable
            disableBorder
            onPress={() => setSelectedCategory(null)}
            style={[styles.floatingViewAllBtn, { backgroundColor: colors.surface, borderColor: colors.gold, bottom: insets.bottom + 90 }]}
          >
            <Lineicons icon={DashboardSquare1Bulk} size={18} color={colors.gold} />
            <Text style={[styles.floatingViewAllText, { color: colors.text }]}>View All Categories</Text>
          </TVFocusable>
        )}
        <PinModal 
          visible={pinModalVisible} 
          expectedPin={parentalPin}
          onCancel={() => {
            setPinModalVisible(false);
            setPendingChannelPlay(null);
            setPendingChannelLock(null);
          }}
          onSuccess={() => {
            setPinModalVisible(false);
            if (pendingChannelPlay) {
              playChannelMobile(pendingChannelPlay, pendingChannelPlay.index || 0);
              setPendingChannelPlay(null);
            } else if (pendingChannelLock) {
              toggleChannelLock(pendingChannelLock);
              setPendingChannelLock(null);
            }
          }}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top, opacity: isFocused ? 1 : 0, pointerEvents: isFocused ? 'auto' : 'none' }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Live TV</Text>
        <Text style={[styles.count, { color: colors.mutedForeground }]}>
          {filteredCategories.length.toLocaleString()} categories
        </Text>
      </View>

      <View style={{ paddingHorizontal: 20, marginBottom: 10 }}>
        <View style={[styles.searchBox, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
          <Ionicons name="search" size={16} color={colors.mutedForeground} />
          <TVFocusable onPress={() => setShowCategoryKeyboard(true)} style={{ flex: 1, paddingVertical: 4 }}>
            <Text style={[styles.searchInput, { color: categorySearch ? colors.text : colors.mutedForeground, marginTop: 4 }]}>
              {categorySearch || t('search_categories')}
            </Text>
          </TVFocusable>
          {categorySearch ? (
            <TVFocusable disableBorder onPress={() => setCategorySearch('')}>
              <Ionicons name="close-circle" size={16} color={colors.mutedForeground} />
            </TVFocusable>
          ) : null}
        </View>
      </View>
      <SearchKeyboardModal 
        visible={showCategoryKeyboard}
        value={categorySearch}
        onChangeText={setCategorySearch}
        onClose={() => setShowCategoryKeyboard(false)}
        placeholder={t('search_categories')}
        inline={false}
      />

      {filteredCategories.length === 0 ? (
        <View style={styles.centerAll}>
          <Lineicons icon={Folder1Bulk} size={48} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.text, marginTop: 12 }]}>No categories found</Text>
        </View>
      ) : (
        <FlatList
          removeClippedSubviews={true}
          initialNumToRender={8}
          maxToRenderPerBatch={12}
          windowSize={5}
          key="categories_list"
          data={filteredCategories}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const isSpecial = item.id.startsWith('__');
            return (
              <TVFocusable
                onPress={() => setSelectedCategory(item)}
                style={({ focused }: any) => [
                  styles.categoryItem,
                  { backgroundColor: focused ? colors.surface : colors.surface2, borderColor: focused ? colors.gold : colors.border },
                  isLandscape && { padding: 8, marginBottom: 6 }
                ]}
              >
                <View style={[styles.categoryLeft, isLandscape && { gap: 8 }]}>
                  <View style={[styles.categoryIconBg, { backgroundColor: colors.gold + '15' }, isLandscape && { width: 30, height: 30, borderRadius: 8 }]}>
                    {item.id === '__favorites__' ? (
                      <Lineicons icon={HeartBulk} size={isLandscape ? 14 : 18} color={colors.gold} />
                    ) : item.id === '__recent__' ? (
                      <Ionicons name="time" size={isLandscape ? 14 : 18} color={colors.gold} />
                    ) : (
                      <Lineicons icon={MonitorBulk} size={isLandscape ? 14 : 18} color={colors.gold} />
                    )}
                  </View>
                  <Text style={[styles.categoryName, { color: colors.text, flex: 1 }, isLandscape && { fontSize: 14 }, isSpecial && { fontWeight: 'bold' }]} numberOfLines={isLandscape ? 1 : 2}>{item.name}</Text>
                </View>
              </TVFocusable>
            );
          }}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 80 }]}
        />
      )}
      <PinModal 
        visible={pinModalVisible} 
        expectedPin={parentalPin}
        onCancel={() => {
          setPinModalVisible(false);
          setPendingChannelPlay(null);
          setPendingChannelLock(null);
        }}
        onSuccess={() => {
          setPinModalVisible(false);
          if (pendingChannelPlay) {
            playChannelMobile(pendingChannelPlay, pendingChannelPlay.index || 0);
            setPendingChannelPlay(null);
          } else if (pendingChannelLock) {
            toggleChannelLock(pendingChannelLock);
            setPendingChannelLock(null);
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 16,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
    height: '100%',
  },
  tvFavoriteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 24,
  },

  mobileChannelListContent: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8
  },
  mobileChannelListLogoContainer: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#FFF',
    padding: 2
  },
  mobileChannelListLogo: {
    flex: 1,
    width: '100%',
    height: '100%',
    borderRadius: 6
  },
  mobileChannelListLogoPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  mobileChannelListTextContainer: {
    flex: 1,
    justifyContent: 'center'
  },
  mobileChannelListName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4
  },
  mobileChannelListCurrent: {
    fontSize: 13
  },
  mobileChannelListBadgeContainer: {
    justifyContent: 'center',
    alignItems: 'center'
  },

  container: { flex: 1 },
  centerAll: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  
  // TV Styles
  tvContainer: { flex: 1, flexDirection: 'row' },
  tvPaneCategories: { width: 280, borderRightWidth: 1 },
  tvPaneChannels: { width: 350, borderRightWidth: 1 },
  tvPanePlayer: { flex: 1, backgroundColor: '#000', flexDirection: 'column' },
  tvHeader: { padding: 24, paddingBottom: 16 },
  tvTitle: { fontSize: 24, fontWeight: 'bold' },
  tvCategoryItem: { paddingHorizontal: 24, paddingVertical: 16, borderLeftWidth: 3, borderLeftColor: 'transparent' },
  tvCategoryText: { fontSize: 16 },
  tvChannelItem: { paddingHorizontal: 24, paddingVertical: 12, borderLeftWidth: 3, borderLeftColor: 'transparent' },
  tvChannelText: { fontSize: 15 },
  tvChannelIconPlaceholder: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  tvPlayerWrapper: { flex: 1, backgroundColor: '#000' },
  tvPlayerInfo: { padding: 32, borderTopWidth: 1 },
  tvPlayerTitle: { fontSize: 32, fontWeight: 'bold' },
  tvFullscreenBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, borderWidth: 1, marginTop: 24 },

  // Mobile Styles
  horizontalTabsContainer: { flexDirection: 'row', gap: 8, paddingHorizontal: 20 },
  floatingViewAllBtn: { position: 'absolute', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 30, paddingHorizontal: 20, height: 48, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 5 },
  floatingViewAllText: { fontSize: 14, fontWeight: 'bold' },
  tabsScrollContent: { gap: 8, paddingRight: 40 },
  tabPill: { paddingHorizontal: 16, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  tabPillText: { fontSize: 13 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 4, paddingBottom: 4, gap: 12 },
  title: { fontSize: 24, fontWeight: 'bold' },
  count: { fontSize: 13, marginTop: 2 },
  gridContent: { paddingHorizontal: 12 },
  gridItem: { flex: 1, padding: 6 },
  listContent: { paddingHorizontal: 20, paddingTop: 4 },
  categoryItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 10 },
  categoryLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  categoryIconBg: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  categoryName: { fontSize: 16, fontWeight: '600' },
  emptyTitle: { fontSize: 18, fontWeight: 'bold' },
});
