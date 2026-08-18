import { TVFocusable } from '@/components/TVFocusable';
import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  Dimensions, 
  ActivityIndicator,
  Linking,
  Alert,
  useWindowDimensions,
  Platform,
  Modal
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { PinModal } from '@/components/PinModal';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Lineicons } from '@lineiconshq/react-native-lineicons';
import { PlayBulk, CheckCircle1Bulk, Download1Bulk, ArrowLeftBulk, HeartBulk, CameraMovie1Bulk, QuestionMarkCircleBulk, PlusBulk } from '@lineiconshq/free-icons';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { GoldButton } from '@/components/GoldButton';
import { QualityBadge } from '@/components/QualityBadge';
import * as FileSystem from 'expo-file-system/legacy';
import { useAppStore } from '@/store/app-store';
import { base64Decode, base64Encode } from '@/lib/base64';
import { useTranslation } from '@/hooks/useTranslation';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Episode {
  id: string;
  season: number;
  number: number;
  title: string;
  duration: string;
  thumbnail: string;
  streamUrl: string;
}

interface Actor {
  id: string;
  name: string;
  image: string;
}

function getInitials(name: string) {
  if (!name) return '';
  const parts = name.split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function EpisodeItem({ ep, seriesTitle, seriesPoster, seriesBackdrop, seriesQuality, seriesStreamUrl, onWatch }: any) {
  const colors = useColors();
  const downloads = useAppStore((s) => s.downloads);
  const startDownload = useAppStore((s) => s.startDownload);
  const removeDownload = useAppStore((s) => s.removeDownload);

  const downloadedItem = downloads.find(d => d.id === ep.id);
  const isDownloaded = downloadedItem?.status === 'completed';
  const isDownloading = downloadedItem?.status === 'downloading' || downloadedItem?.status === 'paused';
  const progress = downloadedItem?.progress || 0;

  const handleDownload = async () => {
    if (isDownloaded && downloadedItem) {
      try {
        await FileSystem.deleteAsync(downloadedItem.localUri, { idempotent: true });
        removeDownload(ep.id);
      } catch (e) {
        console.error("Failed to delete", e);
      }
      return;
    }
    if (isDownloading) return;
    
    startDownload({
      id: ep.id,
      title: `${seriesTitle} - S${ep.season}:E${ep.number}`,
      poster: seriesPoster,
      backdrop: seriesBackdrop,
      quality: seriesQuality,
      streamUrl: ep.streamUrl,
      type: 'series'
    });
  };

  return (
    <TVFocusable 
      style={[styles.episodeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={() => onWatch(ep, isDownloaded && downloadedItem ? downloadedItem.localUri : ep.streamUrl)}
    >
      <View style={styles.epThumbnailContainer}>
          <Image source={{ uri: ep.thumbnail }} style={styles.epThumbnail} contentFit="contain" />
        <View style={styles.epPlayOverlay}>
          <Lineicons icon={PlayBulk} size={24} color="#FFF" />
        </View>
      </View>
      <View style={styles.epInfo}>
        <Text style={[styles.epLabel, { color: colors.gold }]}>S{ep.season} · E{ep.number}</Text>
        <Text style={[styles.epTitle, { color: colors.text }]} numberOfLines={1}>{ep.title}</Text>
        <Text style={[styles.epDuration, { color: colors.mutedForeground }]}>{ep.duration}</Text>
      </View>
      <TVFocusable onPress={handleDownload} style={styles.epDownloadBtn} disabled={isDownloading}>
        {isDownloading ? (
          <Text style={{ color: colors.gold, fontSize: 10, fontWeight: 'bold' }}>
            {Math.round(progress * 100)}%
          </Text>
        ) : isDownloaded ? (
          <Lineicons icon={CheckCircle1Bulk} size={20} color={colors.primary} />
        ) : (
          <Lineicons icon={Download1Bulk} size={20} color={colors.mutedForeground} />
        )}
      </TVFocusable>
    </TVFocusable>
  );
}

export default function SeriesDetailScreen() {
  const params = useLocalSearchParams<{
    id: string;
    title: string;
    poster: string;
    backdrop: string;
    genres: string;
    description: string;
    streamUrl: string;
  }>();

  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL } = useTranslation();

  const activePlaylistId = useAppStore((s) => s.activePlaylistId);
  const playlists = useAppStore((s) => s.playlists);
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);
  const setPlaybackQueue = useAppStore((s) => s.setPlaybackQueue);
  const isChannelLocked = useAppStore((s) => s.isChannelLocked);
  const toggleChannelLock = useAppStore((s) => s.toggleChannelLock);
  const unlockChannel = useAppStore((s) => s.unlockChannel);
  const lockedChannels = useAppStore((s) => s.lockedChannels);
  const parentalPin = useAppStore((s) => s.parentalPin);
  const favorites = useAppStore((s) => s.favorites);

  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const [loading, setLoading] = useState(true);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [seasonsCount, setSeasonsCount] = useState(1);
  const [seriesInfo, setSeriesInfo] = useState<any>(null);
  const [actors, setActors] = useState<any[]>([]);
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [moreRecommendations, setMoreRecommendations] = useState<any[]>([]);
  const [actorsImages, setActorsImages] = useState<Record<string, string>>({});

  const scrollViewRef = React.useRef<ScrollView>(null);

  useEffect(() => {
    scrollViewRef.current?.scrollTo({ y: 0, animated: false });
  }, [params.id]);

  useEffect(() => {
    if (!seriesInfo) return;
    
    const castNames: string[] = [];
    if (seriesInfo.actors_images && Array.isArray(seriesInfo.actors_images)) {
      seriesInfo.actors_images.forEach((actor: any) => {
        const img = actor.image || actor.profile_path || '';
        const name = actor.name || actor.cast_name;
        if (!img && name) {
          castNames.push(name);
        }
      });
    } else if (seriesInfo.cast && typeof seriesInfo.cast === 'string') {
      const rawParts = seriesInfo.cast.split(/[,;|]|\r?\n|\s{2,}|\s*-\s*|\s*\/\s*/);
      let cleaned = rawParts.map((p: string) => p.trim()).filter((p: string) => p.length > 0);

      if (cleaned.length === 1 && cleaned[0].includes(' ')) {
        const words = cleaned[0].split(/\s+/).filter((w: string) => w.length > 0);
        if (words.length > 3) {
          const grouped: string[] = [];
          for (let i = 0; i < words.length; i += 2) {
            if (i + 1 < words.length) {
              grouped.push(`${words[i]} ${words[i + 1]}`);
            } else {
              grouped.push(words[i]);
            }
          }
          cleaned = grouped;
        }
      }
      castNames.push(...cleaned);
    }

    if (castNames.length === 0) return;

    const TMDB_API_KEY = '2eae50aadf0d62874cdc2a281e7130cd';

    async function fetchImages() {
      const results: Record<string, string> = {};
      const promises = castNames.map(async (name) => {
        try {
          const url = `https://api.themoviedb.org/3/search/person?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(name)}`;
          const response = await fetch(url);
          const data = await response.json();
          if (data.results && data.results.length > 0) {
            const path = data.results[0].profile_path;
            if (path) {
              results[name] = `https://image.tmdb.org/t/p/w185${path}`;
            }
          }
        } catch (e) {
          console.warn(`[TMDB] Failed to fetch image for: ${name}`, e);
        }
      });

      await Promise.all(promises);
      
      if (Object.keys(results).length > 0) {
        setActorsImages(prev => ({ ...prev, ...results }));
      }
    }

    fetchImages();
  }, [seriesInfo]);

  const [hasAutoPlayed, setHasAutoPlayed] = useState(false);
  useEffect(() => {
    if ((params as any).autoPlay === 'true' && episodes.length > 0 && !hasAutoPlayed) {
      setHasAutoPlayed(true);
      const ep = episodes[0];
      router.replace({
        pathname: '/player',
        params: {
          streamUrl: ep.streamUrl,
          title: `${params.title || 'Series'} - S${ep.season}:E${ep.number}`,
          quality: 'FHD',
          isLive: 'false',
          id: ep.id,
          type: 'series',
          poster: base64Encode(ep.thumbnail),
          backdrop: base64Encode(ep.thumbnail),
        }
      });
    }
  }, [episodes, params, hasAutoPlayed]);

  const seriesTitle = params.title || 'Series Detail';
  const seriesPoster = params.poster || '';
  const seriesBackdrop = params.backdrop || params.poster || '';
  const seriesDescription = params.description || 'No description available for this series.';
  const seriesStreamUrl = params.streamUrl || '';
  const seriesGenres = params.genres ? params.genres.split(',') : ['TV Series'];
  const seriesQuality = 'FHD' as const;

  const isFavorite = favorites.includes(params.id || '');

  const activePlaylist = playlists.find((x) => x.id === activePlaylistId);
  const activePlaylistUrl = activePlaylist?.url;
  const activeCategories = useAppStore((s) => s.activeCategories);
  const getChannelsForCategory = useAppStore((s) => s.getChannelsForCategory);
  
  const primaryCategory = seriesGenres[0] || 'Series';

  useEffect(() => {
    let active = true;
    async function loadRecommendations() {
      if (!activePlaylistId || !activeCategories) {
        if (active) setRecommendations(getFallbackRecommendations());
        return;
      }

      try {
        const cat = activeCategories.series.find((c: any) => c.name === primaryCategory);
        if (cat) {
          const list = await getChannelsForCategory(activePlaylistId, 'series', cat.id, cat.name);
          if (active) {
            const filtered = list.filter(m => m.id !== params.id);
            setRecommendations(filtered.slice(0, 8));
            setMoreRecommendations(filtered.slice(8, 16));
          }
        } else {
          if (active) {
            setRecommendations(getFallbackRecommendations());
            setMoreRecommendations([]);
          }
        }
      } catch (err) {
        if (active) {
          setRecommendations(getFallbackRecommendations());
          setMoreRecommendations([]);
        }
      }
    }
    loadRecommendations();
    return () => { active = false; };
  }, [activePlaylistId, activeCategories, primaryCategory, params.id]);

  const getFallbackRecommendations = (): any[] => [];

  useEffect(() => {
    let active = true;

    async function loadSeriesInfo() {
      const p = activePlaylist;
      const isXtream = p && (p.url.startsWith('xtream://') || p.url.includes('/get.php?'));

      if (isXtream && params.id) {
        let config: any = null;
        if (p.url.startsWith('xtream://')) {
          config = JSON.parse(base64Decode(p.url.replace('xtream://', '')));
        } else {
          const match = p.url.match(/^(https?:\/\/[^/]+)\/get\.php\?username=([^&]+)&password=([^&]+)/);
          if (match) {
            config = { host: match[1], username: match[2], password: match[3] };
          }
        }

        if (!config) {
          setLoading(false);
          return;
        }

        const seriesId = params.id.replace('xt_series_', '');
        const fetchUrl = `${config.host}/player_api.php?username=${config.username}&password=${config.password}&action=get_series_info&series_id=${seriesId}`;
        
        console.log(`[SeriesDetail] Fetching info from: ${fetchUrl}`);

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
                  else reject(new Error('Empty response'));
                } else {
                  reject(new Error(`HTTP status error: ${xhr.status}`));
                }
              };
              xhr.onerror = () => reject(new Error('Network error'));
              xhr.ontimeout = () => reject(new Error('Timeout'));
              xhr.send();
            });
            fetched = true;
            break;
          } catch (e: any) {
            console.warn(`[SeriesDetail] Failed fetching from ${u}: ${e.message || e}`);
          }
        }

        if (fetched && active) {
          try {
            const data = JSON.parse(text);
            const episodesList: Episode[] = [];
            const seasonsSet = new Set<number>();

            if (data && data.info) {
              setSeriesInfo(data.info);
            }

            let finalBackdrop = seriesBackdrop;
            if (data?.info?.backdrop_path) {
              finalBackdrop = Array.isArray(data.info.backdrop_path) && data.info.backdrop_path.length > 0
                ? data.info.backdrop_path[0]
                : typeof data.info.backdrop_path === 'string'
                  ? data.info.backdrop_path
                  : seriesBackdrop;
            }

            if (data && data.episodes) {
              const eps = data.episodes;
              if (typeof eps === 'object' && !Array.isArray(eps)) {
                for (const seasonNum in eps) {
                  const seasonEps = eps[seasonNum];
                  if (Array.isArray(seasonEps)) {
                    const sNum = parseInt(seasonNum, 10) || 1;
                    seasonsSet.add(sNum);
                    for (const ep of seasonEps) {
                      const ext = ep.container_extension || 'mp4';
                      episodesList.push({
                        id: String(ep.id || ep.episode_id),
                        season: sNum,
                        number: parseInt(ep.episode_num || ep.episode_number, 10) || 1,
                        title: ep.title || `Episode ${ep.episode_num || ep.episode_number || 1}`,
                        duration: ep.info?.duration || ep.duration || '45m',
                        thumbnail: ep.info?.screenshot || finalBackdrop || seriesBackdrop || ep.info?.movie_image || seriesPoster || '',
                        streamUrl: `${config.host}/series/${config.username}/${config.password}/${ep.id || ep.episode_id}.${ep.container_extension || ep.info?.container_extension || 'mp4'}`
                      });
                    }
                  }
                }
              } else if (Array.isArray(eps)) {
                for (const ep of eps) {
                  const sNum = parseInt(ep.season, 10) || 1;
                  seasonsSet.add(sNum);
                  const ext = ep.container_extension || 'mp4';
                  episodesList.push({
                    id: String(ep.id || ep.episode_id),
                    season: sNum,
                    number: parseInt(ep.episode_num || ep.episode_number, 10) || 1,
                    title: ep.title || `Episode ${ep.episode_num || ep.episode_number || 1}`,
                    duration: ep.info?.duration || ep.duration || '45m',
                    thumbnail: ep.info?.screenshot || finalBackdrop || seriesBackdrop || ep.info?.movie_image || seriesPoster || '',
                    streamUrl: `${config.host}/series/${config.username}/${config.password}/${ep.id || ep.episode_id}.${ep.container_extension || ep.info?.container_extension || 'mp4'}`
                  });
                }
              }
            }

            setEpisodes(episodesList.sort((a, b) => a.season - b.season || a.number - b.number));
            setSeasonsCount(seasonsSet.size || 1);
          } catch (err) {
            console.error('Failed to parse series info:', err);
          }
        }
      } else {
        const episodesList: Episode[] = [
          {
            id: params.id || '1',
            season: 1,
            number: 1,
            title: 'Full TV Series Stream',
            duration: 'VOD',
            thumbnail: seriesBackdrop || seriesPoster || '',
            streamUrl: seriesStreamUrl
          }
        ];
        setEpisodes(episodesList);
        setSeasonsCount(1);
      }
      setLoading(false);
    }

    loadSeriesInfo();

    return () => {
      active = false;
    };
  }, [activePlaylistId, activePlaylistUrl, params.id]);

  const handleWatchFirst = () => {
    if (episodes.length > 0) {
      if (isChannelLocked(params.id || '')) {
        setPendingAction(() => () => executeWatchFirst());
        setPinModalVisible(true);
        return;
      }
      executeWatchFirst();
    }
  };

  const executeWatchFirst = () => {
    const ep = episodes[0];
    router.push({
      pathname: '/player',
      params: {
        streamUrl: ep.streamUrl,
        title: `${seriesTitle} - S${ep.season}:E${ep.number}`,
        quality: seriesQuality,
        isLive: 'false',
        id: ep.id,
        type: 'series',
        poster: base64Encode(ep.thumbnail || seriesPoster),
        backdrop: base64Encode(seriesBackdrop),
        description: ep.title,
        category: seriesGenres[0] || 'Series'
      }
    });
  };

  const handleWatchEpisode = (ep: Episode, urlToPlay?: string) => {
    if (isChannelLocked(params.id || '')) {
      setPendingAction(() => () => executeWatchEpisode(ep, urlToPlay));
      setPinModalVisible(true);
      return;
    }
    executeWatchEpisode(ep, urlToPlay);
  };

  const executeWatchEpisode = (ep: Episode, urlToPlay?: string) => {
    router.push({
      pathname: '/player',
      params: {
        streamUrl: urlToPlay || ep.streamUrl,
        title: `${seriesTitle} - S${ep.season}:E${ep.number}`,
        quality: seriesQuality,
        isLive: 'false',
        id: ep.id,
        type: 'series',
        poster: base64Encode(ep.thumbnail || seriesPoster),
        backdrop: base64Encode(seriesBackdrop),
        description: ep.title,
        category: seriesGenres[0] || 'Series'
      }
    });
  };

  const handleToggleFav = () => {
    const channelItem = {
      id: params.id || '',
      name: seriesTitle,
      logo: seriesPoster,
      category: seriesGenres[0] || 'Series',
      streamUrl: seriesStreamUrl,
      current: 'TV Series',
      next: 'Episodes Available',
      quality: seriesQuality,
      isLive: false,
      type: 'series' as const
    };
    toggleFavorite(channelItem);
  };

  const handleWatchTrailer = () => {
    const trailerId = seriesInfo?.youtube_trailer || seriesInfo?.trailer;
    if (trailerId) {
      const url = trailerId.startsWith('http')
        ? trailerId
        : `https://www.youtube.com/watch?v=${trailerId}`;
      Linking.openURL(url).catch(() => {
        Alert.alert('Error', 'Failed to open trailer.');
      });
    }
  };


  useEffect(() => {
    const getActors = (): Actor[] => {
      if (seriesInfo?.actors_images && Array.isArray(seriesInfo.actors_images)) {
        return seriesInfo.actors_images.map((actor: any, idx: number) => {
          const img = actor.image || actor.profile_path || '';
          const realImg = img.startsWith('http') || img ? (img.startsWith('http') ? img : `https://image.tmdb.org/t/p/w185${img}`) : (actorsImages[actor.name || actor.cast_name] || '');
          return {
            id: `actor_${idx}`,
            name: actor.name || actor.cast_name || 'Unknown',
            image: realImg,
          };
        });
      }
      if (seriesInfo?.cast && typeof seriesInfo.cast === 'string') {
        const rawParts = seriesInfo.cast.split(/[,;|]|\r?\n|\s{2,}|\s*-\s*|\s*\/\s*/);
        let cleaned = rawParts.map((p: string) => p.trim()).filter((p: string) => p.length > 0);

        if (cleaned.length === 1 && cleaned[0].includes(' ')) {
          const words = cleaned[0].split(/\s+/).filter((w: string) => w.length > 0);
          if (words.length > 3) {
            const grouped: string[] = [];
            for (let i = 0; i < words.length; i += 2) {
              if (i + 1 < words.length) {
                grouped.push(`${words[i]} ${words[i + 1]}`);
              } else {
                grouped.push(words[i]);
              }
            }
            cleaned = grouped;
          }
        }

        return cleaned.map((name: string, idx: number) => ({
          id: `actor_c_${idx}`,
          name,
          image: actorsImages[name] || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1A1A1A&color=D4A843&bold=true&size=150`,
        }));
      }
      return [];
    };
    setActors(getActors());
  }, [seriesInfo, actorsImages]);

const director = seriesInfo?.director || '';
const releaseDate = seriesInfo?.releaseDate || seriesInfo?.releasedate || '';
const year = releaseDate ? releaseDate.substring(0, 4) : '2026';
const rating = seriesInfo?.rating ? parseFloat(seriesInfo.rating) : 8.5;
const description = seriesInfo?.plot || seriesDescription;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView ref={scrollViewRef} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        
        <View style={[styles.heroSection, { height: Math.max(height * 0.70, 350) }]}>
          <Image source={{ uri: seriesBackdrop || seriesPoster }} style={StyleSheet.absoluteFill} contentFit="cover" />
          <LinearGradient
            colors={['rgba(0,0,0,0.5)', 'rgba(0,0,0,0.2)', 'transparent']}
            style={StyleSheet.absoluteFill}
            locations={[0, 0.5, 1]}
          />
          {/* Dark vignette sides */}
          <LinearGradient
            colors={isRTL ? ['rgba(0,0,0,0.5)', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.95)'] : ['rgba(0,0,0,0.95)', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.5)']}
            locations={[0, 0.5, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          {/* Bottom fade into background */}
          <LinearGradient
            colors={['transparent', colors.background]}
            style={StyleSheet.absoluteFill}
            locations={[0.6, 1]}
          />
          <TVFocusable 
            style={[styles.backBtn, { top: insets.top + 10 }]} 
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(tabs)/series');
              }
            }}
          >
            <Lineicons icon={ArrowLeftBulk} size={28} color="#FFF" style={styles.shadowIcon} />
          </TVFocusable>
          
          {/* Hero body: adapts to landscape/portrait */}
          <View style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            flexDirection: isLandscape ? (isRTL ? 'row-reverse' : 'row') : 'column',
            alignItems: isLandscape ? 'flex-end' : 'flex-start',
            paddingHorizontal: isLandscape ? 40 : 20,
            paddingBottom: 24,
            gap: isLandscape ? 30 : 16,
            zIndex: 20,
          }}>
            {/* Poster image */}
            <Image
              source={{ uri: seriesPoster || seriesBackdrop }}
              style={{
                width: isLandscape ? 180 : 120,
                height: isLandscape ? 270 : 180,
                borderRadius: 12,
                backgroundColor: '#1A1A1A',
                borderWidth: 2,
                borderColor: 'rgba(255,255,255,0.18)',
                flexShrink: 0,
                alignSelf: isLandscape ? 'auto' : 'center',
                marginTop: isLandscape ? 0 : 40,
              }}
              contentFit="cover"
            />

            {/* Info column */}
            <View style={{ flex: 1, gap: 12, paddingBottom: 8, justifyContent: 'flex-end', width: '100%', alignItems: isLandscape ? (isRTL ? 'flex-end' : 'flex-start') : 'center' }}>

              {/* Series Title */}
              <Text
                style={[
                  styles.title,
                  {
                    color: '#FFF',
                    textAlign: isLandscape ? (isRTL ? 'right' : 'left') : 'center',
                    fontSize: width < 768 ? 24 : 36,
                    marginBottom: 0,
                  }
                ]}
                numberOfLines={2}
                adjustsFontSizeToFit
              >
                {seriesTitle}
              </Text>

              {/* Rating + meta row */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: isLandscape ? (isRTL ? 'flex-end' : 'flex-start') : 'center', gap: 10, flexWrap: 'wrap' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Lineicons icon={HeartBulk} size={14} color="#E8A317" />
                  <Text style={[styles.metaRowText, { color: '#E8A317', fontWeight: 'bold', marginBottom: 0 }]}>
                    {rating.toFixed(1)}
                  </Text>
                </View>
                <Text style={[styles.metaRowText, { color: '#CCC', marginBottom: 0 }]}>{year}</Text>
                <Text style={[styles.metaRowText, { color: '#CCC', marginBottom: 0 }]}>{seasonsCount} {seasonsCount === 1 ? 'Season' : 'Seasons'}</Text>
                <Text style={[styles.metaRowText, { color: '#CCC', marginBottom: 0 }]}>{episodes.length} Episodes</Text>
                <Text style={[styles.metaRowText, { color: '#CCC', marginBottom: 0 }]}>{seriesGenres.slice(0, 2).join(' | ')}</Text>
              </View>

              {/* Watch Now button */}
              <LinearGradient
                colors={['#D4A843', '#D4A843']}
                style={[styles.playPillContainer, { alignSelf: isLandscape ? (isRTL ? 'flex-end' : 'flex-start') : 'stretch', marginTop: 8, opacity: episodes.length === 0 ? 0.5 : 1 }]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <TVFocusable
                  style={[styles.playPill, { justifyContent: 'center' }]}
                  onPress={handleWatchFirst}
                  disabled={episodes.length === 0}
                  scaleAmount={1.05}
                  focusedBorderColor="#FFF"
                  borderThickness={3}
                  hasTVPreferredFocus={true}
                >
                  <Lineicons icon={PlayBulk} size={22} color="#1A1A1A" />
                  <Text style={[styles.playPillText, { flexShrink: 1 }]} numberOfLines={1}>Watch Now</Text>
                </TVFocusable>
              </LinearGradient>
            </View>
          </View>
        </View>

        <View style={styles.content}>
          <Text style={[styles.sectionHeading, { color: colors.text }]}>Season {episodes.length > 0 ? episodes[0].season : 1}</Text>
          <Text style={[styles.description, { color: '#DDD' }]}>{description}</Text>
          
          {!loading && actors.length > 0 && (
            <View style={styles.castSection}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Cast</Text>
              <ScrollView horizontal contentContainerStyle={styles.castList}>
                {actors.map(actor => (
                  <TVFocusable 
                    key={actor.id} 
                    style={styles.castCard}
                    onPress={() => router.push({ pathname: '/cast-detail', params: { actorName: actor.name } })}
                  >
                    {actor.image ? (
                      <Image source={{ uri: actor.image }} style={styles.castImage} contentFit="cover" />
                    ) : (
                      <View style={[styles.castAvatarFallback, { borderColor: colors.gold, backgroundColor: colors.surface }]}>
                        <Text style={[styles.castFallbackText, { color: colors.gold }]}>{getInitials(actor.name)}</Text>
                      </View>
                    )}
                    <Text style={[styles.castName, { color: colors.text }]} numberOfLines={2}>{actor.name}</Text>
                  </TVFocusable>
                ))}
              </ScrollView>
            </View>
          )}

          <View style={styles.actionButtonsRow}>
            <TVFocusable style={styles.actionIconBtn} onPress={handleToggleFav}>
              <View style={styles.actionIconCircle}>
                <Lineicons icon={HeartBulk} size={20} color={isFavorite ? colors.gold : "#FFF"} />
              </View>
              <Text style={styles.actionIconText}>{isFavorite ? 'Favorited' : 'Favorite'}</Text>
            </TVFocusable>

            <TVFocusable 
              style={styles.actionIconBtn} 
              onPress={() => {
                if (parentalPin) {
                  setPinModalVisible(true);
                } else {
                  Alert.alert(t('parental'), t('set_pin_first' as any) || 'Please set a Parental PIN in Settings first to lock content.');
                }
              }}
            >
              <View style={styles.actionIconCircle}>
                <Ionicons name="lock-closed" size={20} color={isChannelLocked(params.id || '') ? colors.gold : "#FFF"} />
              </View>
              <Text style={styles.actionIconText}>{isChannelLocked(params.id || '') ? 'Locked' : 'Lock'}</Text>
            </TVFocusable>

            {seriesInfo?.youtube_trailer || seriesInfo?.trailer ? (
              <TVFocusable style={styles.actionIconBtn} onPress={handleWatchTrailer}>
                <View style={styles.actionIconCircle}>
                  <Lineicons icon={CameraMovie1Bulk} size={20} color="#FFF" />
                </View>
                <Text style={styles.actionIconText}>Trailer</Text>
              </TVFocusable>
            ) : null}
          </View>

          {loading ? (
            <View style={{ paddingVertical: 40, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator size="large" color={colors.gold} />
              <Text style={{ color: colors.mutedForeground, marginTop: 12 }}>Syncing episodes...</Text>
            </View>
          ) : (
            <>

              <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 16 }]}>Episodes ({episodes.length})</Text>
              
              <View style={styles.episodesList}>
                {episodes.map(ep => (
                  <EpisodeItem 
                    key={ep.id}
                    ep={ep}
                    seriesTitle={seriesTitle}
                    seriesPoster={seriesPoster}
                    seriesBackdrop={seriesBackdrop}
                    seriesQuality={seriesQuality}
                    seriesStreamUrl={seriesStreamUrl}
                    onWatch={handleWatchEpisode}
                  />
                ))}
                
                {episodes.length === 0 && (
                  <Text style={{ color: colors.mutedForeground, textAlign: 'center', marginVertical: 20 }}>
                    No episodes available for this series.
                  </Text>
                )}
              </View>
            </>
          )}

          {recommendations.length > 0 && (
            <View style={[styles.similarSection, { marginTop: 32 }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Similar Content</Text>
              <ScrollView horizontal contentContainerStyle={styles.similarList}>
                {recommendations.map(item => (
                  <TVFocusable
                    key={item.id}
                    style={styles.similarCard}
                    onPress={() => {
                      router.push({
                        pathname: '/series-detail',
                        params: {
                          id: item.id,
                          title: item.name,
                          poster: item.logo,
                          streamUrl: item.streamUrl,
                          quality: item.quality,
                          category: item.category
                        }
                      });
                    }}
                  >
                    <Image source={{ uri: item.logo }} style={styles.similarImage} contentFit="cover" />
                  </TVFocusable>
                ))}
              </ScrollView>
            </View>
          )}

          {moreRecommendations.length > 0 && (
            <View style={styles.similarSection}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>More from {primaryCategory}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.similarList}>
                {moreRecommendations.map(item => (
                  <TVFocusable
                    key={item.id}
                    style={styles.similarCard}
                    onPress={() => {
                      router.push({
                        pathname: '/series-detail',
                        params: {
                          id: item.id,
                          title: item.name,
                          poster: item.logo,
                          streamUrl: item.streamUrl,
                          quality: item.quality,
                          category: item.category
                        }
                      });
                    }}
                  >
                    <Image source={{ uri: item.logo }} style={styles.similarImage} contentFit="cover" />
                  </TVFocusable>
                ))}
              </ScrollView>
            </View>
          )}

        </View>
      </ScrollView>
      <PinModal 
        visible={pinModalVisible} 
        expectedPin={parentalPin}
        onCancel={() => {
          setPinModalVisible(false);
          setPendingAction(null);
        }}
        onSuccess={() => {
          setPinModalVisible(false);
          if (pendingAction) {
            pendingAction();
            setPendingAction(null);
          } else {
            toggleChannelLock(params.id || '');
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  heroSection: {
    height: SCREEN_HEIGHT * 0.70,
    width: '100%',
    position: 'relative',
  },
  backBtn: {
    position: 'absolute',
    left: 20,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  shadowIcon: {
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  titleSection: {
    alignItems: 'center',
    marginTop: -20,
    paddingHorizontal: 24,
    zIndex: 5,
  },
  title: {
    fontSize: 42,
    fontWeight: '900',
    textAlign: 'left',
    marginBottom: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  badgeText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  playPillContainer: {
    borderRadius: 30,
    alignSelf: 'center',
    marginTop: 10,
    shadowColor: '#D4A843',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  playPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 36,
    gap: 12,
    borderRadius: 30,
  },
  playPillText: {
    color: '#1A1A1A',
    fontWeight: '900',
    fontSize: 18,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  content: {
    padding: 24,
    paddingTop: 32,
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  metaRowText: {
    fontSize: 13,
    marginBottom: 16,
    lineHeight: 20,
  },
  description: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 16,
  },
  starsText: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 24,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 32,
  },
  actionIconBtn: {
    alignItems: 'center',
    gap: 8,
  },
  actionIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  actionIconText: {
    color: '#FFF',
    fontSize: 12,
  },
  castSection: {
    marginVertical: 8,
  },
  castList: {
    paddingBottom: 8,
  },
  castCard: {
    alignItems: 'center',
    marginRight: 16,
    width: 80,
  },
  castImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 6,
    backgroundColor: '#2A2A2A',
  },
  castAvatarFallback: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    borderWidth: 1,
  },
  castFallbackText: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  castName: {
    fontSize: 11,
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  episodesList: {
    gap: 12,
  },
  episodeCard: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  epThumbnailContainer: {
    width: 120,
    aspectRatio: 16/9,
    position: 'relative',
    backgroundColor: '#1A1A1A',
  },
  epThumbnail: {
    width: '100%',
    height: '100%',
  },
  epPlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  epInfo: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  epLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  epTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  epDuration: {
    fontSize: 12,
  },
  epDownloadBtn: {
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    width: 56,
  },
  similarSection: {
    marginTop: 24,
  },
  similarList: {
    paddingBottom: 8,
  },
  similarCard: {
    width: 120,
    height: 180,
    borderRadius: 12,
    marginRight: 12,
    overflow: 'hidden',
    backgroundColor: '#1A1A1A',
  },
  similarImage: {
    width: '100%',
    height: '100%',
  }
});