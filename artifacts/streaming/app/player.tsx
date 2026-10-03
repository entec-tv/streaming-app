import { Lineicons } from '@lineiconshq/react-native-lineicons';
import { VolumeMuteBulk, VolumeLowBulk, VolumeHighBulk } from '@lineiconshq/free-icons';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Dimensions,
  PanResponder,
  Linking,
  Animated,
  ActivityIndicator,
  Alert,
  InteractionManager,
  useWindowDimensions,
  I18nManager,
  ScrollView,
  BackHandler,
} from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, router } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { TVFocusable } from '@/components/TVFocusable';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEvent } from 'expo';
import { WebVideoPlayer, WebVideoPlayerRef } from '@/components/WebVideoPlayer';
import { base64Encode, base64Decode } from '@/lib/base64';
import { StatusBar } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';
import { StatusBar as RNStatusBar } from 'react-native';
import { QuestionMarkCircleBulk, ArrowLeftBulk, Message2Bulk, HeartBulk, PreviousStep2Bulk, ShiftLeftBulk, NextStep2Bulk, ShiftRightBulk, Ban2Bulk, PauseBulk, PlayBulk, MonitorBulk } from '@lineiconshq/free-icons';
import { useColors } from '@/hooks/useColors';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStore } from '@/store/app-store';
import { useTranslation } from '@/hooks/useTranslation';

// Removed static W, H

function formatTime(sec: number): string {
  if (!isFinite(sec) || isNaN(sec) || sec < 0) return '0:00';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function decodeIfNeeded(str?: string) {
  if (!str) return '';
  if (str.startsWith('http') || str.startsWith('data:') || str.startsWith('file:')) return str;
  try {
    const decoded = base64Decode(str);
    if (decoded.startsWith('http')) return decoded;
    return str;
  } catch {
    return str;
  }
}

export default function PlayerScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const routerParams = useLocalSearchParams<{
    id?: string;
    streamUrl: string;
    title?: string;
    isLive?: string;
    current?: string;
    next?: string;
    quality?: string;
    logo?: string;
    category?: string;
    poster?: string;
    backdrop?: string;
    name?: string;
    description?: string;
    autoResume?: string;
    type?: string;
    duration?: string;
  }>();

  const [activeChannel, setActiveChannel] = useState(routerParams);

  const streamUrl = decodeIfNeeded(activeChannel.streamUrl ?? '');
  const title = activeChannel.title || activeChannel.name || 'Streaming';
  
  // Robust live stream detection:
  // 1. Explicit parameter: isLive === 'true' or type === 'live'
  // 2. Stream URL analysis: contains '/live/', or ends with '.ts' or '.ts?'
  // 3. Known IPTV channel prefixes when not an explicit video file (.mp4, .mkv)
  const lowerUrl = (streamUrl || '').toLowerCase();
  const isVideoFile = lowerUrl.includes('.mp4') || lowerUrl.includes('.mkv') || lowerUrl.includes('.avi') || lowerUrl.includes('.mov');
  const isExplicitLive = String(activeChannel.isLive) === 'true' || activeChannel.type === 'live';
  const isUrlLive = lowerUrl.includes('/live/') || lowerUrl.endsWith('.ts') || lowerUrl.includes('.ts?') || lowerUrl.includes(':8000/live') || lowerUrl.includes(':8080/live');
  const isChannelPrefix = /^(AR|BEIN|OSN|SSC|MBC|VIP|EG|KSA|NEWS|SPORT|AL |CH |TV )/i.test(title.trim());
  
  const isLive = isExplicitLive || isUrlLive || (!isVideoFile && isChannelPrefix && activeChannel.type !== 'vod' && activeChannel.type !== 'series');
  const current = activeChannel.current ?? '';
  const next = activeChannel.next ?? '';

  const [showControls, setShowControls] = useState(true);
  const showControlsRef = useRef(true);
  useEffect(() => { showControlsRef.current = showControls; }, [showControls]);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const initialDuration = parseInt(activeChannel.duration || '0', 10);
  const [duration, setDuration] = useState(initialDuration || 0);

  const durationRef = useRef(0);
  const currentTimeRef = useRef(0);
  useEffect(() => { durationRef.current = duration; }, [duration]);
  useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);
  const [volume, setVolume] = useState(1);
  const [hasError, setHasError] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isLiveSync, setIsLiveSync] = useState(true);
  const [seeking, setSeeking] = useState(false);
  const [seekPreview, setSeekPreview] = useState(0);
  const [errorToastVisible, setErrorToastVisible] = useState(false);
  const [aspectMode, setAspectMode] = useState(0); // 0: Fit, 1: Fill, 2: Stretch, 3: 4:3
  const [retryKey, setRetryKey] = useState(0);
  const retryCount = useRef(0);
  const errorToastOpacity = useRef(new Animated.Value(0)).current;
  const errorToastY = useRef(new Animated.Value(-80)).current;
  const videoViewRef = useRef<any>(null);
  const webPlayerRef = useRef<WebVideoPlayerRef>(null);

  const favoriteItems = useAppStore((s) => s.favoriteItems) || [];
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);
  const playbackQueue = useAppStore((s) => s.playbackQueue) || [];
  const playbackIndex = useAppStore((s) => s.playbackIndex);
  const setPlaybackIndex = useAppStore((s) => s.setPlaybackIndex);

  const continueWatching = useAppStore((s) => s.continueWatching) || [];
  const isTV = Platform.isTV;
  const { width, height } = useWindowDimensions();
  const isSmallScreen = width < 768;
  const updateContinueWatching = useAppStore((s) => s.updateContinueWatching);
  const setLastWatchedChannel = useAppStore((s) => s.setLastWatchedChannel);
  const moreOptions = useAppStore((s) => s.moreOptions);
  const settings = useAppStore((s) => s.settings);
  const [resolvedStreamUrl, setResolvedStreamUrl] = useState<string | null>(null);
  const [isResolvingUrl, setIsResolvingUrl] = useState(false);

  const [audioTracks, setAudioTracks] = useState<any[]>([]);
  const [subtitleTracks, setSubtitleTracks] = useState<any[]>([]);
  const [selectedAudio, setSelectedAudio] = useState<any>(null);
  const [selectedSubtitle, setSelectedSubtitle] = useState<any>(null);
  const [showTracksModal, setShowTracksModal] = useState(false);
  const [currentSubtitle, setCurrentSubtitle] = useState('');

  // On-screen HUD for Volume, Seek (+10s/-10s), Play/Pause, and TV Channel Jump
  const [hudMessage, setHudMessage] = useState<string | null>(null);
  const [hudSubMessage, setHudSubMessage] = useState<string | null>(null);
  const [hudIcon, setHudIcon] = useState<'volume' | 'seek-forward' | 'seek-backward' | 'channel' | 'play' | 'pause' | null>(null);
  const hudOpacity = useRef(new Animated.Value(0)).current;
  const hudTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showHud = useCallback((msg: string, icon?: 'volume' | 'seek-forward' | 'seek-backward' | 'channel' | 'play' | 'pause', sub?: string) => {
    if (hudTimer.current) clearTimeout(hudTimer.current);
    setHudMessage(msg);
    setHudSubMessage(sub || null);
    setHudIcon(icon || null);
    Animated.timing(hudOpacity, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    hudTimer.current = setTimeout(() => {
      Animated.timing(hudOpacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
        setHudMessage(null);
        setHudSubMessage(null);
        setHudIcon(null);
      });
    }, 1500);
  }, [hudOpacity]);

  // Channel number entry buffer for 0-9 keys (Direct TV Channel Jumping)
  const channelNumberBuffer = useRef('');
  const channelNumberTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Set last watched channel when player mounts
  useEffect(() => {
    if (activeChannel && activeChannel.streamUrl) {
      setLastWatchedChannel(activeChannel);
    }
  }, [activeChannel]);

  const removeFromContinueWatching = useAppStore((s) => s.removeFromContinueWatching);
  const showGlobalAlert = useAppStore((s) => s.showGlobalAlert);
  const hideGlobalAlert = useAppStore((s) => s.hideGlobalAlert);



  const matchedFavoriteItem = favoriteItems.find(
    (item) => item.streamUrl === streamUrl || (activeChannel.id && item.id === activeChannel.id)
  );
  const isFavorite = !!matchedFavoriteItem;

  const handleToggleFavorite = () => {
    if (matchedFavoriteItem) {
      toggleFavorite(matchedFavoriteItem);
    } else {
      const newItem: any = {
        id: activeChannel.id || `stream_${encodeURIComponent(streamUrl).substring(0, 30)}`,
        name: title,
        logo: activeChannel.logo || '',
        category: activeChannel.category || 'Uncategorized',
        streamUrl: streamUrl,
        current: current,
        next: next,
        quality: activeChannel.quality || 'HD',
        isLive: isLive,
        type: isLive ? 'live' : 'vod'
      };
      toggleFavorite(newItem);
    }
  };

  const { width: W, height: H } = useWindowDimensions();
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seekBarWidth = useRef(W - 40);
  const seekStartX = useRef(0);
  const controlsOpacity = useRef(new Animated.Value(1)).current;
  const hasAutoResumed = useRef(false);

  const matchedWatchedRef = useRef(continueWatching.find(item => item.streamUrl === streamUrl || (activeChannel.id && item.id === activeChannel.id)));
  const matchedWatched = matchedWatchedRef.current;
  const shouldPrompt = !isLive && activeChannel.autoResume !== 'true' && matchedWatched && matchedWatched.progress > 10 && matchedWatched.duration > 0 && matchedWatched.progress < matchedWatched.duration - 30;

  const [promptVisible, setPromptVisible] = useState(!!shouldPrompt);
  const isFocused = useIsFocused();
  const [probeComplete, setProbeComplete] = useState(false);
  const [detectedCodec, setDetectedCodec] = useState<string | null>(null);

  let finalStreamUrl = resolvedStreamUrl ?? streamUrl;
  let proxiedUrl = finalStreamUrl;
  if (Platform.OS === 'web' && finalStreamUrl) {
    if (!finalStreamUrl.startsWith('http')) {
      // Local file
      proxiedUrl = `/api/local-video?path=${encodeURIComponent(finalStreamUrl.replace('file://', ''))}`;
    } else if (isLive) {
      proxiedUrl = `/proxy?url=${encodeURIComponent(finalStreamUrl)}`;
    } else if (!isLive && !finalStreamUrl.includes('.m3u8')) {
      // Use proxy-vod for movies to transcode AC3/DTS audio to AAC
      proxiedUrl = `/proxy-vod?url=${encodeURIComponent(finalStreamUrl)}`;
    } else {
      // HLS VOD can also bypass proxy
      proxiedUrl = finalStreamUrl;
    }
  }

  useEffect(() => {
    if (shouldPrompt) {
      setIsPlaying(false);
    }
  }, []);

  const setIsPlayerOpen = useAppStore((s) => s.setIsPlayerOpen);

  useEffect(() => {
    setIsPlayerOpen(true);
    return () => setIsPlayerOpen(false);
  }, []);

  // Resolve redirect URL if option is ON
  useEffect(() => {
    if (!moreOptions.streamUrlRedirectionCheck || !streamUrl || isLive) return;
    setIsResolvingUrl(true);
    fetch(streamUrl, { method: 'HEAD', redirect: 'follow' })
      .then(res => {
        if (res.url && res.url !== streamUrl) {
          console.log('[Player] Resolved redirect:', res.url);
          setResolvedStreamUrl(res.url);
        }
      })
      .catch(() => {})
      .finally(() => setIsResolvingUrl(false));
  }, [streamUrl, moreOptions.streamUrlRedirectionCheck]);

  // Handle External Player for Android
  useEffect(() => {
    const preferredPlayer = isLive ? settings.liveTvPlayer : settings.vodPlayer;
    if (preferredPlayer === 'android' && proxiedUrl && Platform.OS !== 'web') {
      let urlToOpen = proxiedUrl;
      if (Platform.OS === 'android') {
        const urlWithoutScheme = proxiedUrl.replace(/^https?:\/\//, '');
        const scheme = proxiedUrl.startsWith('https') ? 'https' : 'http';
        urlToOpen = `intent://${urlWithoutScheme}#Intent;scheme=${scheme};type=video/*;action=android.intent.action.VIEW;end;`;
      }
      
      const openPlayer = async () => {
        try {
          console.log('[Player]: Opening external player for:', urlToOpen);
          await Linking.openURL(urlToOpen);
        } catch (err) {
          console.log("Failed to open external player via intent, falling back to URL:", err);
          try {
            await Linking.openURL(proxiedUrl);
          } catch (e) {
            console.error("Failed to open proxied URL:", e);
            Alert.alert("Error", "No compatible video player or browser found to open this stream.");
          }
        } finally {
          // Return to previous screen as the external app is now handling playback
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/');
          }
        }
      };

      openPlayer();
    }
  }, [settings.liveTvPlayer, settings.vodPlayer, proxiedUrl, isLive]);

  // Probe VOD for duration and codec BEFORE playback
  useEffect(() => {
    if (Platform.OS === 'web' && proxiedUrl?.includes('/proxy-vod')) {
      setProbeComplete(false);
      const baseProbeUrl = proxiedUrl.replace('/proxy-vod', '/probe-vod');
      fetch(baseProbeUrl)
        .then(res => res.json())
        .then(data => {
          if (data && data.duration > 0) setDuration(data.duration);
          if (data && data.codec) setDetectedCodec(data.codec);
        })
        .catch(console.error)
        .finally(() => setProbeComplete(true));
    } else {
      setProbeComplete(true);
    }
  }, [proxiedUrl]);

  // Probe tracks BEFORE playback
  useEffect(() => {
    if (Platform.OS === 'web' && proxiedUrl?.includes('/proxy-vod')) {
      const baseProbeUrl = proxiedUrl.replace('/proxy-vod', '/probe-tracks');
      fetch(baseProbeUrl)
        .then(res => res.json())
        .then(data => {
          if (data) {
            setAudioTracks(data.audioTracks || []);
            setSubtitleTracks(data.subtitleTracks || []);
          }
        })
        .catch(console.error);
    } else {
      setAudioTracks([]);
      setSubtitleTracks([]);
    }
  }, [proxiedUrl]);

  const videoSource = React.useMemo(() => {
    if (!proxiedUrl) return null;
    let finalUrl = detectedCodec && proxiedUrl.includes('/proxy-vod')
      ? `${proxiedUrl}&codec=${detectedCodec}`
      : proxiedUrl;
      
    if (selectedAudio !== null && finalUrl.includes('/proxy-vod')) {
      finalUrl += `&audioTrack=${selectedAudio}`;
    }

    const isHls = finalUrl.includes('.m3u8');
    return { 
      uri: finalUrl, 
      headers: { 'User-Agent': 'VLC/3.0.0' }
    } as any;
  }, [proxiedUrl, detectedCodec, selectedAudio]);

  const player = useVideoPlayer(Platform.OS === 'web' ? null : videoSource, (p) => {
    p.volume = 1;
    if (Platform.OS === 'android') {
      try {
        p.bufferOptions = {
          preferredForwardBufferDuration: 60, // Buffer up to 60s
          minBufferForPlayback: 2,           // Start playing when 2s is ready
          maxBufferBytes: 50 * 1024 * 1024,  // Max 50MB memory buffer
        };
      } catch (e) {
        console.log('Failed to set bufferOptions', e);
      }
    }
    if (!shouldPrompt) {
      p.play();
    }
  });

  const status = useEvent(player, 'statusChange', { status: player ? player.status : 'readyToPlay', error: undefined });
  const isPlayingStatus = useEvent(player, 'playingChange', { isPlaying: player ? player.playing : true });
  
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    retryCount.current = 0;
    if (player && videoSource && Platform.OS !== 'web') {
      try {
        if (player.replaceAsync) {
          player.replaceAsync(videoSource).catch((err) => console.log('replaceAsync error:', err));
        } else {
          player.replace(videoSource);
        }
        setIsBuffering(true);
        if (!shouldPrompt) player.play();
      } catch (e) {}
    }
  }, [videoSource]);

  useEffect(() => {
    let isMounted = true;
    if (Platform.OS === 'web') return; // Handled by WebVideoPlayer events
    
    if (status?.status === 'readyToPlay') {
      setIsBuffering(false);
      setHasError(false);
      
      if (activeChannel.autoResume === 'true' && matchedWatched && !hasAutoResumed.current && player) {
        try {
          player.currentTime = matchedWatched.progress;
        } catch (e) {
          console.warn('Failed to seek on readyToPlay', e);
        }
        hasAutoResumed.current = true;
      }

      if (shouldPrompt) {
        setIsPlaying(false);
      } else {
        setIsPlaying(true);
        if (player) {
          player.play();
        }
      }
    } else if (status?.status === 'error') {
      setHasError(true);
      setIsBuffering(false);
      showErrorToast();
      
      if (retryCount.current < 5) {
        retryCount.current += 1;
        retryTimeoutRef.current = setTimeout(() => {
          if (isMounted && player && videoSource) {
            try {
              setIsBuffering(true);
              setHasError(false);
              if (player.replaceAsync) {
                player.replaceAsync(videoSource).catch((err) => console.log('retry replaceAsync error:', err));
              } else {
                player.replace(videoSource);
              }
              player.play();
            } catch(e) {
              console.error('Retry play failed', e);
            }
          }
        }, 3000);
      }
    }
    return () => {
      isMounted = false;
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    };
  }, [status?.status, proxiedUrl, shouldPrompt]);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      setIsPlaying(isPlayingStatus.isPlaying);
    }
  }, [isPlayingStatus.isPlaying]);

  const resetTimer = (duration = 3500) => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setShowControls(true);
    Animated.timing(controlsOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();

    hideTimer.current = setTimeout(() => {
      Animated.timing(controlsOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        setShowControls(false);
      });
    }, duration);
  };

  const showControlsNow = (duration = 4000) => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setShowControls(true);
    controlsOpacity.setValue(1);
    hideTimer.current = setTimeout(() => {
      Animated.timing(controlsOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        setShowControls(false);
      });
    }, duration);
  };

  const handleBackgroundTap = () => {
    if (showControls) {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      Animated.timing(controlsOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
        setShowControls(false);
      });
    } else {
      showControlsNow(4000);
    }
  };

  useEffect(() => {
    // When navigating into player screen, auto-hide elements after 3 seconds
    resetTimer(3000);
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [isFocused]);

  // Keyboard navigation is handled comprehensively below with on-screen HUD integration

  useEffect(() => {
    if (Platform.OS === 'web' || !player) return;
    const interval = setInterval(() => {
      try {
        if (player.status === 'readyToPlay') {
          // Always update the ref so continueWatching logic has accurate time
          currentTimeRef.current = player.currentTime;
          
          // Only trigger a React re-render if the UI needs it
          if (showControlsRef.current) {
            setCurrentTime(player.currentTime);
          }
          if (player.duration && player.duration !== duration) {
            setDuration(player.duration);
          }
        }
      } catch (_) {}
    }, 500);
    return () => clearInterval(interval);
  }, [player]);

  useEffect(() => {
    return () => {
      // Stop the player to prevent audio leaking after navigation
      try {
        if (player) {
          player.pause();
          if (player.replaceAsync) {
            player.replaceAsync(null);
          } else {
            player.replace(null);
          }
        }
      } catch (_) {}
      
      // Update continue watching
      if (streamUrl && !isLive && currentTimeRef.current > 10) {
        const itemType = activeChannel.type === 'series' ? 'series' : 'vod';
        updateContinueWatching({
          id: activeChannel.id || streamUrl,
          type: itemType,
          title: title,
          poster: decodeIfNeeded(activeChannel.poster || activeChannel.logo || ''),
          backdrop: decodeIfNeeded(activeChannel.backdrop || ''),
          streamUrl,
          progress: currentTimeRef.current,
          duration: durationRef.current,
          timestamp: Date.now(),
          quality: activeChannel.quality,
          description: activeChannel.description,
          category: activeChannel.category
        });
      }
    };
  }, []); // Run cleanup ONLY on unmount, not every second!

  const handleExitPlayer = useCallback(() => {
    if (Platform.OS !== 'web') {
      const lastOri = useAppStore.getState().lastNonPlayerOrientation;
      if (lastOri === 'portrait') {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT).catch(() => {});
        setTimeout(() => {
          ScreenOrientation.unlockAsync().catch(() => {});
        }, 350);
      } else {
        ScreenOrientation.unlockAsync().catch(() => {});
      }
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  }, []);

  useEffect(() => {
    const onHardwareBack = () => {
      handleExitPlayer();
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
    return () => sub.remove();
  }, [handleExitPlayer]);

  useEffect(() => {
    // Lock screen orientation to LANDSCAPE whenever player is active
    if (Platform.OS !== 'web') {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
    }

    const enableImmersive = async () => {
      if (Platform.OS === 'android') {
        try {
          await NavigationBar.setVisibilityAsync("hidden");
        } catch (e) {}
      }
      if (Platform.OS !== 'web') {
        RNStatusBar.setHidden(true, 'none');
      }
    };

    enableImmersive();

    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      
      // Do not restore UI on unmount to keep immersive mode globally
      setIsPlayerOpen(false);

      if (Platform.OS !== 'web') {
        const lastOri = useAppStore.getState().lastNonPlayerOrientation;
        if (lastOri === 'portrait') {
          ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT).then(() => {
            setTimeout(() => {
              ScreenOrientation.unlockAsync().catch(() => {});
            }, 350);
          }).catch(() => {
            ScreenOrientation.unlockAsync().catch(() => {});
          });
        } else {
          ScreenOrientation.unlockAsync().catch(() => {});
        }
      }
    };
  }, []);

  const showErrorToast = () => {
    setErrorToastVisible(true);
    Animated.spring(errorToastY, {
      toValue: 40,
      useNativeDriver: true,
    }).start();
    Animated.timing(errorToastOpacity, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    setTimeout(() => {
      Animated.timing(errorToastOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setErrorToastVisible(false);
      });
    }, 3000);
  };

  const seekPreviewVal = useRef(0);

  const seekTo = useCallback((ratio: number) => {
    const currentDuration = durationRef.current;
    const target = Math.max(0, Math.min(currentDuration, ratio * currentDuration));
    setCurrentSubtitle(''); // Instantly clear subtitle on seek
    if (Platform.OS === 'web') {
      webPlayerRef.current?.seek(target);
      setCurrentTime(target);
      return;
    }
    if (!player || !currentDuration) return;
    player.currentTime = target;
  }, [player]);

  const handlePanResponderMove = useCallback((evt: any, gestureState: any) => {
    resetTimer();
    setSeeking(true);
    const newX = Math.max(0, Math.min(seekBarWidth.current, seekStartX.current + gestureState.dx));
    let ratio = newX / seekBarWidth.current;
    const val = ratio * durationRef.current;
    seekPreviewVal.current = val;
    setSeekPreview(val);
  }, []);

  const handlePanResponderRelease = useCallback((evt: any, gestureState: any) => {
    const ratio = seekPreviewVal.current / durationRef.current;
    seekTo(ratio || 0);
    setSeeking(false);
    resetTimer();
  }, [seekTo]);

  const seekBarPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt, gestureState) => {
        const tapX = evt.nativeEvent.locationX;
        seekStartX.current = tapX;
        const currentDuration = durationRef.current;
        let ratio = Math.max(0, Math.min(1, tapX / seekBarWidth.current));
        const val = ratio * currentDuration;
        seekPreviewVal.current = val;
        setSeeking(true);
        setSeekPreview(val);
        resetTimer();
      },
      onPanResponderMove: handlePanResponderMove,
      onPanResponderRelease: handlePanResponderRelease,
    })
  ).current;

  // Volume slider PanResponder
  const volumePan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (evt) => {
        const sliderH = 120;
        const ratio = 1 - Math.max(0, Math.min(1, evt.nativeEvent.locationY / sliderH));
        setVolume(ratio);
        if (Platform.OS === 'web') {
          webPlayerRef.current?.setVolume(ratio);
          if (ratio > 0 && isMuted) {
            webPlayerRef.current?.setMuted(false);
            setIsMuted(false);
          } else if (ratio === 0 && !isMuted) {
            webPlayerRef.current?.setMuted(true);
            setIsMuted(true);
          }
        } else {
          if (player) {
            player.volume = ratio;
            if (ratio > 0 && player.muted) {
              player.muted = false;
              setIsMuted(false);
            } else if (ratio === 0 && !player.muted) {
              player.muted = true;
              setIsMuted(true);
            }
          }
        }
      },
    })
  ).current;

  const togglePlay = () => {
    if (Platform.OS === 'web') {
       setIsPlaying(!isPlaying);
       return;
    }
    if (!player) return;
    if (isPlaying) { 
      try { player.pause(); } catch(e){}
    } else {
      try { player.play(); } catch(e){}
    }
  };

  const handleSeekBy = (secs: number) => {
    setCurrentSubtitle(''); // Instantly clear subtitle on seek
    if (Platform.OS === 'web') {
       const target = Math.max(0, Math.min(duration, currentTime + secs));
       webPlayerRef.current?.seek(target);
       setCurrentTime(target);
       return;
    }
    if (!player) return;
    const target = Math.max(0, Math.min(duration, (player.currentTime ?? 0) + secs));
    player.currentTime = target;
  };

  const isSeries = activeChannel.type === 'series';

  const handlePrevChannel = () => {
    if (playbackQueue.length <= 1) return;
    if (isSeries && playbackIndex === 0) return;

    const prevIdx = isSeries ? playbackIndex - 1 : (playbackIndex - 1 + playbackQueue.length) % playbackQueue.length;
    setPlaybackIndex(prevIdx);
    const ch = playbackQueue[prevIdx];
    const chUrl = decodeIfNeeded(ch.streamUrl || '').toLowerCase();
    const chIsLive = ch.isLive || ch.type === 'live' || chUrl.includes('/live/') || chUrl.endsWith('.ts') || chUrl.includes('.ts?');
    setActiveChannel(prev => ({
      ...prev,
      id: ch.id,
      streamUrl: ch.streamUrl,
      title: ch.name || ch.title,
      isLive: chIsLive ? 'true' : 'false',
      current: ch.current || '',
      next: ch.next || '',
      quality: ch.quality || 'HD',
      logo: ch.logo || ch.poster || '',
      category: ch.category || '',
      poster: ch.poster ? base64Encode(ch.poster) : '',
      backdrop: ch.backdrop ? base64Encode(ch.backdrop) : '',
    }));
  };

  const handleNextChannel = () => {
    if (playbackQueue.length <= 1) return;
    if (isSeries && playbackIndex === playbackQueue.length - 1) return;

    const nextIdx = isSeries ? playbackIndex + 1 : (playbackIndex + 1) % playbackQueue.length;
    setPlaybackIndex(nextIdx);
    const ch = playbackQueue[nextIdx];
    const chUrl = decodeIfNeeded(ch.streamUrl || '').toLowerCase();
    const chIsLive = ch.isLive || ch.type === 'live' || chUrl.includes('/live/') || chUrl.endsWith('.ts') || chUrl.includes('.ts?');
    setActiveChannel(prev => ({
      ...prev,
      id: ch.id,
      streamUrl: ch.streamUrl,
      title: ch.name || ch.title,
      isLive: chIsLive ? 'true' : 'false',
      current: ch.current || '',
      next: ch.next || '',
      quality: ch.quality || 'HD',
      logo: ch.logo || ch.poster || '',
      category: ch.category || '',
      poster: ch.poster ? base64Encode(ch.poster) : '',
      backdrop: ch.backdrop ? base64Encode(ch.backdrop) : '',
    }));
  };

  const isCatchup = streamUrl.includes('/timeshift/') || activeChannel.type === 'catchup';
  const hasPrev = !isCatchup && playbackQueue.length > 1 && (!isSeries || playbackIndex > 0);
  const hasNext = !isCatchup && playbackQueue.length > 1 && (!isSeries || playbackIndex < playbackQueue.length - 1);

  const toggleLiveSync = () => {
    setIsLiveSync(prev => {
       const next = !prev;
       if (next) {
          Alert.alert("Live Sync", "Stream will skip to the absolute latest edge.");
       } else {
          Alert.alert("Resume Mode", "If network buffers, the stream will continue from where it stopped.");
       }
       return next;
    });
    showControlsNow();
  };

  const toggleMute = () => {
    if (Platform.OS === 'web') {
      if (webPlayerRef.current) {
        const next = webPlayerRef.current.toggleMute();
        setIsMuted(next);
      } else {
        setIsMuted(!isMuted);
      }
      showControlsNow();
      return;
    }
    if (!player) return;
    const next = !isMuted;
    player.muted = next;
    if (!next && player.volume === 0) {
      player.volume = 1;
    }
    setIsMuted(next);
    showControlsNow();
  };

  const toggleAspectMode = () => {
    setAspectMode(prev => (prev + 1) % 4);
    showControlsNow();
  };

  const toggleSubtitles = () => {
    setShowTracksModal(true);
    showControlsNow();
  };

  const handleResume = () => {
    if (player && matchedWatched) {
      player.currentTime = matchedWatched.progress;
      if (Platform.OS !== 'web') {
         player.play();
      } else {
         webPlayerRef.current?.seek(matchedWatched.progress);
         setIsPlaying(true);
      }
    }
    setPromptVisible(false);
    showControlsNow();
  };

  const handleStartOver = () => {
    if (player) {
      player.currentTime = 0;
      if (Platform.OS !== 'web') {
         player.play();
      } else {
         webPlayerRef.current?.seek(0);
         setIsPlaying(true);
      }
    }
    setPromptVisible(false);
    showControlsNow();
  };

  const handlePiP = () => {
    if (videoViewRef.current) {
      try {
        videoViewRef.current.startPictureInPicture();
      } catch (e) {
        console.warn('PiP not supported', e);
      }
    }
  };

  // Volume HUD helper
  const handleVolumeDelta = useCallback((delta: number) => {
    setVolume(prev => {
      const next = Math.max(0, Math.min(1, Math.round((prev + delta) * 20) / 20));
      if (Platform.OS === 'web') {
        webPlayerRef.current?.setVolume(next);
        if (next > 0 && isMuted) {
          webPlayerRef.current?.setMuted(false);
          setIsMuted(false);
        } else if (next === 0 && !isMuted) {
          webPlayerRef.current?.setMuted(true);
          setIsMuted(true);
        }
      } else if (player) {
        player.volume = next;
        if (next > 0 && player.muted) {
          player.muted = false;
          setIsMuted(false);
        } else if (next === 0 && !player.muted) {
          player.muted = true;
          setIsMuted(true);
        }
      }
      showHud(`${Math.round(next * 100)}%`, 'volume');
      return next;
    });
  }, [isMuted, player, showHud]);

  // Relative Seek with HUD
  const handleSeekRelative = useCallback((secs: number) => {
    handleSeekBy(secs);
    showHud(secs > 0 ? `+${secs} ثانية` : `${secs} ثانية`, secs > 0 ? 'seek-forward' : 'seek-backward');
    showControlsNow(2500);
  }, [handleSeekBy, showHud]);

  // Play / Pause toggle with HUD
  const handlePlayPauseToggle = useCallback(() => {
    togglePlay();
    showHud(!isPlaying ? 'تشغيل' : 'إيقاف مؤقت', !isPlaying ? 'play' : 'pause');
    showControlsNow(2500);
  }, [isPlaying, togglePlay, showHud]);

  // Mute toggle with HUD
  const handleMuteToggle = useCallback(() => {
    toggleMute();
    showHud(!isMuted ? 'كتم الصوت' : 'تشغيل الصوت', 'volume');
    showControlsNow(2500);
  }, [isMuted, toggleMute, showHud]);

  // Fullscreen toggle with HUD
  const handleFullscreenToggle = useCallback(() => {
    if (Platform.OS === 'web') {
      const isFs = !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
      if (isFs) {
        webPlayerRef.current?.exitFullscreen();
        showHud('إنهاء ملء الشاشة');
      } else {
        webPlayerRef.current?.requestFullscreen();
        showHud('ملء الشاشة');
      }
    }
  }, [showHud]);

  // Direct channel number typing (0-9)
  const handleNumberInput = useCallback((digit: string) => {
    if (!isLive || playbackQueue.length === 0) return;
    if (channelNumberTimer.current) clearTimeout(channelNumberTimer.current);

    channelNumberBuffer.current = `${channelNumberBuffer.current}${digit}`;
    const targetNum = parseInt(channelNumberBuffer.current, 10);

    showHud(`قناة ${channelNumberBuffer.current}`, 'channel', 'جارِ الانتقال...');

    channelNumberTimer.current = setTimeout(() => {
      channelNumberBuffer.current = '';
      if (isNaN(targetNum) || targetNum <= 0) return;

      let foundIndex = playbackQueue.findIndex(ch => ch.num === targetNum || (ch as any).number === targetNum);

      if (foundIndex === -1 && targetNum <= playbackQueue.length) {
        foundIndex = targetNum - 1;
      }

      if (foundIndex >= 0 && foundIndex < playbackQueue.length) {
        setPlaybackIndex(foundIndex);
        const ch = playbackQueue[foundIndex];
        const chUrl = decodeIfNeeded(ch.streamUrl || '').toLowerCase();
        const chIsLive = ch.isLive || ch.type === 'live' || chUrl.includes('/live/') || chUrl.endsWith('.ts') || chUrl.includes('.ts?');
        setActiveChannel(prev => ({
          ...prev,
          id: ch.id,
          streamUrl: ch.streamUrl,
          title: ch.name || ch.title,
          isLive: chIsLive ? 'true' : 'false',
          current: ch.current || '',
          next: ch.next || '',
          quality: ch.quality || 'HD',
          logo: ch.logo || ch.poster || '',
          category: ch.category || '',
          poster: ch.poster ? base64Encode(ch.poster) : '',
          backdrop: ch.backdrop ? base64Encode(ch.backdrop) : '',
        }));
        showHud(ch.name || ch.title || `قناة ${targetNum}`, 'channel');
      } else {
        showHud('القناة غير موجودة', 'channel');
      }
    }, 1200);
  }, [isLive, playbackQueue, setPlaybackIndex, showHud]);

  // Comprehensive keyboard navigation on Web/Desktop
  useEffect(() => {
    if (Platform.OS === 'web') {
      const handleKeyDown = (e: KeyboardEvent) => {
        const activeTag = (document.activeElement as HTMLElement)?.tagName;
        if (['INPUT', 'TEXTAREA'].includes(activeTag)) return;

        switch (e.key) {
          case ' ':
          case 'k':
          case 'K':
            e.preventDefault();
            handlePlayPauseToggle();
            break;
          case 'ArrowLeft':
            e.preventDefault();
            if (isLive) {
              handlePrevChannel();
            } else {
              handleSeekRelative(-10);
            }
            break;
          case 'ArrowRight':
            e.preventDefault();
            if (isLive) {
              handleNextChannel();
            } else {
              handleSeekRelative(10);
            }
            break;
          case 'ArrowUp':
            e.preventDefault();
            handleVolumeDelta(0.05);
            break;
          case 'ArrowDown':
            e.preventDefault();
            handleVolumeDelta(-0.05);
            break;
          case 'm':
          case 'M':
            e.preventDefault();
            handleMuteToggle();
            break;
          case 'f':
          case 'F':
            e.preventDefault();
            handleFullscreenToggle();
            break;
          case 'PageUp':
          case '[':
            e.preventDefault();
            handlePrevChannel();
            break;
          case 'PageDown':
          case ']':
            e.preventDefault();
            handleNextChannel();
            break;
          case 'Escape':
          case 'Backspace':
            e.preventDefault();
            handleExitPlayer();
            break;
          default:
            if (e.key >= '0' && e.key <= '9') {
              e.preventDefault();
              handleNumberInput(e.key);
            } else if (!showControlsRef.current) {
              showControlsNow(3500);
            }
            break;
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [
    handlePlayPauseToggle,
    handleSeekRelative,
    handleVolumeDelta,
    handleMuteToggle,
    handleFullscreenToggle,
    handlePrevChannel,
    handleNextChannel,
    handleExitPlayer,
    handleNumberInput,
    isLive
  ]);

  const progress = duration > 0 ? (currentTime / duration) : 0;

  const isLandscape = width > height;

  if (!streamUrl) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', direction: 'ltr' }]}>
        <StatusBar hidden />
        <Lineicons icon={QuestionMarkCircleBulk} size={48} color="#E53935" />
        <Text style={styles.errorTitle}>{t('no_stream_url')}</Text>
        <TVFocusable style={[styles.retryBtn, { backgroundColor: colors.gold }]} onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace('/(tabs)'); } }}>
          <Text style={styles.retryText}>{t('go_back')}</Text>
        </TVFocusable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { direction: 'ltr' }]}>
      <StatusBar hidden />

      {/* ── Layer 1: Video ── */}
      <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center' }]}>
        {(!probeComplete && proxiedUrl?.includes('/proxy-vod')) ? (
          <View style={styles.bufferingOverlay}>
            <ActivityIndicator size="large" color={colors.gold} />
          </View>
        ) : Platform.OS === 'web' ? (
          <View style={
            aspectMode === 3 
              ? { height: '100%', aspectRatio: 4/3, backgroundColor: '#000' }
              : [StyleSheet.absoluteFill, { width: '100%', height: '100%' }]
          }>
            <WebVideoPlayer
              key={retryKey}
              ref={webPlayerRef}
              source={proxiedUrl || ''}
              subtitleUrl={selectedSubtitle !== null && proxiedUrl?.includes('/proxy-vod') ? proxiedUrl.replace('/proxy-vod', '/proxy-sub') + `&track=${selectedSubtitle}` : undefined}
              onSubtitleChange={setCurrentSubtitle}
              paused={!isPlaying}
              muted={isMuted}
              onMuteChange={(mutedState) => {
                setIsMuted(mutedState);
              }}
              onVolumeChange={(vol) => {
                setVolume(vol);
              }}
              aspectMode={aspectMode}
              preferredPlayer={isLive ? settings.liveTvPlayer : settings.vodPlayer}
              style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]}
              onProgress={(t: number, d: number) => {
                setCurrentTime(t);
                if (proxiedUrl.includes('/proxy-vod')) {
                   if (durationRef.current === 0) {
                      if (initialDuration > 0) setDuration(initialDuration);
                      else if (isFinite(d) && d > 0 && d !== Infinity) setDuration(d);
                   }
                } else {
                   if (isFinite(d) && d > 0 && d !== Infinity) setDuration(d);
                   else if (durationRef.current === 0 && initialDuration > 0) setDuration(initialDuration);
                }
              }}
              onReady={() => {
                setIsBuffering(false);
                setHasError(false);
                retryCount.current = 0; // Reset retry count on success
                
                if (activeChannel.autoResume === 'true' && matchedWatched && !hasAutoResumed.current) {
                  webPlayerRef.current?.seek(matchedWatched.progress);
                  hasAutoResumed.current = true;
                }
              }}
              onError={(e: any) => {
                console.error("WebVideoPlayer Error:", e);
                setHasError(true);
                setIsBuffering(false);
                showErrorToast();
                
                if (retryCount.current < 3) {
                  retryCount.current += 1;
                  setTimeout(() => {
                    setHasError(false);
                    setIsBuffering(true);
                    setRetryKey(k => k + 1);
                  }, 2000);
                }
              }}
              onEnd={() => {
                if (playbackQueue.length > 1) {
                  handleNextChannel();
                } else {
                  handleExitPlayer();
                }
              }}
            />
          </View>
        ) : (
          player && (
            <View style={
              aspectMode === 3 
                ? { height: '100%', aspectRatio: 4/3, backgroundColor: '#000' }
                : [StyleSheet.absoluteFill, { width: '100%', height: '100%' }]
            }>
                <VideoView
                  ref={videoViewRef}
                  player={player}
                  style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]}
                  nativeControls={false}
                  contentFit={
                    aspectMode === 0 ? "contain" :
                    aspectMode === 1 ? "cover" :
                    "fill"
                  }
                  allowsPictureInPicture={true}
                  startsPictureInPictureAutomatically={true}
                />
            </View>
          )
        )}
      </View>

      {/* ── Layer 1.5: HUD Overlay (Volume, Seek, TV Channel Jump) ── */}
      {hudMessage && (
        <Animated.View
          style={[
            styles.hudContainer,
            { opacity: hudOpacity }
          ]}
          pointerEvents="none"
        >
          {hudIcon === 'volume' && (
            <Ionicons
              name={volume === 0 || isMuted ? "volume-mute" : volume < 0.5 ? "volume-low" : "volume-high"}
              size={34}
              color="#F4C542"
            />
          )}
          {hudIcon === 'seek-forward' && <Ionicons name="play-forward" size={34} color="#F4C542" />}
          {hudIcon === 'seek-backward' && <Ionicons name="play-back" size={34} color="#F4C542" />}
          {hudIcon === 'play' && <Ionicons name="play" size={34} color="#F4C542" />}
          {hudIcon === 'pause' && <Ionicons name="pause" size={34} color="#F4C542" />}
          {hudIcon === 'channel' && <Ionicons name="tv" size={34} color="#F4C542" />}
          <Text style={styles.hudText}>{hudMessage}</Text>
          {hudSubMessage && <Text style={styles.hudSubText}>{hudSubMessage}</Text>}
        </Animated.View>
      )}

      {/* ── Layer 2: Buffering spinner ── */}
      {isBuffering && !hasError && (
        <View style={styles.bufferingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color={colors.gold} />
        </View>
      )}

      {/* ── Layer 3: Background tap area (toggle controls) ── */}
      <TVFocusable 
        disableBorder 
        focusable={!showControls} 
        hasTVPreferredFocus={!showControls}
        style={[StyleSheet.absoluteFill, { width: '100%', height: '100%', zIndex: showControls ? 1 : 10 }]} 
        onPress={handleBackgroundTap} 
      />

      {/* ── Layer 4: Controls overlay (box-none so tap layer still works in empty areas) ── */}
      {showControls && (
        <Animated.View
          style={[StyleSheet.absoluteFill, { opacity: controlsOpacity, zIndex: 20 }]}
          pointerEvents="box-none"
        >
          {/* Backdrop inside controls to catch taps on empty space on mobile and hide controls */}
          <TVFocusable
            disableBorder
            focusable={false}
            style={[StyleSheet.absoluteFill, { zIndex: -1 }]}
            onPress={handleBackgroundTap}
          />
          {/* Decorative gradients - no touch */}
          <LinearGradient
            colors={['rgba(0,0,0,0.85)', 'transparent']}
            style={styles.topGradient}
            pointerEvents="none"
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.85)']}
            style={styles.bottomGradient}
            pointerEvents="none"
          />

          {/* Top bar */}
          <View
            style={[styles.topBar, { paddingTop: Platform.OS === 'ios' ? insets.top + 8 : Math.max(insets.top + 8, 20) }]}
            pointerEvents="box-none"
          >
            <TVFocusable 
              onPress={handleExitPlayer} 
              style={({ focused }: any) => [
                styles.iconBtn,
                focused && { transform: [{ scale: 1.1 }], backgroundColor: colors.gold, borderWidth: 3, borderColor: '#FFF' }
              ]}
            >
              {({ focused }: any) => (
                <Lineicons icon={ArrowLeftBulk} size={22} color={focused ? "#0A0A0A" : "#FFF"} />
              )}
            </TVFocusable>

            <View style={[styles.titleBlock, { flexDirection: 'row', alignItems: 'center' }]} pointerEvents="none">
              <Text style={[styles.titleText, { flexShrink: 1 }]} numberOfLines={1}>{title}</Text>
              {(() => {
                 const textToCheck = `${title || ''} ${activeChannel.category || ''}`.toLowerCase();
                 const isDubbed = textToCheck.includes('dubbed') || textToCheck.includes('dual audio');
                 if (isDubbed) {
                   return (
                     <View style={{ backgroundColor: 'rgba(212,168,67,0.3)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 8 }}>
                       <Text style={{ color: colors.gold, fontSize: 10, fontWeight: 'bold' }}>{t('multi_dubbed')}</Text>
                     </View>
                   );
                 }
                 return null;
              })()}
            </View>
          </View>

          {/* Bottom bar */}
          <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom + 12, 24) }]} pointerEvents="box-none">
            {isLive ? (
              <View style={[styles.liveRow, { marginBottom: 16 }]} pointerEvents="none">
                <View style={styles.liveBadge}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveBadgeText}>{t('live')}</Text>
                </View>
                <View style={styles.liveInfo}>
                  <Text style={styles.liveChannel} numberOfLines={1}>{title}</Text>
                </View>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 24, paddingHorizontal: 20 }} pointerEvents="box-none">
                <Text style={styles.timeText}>{formatTime(currentTime)}</Text>

                {/* Seek bar - has its own PanResponder, must NOT be box-none */}
                <View
                  style={[styles.seekBarContainer, { flex: 1, marginTop: 0 }]}
                  onLayout={(e) => { seekBarWidth.current = e.nativeEvent.layout.width; }}
                  {...seekBarPan.panHandlers}
                >
                  <View style={styles.seekBarTrack} pointerEvents="none">
                    <View style={[styles.seekBarFill, { width: `${progress * 100}%`, backgroundColor: colors.gold }]} />
                  </View>
                  <View
                    style={[
                      styles.seekThumb,
                      {
                        left: `${progress * 100}%`,
                        transform: [{ translateX: -8 }],
                        backgroundColor: colors.gold,
                        shadowColor: colors.gold,
                      },
                    ]}
                    pointerEvents="none"
                  />
                </View>

                <Text style={styles.timeText}>{formatTime(duration)}</Text>
              </View>
            )}

            {/* Bottom Actions Row: Play Controls & Indicators */}
            <View style={{ flexDirection: isSmallScreen ? 'column' : 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, gap: isSmallScreen ? 16 : 0, paddingBottom: isSmallScreen ? 16 : 0 }} pointerEvents="box-none">
              
              {/* Spacer on the left to balance the indicators on the right so center is perfectly centered */}
              {!isSmallScreen && <View style={{ flex: 1 }} pointerEvents="none" />}

              <View style={{ flexDirection: 'row', gap: isSmallScreen ? 16 : 24, alignItems: 'center', justifyContent: 'center', width: isSmallScreen ? '100%' : undefined }} pointerEvents="box-none">
                <TVFocusable 
                  style={({ focused }: any) => [
                    styles.iconBtn, 
                    !hasPrev && { opacity: 0.3 },
                    focused && { transform: [{ scale: 1.1 }], backgroundColor: colors.gold, borderWidth: 3, borderColor: '#FFF' }
                  ]}
                  onPress={handlePrevChannel}
                  disabled={!hasPrev}
                >
                  {({ focused }: any) => (
                    <Lineicons icon={PreviousStep2Bulk} size={20} color={focused ? "#0A0A0A" : "#FFF"} />
                  )}
                </TVFocusable>

                {!isLive && (
                  <TVFocusable 
                    style={({ focused }: any) => [
                      styles.iconBtn,
                      focused && { transform: [{ scale: 1.1 }], backgroundColor: colors.gold, borderWidth: 3, borderColor: '#FFF' }
                    ]} 
                    onPress={() => handleSeekBy(-30)}
                  >
                    {({ focused }: any) => (
                      <MaterialCommunityIcons name="rewind-30" size={24} color={focused ? "#0A0A0A" : "#FFF"} />
                    )}
                  </TVFocusable>
                )}

                <TVFocusable 
                  style={({ focused }: any) => [
                    styles.playBtn,
                    isSmallScreen && { width: 56, height: 56, borderRadius: 28 },
                    focused && { transform: [{ scale: 1.1 }], backgroundColor: colors.gold, borderWidth: 3, borderColor: '#FFF', shadowColor: colors.gold, shadowOpacity: 0.8, shadowRadius: 10 }
                  ]} 
                  onPress={togglePlay}
                  focusable={true}
                  hasTVPreferredFocus={true}
                >
                  {({ focused }: any) => (
                    <Lineicons icon={isPlaying  ? PauseBulk : PlayBulk} size={isSmallScreen ? 24 : 32} color={focused ? "#0A0A0A" : "#FFF"} />
                  )}
                </TVFocusable>

                {!isLive && (
                  <TVFocusable 
                    style={({ focused }: any) => [
                      styles.iconBtn,
                      focused && { transform: [{ scale: 1.1 }], backgroundColor: colors.gold, borderWidth: 3, borderColor: '#FFF' }
                    ]} 
                    onPress={() => handleSeekBy(30)}
                  >
                    {({ focused }: any) => (
                      <MaterialCommunityIcons name="fast-forward-30" size={24} color={focused ? "#0A0A0A" : "#FFF"} />
                    )}
                  </TVFocusable>
                )}
                
                <TVFocusable 
                  style={({ focused }: any) => [
                    styles.iconBtn, 
                    !hasNext && { opacity: 0.3 },
                    focused && { transform: [{ scale: 1.1 }], backgroundColor: colors.gold, borderWidth: 3, borderColor: '#FFF' }
                  ]}
                  onPress={handleNextChannel}
                  disabled={!hasNext}
                >
                  {({ focused }: any) => (
                    <Lineicons icon={NextStep2Bulk} size={20} color={focused ? "#0A0A0A" : "#FFF"} />
                  )}
                </TVFocusable>
              </View>

              <View style={{ flex: isSmallScreen ? undefined : 1, width: isSmallScreen ? '100%' : undefined, flexDirection: 'row', gap: 16, justifyContent: isSmallScreen ? 'center' : 'flex-end' }} pointerEvents="box-none">
                <TVFocusable 
                  style={({ focused }: any) => [
                    styles.aspectBtn,
                    focused && { transform: [{ scale: 1.1 }], backgroundColor: colors.gold, borderColor: '#FFF' }
                  ]} 
                  onPress={toggleAspectMode}
                >
                  {({ focused }: any) => (
                    <Text style={[styles.aspectBtnText, focused && { color: '#0A0A0A' }]}>
                      {aspectMode === 0 ? 'FIT' : aspectMode === 1 ? 'FILL' : aspectMode === 2 ? 'STRETCH' : '4:3'}
                    </Text>
                  )}
                </TVFocusable>
                
                <TVFocusable 
                  style={({ focused }: any) => [
                    styles.iconBtn,
                    focused && { transform: [{ scale: 1.1 }], backgroundColor: colors.gold, borderWidth: 3, borderColor: '#FFF' }
                  ]} 
                  onPress={toggleSubtitles}
                >
                  {({ focused }: any) => (
                    <Lineicons icon={Message2Bulk} size={20} color={focused ? "#0A0A0A" : "#FFF"} />
                  )}
                </TVFocusable>

                <TVFocusable 
                  style={({ focused }: any) => [
                    styles.iconBtn,
                    focused && { transform: [{ scale: 1.1 }], backgroundColor: colors.gold, borderWidth: 3, borderColor: '#FFF' }
                  ]} 
                  onPress={toggleMute}
                >
                  {({ focused }: any) => (
                    <Ionicons name={isMuted ? "volume-mute" : "volume-high"} size={20} color={focused ? "#0A0A0A" : (isMuted ? '#E53935' : '#FFF')} />
                  )}
                </TVFocusable>

                <TVFocusable 
                  style={({ focused }: any) => [
                    styles.iconBtn,
                    focused && { transform: [{ scale: 1.1 }], backgroundColor: colors.gold, borderWidth: 3, borderColor: '#FFF' }
                  ]} 
                  onPress={handleToggleFavorite}
                >
                  {({ focused }: any) => (
                    <Lineicons icon={HeartBulk} size={20} color={focused ? "#0A0A0A" : (isFavorite ? '#E53935' : '#FFF')} fill={isFavorite ? '#E53935' : 'transparent'} />
                  )}
                </TVFocusable>


              </View>

            </View>
          </View>
          
          {/* Volume Slider on Right Edge */}
          {Math.min(W, H) >= 600 && (
            <View 
              style={{ 
                position: 'absolute', right: 30, top: '50%', transform: [{ translateY: -100 }],
                width: 44, height: 200, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 22,
                alignItems: 'center', paddingVertical: 16, justifyContent: 'flex-end',
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)'
              }}
              {...volumePan.panHandlers}
            >
              <View style={{ width: 6, height: 120, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 3 }}>
                 <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${volume * 100}%`, backgroundColor: colors.gold, borderRadius: 3 }} />
              </View>
              <TVFocusable onPress={toggleMute} style={{ marginTop: 16 }} disableBorder>
                <Lineicons icon={isMuted || volume === 0 ? VolumeMuteBulk : volume > 0.5 ? VolumeHighBulk : VolumeLowBulk} size={20} color={isMuted ? "#E53935" : "#FFF"} />
              </TVFocusable>
            </View>
          )}
        </Animated.View>
      )}

      {/* ── Layer 5: Error toast (slides in from top, auto-dismisses) ── */}
      {errorToastVisible && (
        <Animated.View
          style={[
            styles.errorToast,
            {
              opacity: errorToastOpacity,
              transform: [{ translateY: errorToastY }],
              top: Platform.OS === 'ios' ? insets.top + 16 : 32,
            },
          ]}
          pointerEvents="none"
        >
          <View style={styles.errorToastIconBg}>
            <Lineicons icon={Ban2Bulk} size={20} color="#FFF" />
          </View>
          <View style={styles.errorToastTextBlock}>
            <Text style={styles.errorToastTitle}>{t('connection_issue')}</Text>
            <Text style={styles.errorToastSub}>{t('reconnecting')}</Text>
          </View>
        </Animated.View>
      )}

      {/* ── Layer 6: Resume Prompt Overlay ── */}
      {promptVisible && (
        <View style={styles.promptOverlay} pointerEvents="auto">
           <Text style={styles.promptTitle}>{t('resume_playback')}</Text>
           <Text style={styles.promptSub}>You previously stopped at {formatTime(matchedWatched?.progress || 0)}</Text>
           <View style={styles.promptButtons}>
             <TVFocusable 
               style={({ focused }: any) => [styles.promptBtn, focused && [styles.promptBtnFocused, { backgroundColor: colors.gold, borderColor: '#FFF' }]]}
               onPress={handleResume}
               hasTVPreferredFocus={true}
               focusable={true}
             >
                {({ focused }: any) => (
                  <Text style={[styles.promptBtnText, focused && styles.promptBtnTextFocused]}>
                    Resume ({formatTime(matchedWatched?.progress || 0)})
                  </Text>
                )}
             </TVFocusable>

             <TVFocusable 
               style={({ focused }: any) => [styles.promptBtn, focused && [styles.promptBtnFocused, { backgroundColor: colors.gold, borderColor: '#FFF' }]]}
               onPress={handleStartOver}
               focusable={true}
             >
                {({ focused }: any) => (
                  <Text style={[styles.promptBtnText, focused && styles.promptBtnTextFocused]}>
                    Start from beginning
                  </Text>
                )}
             </TVFocusable>
           </View>
        </View>
      )}
      {/* ── Layer 7: Tracks Selection Modal ── */}
      {showTracksModal && (() => {
        let modalAudioTracks = Platform.OS === 'web' 
          ? audioTracks.map((t: any) => ({ ...t, title: t.title || t.language || 'Track' }))
          : (player?.availableAudioTracks || []).map((t: any, i: number) => ({ id: t.id ?? `native_audio_${i}`, title: t.label || t.language || 'Track', language: t.language, _native: t }));
        modalAudioTracks = modalAudioTracks.filter((t: any, index: number, self: any[]) => 
          index === self.findIndex((x) => (x.title === t.title && x.language === t.language))
        );
          
        let modalSubtitleTracks = Platform.OS === 'web'
          ? subtitleTracks.map((t: any) => ({ ...t, title: t.title || t.language || 'Subtitle' }))
          : (player?.availableSubtitleTracks || []).map((t: any, i: number) => ({ id: t.id ?? `native_sub_${i}`, title: t.label || t.language || 'Subtitle', language: t.language, _native: t }));
        modalSubtitleTracks = modalSubtitleTracks.filter((t: any, index: number, self: any[]) => 
          index === self.findIndex((x) => (x.title === t.title && x.language === t.language))
        );

        const activeAudioId = Platform.OS === 'web' ? selectedAudio : (player?.audioTrack ? (player.audioTrack.id || player.audioTrack.language || player.audioTrack.label) : null);
        const activeSubtitleId = Platform.OS === 'web' ? selectedSubtitle : (player?.subtitleTrack ? (player.subtitleTrack.id || player.subtitleTrack.language || player.subtitleTrack.label) : null);

        return (
        <View style={styles.modalOverlay} pointerEvents="auto">
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('audio_and_subtitles') || 'Audio & Subtitles'}</Text>
            
            <View style={styles.tracksContainer}>
              <View style={styles.trackColumn}>
                <Text style={styles.trackColTitle}>{t('audio_tracks') || 'Audio Tracks'}</Text>
                <ScrollView style={{ maxHeight: 300 }}>
                  {modalAudioTracks.length === 0 && (
                    <Text style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: 20 }}>No tracks found</Text>
                  )}
                  {modalAudioTracks.map((track: any) => {
                    const isSelected = Platform.OS === 'web' ? selectedAudio === track.id : (activeAudioId === track.id || (player?.audioTrack === track._native));
                    return (
                      <TVFocusable
                        key={`audio-${track.id}`}
                        style={({ focused }: any) => [styles.trackBtn, isSelected && styles.trackBtnActive, focused && { borderColor: '#FFF' }]}
                        onPress={() => {
                          if (Platform.OS === 'web') {
                            setSelectedAudio(track.id);
                          } else if (player && track._native) {
                            player.audioTrack = track._native;
                          }
                          setShowTracksModal(false);
                        }}
                        hasTVPreferredFocus={isSelected || (!activeAudioId && modalAudioTracks.indexOf(track) === 0)}
                      >
                        <Text style={[styles.trackBtnText, isSelected && styles.trackBtnTextActive]}>
                          {track.title}
                        </Text>
                      </TVFocusable>
                    );
                  })}
                </ScrollView>
              </View>

              <View style={styles.trackColumn}>
                <Text style={styles.trackColTitle}>{t('subtitles') || 'Subtitles'}</Text>
                <ScrollView style={{ maxHeight: 300 }}>
                  <TVFocusable
                    style={({ focused }: any) => [styles.trackBtn, !activeSubtitleId && styles.trackBtnActive, focused && { borderColor: '#FFF' }]}
                    onPress={() => {
                       if (Platform.OS === 'web') {
                         setSelectedSubtitle(null);
                       } else if (player) {
                         player.subtitleTrack = null;
                       }
                       setShowTracksModal(false);
                    }}
                  >
                    <Text style={[styles.trackBtnText, !activeSubtitleId && styles.trackBtnTextActive]}>
                      Off
                    </Text>
                  </TVFocusable>
                  {modalSubtitleTracks.map((track: any) => {
                    const isSelected = Platform.OS === 'web' ? selectedSubtitle === track.id : (activeSubtitleId === track.id || (player?.subtitleTrack === track._native));
                    return (
                      <TVFocusable
                        key={`sub-${track.id}`}
                        style={({ focused }: any) => [styles.trackBtn, isSelected && styles.trackBtnActive, focused && { borderColor: '#FFF' }]}
                        onPress={() => {
                          if (Platform.OS === 'web') {
                            setSelectedSubtitle(track.id);
                          } else if (player && track._native) {
                            player.subtitleTrack = track._native;
                          }
                          setShowTracksModal(false);
                        }}
                        hasTVPreferredFocus={isSelected}
                      >
                        <Text style={[styles.trackBtnText, isSelected && styles.trackBtnTextActive]}>
                          {track.title}
                        </Text>
                      </TVFocusable>
                    );
                  })}
                </ScrollView>
              </View>
            </View>
            
            <TVFocusable
              style={({ focused }: any) => [styles.retryBtn, { marginTop: 24, alignSelf: 'center' }, focused && { borderColor: '#FFF', borderWidth: 2 }]}
              onPress={() => setShowTracksModal(false)}
            >
              <Text style={styles.retryText}>{t('close') || 'Close'}</Text>
            </TVFocusable>
          </View>
        </View>
        );
      })()}

      {/* ── Layer 8: Subtitles Overlay (Top-most level so it's always visible over video/tap areas) ── */}
      {currentSubtitle ? (
        <View style={{
          position: 'absolute',
          bottom: '12%',
          left: 0,
          right: 0,
          alignItems: 'center',
          pointerEvents: 'none',
          zIndex: 99999
        }}>
          <Text style={{
            color: 'white',
            backgroundColor: 'rgba(0,0,0,0.6)',
            paddingHorizontal: 16,
            paddingVertical: 6,
            borderRadius: 6,
            fontSize: 26,
            textAlign: 'center',
            textShadowColor: 'black',
            textShadowOffset: { width: 1, height: 1 },
            textShadowRadius: 3,
            fontWeight: '600'
          }}>
            {currentSubtitle}
          </Text>
        </View>
      ) : null}

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  bufferingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  promptOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  promptTitle: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  promptSub: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    marginBottom: 32,
  },
  promptButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
  },
  promptBtn: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  promptBtnFocused: {
    backgroundColor: '#D4A843',
    borderColor: '#FFF',
    transform: [{ scale: 1.05 }],
  },
  promptBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  promptBtnTextFocused: {
    color: '#0A0A0A',
  },
  topGradient: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 160,
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: 200,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
  },
  iconBtn: {
    width: 40, height: 40,
    borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  aspectBtn: {
    paddingHorizontal: 12, height: 40,
    borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 2, borderColor: 'transparent'
  },
  aspectBtnText: {
    color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: 'bold'
  },
  titleBlock: { flex: 1 },
  titleText: { color: '#FFF', fontSize: 17, fontWeight: 'bold' },
  subtitleText: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 },
  topActions: { flexDirection: 'row', gap: 8 },
  centerRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 40,
  },
  centerBtn: { alignItems: 'center', gap: 2 },
  seekLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: 'bold' },
  playBtn: {
    width: 76, height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  volumeSliderWrapper: {
    position: 'absolute',
    alignItems: 'center',
    gap: 4,
    height: 140,
    justifyContent: 'flex-end',
  },
  volumeTrack: {
    width: 4, height: 120,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  volumeFill: {
    width: '100%',
    backgroundColor: '#D4A843',
    borderRadius: 2,
  },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E53935',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  liveDot: {
    width: 6, height: 6,
    borderRadius: 3,
    backgroundColor: '#FFF',
  },
  liveBadgeText: { color: '#FFF', fontWeight: 'bold', fontSize: 11, letterSpacing: 1 },
  liveInfo: { flex: 1 },
  liveChannel: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  liveProgram: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 },
  vodBar: { gap: 10 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  timeText: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600' },
  seekBarContainer: {
    height: 36,
    justifyContent: 'center',
    position: 'relative',
  },
  seekBarTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  seekBarFill: {
    height: '100%',
    backgroundColor: '#D4A843',
    borderRadius: 2,
  },
  seekThumb: {
    position: 'absolute',
    top: '50%',
    width: 18, height: 18,
    borderRadius: 9,
    backgroundColor: '#D4A843',
    marginTop: -9,
    shadowColor: '#D4A843',
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
  errorToast: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(20,20,20,0.95)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(229,57,53,0.5)',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 999,
  },
  errorToastIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#E53935',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorToastTextBlock: { flex: 1 },
  errorToastTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: 'bold',
    writingDirection: 'rtl',
  },
  errorToastSub: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    marginTop: 2,
    writingDirection: 'rtl',
  },
  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 24, paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#D4A843',
  },
  retryText: { color: '#1A1A1A', fontWeight: 'bold' },
  errorTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 200,
  },
  modalContent: {
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxWidth: 600,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  tracksContainer: {
    flexDirection: 'row',
    gap: 32,
  },
  trackColumn: {
    flex: 1,
  },
  trackColTitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  trackBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  trackBtnActive: {
    backgroundColor: 'rgba(212,168,67,0.15)',
    borderColor: '#D4A843',
  },
  trackBtnText: {
    color: '#FFF',
    fontSize: 14,
    textAlign: 'center',
  },
  trackBtnTextActive: {
    color: '#D4A843',
    fontWeight: 'bold',
  },
  hudContainer: {
    position: 'absolute',
    top: '18%',
    alignSelf: 'center',
    backgroundColor: 'rgba(15, 20, 30, 0.88)',
    borderRadius: 20,
    paddingHorizontal: 28,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(244, 197, 66, 0.4)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 20,
    zIndex: 9999,
    minWidth: 140,
    gap: 8,
  },
  hudText: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  hudSubText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    textAlign: 'center',
  },
});

