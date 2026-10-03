import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, useWindowDimensions, Platform, ScrollView, TextInput } from 'react-native';
import { TVFocusable } from '@/components/TVFocusable';
import { MarqueeText } from '@/components/MarqueeText';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Lineicons } from '@lineiconshq/react-native-lineicons';
import { Search1Bulk, MonitorBulk, DashboardSquare1Bulk, Folder1Bulk, ArrowRightBulk, HeartBulk } from '@lineiconshq/free-icons';
import { MovieCard } from '@/components/MovieCard';
import { router, useNavigation, useLocalSearchParams, useRouter } from 'expo-router';
import { useAppStore } from '@/store/app-store';
import { Channel, Series } from '@/types';
import { SearchKeyboardModal } from '@/components/SearchKeyboardModal';
import { PinModal } from '@/components/PinModal';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';



const normalizeTitle = (str: string) => {
  return str
    .toLowerCase()
    .replace(/^[a-z]{2,4}\s*[:|\-]\s*/i, '')
    .replace(/\[.*?\]/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/\b(4k|fhd|hd|uhd|hevc|1080p|720p|h264|h265|bluray|web-dl|vod)\b/gi, '')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const isTargetMatch = (item: any, target: { id?: string | number; name?: string } | null) => {
  if (!item || !target) return false;

  const itemId = String(item.id || '').trim();
  const targetId = String(target.id || '').trim();

  // 1. Direct ID match (highest priority, 100% accurate)
  if (targetId && itemId && (itemId.toLowerCase() === targetId.toLowerCase())) return true;

  // 2. Strip prefix ID match (xt_series_123 vs 123)
  if (targetId && itemId) {
    const cleanItemId = itemId.replace(/^(xt_|)(vod_|series_|live_)/i, '');
    const cleanTargetId = targetId.replace(/^(xt_|)(vod_|series_|live_)/i, '');
    if (cleanItemId && cleanTargetId && cleanItemId === cleanTargetId) return true;
  }

  // 3. Name matching
  const itemTitle = (item.title || item.name || '').trim();
  const targetName = (target.name || '').trim();

  if (targetName && itemTitle) {
    if (itemTitle.toLowerCase() === targetName.toLowerCase()) return true;
    const normItem = normalizeTitle(itemTitle);
    const normTarget = normalizeTitle(targetName);
    if (normItem && normTarget && normItem === normTarget) return true;
  }

  return false;
};

export default function SeriesScreen() {
  const isFocused = useIsFocused();
  const colors = useColors();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { width, height } = useWindowDimensions();
  const rawIsLandscape = width > height;
  const isWindowsWeb = Platform.OS === 'web';
  const rawIsLargeScreen = width >= 1024 || Platform.isTV;
  const rawNumColumns = rawIsLargeScreen ? 4 : 3;
  const rawMobileNumColumns = Math.max(2, Math.floor((width - 40) / 130));

  const [layoutState, setLayoutState] = useState({
    isLandscape: rawIsLandscape,
    isLargeScreen: rawIsLargeScreen,
    numColumns: rawNumColumns,
    mobileNumColumns: rawMobileNumColumns
  });

  useEffect(() => {
    if (isFocused) {
      setLayoutState({
        isLandscape: rawIsLandscape,
        isLargeScreen: rawIsLargeScreen,
        numColumns: rawNumColumns,
        mobileNumColumns: rawMobileNumColumns
      });
    }
  }, [isFocused, rawIsLandscape, rawIsLargeScreen, rawNumColumns, rawMobileNumColumns]);

  const { isLandscape, isLargeScreen, numColumns, mobileNumColumns } = layoutState;

  const activePlaylistId = useAppStore((s) => s.activePlaylistId);
  const activeCategories = useAppStore((s) => s.activeCategories);
  const categoryPreferences = useAppStore((s) => s.categoryPreferences);
  const updateCategoryPreferences = useAppStore((s) => s.updateCategoryPreferences);
  const defaultPrefs = useMemo(() => ({ hiddenIds: [], liveOrder: [], vodOrder: [], seriesOrder: [] }), []);
  const prefs = categoryPreferences[activePlaylistId] || defaultPrefs;
  const getChannelsForCategory = useAppStore((s) => s.getChannelsForCategory);
  const refreshCounter = useAppStore((s) => s.refreshCounter);
  const isNetworkOnline = useAppStore((s) => s.isNetworkOnline);
  const favorites = useAppStore((s) => s.favorites) || [];
  const favoriteItems = useAppStore((s) => s.favoriteItems) || [];
  const continueWatching = useAppStore((s) => s.continueWatching);
  const categoryCounts = useAppStore((s) => s.categoryCounts);

  const [selectedCategory, setSelectedCategory] = useState<{ id: string; name: string; count?: number } | null>(null);
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null);
  const pendingTargetRef = useRef<{ id?: string; name?: string } | null>(null);
  const [localSeries, setLocalSeries] = useState<any[]>([]);
  const localSeriesRef = useRef<any[]>([]);
  useEffect(() => {
    localSeriesRef.current = localSeries;
  }, [localSeries]);
  const [displayCount, setDisplayCount] = useState(50);
  const [loading, setLoading] = useState(false);
  const activeRequestId = useRef(0);
  const hasDefaulted = useRef(false);
  const lastLoadedCategoryId = useRef<string | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const categoryListRef = useRef<FlatList>(null);

  const isParentalLocked = useAppStore((s) => s.isParentalLocked);
  const unlockCategory = useAppStore((s) => s.unlockCategory);
  const parentalPin = useAppStore((s) => s.parentalPin);

  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [pendingCategory, setPendingCategory] = useState<any>(null);

  const [categorySearch, setCategorySearch] = useState('');
  const [seriesSearch, setSeriesSearch] = useState('');
  const [showCategoryKeyboard, setShowCategoryKeyboard] = useState(false);
  const [showSeriesKeyboard, setShowSeriesKeyboard] = useState(false);

  const categories = useMemo(() => {
    if (!activeCategories?.series) return [];
    const hiddenSet = new Set((prefs.hiddenIds || []).map(String));
    let filtered = activeCategories.series.filter((c: any) => !hiddenSet.has(String(c.id)));
    if (prefs.seriesOrder && prefs.seriesOrder.length > 0) {
      const orderMap = new Map<string, number>(prefs.seriesOrder.map((id, index) => [String(id), index]));
      filtered.sort((a: any, b: any) => {
        const idxA = orderMap.has(String(a.id)) ? orderMap.get(String(a.id))! : 999999;
        const idxB = orderMap.has(String(b.id)) ? orderMap.get(String(b.id))! : 999999;
        return idxA - idxB;
      });
    }

    const isSeriesItem = (i: any) => {
      if (!i) return false;
      if (i.type === 'series') return true;
      if (typeof i.id === 'string' && (i.id.startsWith('xt_series_') || i.id.startsWith('series_'))) return true;
      if (typeof i.streamUrl === 'string' && i.streamUrl.includes('/series/')) return true;
      return false;
    };

    const seriesCounts = categoryCounts?.series || {};
    const seriesTotal = categoryCounts?.totals?.series;
    const favItemsCount = favoriteItems.filter(isSeriesItem).length;
    const favIdsCount = (favorites || []).filter((id: any) => typeof id === 'string' && (id.startsWith('xt_series_') || id.startsWith('series_'))).length;
    const seriesFavCount = Math.max(favItemsCount, favIdsCount);

    const SPECIAL_CATEGORIES = [
      { id: '__all__', name: t('all') || 'All', count: seriesTotal },
      { id: '__recent__', name: t('continue_watching') || 'Continue Watching' },
      { id: '__favorites__', name: t('favorites') || 'Favorites', count: seriesFavCount }
    ];

    const mappedFiltered = filtered.map((c: any) => ({
      ...c,
      count: seriesCounts[String(c.id)] ?? seriesCounts[c.name] ?? c.count
    }));

    return [...SPECIAL_CATEGORIES, ...mappedFiltered];
  }, [activeCategories?.series, prefs, t, categoryCounts, favoriteItems, favorites]);

  const filteredCategories = useMemo(() => {
    if (!categorySearch.trim()) return categories;
    const q = categorySearch.toLowerCase().trim();
    return categories.filter((c: any) => c.name.toLowerCase().includes(q));
  }, [categories, categorySearch]);

  const [globalSearchResults, setGlobalSearchResults] = useState<any[]>([]);
  const [isSearchingGlobal, setIsSearchingGlobal] = useState(false);

  useEffect(() => {
    if (selectedCategory?.id !== '__all__' || !seriesSearch.trim()) {
      setGlobalSearchResults([]);
      setIsSearchingGlobal(false);
      return;
    }

    const q = seriesSearch.trim();
    let isCurrent = true;
    setIsSearchingGlobal(true);

    const timer = setTimeout(async () => {
      try {
        const results = await useAppStore.getState().searchChannels(q, 'series', 250);
        if (isCurrent) {
          const mapped = results.map((c: Channel) => ({
            id: c.id,
            title: c.name,
            poster: c.logo || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name)}&background=1A1A1A&color=D4A843&bold=true&size=300&format=svg`,
            backdrop: c.logo,
            rating: 0,
            year: 0,
            genres: [c.category],
            category: c.category,
            categoryId: c.categoryId,
            description: '',
            streamUrl: c.streamUrl,
          }));
          setGlobalSearchResults(mapped);
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
  }, [seriesSearch, selectedCategory?.id]);

  const filteredSeries = useMemo(() => {
    if (!seriesSearch.trim()) return localSeries;
    if (selectedCategory?.id === '__all__') {
      return globalSearchResults;
    }
    const q = seriesSearch.toLowerCase().trim();
    return localSeries.filter(m => m.title.toLowerCase().includes(q));
  }, [localSeries, seriesSearch, selectedCategory?.id, globalSearchResults]);

  const moveCategory = (direction: 'up' | 'down') => {
    if (!selectedCategory || selectedCategory.id.startsWith('__')) return;
    if (!activePlaylistId) return;

    const hiddenSet = new Set((prefs.hiddenIds || []).map(String));
    let currentList = (activeCategories?.series || []).filter((c: any) => !hiddenSet.has(String(c.id)));
    if (prefs.seriesOrder && prefs.seriesOrder.length > 0) {
      const orderMap = new Map<string, number>(prefs.seriesOrder.map((id, index) => [String(id), index]));
      currentList.sort((a: any, b: any) => {
        const idxA = orderMap.has(String(a.id)) ? orderMap.get(String(a.id))! : 999999;
        const idxB = orderMap.has(String(b.id)) ? orderMap.get(String(b.id))! : 999999;
        return idxA - idxB;
      });
    }

    const index = currentList.findIndex((c: any) => String(c.id) === String(selectedCategory.id));
    if (index === -1) return;
    
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === currentList.length - 1) return;
    
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    const temp = currentList[index];
    currentList[index] = currentList[swapIndex];
    currentList[swapIndex] = temp;

    const newOrder = currentList.map((c: any) => String(c.id));
    updateCategoryPreferences(activePlaylistId, { seriesOrder: newOrder });
  };

  const scrollAndFocusTarget = useCallback((targetId: string, targetIdx: number, numCols: number) => {
    const row = Math.floor(targetIdx / numCols);
    const rowHeight = numCols >= 3 ? 380 : 240;
    const targetOffset = Math.max(0, (row - 1) * rowHeight);

    if (Platform.OS === 'web') {
      flatListRef.current?.scrollToOffset({ offset: targetOffset, animated: false });
      let attempts = 0;
      const cleanId = String(targetId).replace(/^(xt_|)(vod_|series_|live_)/i, '');
      const timer = setInterval(() => {
        attempts++;
        const el = document.getElementById(`card_${targetId}`) || 
                   document.getElementById(`card_xt_vod_${cleanId}`) ||
                   document.getElementById(`card_xt_series_${cleanId}`) ||
                   document.getElementById(`card_${cleanId}`) ||
                   document.querySelector(`[data-card-id="${targetId}"]`) ||
                   document.querySelector(`[data-card-id="${cleanId}"]`);

        if (el) {
          clearInterval(timer);
          try {
            el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
            const focusable = el.getAttribute('tabindex') !== null ? el : el.querySelector<HTMLElement>('[tabindex], [data-focusable="true"]');
            (focusable || el as HTMLElement)?.focus();
          } catch (e) {}
        } else if (attempts >= 25) {
          clearInterval(timer);
          try {
            flatListRef.current?.scrollToOffset({ offset: Math.max(0, row * rowHeight), animated: true });
          } catch (e) {}
        }
      }, 50);
    } else {
      setTimeout(() => {
        try {
          flatListRef.current?.scrollToIndex({ index: targetIdx, animated: true, viewPosition: 0.5 });
        } catch (e) {
          try {
            flatListRef.current?.scrollToOffset({ offset: Math.max(0, row * rowHeight), animated: true });
          } catch (err) {}
        }
      }, 300);
    }
  }, []);

  const loadCategory = useCallback(async (cat: { id: string; name: string }, forceReload = false) => {
    if (!activePlaylistId) return;
    // Skip reload if we already have data for this category and it's not forced
    if (!forceReload && lastLoadedCategoryId.current === cat.id && localSeriesRef.current.length > 0) {
      return;
    }
    const reqId = ++activeRequestId.current;
    setDisplayCount(50);
    setLoading(true);
    lastLoadedCategoryId.current = cat.id;
    try {
      let result: Channel[] = [];
      const store = useAppStore.getState();

      if (cat.id === '__all__') {
        const seriesCats = store.activeCategories?.series || [];
        if (seriesCats.length > 0) {
          const randomCats = [...seriesCats].sort(() => 0.5 - Math.random()).slice(0, 5);
          const chunks = await Promise.all(
            randomCats.map(c => getChannelsForCategory(activePlaylistId, 'series', c.id, c.name).catch(() => []))
          );
          result = chunks.flat().sort(() => 0.5 - Math.random());
        }
      } else if (cat.id === '__recent__') {
        result = store.continueWatching
          .filter((i) => i.type === 'series' && i.progress > 0)
          .map((i) => ({ ...i, category: i.category || 'Series' } as unknown as Channel));
      } else if (cat.id === '__favorites__') {
        result = store.favoriteItems
          .filter((i) => i.type === 'series')
          .map((i) => ({ ...i, category: i.category || 'Series' } as unknown as Channel));
      } else {
        result = await getChannelsForCategory(activePlaylistId, 'series', cat.id, cat.name);
      }

      if (activeRequestId.current !== reqId) return;

      const mapped = result.map((c: Channel) => ({
        id: c.id,
        title: c.name,
        poster: c.logo || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name)}&background=1A1A1A&color=D4A843&bold=true&size=300&format=svg`,
        backdrop: c.logo,
        rating: 0,
        year: 0,
        seasons: 1,
        genres: [c.category],
        category: c.category,
        categoryId: c.categoryId,
        description: '',
        streamUrl: c.streamUrl,
        episodes: [],
      }));
      setLocalSeries(mapped);

      const target = pendingTargetRef.current;
      let matchedSeries: any | null = null;
      let mIdx = -1;
      if (target) {
        mIdx = mapped.findIndex((m: any) => isTargetMatch(m, target));
        if (mIdx >= 0) {
          matchedSeries = mapped[mIdx];
        }
      }
      if (matchedSeries && mIdx >= 0) {
        setSelectedSeriesId(matchedSeries.id);
        setDisplayCount(Math.max(50, mIdx + 30));
        scrollAndFocusTarget(matchedSeries.id, mIdx, rawNumColumns);
        pendingTargetRef.current = null;
        router.setParams({ focusId: '', focusName: '' });
      }
    } catch (e) {
      if (activeRequestId.current !== reqId) return;
      setLocalSeries([]);
    } finally {
      if (activeRequestId.current === reqId) {
        setLoading(false);
      }
    }
  }, [activePlaylistId, getChannelsForCategory, rawNumColumns, scrollAndFocusTarget, displayCount]);

  const handleCategoryPress = useCallback((cat: { id: string; name: string }) => {
    if (isParentalLocked(cat.id)) {
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory?.id, activePlaylistId, refreshCounter]);

  const { categoryId, categoryName, focusId, focusName } = useLocalSearchParams<{ 
    categoryId?: string; 
    categoryName?: string; 
    focusId?: string; 
    focusName?: string; 
  }>();

  useEffect(() => {
    if (focusId || focusName) {
      pendingTargetRef.current = { id: focusId, name: focusName };
      if (focusId) setSelectedSeriesId(focusId);
    }
    if ((categoryId || categoryName) && categories.length > 0) {
      const targetCat = categories.find(
        c => (categoryId && String(c.id).toLowerCase() === String(categoryId).toLowerCase()) || 
             (categoryId && c.name.toLowerCase() === String(categoryId).toLowerCase()) ||
             (categoryName && c.name.toLowerCase() === String(categoryName).toLowerCase())
      );
      if (targetCat) {
        if (seriesSearch) setSeriesSearch('');
        const isSameCategory = selectedCategory && String(selectedCategory.id) === String(targetCat.id);
        if (!isSameCategory) {
          setLocalSeries([]);
          setSelectedCategory(targetCat);
        } else {
          loadCategory(targetCat);
        }
        const catIdx = categories.findIndex(c => String(c.id) === String(targetCat.id));
        if (catIdx >= 0) {
          setTimeout(() => {
            try {
              categoryListRef.current?.scrollToIndex({ index: catIdx, animated: true, viewPosition: 0.5 });
            } catch (e) {
              categoryListRef.current?.scrollToOffset({ offset: Math.max(0, (catIdx - 2) * 48), animated: true });
            }
          }, 250);
        }
        router.setParams({ categoryId: '', categoryName: '' });
      }
    }
  }, [categoryId, categoryName, categories, focusId, focusName, seriesSearch]);

  useEffect(() => {
    const target = pendingTargetRef.current || (focusId || focusName ? { id: focusId, name: focusName } : null);
    if (target && localSeries.length > 0) {
      const idx = localSeries.findIndex((m: any) => isTargetMatch(m, target));
      if (idx >= 0) {
        const found = localSeries[idx];
        setSelectedSeriesId(found.id);
        if (idx >= displayCount) {
          setDisplayCount(idx + 30);
        }
        const cols = isLargeScreen ? numColumns : mobileNumColumns;
        scrollAndFocusTarget(found.id, idx, cols);
        pendingTargetRef.current = null;
        if (focusId || focusName) {
          router.setParams({ focusId: '', focusName: '' });
        }
      }
    }
  }, [localSeries, focusId, focusName, displayCount, numColumns, mobileNumColumns, isLargeScreen, scrollAndFocusTarget]);

  const handleSeriesPress = (item: any) => {
    pendingTargetRef.current = { id: item.id, name: item.title };
    setSelectedSeriesId(item.id);

    const catIdentifier = item.categoryId || item.category || (item.genres && item.genres[0]);
    if (catIdentifier && categories.length > 0) {
      const targetCat = categories.find(
        c => String(c.id).toLowerCase() === String(catIdentifier).toLowerCase() || 
             c.name.toLowerCase() === String(catIdentifier).toLowerCase()
      );
      if (targetCat) {
        if (!selectedCategory || selectedCategory.id !== targetCat.id) {
          if (seriesSearch) setSeriesSearch('');
          setSelectedCategory(targetCat);
        }
        const catIdx = categories.findIndex(c => String(c.id) === String(targetCat.id));
        if (catIdx >= 0) {
          setTimeout(() => {
            try {
              categoryListRef.current?.scrollToIndex({ index: catIdx, animated: true, viewPosition: 0.5 });
            } catch (e) {
              categoryListRef.current?.scrollToOffset({ offset: Math.max(0, (catIdx - 2) * 48), animated: true });
            }
          }, 150);
        }
      }
    }

    router.push({
      pathname: '/series-detail',
      params: {
        id: item.id,
        title: item.title,
        poster: item.poster,
        backdrop: item.backdrop,
        genres: Array.isArray(item.genres) ? item.genres.join(',') : (item.category || ''),
        description: item.description,
        streamUrl: item.streamUrl || '',
      },
    });
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if ((categoryId || categoryName) && categories.length > 0) {
        const targetCat = categories.find(
          c => (categoryId && String(c.id).toLowerCase() === String(categoryId).toLowerCase()) || 
               (categoryId && c.name.toLowerCase() === String(categoryId).toLowerCase()) ||
               (categoryName && c.name.toLowerCase() === String(categoryName).toLowerCase())
        );
        if (targetCat) {
          if (seriesSearch) setSeriesSearch('');
          if (!selectedCategory || selectedCategory.id !== targetCat.id) {
            setSelectedCategory(targetCat);
          }
          const catIdx = categories.findIndex(c => String(c.id) === String(targetCat.id));
          if (catIdx >= 0) {
            setTimeout(() => {
              try {
                categoryListRef.current?.scrollToIndex({ index: catIdx, animated: true, viewPosition: 0.5 });
              } catch (e) {
                categoryListRef.current?.scrollToOffset({ offset: Math.max(0, (catIdx - 2) * 48), animated: true });
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
          const firstValid = categories.find(c => !isParentalLocked(c.name)) || categories[0];
          setSelectedCategory(firstValid);
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
  }, [navigation, categories, categoryId, categoryName, selectedCategory, seriesSearch]);

  useEffect(() => {
    if (categories.length > 0 && !hasDefaulted.current) {
      if (categoryId || categoryName || focusId || focusName) {
        return;
      }
      if (isLargeScreen) {
        const firstValid = categories.find(c => !isParentalLocked(c.name)) || categories[0];
        setSelectedCategory(firstValid);
      }
      hasDefaulted.current = true;
    }
  }, [categories, isLargeScreen, isParentalLocked, categoryId, categoryName, focusId, focusName]);

  useEffect(() => {
    hasDefaulted.current = false;
    setSelectedCategory(null);
    setLocalSeries([]);
  }, [activePlaylistId]);


  if (isLargeScreen) {
    const isWeb = Platform.OS === 'web';

    return (
      <View style={[styles.tvContainer, { backgroundColor: '#05070a', paddingLeft: 0, opacity: isFocused ? 1 : 0, pointerEvents: isFocused ? 'auto' : 'none' }]}>
        <View style={{ flexDirection: 'row', flex: 1, backgroundColor: '#0A0C10', height: '100%' }}>
          {/* Pane 1: Categories */}
          <View style={[styles.tvPaneCategories, { borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.08)' }]} data-focus-zone="series-categories">
            <View style={styles.tvHeader}>
              {/* <Text style={[styles.tvTitle, { color: colors.text }]}>{t('series')}</Text> */}
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
                    <TVFocusable onPress={() => setCategorySearch('')} disableBorder={true}>
                      <Ionicons name="close-circle" size={16} color={colors.mutedForeground} style={{ padding: 4 }} />
                    </TVFocusable>
                  ) : null}
                </View>
              )}
            </View>
            <FlatList
              ref={categoryListRef}
              style={{ flex: 1 }}
              data={filteredCategories}
              extraData={[selectedCategory?.id, favoriteItems.length, filteredCategories]}
              keyExtractor={(item) => item.id}
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
              renderItem={({ item, index }) => {
                const isSelected = selectedCategory?.id === item.id;
                const isSpecial = item.id.startsWith('__');
                return (
                  <View 
                    style={[
                      styles.tvCategoryItem,
                      { padding: 0, paddingHorizontal: 0, paddingVertical: 0, flexDirection: 'row', alignItems: 'stretch' }
                    ]}
                  >
                    <TVFocusable
                      hasTVPreferredFocus={isSelected}
                      disableBorder
                      onFocus={() => {
                        categoryListRef.current?.scrollToIndex({
                          index,
                          animated: true,
                          viewPosition: 0.5,
                        });
                      }}
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

          {/* Pane 2: Series */}
          <View style={[styles.tvPaneContent, { flex: 1 }]} data-focus-zone="series-grid">
            <View style={[styles.tvHeader, { paddingBottom: 16 }]}>
              {/* <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <Text style={[styles.tvTitle, { color: colors.text }]}>
                  {selectedCategory ? selectedCategory.name : 'Select a Category'}
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
              {selectedCategory && (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {selectedCategory && !selectedCategory.id.startsWith('__') && !seriesSearch && (
                    <>
                      <TVFocusable
                        onPress={() => moveCategory('up')}
                        style={({ focused }: any) => [
                          styles.tvFavoriteBtn,
                          { backgroundColor: focused ? colors.gold : 'rgba(255,255,255,0.05)', borderColor: colors.border, marginTop: 0, paddingHorizontal: 16, marginRight: 8 }
                        ]}
                      >
                        {({ focused }: any) => (
                          <Ionicons name="chevron-up" size={22} color={focused ? '#000' : colors.text} />
                        )}
                      </TVFocusable>

                      <TVFocusable
                        onPress={() => moveCategory('down')}
                        style={({ focused }: any) => [
                          styles.tvFavoriteBtn,
                          { backgroundColor: focused ? colors.gold : 'rgba(255,255,255,0.05)', borderColor: colors.border, marginTop: 0, paddingHorizontal: 16, marginRight: 16 }
                        ]}
                      >
                        {({ focused }: any) => (
                          <Ionicons name="chevron-down" size={22} color={focused ? '#000' : colors.text} />
                        )}
                      </TVFocusable>
                    </>
                  )}
                  <View style={[styles.searchBox, { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.1)' }]}>
                    <Ionicons name="search" size={14} color={colors.mutedForeground} />
                    {isWindowsWeb ? (
                      <TextInput
                        style={[styles.searchInput, { color: colors.text, outlineStyle: 'none' } as any]}
                        placeholder="search"
                        placeholderTextColor={colors.mutedForeground}
                        value={seriesSearch}
                        onChangeText={setSeriesSearch}
                        returnKeyType="search"
                      />
                    ) : isLargeScreen ? (
                      <TVFocusable onPress={() => setShowSeriesKeyboard(true)} style={{ flex: 1, paddingVertical: 4 }}>
                        <Text style={[styles.searchInput, { color: seriesSearch ? colors.text : colors.mutedForeground, marginTop: 4 }]}>
                          {seriesSearch || 'search'}
                        </Text>
                      </TVFocusable>
                    ) : (
                      <TextInput
                        style={[styles.searchInput, { color: colors.text }]}
                        placeholder="search"
                        placeholderTextColor={colors.mutedForeground}
                        value={seriesSearch}
                        onChangeText={setSeriesSearch}
                      />
                    )}
                    {seriesSearch ? (
                      <TVFocusable onPress={() => { setSeriesSearch(''); setShowSeriesKeyboard(false); }} disableBorder>
                        <Ionicons name="close-circle" size={18} color={colors.mutedForeground} style={{ padding: 4 }} />
                      </TVFocusable>
                    ) : null}
                  </View>
                </View>
              )}
            </View>
            {loading || isSearchingGlobal ? (
              <View style={styles.centerAll}>
                <ActivityIndicator size="large" color={colors.gold} />
              </View>
            ) : !selectedCategory ? (
              <View style={styles.centerAll}>
                <Lineicons icon={Folder1Bulk} size={48} color={colors.mutedForeground} />
                <Text style={[styles.emptyTitle, { color: colors.text, marginTop: 12 }]}>{t('choose_category')}</Text>
              </View>
            ) : filteredSeries.length === 0 ? (
              <View style={styles.centerAll}>
                <Lineicons 
                  icon={selectedCategory?.id === '__favorites__' ? HeartBulk : Search1Bulk} 
                  size={48} 
                  color={colors.mutedForeground} 
                />
                <Text style={[styles.emptyTitle, { color: colors.text, marginTop: 12, marginBottom: 16 }]}>
                  {seriesSearch 
                    ? t('no_series') 
                    : selectedCategory?.id === '__favorites__'
                    ? t('no_favorites')
                    : (isNetworkOnline === false ? 'لا يوجد اتصال بالإنترنت' : t('no_series'))}
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
              <View style={{ flex: 1, opacity: loading ? 0.5 : 1 }}>
                {isWindowsWeb ? (
                  <ScrollView 
                    contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, paddingBottom: 40 }}
                  >
                    {filteredSeries.slice(0, displayCount).map((item, index) => {
                      const isItemFocused = Boolean(
                        selectedSeriesId && (
                          String(item.id) === String(selectedSeriesId) ||
                          isTargetMatch(item, { id: selectedSeriesId })
                        )
                      );
                      return (
                        <View key={`web_${item.id}_${index}`} style={[styles.tvGridItem, { width: `${100 / numColumns}%`, maxWidth: `${100 / numColumns}%` }]}>
                          <MovieCard
                            autoFocus={isItemFocused}
                            isSelected={isItemFocused}
                            movie={item}
                            width={'100%' as any}
                            onPress={() => handleSeriesPress(item)}
                          />
                        </View>
                      );
                    })}
                    {displayCount < filteredSeries.length && (
                      <View style={{ width: '100%', height: 100, justifyContent: 'center', alignItems: 'center' }}>
                         <ActivityIndicator size="large" color={colors.gold} />
                         {isWindowsWeb && (
                           <View 
                             ref={(el) => {
                               if (el && typeof window !== 'undefined' && (window as any).IntersectionObserver) {
                                 const obs = new IntersectionObserver(([entry]) => {
                                   if (entry.isIntersecting) {
                                     setDisplayCount(p => p + 40);
                                     obs.disconnect();
                                   }
                                 }, { rootMargin: '800px' });
                                 obs.observe(el as any);
                               }
                             }}
                             style={{ width: 10, height: 10, position: 'absolute', bottom: 0 }} 
                           />
                         )}
                      </View>
                    )}
                  </ScrollView>
                ) : (
                  <FlatList
                    ref={flatListRef}
                    onScrollToIndexFailed={(info) => {
                      const row = Math.floor(info.index / numColumns);
                      const rowHeight = 380;
                      flatListRef.current?.scrollToOffset({ offset: Math.max(0, row * rowHeight), animated: false });
                      setTimeout(() => {
                        try {
                          flatListRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0.5 });
                        } catch (e) {}
                      }, 250);
                    }}
                    removeClippedSubviews={false}
                    initialNumToRender={12}
                    maxToRenderPerBatch={16}
                    windowSize={7}
                    key={`series_grid_${numColumns}`}
                    data={filteredSeries.slice(0, displayCount)}
                    onEndReached={() => setDisplayCount(prev => prev + 20)}
                    onEndReachedThreshold={0.5}
                    keyExtractor={(item) => item.id}
                    numColumns={numColumns}
                    renderItem={({ item }) => {
                      const isItemFocused = Boolean(
                      selectedSeriesId && (
                        String(item.id) === String(selectedSeriesId) ||
                        isTargetMatch(item, { id: selectedSeriesId })
                      )
                    );
                      return (
                        <View style={[styles.tvGridItem, { width: `${100 / numColumns}%`, maxWidth: `${100 / numColumns}%` }]}>
                          <MovieCard
                            autoFocus={isItemFocused}
                            isSelected={isItemFocused}
                            movie={item}
                            width={'100%' as any}
                            onPress={() => handleSeriesPress(item)}
                          />
                        </View>
                      );
                    }}
                  contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 40 }}
                />
                )}
              </View>
            )}
          </View>
        </View>
        {!isWindowsWeb && (
          <>
            <SearchKeyboardModal 
              visible={showCategoryKeyboard}
              value={categorySearch}
              onChangeText={setCategorySearch}
              onClose={() => setShowCategoryKeyboard(false)}
              placeholder="search"
            />
            <SearchKeyboardModal 
              visible={showSeriesKeyboard}
              value={seriesSearch}
              onChangeText={setSeriesSearch}
              onClose={() => setShowSeriesKeyboard(false)}
              placeholder="search"
            />
          </>
        )}
      </View>
    );
  }

  // --- Mobile Layout ---
  const categoryNumColumns = 1;

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
            <Text style={[styles.title, { color: colors.text, fontSize: isLandscape ? 18 : 22 }]} numberOfLines={isLandscape ? 1 : 2}>
              {selectedCategory.name}
            </Text>
            {selectedCategory.id !== '__all__' && (
              <Text style={[styles.count, { color: colors.mutedForeground, fontSize: isLandscape ? 11 : 13 }]}>
                {localSeries.length.toLocaleString('en-US')} {t('count_series')}
              </Text>
            )}
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



        {!isLandscape && (
          <TVFocusable
            style={[styles.searchBar, { backgroundColor: colors.surface2, borderColor: colors.border }]}
            onPress={() => router.push('/search')}
          >
            <Lineicons icon={Search1Bulk} size={16} color={colors.mutedForeground} />
            <Text style={[styles.searchInput, { color: colors.mutedForeground }]}>
              search
            </Text>
          </TVFocusable>
        )}

        {loading ? (
          <View style={styles.centerAll}>
            <ActivityIndicator size="large" color={colors.gold} />
          </View>
        ) : localSeries.length === 0 ? (
          <View style={styles.centerAll}>
            <Lineicons 
              icon={selectedCategory?.id === '__favorites__' ? HeartBulk : MonitorBulk} 
              size={48} 
              color={colors.mutedForeground} 
            />
            <Text style={[styles.emptyTitle, { color: colors.text, marginTop: 12, marginBottom: 16 }]}>
              {selectedCategory?.id === '__favorites__'
                ? t('no_favorites')
                : (isNetworkOnline === false ? 'لا يوجد اتصال بالإنترنت' : t('no_series'))}
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
              const row = Math.floor(info.index / mobileNumColumns);
              const rowHeight = 220;
              flatListRef.current?.scrollToOffset({ offset: Math.max(0, row * rowHeight), animated: false });
              setTimeout(() => {
                try {
                  flatListRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0.5 });
                } catch (e) {}
              }, 250);
            }}
            removeClippedSubviews={Platform.OS !== 'web'}
            initialNumToRender={12}
            maxToRenderPerBatch={16}
            windowSize={7}
            key={`series_grid_${mobileNumColumns}`}
            data={localSeries.slice(0, displayCount)}
            onEndReached={() => setDisplayCount(prev => prev + 50)}
            onEndReachedThreshold={0.5}
            keyExtractor={(item) => item.id}
            numColumns={mobileNumColumns}
            renderItem={({ item }) => {
              const isItemFocused = Boolean(
                    selectedSeriesId && (
                      String(item.id) === String(selectedSeriesId) ||
                      isTargetMatch(item, { id: selectedSeriesId })
                    )
                  );
              return (
                <View style={[styles.gridItem, { width: `${100 / mobileNumColumns}%`, maxWidth: `${100 / mobileNumColumns}%` }]}>
                  <MovieCard
                    autoFocus={isItemFocused}
                    isSelected={isItemFocused}
                    movie={item}
                    width={'100%' as any}
                    onPress={() => handleSeriesPress(item)}
                  />
                </View>
              );
            }}
            contentContainerStyle={[styles.gridContent, { paddingBottom: isLandscape ? insets.bottom + 80 : insets.bottom + 120 }]}
          />
        )}

        {!isLandscape && (
          <TVFocusable
            disableBorder
            onPress={() => setSelectedCategory(null)}
            style={[styles.floatingViewAllBtn, { backgroundColor: colors.surface, borderColor: colors.gold, bottom: insets.bottom + 90 }]}
          >
            <Lineicons icon={DashboardSquare1Bulk} size={18} color={colors.gold} />
            <Text style={[styles.floatingViewAllText, { color: colors.text }]}>{t('view_all_categories')}</Text>
          </TVFocusable>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top, opacity: isFocused ? 1 : 0, pointerEvents: isFocused ? 'auto' : 'none' }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>{t('series')}</Text>
        <Text style={[styles.count, { color: colors.mutedForeground }]}>
          {categories.length.toLocaleString('en-US')} {t('count_categories')}
        </Text>
      </View>

      <TVFocusable
        style={[styles.searchBar, { backgroundColor: colors.surface2, borderColor: colors.border }]}
        onPress={() => router.push('/search')}
      >
        <Lineicons icon={Search1Bulk} size={16} color={colors.mutedForeground} />
        <Text style={[styles.searchInput, { color: colors.mutedForeground }]}>
          search
        </Text>
      </TVFocusable>

      {categories.length === 0 ? (
        <View style={styles.centerAll}>
          <Lineicons icon={Folder1Bulk} size={48} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.text, marginTop: 12 }]}>{t('no_categories')}</Text>
        </View>
      ) : (
        <FlatList
removeClippedSubviews={Platform.OS !== 'web'}
initialNumToRender={8}
maxToRenderPerBatch={12}
windowSize={5}
          key={`categories_grid_${categoryNumColumns}`}
          data={categories}
          numColumns={categoryNumColumns}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={{ width: `${100 / categoryNumColumns}%`, padding: 0 }}>
              <TVFocusable
                onPress={() => handleCategoryPress(item)}
                style={({ focused }: any) => [
                  styles.categoryItem,
                  { backgroundColor: focused ? colors.surface : colors.surface2, borderColor: focused ? colors.gold : colors.border },
                  { padding: 14 }
                ]}
              >
                <View style={[styles.categoryLeft, { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, marginRight: 8 }}>
                    <View style={[styles.categoryIconBg, { backgroundColor: colors.gold + '15' }]}>
                      <Lineicons icon={Folder1Bulk} size={18} color={colors.gold} />
                    </View>
                    <Text 
                      style={[styles.categoryName, { color: colors.text, textAlign: 'left', flex: 1 }]} 
                      numberOfLines={2}
                    >
                      {item.name}
                    </Text>
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
            </View>
          )}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 80 }]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
    gap: 8,
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
    marginBottom: 8,
    overflow: 'hidden'
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
  tvPaneCategories: { width: 320, borderRightWidth: 1 },
  tvPaneContent: { flex: 1 },
  tvHeader: { padding: 24, paddingBottom: 16 },
  tvTitle: { fontSize: 24, fontWeight: 'bold' },
  tvCategoryItem: { paddingHorizontal: 24, paddingVertical: 16, borderLeftWidth: 3, borderLeftColor: 'transparent' },
  tvCategoryText: { fontSize: 16 },
  tvTopBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingTop: 24, paddingBottom: 8 },
  tvSearchBar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, height: 48, borderRadius: 24, borderWidth: 1, width: 300 },
  tvSearchText: { fontSize: 15 },
  tvGridItem: { padding: 12 },

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
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 20, marginBottom: 12, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, height: 44 },
  searchInput: { flex: 1, fontSize: 14 },
  gridContent: { paddingHorizontal: 10 },
  gridItem: { flex: 1, padding: 6 },
  listContent: { paddingHorizontal: 20, paddingTop: 4 },
  categoryItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 10 },
  categoryLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  categoryIconBg: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  categoryName: { fontSize: 16, fontWeight: '600' },
  emptyTitle: { fontSize: 18, fontWeight: 'bold' },
});
