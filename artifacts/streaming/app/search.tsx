import { Ionicons } from "@expo/vector-icons";
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TextInput, 
  ActivityIndicator, 
  Dimensions,
  Platform,
  useWindowDimensions
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';


import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { TVFocusable } from '@/components/TVFocusable';
import { TVSidebar } from '@/components/TVSidebar';
import { TVKeyboard } from '@/components/TVKeyboard';
import { useAppStore } from '@/store/app-store';
import { Channel } from '@/types';
import QRCode from 'react-native-qrcode-svg';
import { listenToRemoteKeyboard } from '@/store/firebase';
import { useVoiceSearch } from '@/hooks/useVoiceSearch';
import { useTranslation } from '@/hooks/useTranslation';
import { base64Encode } from '@/lib/base64';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type SearchTab = 'all' | 'live' | 'vod' | 'series';

export default function SearchScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 1024 || Platform.isTV;

  const activePlaylistId = useAppStore((s) => s.activePlaylistId);
  const searchIndexReady = useAppStore((s) => s.searchIndexReady);
  const loadingSearchIndex = useAppStore((s) => s.loadingSearchIndex);
  const searchIndexProgress = useAppStore((s) => s.searchIndexProgress);
  const loadSearchIndex = useAppStore((s) => s.loadSearchIndex);
  const buildSearchIndex = useAppStore((s) => s.buildSearchIndex);
  const searchChannels = useAppStore((s) => s.searchChannels);
  const getSearchSuggestions = useAppStore((s) => s.getSearchSuggestions);
  const setPlaybackQueue = useAppStore((s) => s.setPlaybackQueue);

  const [query, setQuery] = useState('');
  const [filteredResults, setFilteredResults] = useState<Channel[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState<SearchTab>('all');
  const [preparingChannelId, setPreparingChannelId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [hasAttemptedAutoBuild, setHasAttemptedAutoBuild] = useState(false);
  const remoteSessionId = useRef(Math.random().toString(36).substring(2, 6).toUpperCase()).current;
  const inputRef = useRef<any>(null);
  const { tab } = useLocalSearchParams<{ tab?: SearchTab }>();
  const isFocused = useIsFocused();

  const { isListening, toggleListening, isSupported } = useVoiceSearch((text) => {
    setQuery((prev) => prev ? `${prev} ${text}` : text);
  });

  useEffect(() => {
    if (tab && ['all', 'live', 'vod', 'series'].includes(tab)) {
      setActiveTab(tab);
      // clear the param so it doesn't get stuck if navigating back
      router.setParams({ tab: '' });
    }
  }, [tab]);

  // Auto-focus input after screen transition completes
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 150);
    return () => clearTimeout(t);
  }, []);

  // Auto-build search index if empty and tab is focused
  useEffect(() => {
    if (isFocused && activePlaylistId && !searchIndexReady && !loadingSearchIndex && !hasAttemptedAutoBuild) {
      setHasAttemptedAutoBuild(true);
      loadSearchIndex(activePlaylistId);
    }
  }, [isFocused, activePlaylistId, searchIndexReady, loadingSearchIndex, hasAttemptedAutoBuild]);

  const handleBuildIndex = async () => {
    if (activePlaylistId) {
      await buildSearchIndex(activePlaylistId, (msg) => {
        setStatusMessage(msg);
      });
    }
  };

  useEffect(() => {
    return listenToRemoteKeyboard(remoteSessionId, (text) => {
      setQuery(text);
    });
  }, [remoteSessionId]);

  // Perform async debounce filter
  useEffect(() => {
    if (query.trim().length < 2) {
      setFilteredResults([]);
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchChannels(query, activeTab);
        const sugs = await getSearchSuggestions(query);
        setFilteredResults(results);
        setSuggestions(sugs);
      } catch (e) {
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, activeTab, searchChannels, getSearchSuggestions]);

  const handleItemPress = (item: Channel, index: number) => {
    const encodedUrl = base64Encode(item.streamUrl || '');
    if (item.type === 'live') {
      // Use the unified Live TV tab for Web and TV so the player UI is identical
      if (Platform.OS === 'web' || Platform.isTV) {
        router.push({
          pathname: '/(tabs)/live',
          params: { categoryId: item.categoryId || '', focusId: item.id }
        });
      } else {
        router.push({
          pathname: '/player',
          params: {
            id: item.id,
            streamUrl: encodedUrl,
            title: item.name || item.title,
            isLive: 'true',
            current: item.current || '',
            next: item.next || '',
            quality: item.quality || 'HD',
            logo: item.logo || item.poster || '',
            category: item.category || ''
          }
        });
      }
    } else if (item.type === 'vod') {
      router.push({ 
        pathname: '/movie-detail', 
        params: { 
          id: item.id,
          title: item.name,
          poster: item.logo || '',
          streamUrl: encodedUrl
        } 
      });
    } else if (item.type === 'series') {
      router.push({ 
        pathname: '/series-detail', 
        params: { 
          id: item.id,
          title: item.name,
          poster: item.logo || '',
          streamUrl: encodedUrl
        } 
      });
    }
  };

  const renderResultCard = ({ item, index }: { item: Channel; index: number }) => {
    const typeLabel = 
      item.type === 'live' ? 'Live TV' : 
      item.type === 'vod' ? 'Movie' : 'TV Series';
      
    const typeColor = 
      item.type === 'live' ? colors.destructive : 
      item.type === 'vod' ? colors.accent : colors.gold;

    return (
      <TVFocusable 
        style={({ focused }: any) => [
          styles.card, 
          { backgroundColor: focused ? 'rgba(255,255,255,0.05)' : colors.surface, borderColor: focused ? '#FFF' : colors.border },
          focused && { borderWidth: 4, transform: [{ scale: 1.02 }] }
        ]}
        onPress={() => handleItemPress(item, index)}
        focusable={true}
      >
        <View style={styles.cardImageWrapper}>
          <Image 
            source={{ uri: item.logo || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name)}&background=1A1A1A&color=${colors.gold.replace('#', '')}&bold=true&size=120&format=png` }} 
            style={styles.cardImage}
            contentFit={item.type === 'live' ? 'contain' : 'cover'}
          />
        </View>
        
        <View style={styles.cardDetails}>
          <Text style={[styles.cardName, { color: colors.text }]} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={[styles.badgeRow, { justifyContent: 'space-between' }]}>
            <View style={[styles.typeBadge, { backgroundColor: typeColor + '20' }]}>
              <Text style={[styles.typeBadgeText, { color: typeColor }]}>
                {typeLabel}
              </Text>
            </View>
            {item.category ? (
              <Text style={[styles.cardCategory, { color: colors.mutedForeground, textAlign: 'right', flex: 1, writingDirection: 'rtl' }]} numberOfLines={1}>
                {item.category}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={[styles.playIconWrapper, { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
          {preparingChannelId === item.id ? (
            <ActivityIndicator size="small" color={colors.gold} />
          ) : (
            <Ionicons name={item.type === 'live' ? "tv-outline" : "play"} size={18} color={colors.gold} />
          )}
        </View>
      </TVFocusable>
    );
  };

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: 'transparent' }}>
      <TVSidebar />
      <View style={[styles.container, { flex: 1, overflow: 'hidden', paddingTop: insets.top, paddingLeft: isLargeScreen ? 110 : 0 }]}>
      {/* Search Header */}
      <View style={styles.header}>
        <TVFocusable 
          style={({ focused }: any) => [
            styles.backBtn,
            focused && { transform: [{ scale: 1.1 }], backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, borderWidth: 3, borderColor: '#FFF' }
          ]} 
          onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace('/(tabs)'); } }}
          focusable={true}
        >
          {({ focused }: any) => (
            <Ionicons name="chevron-back" size={22} color={focused ? colors.gold : colors.text} />
          )}
        </TVFocusable>
        <TVFocusable 
          onPress={() => {
            if (isLargeScreen) {
              setIsKeyboardOpen(true);
            } else {
              inputRef.current?.focus();
            }
          }}
          style={({ focused }: any) => [styles.searchBox, { backgroundColor: colors.surface, borderColor: focused ? colors.gold : colors.border }]}
        >
          <Ionicons name="search" size={18} color={colors.mutedForeground} style={{ marginRight: 8 }} />
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            placeholder={t('search_all')}
            placeholderTextColor={colors.mutedForeground}
            style={[styles.searchInput, { color: colors.text }]}
            returnKeyType="search"
            focusable={true}
            editable={true}
            showSoftInputOnFocus={!isLargeScreen}
            onFocus={() => { if (isLargeScreen) setIsKeyboardOpen(true) }}
          />
          {query.length > 0 && (
            <TVFocusable disableBorder onPress={() => setQuery('')}>
              <Ionicons name="close" size={18} color={colors.text} />
            </TVFocusable>
          )}
        </TVFocusable>
        {isSupported && (
          <TVFocusable 
            style={({ focused }: any) => [
              styles.syncBtn,
              focused && { transform: [{ scale: 1.1 }], backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, borderWidth: 3, borderColor: '#FFF' },
              isListening && { backgroundColor: colors.destructive, borderColor: colors.destructive }
            ]} 
            onPress={toggleListening}
            focusable={true}
          >
            {({ focused }: any) => (
              <Ionicons name="mic-outline" size={20} color={isListening ? "#FFF" : (focused ? "#FFF" : colors.gold)} />
            )}
          </TVFocusable>
        )}
        {!loadingSearchIndex && (
          <TVFocusable 
            style={({ focused }: any) => [
              styles.syncBtn,
              focused && { transform: [{ scale: 1.1 }], backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, borderWidth: 3, borderColor: '#FFF' }
            ]} 
            onPress={handleBuildIndex}
            focusable={true}
          >
            {({ focused }: any) => (
              <Ionicons name="refresh-outline" size={20} color={focused ? "#FFF" : colors.gold} />
            )}
          </TVFocusable>
        )}
      </View>

      {/* Tabs */}
      {searchIndexReady && !loadingSearchIndex && (
        <View style={[styles.tabsBar, { borderBottomColor: colors.border }]}>
          {(['all', 'live', 'vod', 'series'] as SearchTab[]).map((tab) => {
            const isSelected = activeTab === tab;
            const label = 
              tab === 'all' ? 'All' : 
              tab === 'live' ? 'Live TV' : 
              tab === 'vod' ? 'Movies' : 'Series';
            return (
              <TVFocusable
                key={tab}
                style={({ focused }: any) => [
                  styles.tabItem,
                  isSelected && { borderBottomColor: colors.gold },
                  focused && { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 8, borderWidth: 3, borderColor: '#FFF' }
                ]}
                onPress={() => setActiveTab(tab)}
                focusable={true}
              >
                {({ focused }: any) => (
                  <Text style={[
                    styles.tabLabel,
                    { color: isSelected || focused ? colors.gold : colors.text }
                  ]}>
                    {label}
                  </Text>
                )}
              </TVFocusable>
            );
          })}
        </View>
      )}

      {/* Main Body */}
      <View style={{ flex: 1, flexDirection: 'column', gap: 24, paddingHorizontal: isLargeScreen && isKeyboardOpen ? 16 : 0, marginTop: 16 }}>
        {isLargeScreen && isKeyboardOpen && (
          <View style={{ transform: [{ scale: 0.75 }], marginVertical: -40 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 40, width: '100%', paddingVertical: 12 }}>
              <View style={{ width: 480 }}>
                <TVKeyboard 
                   value={query} 
                   onChangeText={setQuery} 
                   onSubmit={() => setIsKeyboardOpen(false)} 
                   suggestions={suggestions}
                   onSuggestionPress={(sug) => { setQuery(sug); setIsKeyboardOpen(false); }}
                   autoFocus={true}
                />
              </View>

              <View style={{ alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.02)', padding: 24, borderRadius: 16, borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>{t('remote_search')}</Text>
                <View style={{ backgroundColor: '#fff', padding: 12, borderRadius: 12, marginBottom: 12 }}>
                  <QRCode 
                    value={`https://entec-keyboard.web.app/?session=${remoteSessionId}`} 
                    size={140} 
                  />
                </View>
                <Text style={{ color: colors.gold, fontSize: 24, fontWeight: 'bold', letterSpacing: 4 }}>{remoteSessionId}</Text>
              </View>
            </View>
          </View>
        )}
        <View style={{ flex: 1 }}>
      {(isSearching || loadingSearchIndex) ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.gold} />
          {loadingSearchIndex && (
            <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
              {searchIndexProgress || 'Loading search engine...'}
            </Text>
          )}
        </View>
      ) : !searchIndexReady ? (
        <View style={styles.centerContainer}>
          <Ionicons name="server-outline" size={64} color={colors.mutedForeground} style={{ marginBottom: 16 }} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            No Search Data
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
            No searchable items found. You can try refreshing the database using the sync button in the header.
          </Text>
        </View>
      ) : query.trim().length >= 2 && filteredResults.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="sad-outline" size={64} color={colors.mutedForeground} style={{ marginBottom: 16 }} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            No Results Found
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
            Try searching for a different movie, series, or live channel.
          </Text>
        </View>
      ) : query.trim().length < 2 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="search" size={64} color={colors.mutedForeground} style={{ marginBottom: 16 }} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            Search Everything
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
            Type at least 2 characters to search across all items
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredResults}
          keyExtractor={(item) => item.id}
          renderItem={renderResultCard}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 20 }]}
          ListEmptyComponent={
            <View style={styles.centerContainer}>
              <Ionicons name="ban" size={48} color={colors.mutedForeground} style={{ marginBottom: 12 }} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                No results found
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
                Try searching with a different term
              </Text>
            </View>
          }
        />
      )}
        </View>
      </View>
    </View>
  </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 56,
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBox: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    height: '100%',
    padding: 0,
  },
  syncBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 16,
  },
  loadingSubtext: {
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    marginBottom: 20,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  primaryBtnText: {
    color: '#1A1A1A',
    fontWeight: 'bold',
    fontSize: 14,
  },
  listContent: {
    padding: 16,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  cardImageWrapper: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.2)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardDetails: {
    flex: 1,
    marginLeft: 12,
    gap: 4,
  },
  cardName: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  cardPackage: {
    fontSize: 12,
    flex: 1,
  },
  cardCategory: {
    fontSize: 12,
  },
  playIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
});
