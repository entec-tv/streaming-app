import { Ionicons } from "@expo/vector-icons";
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TextInput, 
  ActivityIndicator, 
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
import { base64Encode, base64Decode } from '@/lib/base64';

type SearchTab = 'all' | 'live' | 'vod' | 'series';

export default function SearchScreen() {
  const colors = useColors();
  const { t, language, isRTL } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWindowsWeb = Platform.OS === 'web';
  const isLargeScreen = (width >= 1024 || Platform.isTV) && !isWindowsWeb;

  const activePlaylistId = useAppStore((s) => s.activePlaylistId);
  const playlists = useAppStore((s) => s.playlists);
  const searchIndexReady = useAppStore((s) => s.searchIndexReady);
  const loadingSearchIndex = useAppStore((s) => s.loadingSearchIndex);
  const searchIndexProgress = useAppStore((s) => s.searchIndexProgress);
  const loadSearchIndex = useAppStore((s) => s.loadSearchIndex);
  const buildSearchIndex = useAppStore((s) => s.buildSearchIndex);
  const searchChannels = useAppStore((s) => s.searchChannels);
  const getSearchSuggestions = useAppStore((s) => s.getSearchSuggestions);

  const [query, setQuery] = useState('');
  const [filteredResults, setFilteredResults] = useState<Channel[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
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
      router.setParams({ tab: '' });
    }
  }, [tab]);

  // Auto-focus input on mobile and Windows Desktop
  useEffect(() => {
    if (!isLargeScreen || isWindowsWeb) {
      const t = setTimeout(() => inputRef.current?.focus(), 150);
      return () => clearTimeout(t);
    }
  }, [isLargeScreen, isWindowsWeb]);

  // Auto-build search index if empty and tab is focused
  useEffect(() => {
    if (isFocused && activePlaylistId && !searchIndexReady && !loadingSearchIndex) {
      loadSearchIndex(activePlaylistId);
    }
  }, [isFocused, activePlaylistId, searchIndexReady, loadingSearchIndex]);

  const handleBuildIndex = async () => {
    if (activePlaylistId) {
      await buildSearchIndex(activePlaylistId, (msg) => {
        setStatusMessage(msg);
      });
    }
  };

  useEffect(() => {
    if (isWindowsWeb) return;
    return listenToRemoteKeyboard(remoteSessionId, (text) => {
      setQuery(text);
    });
  }, [remoteSessionId, isWindowsWeb]);

  // Perform async debounce filter
  // Re-runs when query, tab, or searchIndex status changes
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
  }, [query, activeTab, searchChannels, getSearchSuggestions, searchIndexReady, loadingSearchIndex]);

  const handleItemPress = (item: Channel, index: number) => {
    const catIdentifier = item.categoryId || item.category || '';
    const itemTitle = item.name || (item as any).title || '';
    
    if (item.type === 'live') {
      router.push({
        pathname: '/player',
        params: {
          id: item.id,
          streamUrl: item.streamUrl || '',
          title: itemTitle,
          isLive: 'true',
          logo: item.logo || '',
          category: item.category || ''
        }
      });
    } else if (item.type === 'vod') {
      router.push({ 
        pathname: '/movie-detail', 
        params: { 
          id: item.id, 
          title: itemTitle, 
          poster: item.logo || '', 
          categoryId: catIdentifier 
        } 
      });
    } else if (item.type === 'series') {
      router.push({ 
        pathname: '/series-detail', 
        params: { 
          id: item.id, 
          title: itemTitle, 
          poster: item.logo || '', 
          categoryId: catIdentifier 
        } 
      });
    }
  };

  const getTabLabel = (tab: SearchTab) => {
    switch (tab) {
      case 'all': return language === 'ar' ? 'الكل' : 'All';
      case 'live': return language === 'ar' ? 'بث مباشر' : 'Live TV';
      case 'vod': return language === 'ar' ? 'أفلام' : 'Movies';
      case 'series': return language === 'ar' ? 'مسلسلات' : 'Series';
    }
  };

  const renderResultCard = ({ item, index }: { item: Channel; index: number }) => {
    const typeLabel = 
      item.type === 'live' ? (language === 'ar' ? 'بث مباشر' : 'Live TV') : 
      item.type === 'vod' ? (language === 'ar' ? 'فيلم' : 'Movie') : 
      (language === 'ar' ? 'مسلسل' : 'TV Series');
      
    const typeColor = 
      item.type === 'live' ? colors.destructive : 
      item.type === 'vod' ? colors.accent : colors.gold;

    return (
      <TVFocusable 
        style={({ focused }: any) => [
          styles.card, 
          { backgroundColor: focused ? 'rgba(255,255,255,0.08)' : colors.surface, borderColor: focused ? '#FFF' : colors.border },
          focused && { borderWidth: 3, transform: [{ scale: 1.015 }] }
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
              <Text style={[styles.cardCategory, { color: colors.mutedForeground, textAlign: isRTL ? 'left' : 'right', flex: 1 }]} numberOfLines={1}>
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

  // Determine whether to show the Split Layout (Search Box + Keyboard + QR on Left, Results on Right)
  const hasStartedSearch = query.trim().length >= 2;
  const hasResults = filteredResults.length > 0;
  const showResultsLayout = isLargeScreen && (hasStartedSearch || hasResults);

  // Render Header (Back, Search Box, Voice, Sync)
  const renderHeader = (isSplit: boolean) => (
    <View style={[styles.header, isSplit ? styles.headerSplit : styles.headerCentered]}>
      <TVFocusable 
        style={({ focused }: any) => [
          styles.backBtn,
          { backgroundColor: colors.surface, borderColor: focused ? colors.gold : colors.border },
          focused && { transform: [{ scale: 1.08 }], borderWidth: 2 }
        ]} 
        onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace('/(tabs)'); } }}
        focusable={true}
      >
        {({ focused }: any) => (
          <Ionicons name="chevron-back" size={20} color={focused ? colors.gold : colors.text} />
        )}
      </TVFocusable>

      <TVFocusable 
        onPress={() => {
          if (!isLargeScreen || isWindowsWeb) {
            inputRef.current?.focus();
          }
        }}
        style={({ focused }: any) => [
          styles.searchBox, 
          { backgroundColor: colors.surface, borderColor: focused ? colors.gold : colors.border },
          focused && { borderWidth: 2 }
        ]}
      >
        <Ionicons name="search" size={18} color={colors.mutedForeground} style={{ marginRight: 8 }} />
        <TextInput
          ref={inputRef}
          value={query}
          onChangeText={setQuery}
          placeholder="search"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.searchInput, { color: colors.text, textAlign: isRTL ? 'right' : 'left' }]}
          returnKeyType="search"
          focusable={true}
          editable={true}
          showSoftInputOnFocus={!isLargeScreen || isWindowsWeb}
        />
        {query.length > 0 && (
          <TVFocusable 
            disableBorder 
            onPress={() => {
              setQuery('');
              setFilteredResults([]);
            }}
            style={styles.clearBtn}
          >
            <Ionicons name="close-circle" size={18} color={colors.mutedForeground} />
          </TVFocusable>
        )}
      </TVFocusable>

      {isSupported && (
        <TVFocusable 
          style={({ focused }: any) => [
            styles.iconBtn,
            { backgroundColor: isListening ? colors.destructive : colors.surface, borderColor: focused ? colors.gold : colors.border },
            focused && { transform: [{ scale: 1.08 }], borderWidth: 2 }
          ]} 
          onPress={toggleListening}
          focusable={true}
        >
          {({ focused }: any) => (
            <Ionicons name="mic-outline" size={19} color={isListening ? "#FFF" : (focused ? colors.gold : colors.text)} />
          )}
        </TVFocusable>
      )}

      {!loadingSearchIndex && (
        <TVFocusable 
          style={({ focused }: any) => [
            styles.iconBtn,
            { backgroundColor: colors.surface, borderColor: focused ? colors.gold : colors.border },
            focused && { transform: [{ scale: 1.08 }], borderWidth: 2 }
          ]} 
          onPress={handleBuildIndex}
          focusable={true}
        >
          {({ focused }: any) => (
            <Ionicons name="refresh-outline" size={19} color={focused ? colors.gold : colors.text} />
          )}
        </TVFocusable>
      )}
    </View>
  );

  // Windows / Web Desktop Layout (TVSidebar on left, full search bar at top, category tabs, full-width results)
  // Completely eliminates on-screen TVKeyboard and QRCode since desktop user has a physical keyboard & mouse!
  if (isWindowsWeb) {
    return (
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.background }}>
        <TVSidebar />

        <View style={[styles.container, { paddingTop: insets.top + 16, paddingLeft: 120, paddingRight: 32, paddingBottom: insets.bottom }]}>
          {/* Top Search Bar */}
          <View style={{ width: '100%', maxWidth: 900, marginBottom: 16 }}>
            {renderHeader(false)}
          </View>

          {/* Category Tabs */}
          {searchIndexReady && !loadingSearchIndex && (
            <View style={[styles.tabsBar, { borderBottomColor: colors.border, paddingHorizontal: 0, marginBottom: 16, width: '100%', maxWidth: 900 }]}>
              {(['all', 'live', 'vod', 'series'] as SearchTab[]).map((tab) => {
                const isSelected = activeTab === tab;
                const label = getTabLabel(tab);
                return (
                  <TVFocusable
                    key={tab}
                    style={({ focused }: any) => [
                      styles.tabItem,
                      isSelected && { borderBottomColor: colors.gold, borderBottomWidth: 3 },
                      focused && { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 8 }
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
                        {isSelected && filteredResults.length > 0 && ` (${filteredResults.length})`}
                      </Text>
                    )}
                  </TVFocusable>
                );
              })}
            </View>
          )}

          {/* Search Results Area */}
          <View style={{ flex: 1, width: '100%', maxWidth: 1200 }}>
            {isSearching || loadingSearchIndex ? (
              <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={colors.gold} />
                <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
                  {searchIndexProgress || (language === 'ar' ? 'جاري البحث في قاعدة البيانات...' : 'Searching database...')}
                </Text>
              </View>
            ) : query.trim().length < 2 ? (
              <View style={styles.centerContainer}>
                <Ionicons name="search" size={54} color={colors.mutedForeground} style={{ marginBottom: 16, opacity: 0.6 }} />
                <Text style={[styles.emptyTitle, { color: colors.text, fontSize: 18 }]}>
                  {language === 'ar' ? 'البحث الشامل' : 'Search Everything'}
                </Text>
                <Text style={[styles.emptySubtitle, { color: colors.mutedForeground, fontSize: 14 }]}>
                  {language === 'ar' ? 'اكتب في شريط البحث أعلاه للبحث في جميع القنوات والأفلام والمسلسلات' : 'Type in the search bar above to search across channels, movies, and series'}
                </Text>
              </View>
            ) : filteredResults.length > 0 ? (
              <FlatList
                data={filteredResults}
                keyExtractor={(item) => item.id}
                renderItem={renderResultCard}
                contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 32 }]}
              />
            ) : (
              <View style={styles.centerContainer}>
                <Ionicons name="sad-outline" size={54} color={colors.mutedForeground} style={{ marginBottom: 16 }} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>
                  {language === 'ar' ? 'لم يتم العثور على نتائج' : 'No Results Found'}
                </Text>
                <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
                  {language === 'ar' ? 'جرب البحث عن فيلم أو مسلسل أو قناة أخرى.' : 'Try searching for a different movie, series, or live channel.'}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  }

  // Mobile layout
  if (!isLargeScreen) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
        {renderHeader(false)}

        {searchIndexReady && !loadingSearchIndex && (
          <View style={[styles.tabsBar, { borderBottomColor: colors.border, paddingHorizontal: 16 }]}>
            {(['all', 'live', 'vod', 'series'] as SearchTab[]).map((tab) => {
              const isSelected = activeTab === tab;
              const label = getTabLabel(tab);
              return (
                <TVFocusable
                  key={tab}
                  style={[
                    styles.tabItem,
                    isSelected && { borderBottomColor: colors.gold, borderBottomWidth: 2 }
                  ]}
                  onPress={() => setActiveTab(tab)}
                >
                  <Text style={[styles.tabLabel, { color: isSelected ? colors.gold : colors.text }]}>
                    {label}
                  </Text>
                </TVFocusable>
              );
            })}
          </View>
        )}

        <View style={{ flex: 1, paddingHorizontal: 16 }}>
          {isSearching || loadingSearchIndex ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={colors.gold} />
              <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
                {searchIndexProgress || (language === 'ar' ? 'جاري البحث...' : 'Searching...')}
              </Text>
            </View>
          ) : query.trim().length < 2 ? (
            <View style={styles.centerContainer}>
              <Ionicons name="search" size={54} color={colors.mutedForeground} style={{ marginBottom: 16 }} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {language === 'ar' ? 'البحث الشامل' : 'Search Everything'}
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
                {language === 'ar' ? 'اكتب حرفين على الأقل للبحث في القنوات والأفلام والمسلسلات' : 'Type at least 2 characters to search across all items'}
              </Text>
            </View>
          ) : filteredResults.length > 0 ? (
            <FlatList
              data={filteredResults}
              keyExtractor={(item) => item.id}
              renderItem={renderResultCard}
              contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 20 }]}
            />
          ) : (
            <View style={styles.centerContainer}>
              <Ionicons name="sad-outline" size={54} color={colors.mutedForeground} style={{ marginBottom: 16 }} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {language === 'ar' ? 'لم يتم العثور على نتائج' : 'No Results Found'}
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
                {language === 'ar' ? 'جرب البحث عن فيلم أو مسلسل أو قناة أخرى.' : 'Try searching for a different movie, series, or live channel.'}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  }

  // Large Screen / TV layout
  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.background }}>
      <TVSidebar />

      <View style={[styles.container, { paddingTop: insets.top, paddingLeft: 110 }]}>
        <View style={[styles.mainWrapper, showResultsLayout ? styles.mainWrapperSplit : styles.mainWrapperCentered]}>
          
          {/* LEFT COLUMN in Split Mode / CENTER PANEL in Initial Mode */}
          <View style={[styles.inputPanel, showResultsLayout ? styles.inputPanelSplit : styles.inputPanelCentered]}>
            {/* Search Header */}
            {renderHeader(showResultsLayout)}

            {/* TV Keyboard & QR Code */}
            <View style={[styles.keyboardAndQrRow, showResultsLayout ? styles.keyboardAndQrRowSplit : styles.keyboardAndQrRowCentered]}>
              <View style={[styles.keyboardWrap, showResultsLayout ? styles.keyboardWrapSplit : styles.keyboardWrapCentered]}>
                <TVKeyboard 
                  value={query} 
                  onChangeText={setQuery} 
                  onSubmit={() => {}} 
                  suggestions={suggestions}
                  onSuggestionPress={(sug) => { setQuery(sug); }}
                  autoFocus={true}
                  style={showResultsLayout ? { padding: 14 } : undefined}
                />
              </View>

              {/* QR Code Container */}
              <View style={[styles.qrContainer, showResultsLayout ? styles.qrContainerSplit : styles.qrContainerCentered]}>
                {showResultsLayout ? (
                  // Compact horizontal card in Left Column
                  <View style={styles.qrCardCompact}>
                    <View style={{ flex: 1, paddingRight: 10, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <Ionicons name="phone-portrait-outline" size={15} color={colors.gold} />
                        <Text style={{ color: colors.text, fontSize: 13, fontWeight: 'bold' }}>
                          {language === 'ar' ? 'البحث من الجوال' : 'Remote Search'}
                        </Text>
                      </View>
                      <Text style={{ color: colors.mutedForeground, fontSize: 11, marginBottom: 4 }} numberOfLines={1}>
                        {language === 'ar' ? 'امسح الكود بهاتفك للكتابة' : 'Scan to type from phone'}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>
                          {language === 'ar' ? 'الرمز:' : 'Code:'}
                        </Text>
                        <Text style={{ color: colors.gold, fontSize: 17, fontWeight: 'bold', letterSpacing: 2 }}>
                          {remoteSessionId}
                        </Text>
                      </View>
                    </View>
                    <View style={{ backgroundColor: '#fff', padding: 6, borderRadius: 10 }}>
                      <QRCode 
                        value={`https://entec-keyboard.web.app/?session=${remoteSessionId}`} 
                        size={68} 
                      />
                    </View>
                  </View>
                ) : (
                  // Spacious vertical card in Centered Layout
                  <View style={styles.qrCardCentered}>
                    <Ionicons name="phone-portrait-outline" size={22} color={colors.gold} style={{ marginBottom: 6 }} />
                    <Text style={{ color: colors.text, fontSize: 15, fontWeight: 'bold', marginBottom: 2 }}>
                      {language === 'ar' ? 'البحث من الجوال' : 'Remote Search'}
                    </Text>
                    <Text style={{ color: colors.mutedForeground, fontSize: 11, marginBottom: 12, textAlign: 'center' }}>
                      {language === 'ar' ? 'امسح الكود بالكاميرا للكتابة بهاتفك' : 'Scan code to type from phone'}
                    </Text>
                    <View style={{ backgroundColor: '#fff', padding: 8, borderRadius: 12, marginBottom: 10 }}>
                      <QRCode 
                        value={`https://entec-keyboard.web.app/?session=${remoteSessionId}`} 
                        size={110} 
                      />
                    </View>
                    <Text style={{ color: colors.gold, fontSize: 20, fontWeight: 'bold', letterSpacing: 3 }}>
                      {remoteSessionId}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* RIGHT COLUMN: Results & Tabs (Appears when search results start appearing) */}
          {showResultsLayout ? (
            <View style={styles.rightColumn}>
              {/* Category Tabs */}
              {searchIndexReady && !loadingSearchIndex && (
                <View style={[styles.tabsBar, { borderBottomColor: colors.border }]}>
                  {(['all', 'live', 'vod', 'series'] as SearchTab[]).map((tab) => {
                    const isSelected = activeTab === tab;
                    const label = getTabLabel(tab);
                    return (
                      <TVFocusable
                        key={tab}
                        style={({ focused }: any) => [
                          styles.tabItem,
                          isSelected && { borderBottomColor: colors.gold, borderBottomWidth: 3 },
                          focused && { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 8, borderWidth: 2, borderColor: '#FFF' }
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
                            {isSelected && filteredResults.length > 0 && ` (${filteredResults.length})`}
                          </Text>
                        )}
                      </TVFocusable>
                    );
                  })}
                </View>
              )}

              {/* Results Content Area */}
              <View style={{ flex: 1 }}>
                {isSearching || loadingSearchIndex ? (
                  <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={colors.gold} />
                    <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
                      {searchIndexProgress || (language === 'ar' ? 'جاري البحث في قاعدة البيانات...' : 'Searching database...')}
                    </Text>
                  </View>
                ) : !searchIndexReady ? (
                  <View style={styles.centerContainer}>
                    <Ionicons name="server-outline" size={54} color={colors.mutedForeground} style={{ marginBottom: 16 }} />
                    <Text style={[styles.emptyTitle, { color: colors.text }]}>
                      {language === 'ar' ? 'لا توجد بيانات بحث' : 'No Search Data'}
                    </Text>
                    <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
                      {language === 'ar' ? 'لم يتم العثور على بيانات. يرجى الضغط على زر التحديث.' : 'No searchable items found. You can try refreshing the database.'}
                    </Text>
                  </View>
                ) : filteredResults.length > 0 ? (
                  <FlatList
                    data={filteredResults}
                    keyExtractor={(item) => item.id}
                    renderItem={renderResultCard}
                    contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
                  />
                ) : (
                  <View style={styles.centerContainer}>
                    <Ionicons name="sad-outline" size={54} color={colors.mutedForeground} style={{ marginBottom: 16 }} />
                    <Text style={[styles.emptyTitle, { color: colors.text }]}>
                      {language === 'ar' ? 'لم يتم العثور على نتائج' : 'No Results Found'}
                    </Text>
                    <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
                      {language === 'ar' ? 'جرب البحث عن فيلم أو مسلسل أو قناة أخرى.' : 'Try searching for a different movie, series, or live channel.'}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          ) : (
            /* Initial State Prompt (Below centered keyboard) */
            <View style={styles.initialPrompt}>
              <Ionicons name="search" size={44} color={colors.mutedForeground} style={{ marginBottom: 10, opacity: 0.6 }} />
              <Text style={[styles.emptyTitle, { color: colors.text, fontSize: 17 }]}>
                {language === 'ar' ? 'البحث الشامل' : 'Search Everything'}
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.mutedForeground, fontSize: 13 }]}>
                {language === 'ar' ? 'اكتب حرفين على الأقل للبحث في القنوات والأفلام والمسلسلات' : 'Type at least 2 characters to search across all items'}
              </Text>
            </View>
          )}

        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mainWrapper: {
    flex: 1,
  },
  mainWrapperCentered: {
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop: 16,
    paddingHorizontal: 20,
  },
  mainWrapperSplit: {
    flexDirection: 'row',
    direction: 'ltr',
    alignItems: 'flex-start',
    paddingTop: 10,
    paddingHorizontal: 20,
    gap: 20,
  },
  inputPanel: {
  },
  inputPanelCentered: {
    width: '100%',
    maxWidth: 780,
    alignItems: 'center',
  },
  inputPanelSplit: {
    width: 480,
    maxWidth: '42%',
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    gap: 10,
  },
  headerCentered: {
    width: '100%',
    marginBottom: 20,
  },
  headerSplit: {
    width: '100%',
    marginBottom: 10,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBox: {
    flex: 1,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    height: '100%',
    padding: 0,
  },
  clearBtn: {
    padding: 4,
  },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyboardAndQrRow: {
  },
  keyboardAndQrRowCentered: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 24,
    width: '100%',
  },
  keyboardAndQrRowSplit: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 10,
    width: '100%',
  },
  keyboardWrap: {
  },
  keyboardWrapCentered: {
    width: 490,
  },
  keyboardWrapSplit: {
    width: '100%',
  },
  qrContainer: {
  },
  qrContainerCentered: {
  },
  qrContainerSplit: {
    width: '100%',
  },
  qrCardCentered: {
    width: 230,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
    padding: 20,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  qrCardCompact: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.025)',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  rightColumn: {
    flex: 1,
    height: '100%',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.06)',
    paddingLeft: 20,
    flexDirection: 'column',
  },
  tabsBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    gap: 8,
    marginBottom: 12,
  },
  tabItem: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  initialPrompt: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    paddingHorizontal: 20,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 16,
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
    maxWidth: 420,
  },
  listContent: {
    paddingRight: 8,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    marginBottom: 10,
  },
  cardImageWrapper: {
    width: 48,
    height: 48,
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
    fontSize: 14,
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
  cardCategory: {
    fontSize: 12,
  },
  playIconWrapper: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
});
