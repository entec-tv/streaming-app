import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { TVFocusable } from '@/components/TVFocusable';
import { MovieCard } from '@/components/MovieCard';
import { useAppStore } from '@/store/app-store';
import { Channel } from '@/types';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from '@/hooks/useTranslation';

const TMDB_API_KEY = '2eae50aadf0d62874cdc2a281e7130cd';

export default function CastDetailScreen() {
  const params = useLocalSearchParams();
  const actorName = params.actorName as string || 'Unknown Actor';
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<Channel[]>([]);

  useEffect(() => {
    let active = true;

    async function fetchAndMatch() {
      setLoading(true);
      try {
        // 1. Fetch TMDB Person ID
        const searchUrl = `https://api.themoviedb.org/3/search/person?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(actorName)}`;
        const searchRes = await fetch(searchUrl);
        const searchData = await searchRes.json();

        let validPersons = searchData.results;
        if (!validPersons || validPersons.length === 0) {
          if (active) {
            setResults([]);
            setLoading(false);
          }
          return;
        }

        validPersons.sort((a: any, b: any) => (b.popularity || 0) - (a.popularity || 0));
        const personId = validPersons[0].id;

        // 2. Fetch Person Combined Credits (with Arabic language to get Arabic titles)
        const creditsUrl = `https://api.themoviedb.org/3/person/${personId}/combined_credits?api_key=${TMDB_API_KEY}&language=ar-SA`;
        const creditsRes = await fetch(creditsUrl);
        const creditsData = await creditsRes.json();

        const tmdbTitles = new Set<string>();
        if (creditsData.cast) {
          creditsData.cast.forEach((c: any) => {
            if (c.title) tmdbTitles.add(c.title.toLowerCase().trim());
            if (c.original_title) tmdbTitles.add(c.original_title.toLowerCase().trim());
            if (c.name) tmdbTitles.add(c.name.toLowerCase().trim());
            if (c.original_name) tmdbTitles.add(c.original_name.toLowerCase().trim());
          });
        }

        // 3. Search in globalSearchIndex for any of these titles
        const store = useAppStore.getState();
        const localVod = await store.getChannelsByType('vod');
        const localSeries = await store.getChannelsByType('series');
        const allLocal = [...localVod, ...localSeries];

        const cleanTitle = (str: string, isLocal: boolean = false) => {
          let s = str.toLowerCase();
          if (isLocal) {
            // Remove brackets/parentheses
            s = s.replace(/\[.*?\]|\(.*?\)/g, ' ');
            // Remove country/language prefixes like AR-IRQ - or EN:
            s = s.replace(/^([a-z]{2,4}(?:-[a-z]{2,4})?)\s*[-|:]\s*/i, ' ');
            // Remove common quality/format/season tags
            s = s.replace(/\b(4k|8k|1080p|720p|480p|fhd|hd|sd|uhd|vod|movie|series|tv|ar|en|fr|sub|dub|multi|dual|audio|x264|x265|hevc|bluray|webdl|webrip|cam|ts|tc|dvdrip|brrip|hdtv|irq|egy|syr|ksa|uae)\b/gi, ' ');
            // Remove season/episode markers like S01, S1, Season 1, Ep 1, E01
            s = s.replace(/\b(s\d+|season\s*\d+|ep\d+|episode\s*\d+|e\d+|complete)\b/gi, ' ');
          }
          // Remove special chars, replace with spaces, normalize arabic alef
          s = s.replace(/[أإآ]/g, 'ا');
          return s.replace(/[^a-z0-9\u0600-\u06FF]/g, ' ').replace(/\s+/g, ' ').trim();
        };

        const titlesArray = Array.from(tmdbTitles).filter(t => t.length > 2).map(t => cleanTitle(t, false));
        
        const matched = allLocal.filter(ch => {
          if (!ch.name) return false;
          const cleanLocal = cleanTitle(ch.name, true);
          return titlesArray.includes(cleanLocal);
        });
        
        // Remove duplicates if any
        const matchedChannels = new Map<string, Channel>();
        matched.forEach((ch: Channel) => matchedChannels.set(ch.id, ch));

        if (active) {
          setResults(Array.from(matchedChannels.values()));
          setLoading(false);
        }

      } catch (err) {
        console.warn('Failed to fetch cast details', err);
        if (active) {
          setResults([]);
          setLoading(false);
        }
      }
    }

    fetchAndMatch();

    return () => {
      active = false;
    };
  }, [actorName]);

  const numColumns = Math.max(2, Math.floor(width / 160));

  const renderItem = ({ item, index }: { item: Channel; index: number }) => {
    // Transform Channel into Movie format for MovieCard
    const movieObj = {
      id: item.id,
      title: item.name,
      poster: item.poster || item.logo,
      backdrop: item.backdrop || '',
      rating: 0,
      year: 0,
      duration: '',
      quality: item.quality || 'HD',
      genres: [item.category],
      description: '',
      streamUrl: item.streamUrl
    };

    return (
      <View style={{ margin: 8, width: 140 }}>
        <MovieCard
          movie={movieObj as any}
          onPress={() => {
             const targetRoute = item.type === 'series' ? '/series-detail' : '/movie-detail';
             router.push({
               pathname: targetRoute as any,
               params: {
                 id: item.id,
                 title: item.name,
                 poster: item.poster || item.logo,
                 backdrop: item.backdrop || '',
                 streamUrl: item.streamUrl,
                 categoryId: item.categoryId
               }
             });
          }}
          width={140}
          autoFocus={index === 0}
        />
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
          {item.name}
        </Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={[colors.surface, 'transparent']}
        style={[styles.header, { paddingTop: insets.top + 20 }]}
      >
        <TVFocusable
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TVFocusable>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          {actorName}
        </Text>
      </LinearGradient>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.gold} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>{t('searching_titles')}</Text>
        </View>
      ) : results.length > 0 ? (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          numColumns={numColumns}
          key={numColumns}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 20 }]}
          columnWrapperStyle={styles.columnWrapper}
        />
      ) : (
        <View style={styles.center}>
          <Ionicons name="film-outline" size={64} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.text }]}>{t('no_titles_found')}</Text>
        </View>
      )}
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
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    marginRight: 15,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: 'Inter_700Bold',
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
  },
  emptyText: {
    marginTop: 15,
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
  },
  listContent: {
    padding: 12,
  },
  columnWrapper: {
    justifyContent: 'flex-start',
  },
  title: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    marginTop: 8,
    textAlign: 'center',
  }
});
