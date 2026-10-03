import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Animated, FlatList, ActivityIndicator, useWindowDimensions, Platform, BackHandler, ScrollView, TextInput, Modal } from 'react-native';
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
  const isWindowsWeb = Platform.OS === 'web';
  const rawIsLargeScreen = width >= 1024 || Platform.isTV;

  // Proportional pane widths for large screen (TV/Desktop)
  // Categories: 18%, Channels: 27%, Player: 55% (flex)
  const tvPaneCategoriesWidth = Math.min(Math.max(Math.floor(width * 0.18), 220), 320);
  const tvPaneChannelsWidth = Math.min(Math.max(Math.floor(width * 0.27), 260), 400);

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
  const refreshCounter = useAppStore((s) => s.refreshCounter);
  const isNetworkOnline = useAppStore((s) => s.isNetworkOnline);
  const categoryCounts = useAppStore((s) => s.categoryCounts);
  const [selectedCategory, setSelectedCategory] = useState<{ id: string; name: string; count?: number } | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [localChannels, setLocalChannels] = useState<Channel[]>([]);
  const [displayCount, setDisplayCount] = useState(50);
  const [loading, setLoading] = useState(false);
  const activeRequestId = useRef(0);
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
  const [showBigPlayerControls, setShowBigPlayerControls] = useState(false);
  const bigPlayerControlsOpacity = useRef(new Animated.Value(0)).current;
  const bigPlayerHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hideBigPlayerControlsNow = useCallback(() => {
    if (bigPlayerHideTimer.current) clearTimeout(bigPlayerHideTimer.current);
    Animated.timing(bigPlayerControlsOpacity, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setShowBigPlayerControls(false);
    });
  }, [bigPlayerControlsOpacity]);

  const showBigPlayerControlsBriefly = useCallback((duration = 4000) => {
    if (bigPlayerHideTimer.current) clearTimeout(bigPlayerHideTimer.current);
    setShowBigPlayerControls(true);
    Animated.timing(bigPlayerControlsOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();

    bigPlayerHideTimer.current = setTimeout(() => {
      hideBigPlayerControlsNow();
    }, duration);
  }, [bigPlayerControlsOpacity, hideBigPlayerControlsNow]);

  const handleBigPlayerTap = useCallback(() => {
    if (showBigPlayerControls) {
      hideBigPlayerControlsNow();
    } else {
      showBigPlayerControlsBriefly(4000);
    }
  }, [showBigPlayerControls, hideBigPlayerControlsNow, showBigPlayerControlsBriefly]);
  const [channelSearch, setChannelSearch] = useState('');
  const [showChannelKeyboard, setShowChannelKeyboard] = useState(false);
  const [unlockedForSession, setUnlockedForSession] = useState<string[]>([]);
  const [showSwitchPageModal, setShowSwitchPageModal] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const categoryListRef = useRef<FlatList>(null);
  const { categoryId, categoryName, focusId, focusName } = useLocalSearchParams<{ categoryId?: string; categoryName?: string; focusId?: string; focusName?: string }>();
  const pendingTargetRef = useRef<{ id?: string; name?: string } | null>(null);

  const categoryPreferences = useAppStore(s => s.categoryPreferences);
  const updateCategoryPreferences = useAppStore(s => s.updateCategoryPreferences);
  const defaultPrefs = useMemo(() => ({ hiddenIds: [], liveOrder: [], vodOrder: [], seriesOrder: [] }), []);
  const prefs = categoryPreferences[activePlaylistId] || defaultPrefs;

  const orderedLiveCats = useMemo(() => {
    if (!activeCategories?.live) return [];
    
    const hiddenSet = new Set((prefs.hiddenIds || []).map(String));
    let filtered = activeCategories.live.filter((c: any) => 
      !hiddenSet.has(String(c.id)) && 
      !c.name.toLowerCase().includes('remote search')
    );
    
    if (prefs.liveOrder && prefs.liveOrder.length > 0) {
      const orderMap = new Map<string, number>(prefs.liveOrder.map((id, index) => [String(id), index]));
      filtered.sort((a: any, b: any) => {
        const idxA = orderMap.has(String(a.id)) ? orderMap.get(String(a.id))! : 999999;
        const idxB = orderMap.has(String(b.id)) ? orderMap.get(String(b.id))! : 999999;
        return idxA - idxB;
      });
    }
    return filtered;
  }, [activeCategories?.live, prefs]);

  const [categorySearch, setCategorySearch] = useState('');
  const [showCategoryKeyboard, setShowCategoryKeyboard] = useState(false);

  const isLiveItem = useCallback((i: any) => {
    if (!i) return false;
    if (i.type === 'live' || i.type === 'channel') return true;
    if (i.isLive === true || (i.isLive as unknown) === 'true') return true;
    if (typeof i.id === 'string' && (i.id.startsWith('xt_live_') || i.id.startsWith('live_'))) return true;
    if (typeof i.streamUrl === 'string' && (i.streamUrl.includes('/live/') || i.streamUrl.endsWith('.m3u8') || i.streamUrl.endsWith('.ts'))) {
      if (!i.streamUrl.includes('/movie/') && !i.streamUrl.includes('/series/')) return true;
    }
    return false;
  }, []);

  const categories = useMemo(() => {
    const liveCounts = categoryCounts?.live || {};
    const liveTotal = categoryCounts?.totals?.live;
    const favItemsCount = favoriteItems.filter(isLiveItem).length;
    const favIdsCount = (favorites || []).filter((id: any) => typeof id === 'string' && (id.startsWith('xt_live_') || id.startsWith('live_'))).length;
    const liveFavCount = Math.max(favItemsCount, favIdsCount);

    const mappedOrdered = orderedLiveCats.map((c: any) => ({
      ...c,
      count: liveCounts[String(c.id)] ?? liveCounts[c.name] ?? c.count
    }));

    return [
      { id: '__all__', name: t('all') || 'All', count: liveTotal },
      { id: '__favorites__', name: t('favorites'), count: liveFavCount },
      { id: '__recent__', name: t('continue_watching') },
      ...mappedOrdered
    ];
  }, [orderedLiveCats, t, categoryCounts, favoriteItems, favorites, isLiveItem]);

  const filteredCategories = useMemo(() => {
    if (!categorySearch.trim()) return categories;
    const q = categorySearch.toLowerCase().trim();
    return categories.filter(c => c.name.toLowerCase().includes(q));
  }, [categories, categorySearch]);

  const [globalSearchResults, setGlobalSearchResults] = useState<Channel[]>([]);
  const [isSearchingGlobal, setIsSearchingGlobal] = useState(false);

  useEffect(() => {
    if (selectedCategory?.id !== '__all__' || !channelSearch.trim()) {
      setGlobalSearchResults([]);
      setIsSearchingGlobal(false);
      return;
    }

    const q = channelSearch.trim();
    let isCurrent = true;
    setIsSearchingGlobal(true);

    const timer = setTimeout(async () => {
      try {
        const results = await useAppStore.getState().searchChannels(q, 'live', 250);
        if (isCurrent) {
          setGlobalSearchResults(results);
        }
      } catch (e) {
        if (isCurrent) setGlobalSearchResults([]);
      } finally {
        if (isCurrent) setIsSearchingGlobal(false);
      }
    }, 200);

    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [channelSearch, selectedCategory?.id]);

  const filteredChannels = useMemo(() => {
    if (!channelSearch.trim()) return localChannels;
    if (selectedCategory?.id === '__all__') {
      return globalSearchResults;
    }
    const q = channelSearch.toLowerCase().trim();
    return localChannels.filter(ch => ch.name.toLowerCase().includes(q));
  }, [localChannels, channelSearch, selectedCategory?.id, globalSearchResults]);

  const moveCategory = (direction: 'up' | 'down') => {
    if (!activePlaylistId) return;

    let targetCat = selectedCategory;
    if (!targetCat || targetCat.id.startsWith('__')) {
      if (selectedChannel) {
        const found = orderedLiveCats.find(
          c => String(c.id) === String((selectedChannel as any).category_id) || c.name === selectedChannel.category
        );
        if (found) targetCat = found;
      }
    }

    if (!targetCat || targetCat.id.startsWith('__')) return;

    const hiddenSet = new Set((prefs.hiddenIds || []).map(String));
    let currentList = (activeCategories?.live || []).filter((c: any) => 
      !hiddenSet.has(String(c.id)) && 
      !c.name.toLowerCase().includes('remote search')
    );

    if (prefs.liveOrder && prefs.liveOrder.length > 0) {
      const orderMap = new Map<string, number>(prefs.liveOrder.map((id, index) => [String(id), index]));
      currentList.sort((a: any, b: any) => {
        const idxA = orderMap.has(String(a.id)) ? orderMap.get(String(a.id))! : 999999;
        const idxB = orderMap.has(String(b.id)) ? orderMap.get(String(b.id))! : 999999;
        return idxA - idxB;
      });
    }

    const index = currentList.findIndex((c: any) => String(c.id) === String(targetCat!.id));
    if (index === -1) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === currentList.length - 1) return;

    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    const temp = currentList[index];
    currentList[index] = currentList[swapIndex];
    currentList[swapIndex] = temp;

    const newOrder = currentList.map((c: any) => String(c.id));
    updateCategoryPreferences(activePlaylistId, { liveOrder: newOrder });

    if (!selectedCategory || selectedCategory.id.startsWith('__') || String(selectedCategory.id) !== String(targetCat.id)) {
      setSelectedCategory(targetCat);
    }
  };

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

  // Auto-select and scroll to category and channel when coming from search or deep link
  useEffect(() => {
    if (focusId || focusName) {
      pendingTargetRef.current = { id: focusId, name: focusName };
    }
    if ((categoryId || categoryName) && categories.length > 0) {
      const targetCat = categories.find(
        c => (categoryId && String(c.id).toLowerCase() === String(categoryId).toLowerCase()) || 
             (categoryId && c.name.toLowerCase() === String(categoryId).toLowerCase()) ||
             (categoryName && c.name.toLowerCase() === String(categoryName).toLowerCase())
      );
      if (targetCat) {
        if (channelSearch) setChannelSearch('');
        setSelectedCategory(targetCat);
        const idx = categories.findIndex(c => String(c.id) === String(targetCat.id));
        if (idx >= 0) {
          setTimeout(() => {
            try {
              categoryListRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 });
            } catch (e) {
              categoryListRef.current?.scrollToOffset({ offset: Math.max(0, (idx - 2) * 48), animated: true });
            }
          }, 250);
        }
        router.setParams({ categoryId: '', categoryName: '' });
      }
    }
  }, [categoryId, categoryName, categories, focusId, focusName]);

  useEffect(() => {
    const target = pendingTargetRef.current || (focusId || focusName ? { id: focusId, name: focusName } : null);
    if (target && localChannels.length > 0) {
      let idx = -1;
      if (target.id) idx = localChannels.findIndex(c => c.id === target.id);
      if (idx === -1 && target.name) {
        idx = localChannels.findIndex(c => c.name.toLowerCase() === target.name!.toLowerCase());
      }
      if (idx >= 0) {
        setSelectedChannel(localChannels[idx]);
        if (idx >= displayCount) {
          setDisplayCount(idx + 30);
        }
        setTimeout(() => {
          try {
            flatListRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 });
          } catch (e) {
            try {
              flatListRef.current?.scrollToOffset({ offset: Math.max(0, (idx - 2) * 56), animated: true });
            } catch (err) {}
          }
        }, 400);
        pendingTargetRef.current = null;
        if (focusId || focusName) {
          router.setParams({ focusId: '', focusName: '' });
        }
      }
    }
  }, [localChannels, focusId, focusName]);

  const handleSelectChannel = (item: Channel, index: number) => {
    if (isChannelLocked(item.id) && !unlockedForSession.includes(item.id)) {
      setPendingChannelPlay({ ...item, index });
      setPinModalVisible(true);
      return;
    }

    pendingTargetRef.current = { id: item.id, name: item.name };
    setSelectedChannel(item);
    setShowChannelKeyboard(false);
    setShowCategoryKeyboard(false);

    // Move category list to the channel's category (skip if in special categories)
    if (selectedCategory?.id !== '__favorites__' && selectedCategory?.id !== '__recent__') {
      const catIdentifier = (item as any).categoryId || item.category;
      if (catIdentifier && categories.length > 0) {
        const foundCat = categories.find(
          c => String(c.id).toLowerCase() === String(catIdentifier).toLowerCase() || 
               c.name.toLowerCase() === String(catIdentifier).toLowerCase()
        );
        if (foundCat && selectedCategory?.id !== foundCat.id) {
          if (channelSearch) setChannelSearch('');
          setSelectedCategory(foundCat);
          const catIdx = categories.findIndex(c => String(c.id) === String(foundCat.id));
          if (catIdx >= 0) {
            setTimeout(() => {
              try {
                categoryListRef.current?.scrollToIndex({ index: catIdx, animated: true, viewPosition: 0.5 });
              } catch (e) {
                categoryListRef.current?.scrollToOffset({ offset: Math.max(0, (catIdx - 2) * 48), animated: true });
              }
            }, 150);
          }
          return;
        }
      }
    }
  };

  const isFavorite = useMemo(() => {
    if (!selectedChannel) return false;
    const chId = String(selectedChannel.id || '');
    const chUrl = selectedChannel.streamUrl ? String(selectedChannel.streamUrl) : '';
    return (
      (favorites || []).some((f) => String(f) === chId || (chUrl && String(f) === chUrl)) ||
      favoriteItems.some((item) => String(item.id) === chId || (chUrl && item.streamUrl === chUrl))
    );
  }, [favorites, favoriteItems, selectedChannel]);

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
      } else if ((e.key === 'Enter' || e.key === ' ') && isFullscreen && !showBigPlayerControls) {
        showBigPlayerControlsBriefly(4000);
      }
    };
    if (Platform.OS === 'web') {
      window.addEventListener('keydown', handleKeyDown);
    }

    if (isFullscreen) {
      // Auto-hide controls after 3 seconds upon navigating to big player
      showBigPlayerControlsBriefly(3000);
      setShowFullscreenHint(true);
      const timer = setTimeout(() => setShowFullscreenHint(false), 3000);
      return () => {
        backHandler.remove();
        if (Platform.OS === 'web') window.removeEventListener('keydown', handleKeyDown);
        clearTimeout(timer);
        if (bigPlayerHideTimer.current) clearTimeout(bigPlayerHideTimer.current);
      };
    } else {
      setShowBigPlayerControls(false);
      bigPlayerControlsOpacity.setValue(0);
      if (bigPlayerHideTimer.current) clearTimeout(bigPlayerHideTimer.current);
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
    const reqId = ++activeRequestId.current;
    setLoading(true);
    setDisplayCount(50);

    try {
      let finalChannels: Channel[] = [];

      if (cat.id === '__all__') {
        const liveCats = useAppStore.getState().activeCategories?.live || [];
        if (liveCats.length > 0) {
          const randomCats = [...liveCats].sort(() => 0.5 - Math.random()).slice(0, 5);
          const chunks = await Promise.all(
            randomCats.map(c => getChannelsForCategory(activePlaylistId, 'live', c.id, c.name).catch(() => []))
          );
          finalChannels = chunks.flat().sort(() => 0.5 - Math.random());
        }
      } else if (cat.id === '__favorites__') {
        const storeFavs = useAppStore.getState().favoriteItems || [];
        finalChannels = storeFavs
          .filter(isLiveItem)
          .map(toChannel);
      } else if (cat.id === '__recent__') {
        const storeRecent = useAppStore.getState().continueWatching || [];
        finalChannels = storeRecent
          .filter(isLiveItem)
          .map(toChannel);
      } else {
        const result = await getChannelsForCategory(activePlaylistId, 'live', cat.id, cat.name);
        
        finalChannels = result;
        try {
          const orderStr = await AsyncStorage.getItem(`channel_order_${cat.id}`);
          if (orderStr) {
            const orderArr = JSON.parse(orderStr);
            const orderMap = new Map<string, number>(orderArr.map((id: string, index: number) => [id, index]));
            finalChannels = [...result].sort((a, b) => {
              const idxA = orderMap.has(a.id) ? orderMap.get(a.id) as number : 999999;
              const idxB = orderMap.has(b.id) ? orderMap.get(b.id) as number : 999999;
              return idxA - idxB;
            });
          }
        } catch (e) {
          console.error("Failed to load custom order:", e);
        }
      }

      setLocalChannels(finalChannels);
      
      const target = pendingTargetRef.current;
      let matchedChannel: Channel | null = null;
      if (target) {
        if (target.id) matchedChannel = finalChannels.find(c => c.id === target.id) || null;
        if (!matchedChannel && target.name) {
          matchedChannel = finalChannels.find(c => c.name.toLowerCase() === target.name!.toLowerCase()) || null;
        }
      }
      if (!matchedChannel && selectedChannel && finalChannels.some(c => c.id === selectedChannel.id)) {
        matchedChannel = selectedChannel;
      }
      if (!matchedChannel && isLargeScreen && finalChannels.length > 0) {
        matchedChannel = finalChannels[0];
      }

      if (matchedChannel) {
        setSelectedChannel(matchedChannel);
        const chIdx = finalChannels.findIndex(c => c.id === matchedChannel!.id);
        if (chIdx >= 0) {
          if (chIdx >= 50) {
            setDisplayCount(chIdx + 30);
          }
          setTimeout(() => {
            try {
              flatListRef.current?.scrollToIndex({ index: chIdx, animated: true, viewPosition: 0.5 });
            } catch (e) {
              try {
                flatListRef.current?.scrollToOffset({ offset: Math.max(0, (chIdx - 2) * 56), animated: true });
              } catch (err) {}
            }
          }, 300);
        }
      } else if (finalChannels.length === 0) {
        setSelectedChannel(null);
      }

      if (target) {
        pendingTargetRef.current = null;
      }
    } catch (e) {
      if (activeRequestId.current !== reqId) return;
      setLocalChannels([]);
    } finally {
      if (activeRequestId.current === reqId) {
        setLoading(false);
      }
    }
  }, [activePlaylistId, getChannelsForCategory, isLargeScreen]);

  const handleCategoryPress = useCallback((cat: { id: string; name: string }) => {
    if (cat.id === '__search__') {
      router.push({ pathname: '/search', params: { tab: 'live' } });
    } else if (isParentalLocked(cat.id)) {
      setPendingCategory(cat);
      setPinModalVisible(true);
    } else {
      if (selectedCategory && String(selectedCategory.id) === String(cat.id)) {
        loadCategory(cat);
      } else {
        setSelectedCategory(cat);
      }
    }
  }, [isParentalLocked, selectedCategory, loadCategory]);

  useEffect(() => {
    if (selectedCategory) {
      loadCategory(selectedCategory);
    }
  }, [selectedCategory, loadCategory, refreshCounter]);

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
        .filter(isLiveItem)
        .map(toChannel);
      setLocalChannels(favs);
    } else if (selectedCategory?.id === '__recent__') {
      const recents = (continueWatching || [])
        .filter(isLiveItem)
        .map(toChannel);
      setLocalChannels(recents);
    }
  }, [favoriteItems, continueWatching, selectedCategory?.id, isLiveItem]);

  // Auto-select category: Defaults to Favorites (SPECIAL_CATEGORIES[0])
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if ((categoryId || categoryName) && categories.length > 0) {
        const targetCat = categories.find(
          c => (categoryId && String(c.id).toLowerCase() === String(categoryId).toLowerCase()) || 
               (categoryId && c.name.toLowerCase() === String(categoryId).toLowerCase()) ||
               (categoryName && c.name.toLowerCase() === String(categoryName).toLowerCase())
        );
        if (targetCat) {
          if (!selectedCategory || selectedCategory.id !== targetCat.id) {
            setSelectedCategory(targetCat);
          }
          const idx = categories.findIndex(c => String(c.id) === String(targetCat.id));
          if (idx >= 0) {
            setTimeout(() => {
              try {
                categoryListRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 });
              } catch (e) {
                categoryListRef.current?.scrollToOffset({ offset: Math.max(0, (idx - 2) * 48), animated: true });
              }
            }, 300);
          }
          hasDefaulted.current = true;
          router.setParams({ categoryId: '', categoryName: '' });
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

    return (
      <View style={[styles.tvContainer, { backgroundColor: '#05070a', paddingLeft: 0, opacity: isFocused ? 1 : 0, pointerEvents: isFocused ? 'auto' : 'none' }]}>
        <View style={{
          flexDirection: 'row',
          width: tvPaneCategoriesWidth + tvPaneChannelsWidth,
          backgroundColor: '#0A0C10',
          borderRightWidth: 1,
          borderRightColor: 'rgba(255,255,255,0.08)',
          height: '100%',
        }}>
          {/* Pane 1: Categories */}
          <View nativeID="tour-live-categories" data-focus-zone="live-categories" {...({ id: 'tour-live-categories' } as any)} style={[styles.tvPaneCategories, { width: tvPaneCategoriesWidth, borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.08)', height: '100%' }]}>
            <View style={[styles.tvHeader, { padding: 16, paddingBottom: 12 }]}>
              {/* <Text style={[styles.tvTitle, { color: colors.text, fontSize: tvPaneCategoriesWidth < 260 ? 18 : 22 }]}>{t('categories')}</Text> */}
              {!isWindowsWeb && (
                <View style={[styles.searchBox, { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.1)' }]}>
                  <Ionicons name="search" size={14} color={colors.mutedForeground} />
                  {isLargeScreen ? (
                    <TVFocusable onPress={() => setShowCategoryKeyboard(true)} style={{ flex: 1, paddingVertical: 4 }}>
                      <Text style={[styles.searchInput, { color: categorySearch ? colors.text : colors.mutedForeground, marginTop: 4 }]}>
                        {categorySearch || 'search'}
                      </Text>
                    </TVFocusable>
                  ) : (
                    <TextInput
                      style={[styles.searchInput, { color: colors.text }]}
                      placeholder="search"
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
              )}
            </View>
            
            {Boolean(selectedCategory && !selectedCategory.id.startsWith('__')) && !categorySearch && (
              <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 12, gap: 12 }}>
                <TVFocusable
                  onPress={() => moveCategory('up')}
                  style={({ focused }: any) => [
                    styles.tvFavoriteBtn,
                    { flex: 1, backgroundColor: focused ? colors.gold : 'rgba(255,255,255,0.05)', borderColor: colors.border, marginTop: 0, height: 40, justifyContent: 'center' }
                  ]}
                >
                  {({ focused }: any) => (
                    <Ionicons name="chevron-up" size={20} color={focused ? '#000' : colors.text} />
                  )}
                </TVFocusable>
                <TVFocusable
                  onPress={() => moveCategory('down')}
                  style={({ focused }: any) => [
                    styles.tvFavoriteBtn,
                    { flex: 1, backgroundColor: focused ? colors.gold : 'rgba(255,255,255,0.05)', borderColor: colors.border, marginTop: 0, height: 40, justifyContent: 'center' }
                  ]}
                >
                  {({ focused }: any) => (
                    <Ionicons name="chevron-down" size={20} color={focused ? '#000' : colors.text} />
                  )}
                </TVFocusable>
              </View>
            )}

            <FlatList
              ref={categoryListRef}
              style={{ flex: 1 }}
              data={filteredCategories}
              extraData={[selectedCategory?.id, favoriteItems.length, filteredCategories]}
              keyExtractor={(item: any) => item.id}
              showsVerticalScrollIndicator={false}
              onScrollToIndexFailed={(info) => {
                const offset = (info.averageItemLength || 48) * info.index;
                categoryListRef.current?.scrollToOffset({ offset, animated: false });
                setTimeout(() => {
                  try {
                    categoryListRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0.5 });
                  } catch (e) {}
                }, 300);
              }}
              renderItem={({ item, index }: any) => {
                const isSelected = selectedCategory?.id === item.id;
                const isSpecial = item.id.startsWith('__');
                return (
                  <View 
                    key={item.id}
                    style={[
                      styles.tvCategoryItem,
                      { padding: 0, paddingHorizontal: 0, paddingVertical: 0, flexDirection: 'row', alignItems: 'stretch' }
                    ]}
                  >
                    <TVFocusable
                      hasTVPreferredFocus={isSelected}
                      disableBorder
                      onPress={() => {
                        handleCategoryPress(item);
                      }}
                      style={({ focused }: any) => [
                        { flex: 1, padding: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 8, borderWidth: 1, borderColor: 'transparent' },
                        isSelected && { borderColor: 'rgba(212,168,67,0.8)' },
                        focused && { backgroundColor: 'rgba(212,168,67,0.15)', transform: [{ scale: 1.02 }] }
                      ]}
                    >
                      {({ focused }: any) => (
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flex: 1, width: '100%' }}>
                          {focused && (
                            <View style={{ position: 'absolute', left: -16, top: -12, bottom: -12, width: 3, backgroundColor: colors.gold, borderTopRightRadius: 3, borderBottomRightRadius: 3 }} />
                          )}
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, marginRight: 8, overflow: 'hidden' }}>
                            {item.id === '__favorites__' && (
                              <Lineicons icon={HeartBulk} size={16} color={focused || isSelected ? colors.gold : colors.text} />
                            )}
                            {item.id === '__recent__' && (
                              <Ionicons name="time" size={16} color={focused || isSelected ? colors.gold : colors.text} />
                            )}
                            <MarqueeText 
                              text={item.name}
                              isFocused={focused || isSelected}
                              style={[
                                styles.tvCategoryText, 
                                { color: focused || isSelected ? colors.gold : colors.text, fontWeight: isSelected || isSpecial ? 'bold' : '500' }
                              ]} 
                            />
                          </View>
                          {item.count !== undefined && (
                            <View style={{
                              paddingHorizontal: 8,
                              paddingVertical: 2,
                              borderRadius: 10,
                              backgroundColor: focused ? 'rgba(212,168,67,0.25)' : (isSelected ? 'rgba(212,168,67,0.1)' : 'rgba(255,255,255,0.08)'),
                              marginLeft: 6,
                            }}>
                              <Text style={{
                                fontSize: 11,
                                fontWeight: '700',
                                color: focused || isSelected ? colors.gold : colors.mutedForeground,
                              }}>
                                {item.count.toLocaleString('en-US')}
                              </Text>
                            </View>
                          )}
                        </View>
                      )}
                    </TVFocusable>
                  </View>
                );
              }}
            />
          </View>

          {/* Pane 2: Channels */}
          <View style={[styles.tvPaneChannels, { width: tvPaneChannelsWidth }]} data-focus-zone="live-channels">
            <View style={[styles.tvHeader, { padding: 16, paddingBottom: 12 }]}>
              {/* <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <Text style={[styles.tvTitle, { color: colors.text }]}>
                  {selectedCategory ? selectedCategory.name : t('channels')}
                </Text>
                {selectedCategory?.count !== undefined && (
                  <View style={{
                    paddingHorizontal: 10,
                    paddingVertical: 2,
                    borderRadius: 12,
                    backgroundColor: 'rgba(212,168,67,0.15)',
                    borderWidth: 1,
                    borderColor: 'rgba(212,168,67,0.3)',
                  }}>
                    <Text style={{ color: colors.gold, fontWeight: 'bold', fontSize: 14 }}>
                      {selectedCategory.count.toLocaleString('en-US')}
                    </Text>
                  </View>
                )}
              </View> */}
              <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
                <View style={[styles.searchBox, { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.1)' }]}>
                  <Ionicons name="search" size={14} color={colors.mutedForeground} />
                  {isWindowsWeb ? (
                    <TextInput
                      style={[styles.searchInput, { color: colors.text, outlineStyle: 'none' } as any]}
                      placeholder="search"
                      placeholderTextColor={colors.mutedForeground}
                      value={channelSearch}
                      onChangeText={setChannelSearch}
                      returnKeyType="search"
                    />
                  ) : isLargeScreen ? (
                    <TVFocusable onPress={() => setShowChannelKeyboard(true)} style={{ flex: 1, paddingVertical: 4 }}>
                      <Text style={[styles.searchInput, { color: channelSearch ? colors.text : colors.mutedForeground, marginTop: 0 }]}>
                        {channelSearch || 'search'}
                      </Text>
                    </TVFocusable>
                  ) : (
                    <TextInput
                      style={[styles.searchInput, { color: colors.text }]}
                      placeholder="search"
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
            {filteredChannels.length === 0 && !loading && !isSearchingGlobal ? (
              <View style={styles.centerAll}>
                <Lineicons 
                  icon={selectedCategory?.id === '__favorites__' ? HeartBulk : MonitorBulk} 
                  size={48} 
                  color={colors.mutedForeground} 
                />
                <Text style={[styles.emptyTitle, { color: colors.text, marginTop: 12, marginBottom: 16 }]}>
                  {channelSearch 
                    ? t('no_channels') 
                    : selectedCategory?.id === '__favorites__'
                    ? t('no_favorites')
                    : selectedCategory?.id === '__recent__'
                    ? t('no_continue_watching')
                    : (isNetworkOnline === false ? 'لا يوجد اتصال بالإنترنت' : t('no_channels'))}
                </Text>
                {selectedCategory && !selectedCategory.id.startsWith('__') && (
                  <TVFocusable
                    onPress={() => loadCategory(selectedCategory)}
                    style={({ focused }: any) => [
                      {
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: colors.gold,
                        paddingHorizontal: 20,
                        paddingVertical: 10,
                        borderRadius: 8,
                        gap: 8,
                      },
                      focused && { transform: [{ scale: 1.05 }], backgroundColor: '#f0c767' }
                    ]}
                  >
                    <Ionicons name="refresh" size={18} color="#000" />
                    <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 14 }}>
                      إعادة المحاولة
                    </Text>
                  </TVFocusable>
                )}
              </View>
            ) : (
              <View style={{ flex: 1, opacity: (loading || isSearchingGlobal) ? 0.5 : 1 }}>
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
                  removeClippedSubviews={Platform.OS !== 'web'}
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
                      <View 
                        style={[
                          styles.tvChannelItem,
                          { padding: 0, paddingHorizontal: 0, paddingVertical: 0, flexDirection: 'row', alignItems: 'stretch' }
                        ]}
                      >
                        <TVFocusable
                          hasTVPreferredFocus={focusId === item.id}
                          disableBorder
                          onPress={() => handleSelectChannel(item, index)}
                          style={({ focused }: any) => [
                            { flex: 1, padding: 12, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 8, borderWidth: 1, borderColor: 'transparent' },
                            isSelected && { borderColor: 'rgba(212,168,67,0.8)' },
                            focused && { backgroundColor: 'rgba(212,168,67,0.15)', transform: [{ scale: 1.02 }] }
                          ]}
                        >
                          {({ focused }: any) => (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                              {focused && (
                                <View style={{ position: 'absolute', left: -24, top: -12, bottom: -12, width: 3, backgroundColor: colors.gold, borderTopRightRadius: 3, borderBottomRightRadius: 3 }} />
                              )}
                              {item.logo ? (
                                 <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                                   <Image 
                                      source={{ 
                                        uri: item.logo,
                                        headers: {
                                          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                                        }
                                      }} 
                                      style={{ width: '100%', height: '100%' }}
                                      contentFit="contain"
                                      cachePolicy="memory-disk"
                                      transition={150}
                                    />
                                 </View>
                              ) : (
                                <View style={[styles.tvChannelIconPlaceholder, { backgroundColor: focused ? 'rgba(212,168,67,0.2)' : 'rgba(255,255,255,0.05)' }]}>
                                  <Lineicons icon={MonitorBulk} size={20} color={focused || isSelected ? colors.gold : colors.text} />
                                </View>
                              )}
                              <View style={{ flex: 1 }}>
                                <Text style={[styles.tvChannelText, { color: focused || isSelected ? colors.gold : colors.text, fontWeight: isSelected ? 'bold' : '500' }]} numberOfLines={1}>
                                  {item.num ? `${item.num} - ` : ''}{item.name}
                                </Text>
                                {item.id.startsWith('xt_live_') && (
                                  <EpgNowNext streamId={item.id.replace('xt_live_', '')} />
                                )}
                              </View>
                            </View>
                          )}
                        </TVFocusable>
                      </View>
                    );
                  }}
                />
              </View>
            )}
          </View>
        </View>

        {/* Pane 3: Video Player */}
        <View style={isFullscreen ? [StyleSheet.absoluteFill, { zIndex: 9999, backgroundColor: '#000' }] : [styles.tvPanePlayer, { flex: 1, backgroundColor: '#000', height: '100%' }]} data-focus-zone="live-player">
          {!isWindowsWeb && showCategoryKeyboard ? (
            <SearchKeyboardModal 
              visible={showCategoryKeyboard}
              value={categorySearch}
              onChangeText={setCategorySearch}
              onClose={() => setShowCategoryKeyboard(false)}
              placeholder="search"
              inline
            />
          ) : !isWindowsWeb && showChannelKeyboard ? (
            <SearchKeyboardModal 
              visible={showChannelKeyboard}
              value={channelSearch}
              onChangeText={setChannelSearch}
              onClose={() => setShowChannelKeyboard(false)}
              placeholder="search"
              inline
            />
          ) : selectedChannel ? (
            <>
              <TVFocusable
                style={[
                  { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' },
                  isFullscreen && { aspectRatio: undefined, borderRadius: 0, ...StyleSheet.absoluteFillObject }
                ]}
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
                      onMuteChange={(mutedState) => setIsMuted(mutedState)}
                      controls={false}
                      aspectMode={isFullscreen ? aspectMode : 0}
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

              {/* Fullscreen Background Listener for OK button and Mobile Tap */}
              {isFullscreen && (
                <TVFocusable 
                  disableBorder 
                  focusable={!showBigPlayerControls}
                  hasTVPreferredFocus={!showBigPlayerControls}
                  style={[StyleSheet.absoluteFill, { zIndex: showBigPlayerControls ? 99990 : 99998 }]} 
                  onPress={handleBigPlayerTap} 
                />
              )}

              {isFullscreen && showBigPlayerControls && (
                <Animated.View style={[StyleSheet.absoluteFill, { padding: 32, pointerEvents: 'box-none', zIndex: 99999, justifyContent: 'space-between', opacity: bigPlayerControlsOpacity }]}>
                   {/* Backdrop to dismiss on tap */}
                   <TVFocusable
                     disableBorder
                     focusable={false}
                     style={[StyleSheet.absoluteFill, { zIndex: -1 }]}
                     onPress={handleBigPlayerTap}
                   />

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
                </Animated.View>
              )}

              {!isFullscreen && (
                <View style={[styles.tvPlayerInfo, { backgroundColor: 'rgba(14,14,18,0.98)', borderTopColor: colors.border, paddingVertical: 16, paddingHorizontal: 24 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                    {selectedChannel.logo ? (
                      <View style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden', flexShrink: 0 }}>
                        <Image source={{ uri: selectedChannel.logo }} style={{ width: '100%', height: '100%' }} contentFit="contain" />
                      </View>
                    ) : null}
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <Text style={[{ color: colors.text, fontSize: 18, fontWeight: 'bold', lineHeight: 22, flexShrink: 1 }]} numberOfLines={1} adjustsFontSizeToFit>{selectedChannel.name}</Text>
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
                            { backgroundColor: focused ? colors.gold : 'rgba(255,255,255,0.05)', borderColor: isFavorite ? colors.gold : colors.border, marginTop: 0, paddingHorizontal: 12, height: 32, borderRadius: 6, justifyContent: 'center' }
                          ]}
                        >
                          {({ focused }: any) => (
                            <Lineicons icon={HeartBulk} size={16} color={focused ? '#000' : (isFavorite ? colors.gold : colors.text)} />
                          )}
                        </TVFocusable>
                      </View>
                      <Text style={{ color: colors.mutedForeground, fontSize: 13, marginTop: 2 }} numberOfLines={1}>
                        {selectedChannel.current ? selectedChannel.current : `Now Playing • ${selectedChannel.category}`}
                      </Text>
                    </View>
                    {selectedChannel.quality && (
                      <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: 'rgba(212,168,67,0.15)', borderWidth: 1, borderColor: 'rgba(212,168,67,0.35)' }}>
                        <Text style={{ color: colors.gold, fontSize: 11, fontWeight: 'bold' }}>{selectedChannel.quality}</Text>
                      </View>
                    )}
                  </View>
                </View>
              )}
              {showFullscreenHint && showBigPlayerControls && (
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
              {filteredChannels.length.toLocaleString('en-US')} channels
            </Text>
          </View>
          {selectedCategory && !selectedCategory.id.startsWith('__') && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginRight: 8 }}>
              <TVFocusable
                onPress={() => moveCategory('up')}
                style={({ focused }: any) => [
                  styles.tvFavoriteBtn,
                  { backgroundColor: focused ? colors.gold : 'rgba(255,255,255,0.05)', borderColor: colors.border, marginTop: 0, paddingHorizontal: 10, paddingVertical: 6 }
                ]}
              >
                {({ focused }: any) => (
                  <Ionicons name="chevron-up" size={18} color={focused ? '#000' : colors.text} />
                )}
              </TVFocusable>
              <TVFocusable
                onPress={() => moveCategory('down')}
                style={({ focused }: any) => [
                  styles.tvFavoriteBtn,
                  { backgroundColor: focused ? colors.gold : 'rgba(255,255,255,0.05)', borderColor: colors.border, marginTop: 0, paddingHorizontal: 10, paddingVertical: 6 }
                ]}
              >
                {({ focused }: any) => (
                  <Ionicons name="chevron-down" size={18} color={focused ? '#000' : colors.text} />
                )}
              </TVFocusable>
            </View>
          )}
        </View>

        <View style={{ paddingHorizontal: 20, marginBottom: 10 }}>
          <View style={[styles.searchBox, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
            <Ionicons name="search" size={16} color={colors.mutedForeground} />
            <TextInput
              style={[styles.searchInput, { color: colors.text, outlineStyle: 'none' } as any]}
              placeholder="search"
              placeholderTextColor={colors.mutedForeground}
              value={channelSearch}
              onChangeText={setChannelSearch}
              returnKeyType="search"
            />
            {channelSearch ? (
              <TVFocusable disableBorder onPress={() => setChannelSearch('')}>
                <Ionicons name="close-circle" size={16} color={colors.mutedForeground} />
              </TVFocusable>
            ) : null}
          </View>
        </View>

        {loading || isSearchingGlobal ? (
          <View style={styles.centerAll}>
            <ActivityIndicator size="large" color={colors.gold} />
          </View>
        ) : filteredChannels.length === 0 ? (
          <View style={styles.centerAll}>
            <Lineicons 
              icon={selectedCategory?.id === '__favorites__' ? HeartBulk : MonitorBulk} 
              size={48} 
              color={colors.mutedForeground} 
            />
            <Text style={[styles.emptyTitle, { color: colors.text, marginTop: 12, marginBottom: 16 }]}>
              {selectedCategory?.id === '__favorites__'
                ? t('no_favorites')
                : selectedCategory?.id === '__recent__'
                ? t('no_continue_watching')
                : (isNetworkOnline === false ? 'لا يوجد اتصال بالإنترنت' : t('no_channels'))}
            </Text>
            {selectedCategory && !selectedCategory.id.startsWith('__') && (
              <TVFocusable
                onPress={() => loadCategory(selectedCategory)}
                style={({ focused }: any) => [
                  {
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: colors.gold,
                    paddingHorizontal: 20,
                    paddingVertical: 10,
                    borderRadius: 8,
                    gap: 8,
                  },
                  focused && { transform: [{ scale: 1.05 }], backgroundColor: '#f0c767' }
                ]}
              >
                <Ionicons name="refresh" size={18} color="#000" />
                <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 14 }}>
                  إعادة المحاولة
                </Text>
              </TVFocusable>
            )}
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
            removeClippedSubviews={Platform.OS !== 'web'}
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
                  const catIdentifier = (item as any).categoryId || item.category;
                  if (catIdentifier && categories.length > 0) {
                    const foundCat = categories.find(
                      c => String(c.id).toLowerCase() === String(catIdentifier).toLowerCase() || 
                           c.name.toLowerCase() === String(catIdentifier).toLowerCase()
                    );
                    if (foundCat && selectedCategory?.id !== foundCat.id) {
                      setSelectedCategory(foundCat);
                    }
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
          {filteredCategories.length.toLocaleString('en-US')} categories
        </Text>
      </View>

      {!isWindowsWeb && (
        <>
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
            placeholder="search"
            inline={false}
          />
        </>
      )}

      {filteredCategories.length === 0 ? (
        <View style={styles.centerAll}>
          <Lineicons icon={Folder1Bulk} size={48} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.text, marginTop: 12 }]}>No categories found</Text>
        </View>
      ) : (
        <FlatList
          removeClippedSubviews={Platform.OS !== 'web'}
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
                onPress={() => handleCategoryPress(item)}
                style={({ focused }: any) => [
                  styles.categoryItem,
                  { backgroundColor: focused ? colors.surface : colors.surface2, borderColor: focused ? colors.gold : colors.border },
                  isLandscape && { padding: 8, marginBottom: 6 }
                ]}
              >
                <View style={[styles.categoryLeft, { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, isLandscape && { gap: 8 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, marginRight: 8 }}>
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
                  {item.count !== undefined && (
                    <View style={{
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 10,
                      backgroundColor: 'rgba(212,168,67,0.15)',
                    }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.gold }}>
                        {item.count.toLocaleString('en-US')}
                      </Text>
                    </View>
                  )}
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
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 0,
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
  tvPaneCategories: { borderRightWidth: 1 },
  tvPaneChannels: { borderRightWidth: 1 },
  tvPanePlayer: { flex: 1, backgroundColor: '#000', flexDirection: 'column' },
  tvHeader: { padding: 24, paddingBottom: 16 },
  tvTitle: { fontSize: 24, fontWeight: 'bold' },
  tvCategoryItem: { paddingHorizontal: 24, paddingVertical: 16, borderLeftWidth: 3, borderLeftColor: 'transparent' },
  tvCategoryText: { fontSize: 16 },
  tvChannelItem: { paddingHorizontal: 24, paddingVertical: 12, borderLeftWidth: 3, borderLeftColor: 'transparent' },
  tvChannelText: { fontSize: 15 },
  tvChannelIconPlaceholder: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  tvPlayerWrapper: { flex: 1, backgroundColor: '#000' },
  tvPlayerInfo: { padding: 16, borderTopWidth: 1 },
  tvPlayerTitle: { fontSize: 20, fontWeight: 'bold' },
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
