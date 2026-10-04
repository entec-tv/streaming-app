import { create } from 'zustand';
import { Platform, Dimensions } from 'react-native';
import AsyncStorageOriginal from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

import { readCacheString, writeCacheString, deleteCache } from '../lib/storage';
import { createEventSource } from '../lib/event-source';
import { networkManager } from '../lib/network';

const isLargeDataKey = (key: string) => key.startsWith('channels_') || key.startsWith('categories_') || key.startsWith('search_index_');

const AsyncStorage = {
  getItem: async (key: string) => {
    if (Platform.OS === 'web') return await readCacheString(key);
    if (isLargeDataKey(key)) return await readCacheString(key);
    return await AsyncStorageOriginal.getItem(key);
  },
  setItem: async (key: string, value: string) => {
    if (Platform.OS === 'web') return await writeCacheString(key, value);
    if (isLargeDataKey(key)) return await writeCacheString(key, value);
    return await AsyncStorageOriginal.setItem(key, value);
  },
  removeItem: async (key: string) => {
    if (Platform.OS === 'web') return await deleteCache(key);
    if (isLargeDataKey(key)) return await deleteCache(key);
    return await AsyncStorageOriginal.removeItem(key);
  }
};

let globalSearchIndex: Channel[] = [];
const globalChannelsCache = new Map<string, { data: Channel[], timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000;
import Constants from 'expo-constants';
import { Channel, Playlist } from '../types';
import { MOCK_PLAYLISTS, MOCK_CHANNELS, MOCK_MOVIES, MOCK_SERIES } from '../lib/mock-data';
import { parseM3U } from '../lib/m3u-parser';
import { base64Decode, base64Encode, decodeIfNeeded } from '../lib/base64';
import { getOrCreateDeviceData } from '../utils/device';

export interface PlaylistCategories {
  live: { id: string; name: string; count?: number }[];
  vod: { id: string; name: string; count?: number }[];
  series: { id: string; name: string; count?: number }[];
}

export interface CategoryCountsData {
  live: Record<string, number>;
  vod: Record<string, number>;
  series: Record<string, number>;
  totals: {
    live: number;
    vod: number;
    series: number;
  };
}

export interface CategoryPreferences {
  hiddenIds: string[];
  liveOrder: string[];
  vodOrder: string[];
  seriesOrder: string[];
}

export interface GlobalToastData {
  title: string;
  message: string;
  type?: 'info' | 'success' | 'warning';
}

export interface WatchedItem {
  id: string;
  type: 'vod' | 'series' | 'live';
  title: string;
  poster: string;
  backdrop: string;
  streamUrl: string;
  progress: number;
  duration: number;
  timestamp: number;
  quality?: string;
  genres?: string[];
  description?: string;
  category?: string;
}

interface AppState {
  deviceId: string;
  deviceKey: string;
  categoryPreferences: Record<string, CategoryPreferences>;
  updateCategoryPreferences: (playlistId: string, prefs: Partial<CategoryPreferences>) => void;
  lazyLoadContent: boolean;
  setLazyLoadContent: (val: boolean) => void;
  autoPlayOnStartup: boolean;
  setAutoPlayOnStartup: (val: boolean) => void;
  currentThemeId: string;
  setTheme: (id: string) => void;
  lastWatchedChannel: any | null;
  setLastWatchedChannel: (channel: any) => void;
  isLoggedIn: boolean;
  user: any | null;
  appExpiry: string | null;
  login: (token: string, customer?: any) => void;
  logout: () => void;
  setupSseConnection: () => void;
  globalToast: GlobalToastData | null;
  showToast: (title: string, message: string, type?: 'info' | 'success' | 'warning') => void;
  hideToast: () => void;
  refreshCounter: number;
  isNetworkOnline: boolean;
  setIsNetworkOnline: (status: boolean) => void;

  parentalPin: string | null;
  setParentalPin: (pin: string | null) => void;
  unlockedCategories: string[];
  unlockCategory: (categoryName: string) => void;
  lockAllCategories: () => void;
  isParentalLocked: (categoryName: string) => boolean;

  lockedChannels: string[];
  unlockedChannels: string[];
  toggleChannelLock: (id: string) => void;
  unlockChannel: (id: string) => void;
  isChannelLocked: (id: string) => boolean;

  activePlaylistId: string;
  appIsReady: boolean;
  playlists: Playlist[];
  playlistChannels: Record<string, Channel[]>;
  activeCategories: PlaylistCategories | null;
  channels: Channel[];
  loadingChannels: boolean;
  subscriptionExpired: boolean;
  setSubscriptionExpired: (expired: boolean) => void;
  isTrialActive: boolean;
  trialDaysRemaining: number;
  trialHoursRemaining: number;
  trialEndsAt: string | null;
  serverTime: string | null;
  serverTimeOffset: number;
  getServerTime: () => Date;
  isAppLocked: boolean;
  setAppLocked: (locked: boolean) => void;
  isFullscreen: boolean;
  setIsFullscreen: (full: boolean) => void;

  loadingSearchIndex: boolean;
  searchIndexReady: boolean;
  searchIndexProgress: string;
  categoryCounts: CategoryCountsData;
  updateCategoryCount: (type: 'live' | 'vod' | 'series', categoryId: string, count: number, categoryName?: string) => void;
  computeAndSetCategoryCounts: (items: Channel[]) => void;
  loadSearchIndex: (playlistId: string) => Promise<void>;
  buildSearchIndex: (playlistId: string, onProgress?: (msg: string) => void) => Promise<void>;
  searchChannels: (query: string, typeFilter?: string, limit?: number) => Promise<Channel[]>;
  getSearchSuggestions: (query: string) => Promise<string[]>;
  getChannelsByType: (type: 'live' | 'vod' | 'series') => Promise<Channel[]>;
  
  cachedHomeContent: {
    playlistId: string | null;
    rows: any[];
    featured: any[];
  } | null;
  setCachedHomeContent: (playlistId: string, rows: any[], featured: any[]) => void;
  
  addPlaylist: (
    playlist: Playlist, 
    channels?: Channel[], 
    categories?: PlaylistCategories | null
  ) => Promise<void>;
  deletePlaylist: (id: string) => Promise<void>;
  setActivePlaylist: (id: string) => Promise<void>;
  refreshPlaylist: (id: string) => Promise<void>;
  loadPlaylistFromUrl: (
    playlistId: string,
    url: string,
    onProgress?: (msg: string) => void
  ) => Promise<{ channels: number, expireText?: string }>;
  loadChannelsForCategory: (
    playlistId: string,
    type: 'live' | 'vod' | 'series',
    categoryId: string,
    categoryName: string
  ) => Promise<void>;
  getChannelsForCategory: (
    playlistId: string,
    type: 'live' | 'vod' | 'series',
    categoryId: string,
    categoryName: string
  ) => Promise<Channel[]>;

  getActiveChannels: (type: 'live' | 'vod' | 'series') => Channel[];

  playbackQueue: Channel[];
  playbackIndex: number;
  setPlaybackQueue: (queue: Channel[], index: number) => void;
  setPlaybackIndex: (index: number) => void;

  globalShowTour: boolean;
  setGlobalShowTour: (show: boolean) => void;

  favorites: string[];
  favoriteItems: Channel[];
  toggleFavorite: (item: Channel) => void;
  globalAlert: { 
    title: string; 
    message: string; 
    buttonText: string; 
    onPress: () => void; 
    secondaryButton?: { text: string; onPress: () => void; color?: string; icon?: string; }
  } | null;
  showGlobalAlert: (
    title: string, 
    message: string, 
    buttonText: string, 
    onPress: () => void,
    secondaryButton?: { text: string; onPress: () => void; color?: string; icon?: string; }
  ) => void;
  hideGlobalAlert: () => void;

  settings: {
    quality: 'Auto' | '4K' | '1080p' | '720p';
    forceHttp: boolean;
    notifications: boolean;
    parentalControl: boolean;
    liveTvPlayer: 'android' | 'exo';
    vodPlayer: 'android' | 'exo';
    autoBoot: boolean;
    language: 'en' | 'ar';
  };
  updateSettings: (s: Partial<AppState['settings']>) => void;
  setLanguage: (lang: 'en' | 'ar') => void;

  moreOptions: {
    streamUrlRedirectionCheck: boolean;
    liveTvEpg: boolean;
    useExtensionInStreamUrl: boolean;
    useM3uFormatInStreamUrl: boolean;
    useRuntimeFunctionInMovies: boolean;
    useRuntimeFunctionInSeries: boolean;
    useUtf8Decode: boolean;
  };
  updateMoreOptions: (opts: Partial<AppState['moreOptions']>) => void;

  continueWatching: WatchedItem[];
  updateContinueWatching: (item: WatchedItem) => void;
  removeFromContinueWatching: (id: string) => void;

  downloads: DownloadItem[];
  addDownload: (item: DownloadItem) => void;
  removeDownload: (id: string) => void;
  updateDownloadItem: (id: string, updates: Partial<DownloadItem>) => void;
  startDownload: (item: Omit<DownloadItem, 'status' | 'progress' | 'resumeData' | 'localUri'>) => Promise<void>;
  pauseDownload: (id: string) => Promise<void>;
  resumeDownload: (id: string) => Promise<void>;
  cancelDownload: (id: string) => Promise<void>;

  clearAppCache: () => Promise<void>;
  
  initializeFromStorage: () => Promise<void>;
  checkAuthStatus: (options?: { forceReload?: boolean }) => Promise<void>;
  sendHeartbeatPing: () => Promise<void>;
  isPlayerOpen: boolean;
  setIsPlayerOpen: (isOpen: boolean) => void;
  lastNonPlayerOrientation: 'portrait' | 'landscape';
  setLastNonPlayerOrientation: (orientation: 'portrait' | 'landscape') => void;

  syncAdminSubscriptions: (subscriptions: { id: string; host: string; username: string; password: string; name: string }[], options?: { forceReload?: boolean }) => Promise<void>;
  syncM3uPlaylists: (playlists: { name: string; url: string }[]) => Promise<void>;
  preloadFullPlaylistContent: (playlistId: string, onProgress?: (percent: number, message: string) => void) => Promise<boolean>;
}

export interface DownloadItem {
  id: string;
  title: string;
  poster: string;
  backdrop: string;
  quality: string;
  streamUrl: string;
  localUri: string;
  type: 'movie' | 'series';
  status: 'downloading' | 'paused' | 'completed' | 'error';
  progress: number;
  resumeData?: string;
}

const activeDownloads: Record<string, FileSystem.DownloadResumable> = {};

const USER_AGENTS = [
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  'Kodi/20.2 (Linux; Android 13) ExoPlayerLib/2.18.1',
  'VLC/3.0.18 LibVLC/3.0.18',
  'TiviMate/4.7.0',
];

const fetchWithXHR = (targetUrl: string, acceptHeader?: string, timeoutMs: number = 30000): Promise<string> =>
  new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && typeof window.navigator !== 'undefined' && window.navigator.onLine === false) {
      return reject(new Error('OFFLINE'));
    }
    const xhr = new XMLHttpRequest();
    xhr.open('GET', targetUrl, true);
    xhr.timeout = timeoutMs;
    try {
      xhr.setRequestHeader('Accept', acceptHeader || 'application/json, application/x-mpegurl, */*');
      if (Platform.OS !== 'web') {
        xhr.setRequestHeader('User-Agent', 'VLC/3.0.18 LibVLC/3.0.18');
      }
    } catch (_) {}

    xhr.onload = () => {
      const body = xhr.responseText ?? '';
      if (body.trim().length > 0) {
        resolve(body);
      } else {
        const hint =
          xhr.status > 599
            ? `\n\nStatus ${xhr.status} > 599 suggests the port may be wrong or the server is not responding with HTTP.`
            : '';
        reject(new Error(`SERVER_EMPTY:${xhr.status}${hint}`));
      }
    };

    xhr.onerror = () => reject(new Error('NETWORK_ERROR'));
    xhr.ontimeout = () => reject(new Error('TIMEOUT'));
    xhr.onabort = () => reject(new Error('ABORTED'));

    xhr.send();
  });

export const useAppStore = create<AppState>((set, get) => ({
  deviceId: '',
  deviceKey: '',
  currentThemeId: 'default',
  setTheme: (id) => set({ currentThemeId: id }),
  isLoggedIn: false,

  parentalPin: null,
  setParentalPin: (pin) => {
    set({ parentalPin: pin });
    if (pin !== null) {
      AsyncStorage.setItem('parental_pin', pin).catch(console.error);
    } else {
      AsyncStorage.removeItem('parental_pin').catch(console.error);
    }
  },
  unlockedCategories: [],
  unlockCategory: (categoryName) => set((state) => {
    if (!state.unlockedCategories.includes(categoryName)) {
      return { unlockedCategories: [...state.unlockedCategories, categoryName] };
    }
    return state;
  }),
  lockAllCategories: () => set({ unlockedCategories: [], unlockedChannels: [] }),
  isParentalLocked: (categoryName) => {
    const { parentalPin, unlockedCategories } = get();
    if (!parentalPin) return false;
    if (unlockedCategories.includes(categoryName)) return false;
    
    const lowerName = categoryName.toLowerCase();
    const adultKeywords = ['adult', '18+', 'xxx', 'porn', 'for adults'];
    return adultKeywords.some(keyword => lowerName.includes(keyword));
  },

  lockedChannels: [],
  unlockedChannels: [],
  toggleChannelLock: (id) => set((state) => {
    const isLocked = state.lockedChannels.includes(id);
    const newLocked = isLocked 
      ? state.lockedChannels.filter(c => c !== id)
      : [...state.lockedChannels, id];
    
    AsyncStorage.setItem('locked_channels', JSON.stringify(newLocked)).catch(console.error);
    return { lockedChannels: newLocked };
  }),
  unlockChannel: (id) => set((state) => {
    if (!state.unlockedChannels.includes(id)) {
      return { unlockedChannels: [...state.unlockedChannels, id] };
    }
    return state;
  }),
  isChannelLocked: (id) => {
    const { parentalPin, lockedChannels, unlockedChannels } = get();
    if (!parentalPin) return false;
    if (unlockedChannels.includes(id)) return false;
    return lockedChannels.includes(id);
  },
  globalAlert: null,
  showGlobalAlert: (title, message, buttonText, onPress, secondaryButton) => set({ globalAlert: { title, message, buttonText, onPress, secondaryButton } }),
  hideGlobalAlert: () => set({ globalAlert: null }),
  user: null,
  downloads: [],

  addDownload: (item) => {
    set(state => {
      const newDownloads = [...state.downloads.filter(d => d.id !== item.id), item];
      AsyncStorage.setItem('downloads', JSON.stringify(newDownloads));
      return { downloads: newDownloads };
    });
  },

  removeDownload: (id) => {
    set(state => {
      const newDownloads = state.downloads.filter(d => d.id !== id);
      AsyncStorage.setItem('downloads', JSON.stringify(newDownloads));
      return { downloads: newDownloads };
    });
  },

  updateDownloadItem: (id, updates) => {
    set(state => {
      if (!state.downloads.some(d => d.id === id)) return state;
      const newDownloads = state.downloads.map(d => d.id === id ? { ...d, ...updates } : d);
      AsyncStorage.setItem('downloads', JSON.stringify(newDownloads));
      return { downloads: newDownloads };
    });
  },

  startDownload: async (item) => {
    const fileUri = (FileSystem as any).documentDirectory + `${item.id}.mp4`;
    const cleanStreamUrl = decodeIfNeeded(item.streamUrl);
    
    const newDownload: DownloadItem = {
      ...item,
      streamUrl: cleanStreamUrl,
      status: 'downloading',
      progress: 0,
      localUri: Platform.OS === 'web' ? '' : fileUri
    };
    get().addDownload(newDownload);

    if (Platform.OS === 'web') {
      try {
        const url = `/api/download/start?id=${encodeURIComponent(item.id)}&url=${encodeURIComponent(cleanStreamUrl)}`;
        const res = await fetch(url);
        const data = await res.json();

        // Check if download was cancelled while request was in-flight
        if (!get().downloads.some(d => d.id === item.id)) {
          fetch(`/api/download/cancel?id=${encodeURIComponent(item.id)}`).catch(() => {});
          return;
        }

        get().updateDownloadItem(item.id, { localUri: data.localUri });

        if (!(window as any).downloadPoller) {
          (window as any).downloadPoller = setInterval(async () => {
            try {
              const statRes = await fetch('/api/download/status');
              const stats = await statRes.json();
              for (const [id, info] of Object.entries(stats)) {
                if (get().downloads.some(d => d.id === id)) {
                  get().updateDownloadItem(id, info as any);
                }
              }
            } catch (e) {}
          }, 1000);
        }
      } catch (e) {
        console.error("[Web Download Error]", e);
        get().updateDownloadItem(item.id, { status: 'error' });
      }
      return;
    }

    try {
      activateKeepAwakeAsync('downloads').catch(() => {});
      const downloadResumable = FileSystem.createDownloadResumable(
        cleanStreamUrl,
        fileUri,
        { 
          headers: { 
            'User-Agent': 'VLC/3.0.18 LibVLC/3.0.18',
            'Accept': '*/*',
            'Accept-Encoding': 'identity'
          } 
        },
        (dp) => {
          const progress = dp.totalBytesWritten / dp.totalBytesExpectedToWrite;
          get().updateDownloadItem(item.id, { progress });
        }
      );
      
      activeDownloads[item.id] = downloadResumable;
      
      const result = await downloadResumable.downloadAsync();
      
      if (result) {
        get().updateDownloadItem(item.id, { status: 'completed', progress: 1 });
      } else {
        const currentItem = get().downloads.find(d => d.id === item.id);
        if (currentItem && currentItem.status !== 'paused') {
          get().updateDownloadItem(item.id, { status: 'error' });
        }
      }
    } catch (e: any) {
      console.error("[Download Error]", e);
      const currentItem = get().downloads.find(d => d.id === item.id);
      if (currentItem && currentItem.status !== 'paused') {
        get().updateDownloadItem(item.id, { status: 'error' });
      }
    } finally {
      delete activeDownloads[item.id];
      if (Object.keys(activeDownloads).length === 0) {
        deactivateKeepAwake('downloads').catch(() => {});
      }
    }
  },

  pauseDownload: async (id) => {
    if (Platform.OS === 'web') {
      try {
        await fetch(`/api/download/pause?id=${id}`);
        get().updateDownloadItem(id, { status: 'paused' });
      } catch (e) {
        console.error("Failed to pause web download", e);
      }
      return;
    }
    const resumable = activeDownloads[id];
    if (resumable) {
      try {
        const resumeData = await resumable.pauseAsync();
        const serialized = JSON.stringify(resumeData);
        get().updateDownloadItem(id, { status: 'paused', resumeData: serialized });
      } catch (e) {
        console.error("Failed to pause", e);
      }
    }
  },

  resumeDownload: async (id) => {
    const download = get().downloads.find(d => d.id === id);
    if (!download) return;

    if (Platform.OS === 'web') {
      try {
        const cleanStreamUrl = decodeIfNeeded(download.streamUrl);
        await fetch(`/api/download/resume?id=${encodeURIComponent(id)}&url=${encodeURIComponent(cleanStreamUrl)}`);
        get().updateDownloadItem(id, { status: 'downloading' });
      } catch (e) {
        console.error("Failed to resume web download", e);
      }
      return;
    }
    
    if (!download.resumeData) {
      return get().startDownload(download);
    }

    try {
      activateKeepAwakeAsync('downloads').catch(() => {});
      const parsedResumeData = JSON.parse(download.resumeData);
      const cleanStreamUrl = decodeIfNeeded(download.streamUrl);
      const downloadResumable = FileSystem.createDownloadResumable(
        cleanStreamUrl,
        download.localUri,
        { 
          headers: { 
            'User-Agent': 'VLC/3.0.18 LibVLC/3.0.18',
            'Accept': '*/*',
            'Accept-Encoding': 'identity'
          } 
        },
        (dp) => {
          const progress = dp.totalBytesWritten / dp.totalBytesExpectedToWrite;
          get().updateDownloadItem(id, { progress });
        },
        parsedResumeData.resumeData
      );

      activeDownloads[id] = downloadResumable;
      get().updateDownloadItem(id, { status: 'downloading' });
      
      const result = await downloadResumable.downloadAsync();
      
      if (result) {
        get().updateDownloadItem(id, { status: 'completed', progress: 1 });
      } else {
        const currentItem = get().downloads.find(d => d.id === id);
        if (currentItem && currentItem.status !== 'paused') {
          get().updateDownloadItem(id, { status: 'error' });
        }
      }
    } catch (e: any) {
      console.error("[Download Resume Error]", e);
      const currentItem = get().downloads.find(d => d.id === id);
      if (currentItem && currentItem.status !== 'paused') {
        get().updateDownloadItem(id, { status: 'error' });
      }
    } finally {
      delete activeDownloads[id];
      if (Object.keys(activeDownloads).length === 0) {
        deactivateKeepAwake('downloads').catch(() => {});
      }
    }
  },

  cancelDownload: async (id) => {
    const download = get().downloads.find(d => d.id === id);
    const localUri = download?.localUri || ((FileSystem as any).documentDirectory ? (FileSystem as any).documentDirectory + `${id}.mp4` : null);

    // 1. Immediately remove from local state so UI updates instantaneously
    get().removeDownload(id);

    if (Platform.OS === 'web') {
      try {
        await fetch(`/api/download/cancel?id=${encodeURIComponent(id)}`);
      } catch (e) {
        console.error("Failed to cancel web download", e);
      }
      return;
    }

    const resumable = activeDownloads[id];
    if (resumable) {
      try {
        await resumable.pauseAsync(); // Stop active download safely
      } catch (e) {}
    }
    delete activeDownloads[id];
    
    if (localUri) {
      try {
        await FileSystem.deleteAsync(localUri, { idempotent: true });
      } catch (e) {}
    }
  },

  clearAppCache: async () => {
    try {
      // 1. Clear all keys from AsyncStorage except user login if we want to keep it, 
      // but usually "Clear Cache" in these apps means a fresh start.
      const allKeys = await AsyncStorageOriginal.getAllKeys();
      // Keep 'user' and 'playlists' if you don't want the user to log out
      const keysToRemove = allKeys.filter(key => key !== 'user' && key !== 'playlists' && key !== 'activePlaylistId');
      await AsyncStorageOriginal.multiRemove(keysToRemove);

      // 2. Clear large data files from FileSystem (if any)
      if (Platform.OS !== 'web') {
        const cacheDir = (FileSystem as any).cacheDirectory;
        if (cacheDir) {
          const files = await FileSystem.readDirectoryAsync(cacheDir);
          for (const file of files) {
            await FileSystem.deleteAsync(cacheDir + file, { idempotent: true });
          }
        }
      } else {
        // Clear Web cache via Proxy API if available
        fetch('/api/cache/clear', { method: 'DELETE' }).catch(() => {});
      }

      // 3. Reset in-memory state
      globalChannelsCache.clear();
      globalSearchIndex = [];
      set({ 
        channels: [], 
        continueWatching: [], 
        favorites: [], 
        favoriteItems: [],
        searchIndexReady: false 
      });

      console.log('[Store]: App Cache cleared successfully');
    } catch (e) {
      console.error('[Store]: Failed to clear app cache', e);
    }
  },

  syncM3uPlaylists: async (playlists) => {
    let currentPlaylists = [...get().playlists];
    // Remove all existing m3u playlists (we trust the server as the source of truth)
    currentPlaylists = currentPlaylists.filter(p => !p.id.startsWith('m3u_'));
    
    // Add the new m3u playlists
    const newPlaylists = playlists.map((p, i) => ({
      id: `m3u_${Date.now()}_${i}`,
      name: p.name,
      url: p.url,
      channels: 0,
      updated: new Date().toLocaleDateString('en-US'),
      lastUpdatedTimestamp: Date.now(),
    }));
    
    currentPlaylists = [...currentPlaylists, ...newPlaylists];
    set({ playlists: currentPlaylists });
    await AsyncStorage.setItem('playlists', JSON.stringify(currentPlaylists));
  },

  syncAdminSubscriptions: async (subscriptions, options) => {
    const adminIds = subscriptions.map(s => `admin_sub_${s.id}`);
    
    let deletedAdminSubs: string[] = [];
    try {
      const stored = await AsyncStorage.getItem('deleted_admin_subs');
      if (stored) deletedAdminSubs = JSON.parse(stored);
    } catch (e) {}

    // Remove old admin subscriptions that are no longer in the list
    let currentPlaylists = [...get().playlists];
    
    // Purge demo playlists if real subscriptions are present
    if (subscriptions.length > 0) {
      const hadDemos = currentPlaylists.some(p => p.isDemo || ['p1', 'p2', 'p3'].includes(p.id) || p.url?.startsWith('demo://'));
      if (hadDemos) {
        currentPlaylists = currentPlaylists.filter(p => !p.isDemo && !['p1', 'p2', 'p3'].includes(p.id) && !p.url?.startsWith('demo://'));
      }
    }

    const oldAdminPlaylists = currentPlaylists.filter(p => p.id.startsWith('admin_sub_') && !adminIds.includes(p.id));
    let hasAnyChanges = oldAdminPlaylists.length > 0;

    for (const old of oldAdminPlaylists) {
      currentPlaylists = currentPlaylists.filter(p => p.id !== old.id);
      try {
        await AsyncStorage.removeItem(`channels_${old.id}`);
        await AsyncStorage.removeItem(`categories_${old.id}`);
      } catch(e) {}
    }
    
    let activePlaylistIdChanged = false;
    if (oldAdminPlaylists.some(p => p.id === get().activePlaylistId)) {
      activePlaylistIdChanged = true;
    }

    // Process new/updated subscriptions
    for (const sub of subscriptions) {
      const playlistId = `admin_sub_${sub.id}`;
      if (deletedAdminSubs.includes(playlistId) && !options?.forceReload) {
        continue;
      }
      const hostClean = (sub.host || '').endsWith('/') ? sub.host.slice(0, -1) : (sub.host || '');
      const credentials = JSON.stringify({ host: hostClean, username: sub.username, password: sub.password });
      const xtreamUrl = `xtream://${base64Encode(credentials)}`;
      
      const existingIndex = currentPlaylists.findIndex(p => p.id === playlistId);
      let needsUpdate = false;
      let existing = null;
      
      if (existingIndex >= 0) {
        existing = currentPlaylists[existingIndex];
        const nameChanged = sub.name && existing.name !== sub.name;
        const urlChanged = existing.url !== xtreamUrl;
        if (options?.forceReload || urlChanged || nameChanged) {
          needsUpdate = true;
        }
      } else {
        needsUpdate = true;
      }
      
      if (needsUpdate) {
        hasAnyChanges = true;
        try {
          const m3uUrl = `${hostClean}/get.php?username=${sub.username}&password=${sub.password}&type=m3u_plus&output=ts`;
          const { channels, expireText } = await get().loadPlaylistFromUrl(playlistId, m3uUrl);
          
          if (existingIndex >= 0 && existing) {
            currentPlaylists[existingIndex] = { ...existing, url: xtreamUrl, name: "admin_subscription", channels, updated: expireText || 'Active', lastUpdatedTimestamp: Date.now() };
          } else {
            currentPlaylists.push({
              id: playlistId,
              name: "admin_subscription",
              url: xtreamUrl,
              channels,
              updated: expireText || 'Active',
              lastUpdatedTimestamp: Date.now(),
            });
            if (!get().activePlaylistId || ['p1', 'p2', 'p3'].includes(get().activePlaylistId) || activePlaylistIdChanged) {
              set({ activePlaylistId: playlistId });
              activePlaylistIdChanged = false;
            }
          }
        } catch (err) {
          console.error(`Failed to sync admin playlist ${sub.name}`, err);
        }
      }
    }
    
    // Ensure active playlist is valid and not stuck on demo
    const currentActive = get().activePlaylistId;
    const isCurrentActiveInvalid = !currentActive || ['p1', 'p2', 'p3'].includes(currentActive) || !currentPlaylists.some(p => p.id === currentActive);
    
    if (isCurrentActiveInvalid && currentPlaylists.length > 0) {
      const newActiveId = currentPlaylists[0].id;
      set({ activePlaylistId: newActiveId });
      try {
        await AsyncStorage.setItem('activePlaylistId', newActiveId);
        const cachedCats = await AsyncStorage.getItem(`categories_${newActiveId}`);
        if (cachedCats) set({ activeCategories: JSON.parse(cachedCats) });
      } catch (e) {}
      hasAnyChanges = true;
    }

    // Only update state and write to disk if there were actual changes!
    if (hasAnyChanges) {
      set({ playlists: currentPlaylists });
      try {
        await AsyncStorage.setItem('playlists', JSON.stringify(currentPlaylists));
        const finalActive = get().activePlaylistId;
        if (finalActive) {
          await AsyncStorage.setItem('activePlaylistId', finalActive);
        }
      } catch(e){}
    }
  },

  categoryPreferences: {},
  updateCategoryPreferences: (playlistId, prefs) => {
    set((state) => {
      const current = state.categoryPreferences[playlistId] || { hiddenIds: [], liveOrder: [], vodOrder: [], seriesOrder: [] };
      const nextPrefs = { ...state.categoryPreferences, [playlistId]: { ...current, ...prefs } };
      AsyncStorage.setItem('categoryPreferences', JSON.stringify(nextPrefs));
      return { categoryPreferences: nextPrefs };
    });
  },

  lazyLoadContent: true,
  setLazyLoadContent: (val: boolean) => {
    set({ lazyLoadContent: val });
    AsyncStorage.setItem('lazyLoadContent', JSON.stringify(val));
  },

  autoPlayOnStartup: false,
  setAutoPlayOnStartup: (val: boolean) => {
    set({ autoPlayOnStartup: val });
    AsyncStorage.setItem('autoPlayOnStartup', JSON.stringify(val));
  },

  lastWatchedChannel: null,
  setLastWatchedChannel: (channel: any) => {
    set({ lastWatchedChannel: channel });
    AsyncStorage.setItem('lastWatchedChannel', JSON.stringify(channel));
  },

  login: (token, customer) => {
    const userData = customer ? { ...customer, token } : { token, plan: 'Premium' };
    set({ isLoggedIn: true, user: userData });
    AsyncStorage.setItem('user', JSON.stringify(userData));
  },
  logout: () => {
    console.trace('LOGOUT TRIGGERED');
    set({ isLoggedIn: false, user: null });
    AsyncStorage.removeItem('user');
  },

  activePlaylistId: '',
  playlists: [],
  playlistChannels: {},
  activeCategories: null,
  channels: [],
  loadingChannels: false,
  subscriptionExpired: false,
  setSubscriptionExpired: (expired) => set({ subscriptionExpired: expired, isAppLocked: expired }),
  isTrialActive: true,
  trialDaysRemaining: 7,
  trialHoursRemaining: 168,
  trialEndsAt: null,
  serverTime: null,
  serverTimeOffset: 0,
  getServerTime: () => new Date(Date.now() + (get().serverTimeOffset || 0)),
  isAppLocked: false,
  setAppLocked: (locked) => set({ isAppLocked: locked, subscriptionExpired: locked }),
  isFullscreen: false,
  setIsFullscreen: (full) => set({ isFullscreen: full }),

  loadingSearchIndex: false,
  searchIndexReady: false,
  searchIndexProgress: '',

  categoryCounts: {
    live: {},
    vod: {},
    series: {},
    totals: { live: 0, vod: 0, series: 0 }
  },

  updateCategoryCount: (type, categoryId, count, categoryName) => {
    set((state) => {
      const current = state.categoryCounts[type] || {};
      const updated = {
        ...current,
        [String(categoryId)]: count,
        ...(categoryName ? { [categoryName]: count } : {})
      };
      return {
        categoryCounts: {
          ...state.categoryCounts,
          [type]: updated
        }
      };
    });
  },

  computeAndSetCategoryCounts: (items) => {
    const counts: CategoryCountsData = {
      live: {},
      vod: {},
      series: {},
      totals: { live: 0, vod: 0, series: 0 }
    };
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type && counts[item.type as 'live' | 'vod' | 'series']) {
        const t = item.type as 'live' | 'vod' | 'series';
        counts.totals[t]++;
        if (item.categoryId) {
          counts[t][String(item.categoryId)] = (counts[t][String(item.categoryId)] || 0) + 1;
        }
        if (item.category) {
          counts[t][item.category] = (counts[t][item.category] || 0) + 1;
        }
      }
    }
    set({ categoryCounts: counts });
    const activeId = get().activePlaylistId;
    if (activeId) {
      AsyncStorage.setItem(`category_counts_${activeId}`, JSON.stringify(counts)).catch(() => {});
    }
  },

  cachedHomeContent: null,
  setCachedHomeContent: (playlistId, rows, featured) => {
    set({ cachedHomeContent: { playlistId, rows, featured } });
  },

  searchChannels: async (query: string, typeFilter?: string, limit: number = 200) => {
    if (!query) return [];
    const q = query.toLowerCase().trim();
    if (!q) return [];
    
    // Ensure search index is loaded if empty
    if (globalSearchIndex.length === 0) {
      const activeId = get().activePlaylistId;
      if (activeId) {
        try {
          const cachedIndex = await AsyncStorage.getItem(`search_index_${activeId}`);
          if (cachedIndex) {
            const parsed = JSON.parse(cachedIndex);
            if (Array.isArray(parsed) && parsed.length > 0) {
              globalSearchIndex = parsed;
              set({ searchIndexReady: true });
            }
          }
        } catch (e) {}

        if (globalSearchIndex.length === 0) {
          try {
            const cachedChannels = await AsyncStorage.getItem(`channels_${activeId}`);
            if (cachedChannels) {
              const parsed = JSON.parse(cachedChannels);
              if (Array.isArray(parsed) && parsed.length > 0) {
                globalSearchIndex = parsed;
                set({ searchIndexReady: true });
              }
            }
          } catch (e) {}
        }

        if (globalSearchIndex.length === 0 && get().playlistChannels[activeId]?.length > 0) {
          globalSearchIndex = get().playlistChannels[activeId];
          set({ searchIndexReady: true });
        }

        if (globalSearchIndex.length === 0 && !get().loadingSearchIndex) {
          get().loadSearchIndex(activeId).catch(() => {});
        }
      }
    }

    // Fallback to loaded memory channels if search index is still empty
    const searchSource = globalSearchIndex.length > 0 ? globalSearchIndex : (() => {
      const fallbackList: Channel[] = [];
      for (const [, cacheEntry] of globalChannelsCache.entries()) {
        for (const item of cacheEntry.data) {
          if (!fallbackList.some(r => r.id === item.id)) {
            fallbackList.push(item);
          }
        }
      }
      return fallbackList;
    })();

    const maxResults = limit || 200;

    // إذا كان هناك فلتر محدد، ابحث فقط في هذا النوع
    if (typeFilter && typeFilter !== 'all') {
      const results: Channel[] = [];
      for (const item of searchSource) {
        if (results.length >= maxResults) break;
        if (item.type !== typeFilter) continue;
        const matchName = item.name && item.name.toLowerCase().includes(q);
        const matchCategory = item.category && item.category.toLowerCase().includes(q);
        if (matchName || matchCategory) {
          results.push(item);
        }
      }
      return results;
    }
    
    // بدون فلتر: اجمع نتائج من كل نوع
    const liveResults: Channel[] = [];
    const vodResults: Channel[] = [];
    const seriesResults: Channel[] = [];
    const MAX_PER_TYPE = Math.floor(maxResults / 3);
    
    for (const item of searchSource) {
      if (liveResults.length >= MAX_PER_TYPE && 
          vodResults.length >= MAX_PER_TYPE && 
          seriesResults.length >= MAX_PER_TYPE) break;
      
      const matchName = item.name && item.name.toLowerCase().includes(q);
      const matchCategory = item.category && item.category.toLowerCase().includes(q);
      if (!matchName && !matchCategory) continue;
      
      if (item.type === 'live' && liveResults.length < MAX_PER_TYPE) {
        liveResults.push(item);
      } else if (item.type === 'vod' && vodResults.length < MAX_PER_TYPE) {
        vodResults.push(item);
      } else if (item.type === 'series' && seriesResults.length < MAX_PER_TYPE) {
        seriesResults.push(item);
      }
    }
    
    return [...liveResults, ...vodResults, ...seriesResults];
  },

  getChannelsByType: async (type: 'live' | 'vod' | 'series') => {
    if (globalSearchIndex.length === 0) {
      const activeId = get().activePlaylistId;
      if (activeId) {
        try {
          const cachedIndex = await AsyncStorage.getItem(`search_index_${activeId}`);
          if (cachedIndex) {
            const parsed = JSON.parse(cachedIndex);
            if (Array.isArray(parsed) && parsed.length > 0) {
              globalSearchIndex = parsed;
              set({ searchIndexReady: true });
            }
          }
        } catch (e) {}
      }
    }
    return globalSearchIndex.filter(c => c.type === type);
  },

  getSearchSuggestions: async (query: string) => {
    if (!query || query.trim().length === 0) return [];
    const q = query.toLowerCase();
    const suggestions = new Set<string>();
    
    for (const item of globalSearchIndex) {
      if (suggestions.size >= 6) break;
      if (item.name && item.name.toLowerCase().includes(q)) {
        // Try to return just the matching word or the whole name if it's short
        suggestions.add(item.name.split(' ').slice(0, 3).join(' ')); 
      }
    }
    return Array.from(suggestions);
  },


  continueWatching: [],
  updateContinueWatching: (item) => {
    set((state) => {
      const filtered = state.continueWatching.filter(i => i.id !== item.id && i.streamUrl !== item.streamUrl);
      const newList = [item, ...filtered].sort((a, b) => b.timestamp - a.timestamp).slice(0, 30);
      AsyncStorage.setItem('continueWatching', JSON.stringify(newList));
      return { continueWatching: newList };
    });
  },
  removeFromContinueWatching: (id) => {
    set((state) => {
      const newList = state.continueWatching.filter(i => i.id !== id);
      AsyncStorage.setItem('continueWatching', JSON.stringify(newList));
      return { continueWatching: newList };
    });
  },

  addPlaylist: async (playlist, channels, categories) => {
    const newPlaylists = [...get().playlists, playlist];
    set({ playlists: newPlaylists, activePlaylistId: playlist.id, channels: [] });
    if (categories) {
      set({ activeCategories: categories });
      await AsyncStorage.setItem(`categories_${playlist.id}`, JSON.stringify(categories));
    } else {
      try {
        const cachedCats = await AsyncStorage.getItem(`categories_${playlist.id}`);
        if (cachedCats) {
          set({ activeCategories: JSON.parse(cachedCats) });
        }
      } catch (e) {
        console.warn('Failed to load categories in addPlaylist:', e);
      }
    }
    if (channels) {
      set((s) => ({ playlistChannels: { ...s.playlistChannels, [playlist.id]: channels } }));
      await AsyncStorage.setItem(`channels_${playlist.id}`, JSON.stringify(channels));
    }
    await AsyncStorage.setItem('playlists', JSON.stringify(newPlaylists));
    await AsyncStorage.setItem('activePlaylistId', playlist.id);
  },

  deletePlaylist: async (id) => {
    const newPlaylists = get().playlists.filter((p) => p.id !== id);
    const newChannels = { ...get().playlistChannels };
    delete newChannels[id];
    
    const wasActive = get().activePlaylistId === id;
    const nextActiveId = newPlaylists[0]?.id ?? '';
    
    set({
      playlists: newPlaylists,
      playlistChannels: newChannels,
      ...(wasActive ? { activePlaylistId: nextActiveId, activeCategories: null, channels: [] } : {})
    });
    
    await AsyncStorage.setItem('playlists', JSON.stringify(newPlaylists));
    if (wasActive) {
      await AsyncStorage.setItem('activePlaylistId', nextActiveId);
    }
    
    await AsyncStorage.removeItem(`channels_${id}`);
    await AsyncStorage.removeItem(`categories_${id}`);
    await AsyncStorage.removeItem(`search_index_${id}`);
    
    if (id.startsWith('admin_sub_')) {
      try {
        const storedDeleted = await AsyncStorage.getItem('deleted_admin_subs');
        const list = storedDeleted ? JSON.parse(storedDeleted) : [];
        if (!list.includes(id)) {
          list.push(id);
          await AsyncStorage.setItem('deleted_admin_subs', JSON.stringify(list));
        }
      } catch (e) {}
    }
  },

  setActivePlaylist: async (id) => {
    set({ activePlaylistId: id, channels: [] });
    await AsyncStorage.setItem('activePlaylistId', id);
    
    if (id === 'p1' || id === 'p2' || id === 'p3') {
      const categorySet = new Set(MOCK_CHANNELS.map((c) => c.category));
      const catsList = Array.from(categorySet).filter(Boolean).map(name => ({ id: name, name }));
      const cats: PlaylistCategories = {
        live: catsList,
        vod: [],
        series: []
      };
      set({ activeCategories: cats });
    } else {
      try {
        const cachedCats = await AsyncStorage.getItem(`categories_${id}`);
        if (cachedCats) {
          set({ activeCategories: JSON.parse(cachedCats) });
        } else {
          set({ activeCategories: null });
        }
      } catch (e) {
        set({ activeCategories: null });
      }

      if (id) {
        try {
          const cachedCounts = await AsyncStorage.getItem(`category_counts_${id}`);
          if (cachedCounts) {
            set({ categoryCounts: JSON.parse(cachedCounts) });
          } else {
            const cachedSearchIdx = await AsyncStorage.getItem(`search_index_${id}`);
            if (cachedSearchIdx) {
              const parsed = JSON.parse(cachedSearchIdx);
              if (Array.isArray(parsed) && parsed.length > 0) {
                globalSearchIndex = parsed;
                set({ searchIndexReady: true });
                get().computeAndSetCategoryCounts(parsed);
              }
            }
          }
        } catch (e) {}
      }
    }
  },

  refreshPlaylist: async (id) => {
    const playlist = get().playlists.find((p) => p.id === id);
    if (!playlist || playlist.isDemo) return;
    await get().loadPlaylistFromUrl(id, playlist.url);
  },

  loadPlaylistFromUrl: async (playlistId, url, onProgress) => {
    onProgress?.('Connecting to server...');

    let getPhpMatch = url.match(/^(https?:\/\/[^/]+)\/get\.php\?username=([^&]+)&password=([^&]+)/);
    
    if (url.startsWith('xtream://')) {
      try {
        const b64 = url.replace('xtream://', '');
        const creds = JSON.parse(base64Decode(b64));
        getPhpMatch = [url, creds.host, creds.username, creds.password];
      } catch(e) {}
    }
    
    // If it is an Xtream Codes URL, try fetching via player_api.php dynamically
    // to avoid the IPTV server crashing with a 500 error on get.php.
    if (getPhpMatch) {
      const [, rawHost, username, password] = getPhpMatch;
      const host = (rawHost || '').endsWith('/') ? rawHost.slice(0, -1) : (rawHost || '');
      
      const isWeb = Platform.OS === 'web';
      const fetchJsonWithFallback = async (endpoint: string): Promise<any> => {
        const targetUrls = isWeb ? [
          `/proxy?url=${encodeURIComponent(endpoint)}`,
          endpoint,
          `https://corsproxy.io/?url=${encodeURIComponent(endpoint)}`,
          `https://api.allorigins.win/raw?url=${encodeURIComponent(endpoint)}`
        ] : [
          endpoint
        ];
        let lastErr: Error = new Error('JSON fetch failed');
        for (const u of targetUrls) {
          try {
            const resText = await fetchWithXHR(u);
            const parsed = JSON.parse(resText);
            if (parsed && (Array.isArray(parsed) || typeof parsed === 'object')) {
              return parsed;
            }
          } catch (e: any) {
            lastErr = e;
          }
        }
        throw lastErr;
      };

      try {
        console.log(`[Xtream Import] Verifying account credentials at: ${host}`);
        onProgress?.('Verifying Xtream Account Status...');
        const accountInfo = await fetchJsonWithFallback(`${host}/player_api.php?username=${username}&password=${password}&_t=${Date.now()}`);
        
        console.log('[Xtream Import] Account info response:', accountInfo);
        
        if (!accountInfo || !accountInfo.user_info || accountInfo.user_info.auth === 0) {
          throw new Error('Authentication failed: Invalid Username or Password.');
        }
        
        if (accountInfo.user_info.status !== 'Active') {
          console.log('LOGOUT TRIGGERED FROM APP-STORE.TS: status !== Active. Status was:', accountInfo.user_info.status);
          get().setSubscriptionExpired(true);
          get().logout();
          throw new Error(`Account status is: ${accountInfo.user_info.status || 'Expired or Inactive'}`);
        }

        let expireText = 'Active';
        if (accountInfo.user_info.exp_date && accountInfo.user_info.exp_date !== "null") {
          const timestamp = parseInt(accountInfo.user_info.exp_date) * 1000;
          if (!isNaN(timestamp)) {
            expireText = 'Expires: ' + new Date(timestamp).toLocaleDateString();
          }
        }

        console.log('[Xtream Import] Credentials verified. Account status active. Syncing categories...');
        onProgress?.('Fetching categories...');
        const [liveCats, vodCats, seriesCats] = await Promise.all([
          fetchJsonWithFallback(`${host}/player_api.php?username=${username}&password=${password}&action=get_live_categories&_t=${Date.now()}`).catch((err) => { console.warn('Failed get_live_categories:', err); return []; }),
          fetchJsonWithFallback(`${host}/player_api.php?username=${username}&password=${password}&action=get_vod_categories&_t=${Date.now()}`).catch((err) => { console.warn('Failed get_vod_categories:', err); return []; }),
          fetchJsonWithFallback(`${host}/player_api.php?username=${username}&password=${password}&action=get_series_categories&_t=${Date.now()}`).catch((err) => { console.warn('Failed get_series_categories:', err); return []; })
        ]);

        if (Array.isArray(liveCats) || Array.isArray(vodCats) || Array.isArray(seriesCats)) {
          onProgress?.('Processing categories...');
          
          const liveCategories = Array.isArray(liveCats)
            ? liveCats.filter((c: any) => c && c.category_id && c.category_name).map((c: any) => ({ id: String(c.category_id), name: String(c.category_name) }))
            : [];
          const vodCategories = Array.isArray(vodCats)
            ? vodCats.filter((c: any) => c && c.category_id && c.category_name).map((c: any) => ({ id: String(c.category_id), name: String(c.category_name) }))
            : [];
          const seriesCategories = Array.isArray(seriesCats)
            ? seriesCats.filter((c: any) => c && c.category_id && c.category_name).map((c: any) => ({ id: String(c.category_id), name: String(c.category_name) }))
            : [];
            
          const categoriesObj: PlaylistCategories = {
            live: liveCategories,
            vod: vodCategories,
            series: seriesCategories
          };

          console.log(`[Xtream Import] Found categories count: Live=${liveCategories.length}, Movies=${vodCategories.length}, Series=${seriesCategories.length}`);

          set({ activeCategories: categoriesObj });
          await AsyncStorage.setItem(`categories_${playlistId}`, JSON.stringify(categoriesObj));

          // If NOT lazy loading, we must fetch ALL streams now and cache them!
          if (!get().lazyLoadContent) {
            onProgress?.('Downloading all streams... This may take a while.');
            
            try {
              const [liveStreams, vodStreams, seriesStreams] = await Promise.all([
                fetchJsonWithFallback(`${host}/player_api.php?username=${username}&password=${password}&action=get_live_streams&_t=${Date.now()}`).catch(() => []),
                fetchJsonWithFallback(`${host}/player_api.php?username=${username}&password=${password}&action=get_vod_streams&_t=${Date.now()}`).catch(() => []),
                fetchJsonWithFallback(`${host}/player_api.php?username=${username}&password=${password}&action=get_series&_t=${Date.now()}`).catch(() => [])
              ]);

              onProgress?.('Processing and saving all streams locally...');
              
              // Helper to group by category and save to storage
              const saveStreamsByCategory = async (streams: any[], type: 'live' | 'vod' | 'series') => {
                if (!Array.isArray(streams)) return;
                const catMap = new Map<string, any[]>();
                for (const s of streams) {
                  const cid = String(s.category_id || 'unknown');
                  if (!catMap.has(cid)) catMap.set(cid, []);
                  catMap.get(cid)!.push(s);
                }
                for (const [cid, items] of catMap.entries()) {
                  await AsyncStorage.setItem(`channels_v4_${playlistId}_${type}_${cid}`, JSON.stringify(items));
                }
              };

              await saveStreamsByCategory(liveStreams, 'live');
              await saveStreamsByCategory(vodStreams, 'vod');
              await saveStreamsByCategory(seriesStreams, 'series');
              console.log('[Xtream Import] Downloaded and cached all streams successfully.');
            } catch (err) {
              console.warn('[Xtream Import] Failed to download all streams upfront:', err);
            }
          }

          const totalCategories = liveCategories.length + vodCategories.length + seriesCategories.length;

          set((s) => ({
            playlists: s.playlists.map((p) =>
              p.id === playlistId
                ? { ...p, channels: totalCategories, updated: expireText, lastUpdatedTimestamp: Date.now() }
                : p
            ),
          }));

          await AsyncStorage.setItem('playlists', JSON.stringify(get().playlists));

          return { channels: totalCategories, expireText };
        }
      } catch (e: any) {
        console.error('[Xtream Import] Failed to verify or fetch categories:', e);
        throw new Error(e.message || 'Failed to authenticate with Xtream Codes server.');
      }
    }

    const baseUrls: string[] = [url];

    // If Xtream get.php format, also try the /username/password/all.m3u path variant
    if (getPhpMatch) {
      const [, base, u, p] = getPhpMatch;
      baseUrls.push(`${base}/${u}/${p}/`);
      baseUrls.push(`${base}/get.php?username=${u}&password=${p}&type=m3u_plus`);
    }

    // Also try HTTPS if the original is HTTP (some servers force HTTPS)
    for (const u of [...baseUrls]) {
      if (u.startsWith('http://')) baseUrls.push(u.replace('http://', 'https://'));
    }

    // Generate the full list of URLs to try:
    // First, try all direct options (so direct works fast if it works)
    const urlsToTry: string[] = [];

    // Prioritize the local proxy in Electron, otherwise direct
    for (const u of baseUrls) {
      urlsToTry.push(`/proxy?url=${encodeURIComponent(u)}`);
      urlsToTry.push(u);
    }

    // Then, try each URL through HTTPS CORS proxies (bypass user-agent blocks and cleartext restrictions)
    for (const u of baseUrls) {
      urlsToTry.push(`https://corsproxy.io/?url=${encodeURIComponent(u)}`);
      urlsToTry.push(`https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`);
    }

    let lastError: Error = new Error('Unknown error');

    for (let i = 0; i < urlsToTry.length; i++) {
      const targetUrl = urlsToTry[i];
      
      // Inform user if we are trying fallback options
      if (i > 0) {
        const isProxy = targetUrl.includes('corsproxy.io') || targetUrl.includes('allorigins.win');
        const proxyName = targetUrl.includes('corsproxy.io') ? 'CORSProxy' : 'AllOrigins';
        onProgress?.(`Trying alternate URL (${i}/${urlsToTry.length - 1})${isProxy ? ` via ${proxyName} proxy` : ''}...`);
      }

      try {
        const text = await fetchWithXHR(targetUrl);

        if (!text.includes('#EXTM3U') && !text.includes('#EXTINF')) {
          const preview = text.substring(0, 300).trim();
          // We throw a catchable error so we can proceed with other candidate URLs (e.g. proxies)
          throw new Error(
            `INVALID_CONTENT:Server responded but did not return M3U data.\n\nServer reply:\n${preview || '(empty)'}`
          );
        }

        onProgress?.('Parsing channels...');
        const parsedChannels = parseM3U(text);

        if (parsedChannels.length === 0) {
          throw new Error('Playlist loaded but contains 0 channels. Check the URL format.');
        }

        onProgress?.('Grouping categories...');
        const liveCatsList: { id: string; name: string; count?: number }[] = [];
        const vodCatsList: { id: string; name: string; count?: number }[] = [];
        const seriesCatsList: { id: string; name: string; count?: number }[] = [];
        
        const catMap = new Map<string, Channel[]>();
        for (const ch of parsedChannels) {
          let catList = catMap.get(ch.category);
          if (!catList) {
            catList = [];
            catMap.set(ch.category, catList);
          }
          catList.push(ch);
        }
        
        for (const [catName, catChannels] of catMap.entries()) {
          const lowerName = catName.toLowerCase();
          const cid = catName;
          
          if (lowerName.includes('series') || lowerName.includes('season') || lowerName.includes('مسلسلات')) {
            seriesCatsList.push({ id: cid, name: catName, count: catChannels.length });
            await AsyncStorage.setItem(`channels_${playlistId}_series_${cid}`, JSON.stringify(catChannels));
          } else if (lowerName.includes('movie') || lowerName.includes('cinema') || lowerName.includes('films') || lowerName.includes('افلام')) {
            vodCatsList.push({ id: cid, name: catName, count: catChannels.length });
            await AsyncStorage.setItem(`channels_${playlistId}_vod_${cid}`, JSON.stringify(catChannels));
          } else {
            liveCatsList.push({ id: cid, name: catName, count: catChannels.length });
            await AsyncStorage.setItem(`channels_${playlistId}_live_${cid}`, JSON.stringify(catChannels));
          }
        }
        
        const finalCategories: PlaylistCategories = {
          live: liveCatsList,
          vod: vodCatsList,
          series: seriesCatsList,
        };
        
        set((s) => ({
          activeCategories: finalCategories,
          playlists: s.playlists.map((p) =>
            p.id === playlistId
              ? { ...p, channels: parsedChannels.length, updated: 'Just now', lastUpdatedTimestamp: Date.now() }
              : p
          ),
        }));
        
        await AsyncStorage.setItem(`categories_${playlistId}`, JSON.stringify(finalCategories));
        await AsyncStorage.setItem('playlists', JSON.stringify(get().playlists));

        return { channels: parsedChannels.length };
      } catch (err: any) {
        const msg: string = err?.message ?? '';

        if (msg.startsWith('INVALID_CONTENT:')) {
          const preview = msg.substring('INVALID_CONTENT:'.length);
          lastError = new Error(
            `Server returned non-M3U data (possibly block page, check credentials).\n\n${preview}`
          );
          continue; // try next URL variant or proxy
        }

        if (msg.startsWith('SERVER_EMPTY:')) {
          const statusStr = msg.split(':')[1]?.split('\n')[0] ?? '?';
          const hint = msg.includes('\n') ? msg.substring(msg.indexOf('\n')) : '';
          lastError = new Error(
            `Server returned empty response (status ${statusStr}).${hint}\n\n` +
            `Possible causes:\n` +
            `• Wrong username/password\n` +
            `• Subscription expired\n` +
            `• Server blocked connection (IPTV providers often block React Native User-Agent)`
          );
          continue; // try next URL variant or proxy
        }

        if (msg === 'NETWORK_ERROR') {
          lastError = new Error(
            'Could not reach the server.\n• Check the URL/host is correct\n• Check your internet connection\n• Secure connection (HTTPS) may be required'
          );
          continue;
        }

        if (msg === 'TIMEOUT') {
          lastError = new Error('Connection timed out (30s). The server is too slow or unreachable.');
          continue;
        }

        if (msg === 'ABORTED') {
          lastError = new Error('Request was cancelled.');
          break;
        }

        // If it is another parse error or something else, throw it immediately
        throw err;
      }
    }

    throw lastError;
  },

  getChannelsForCategory: async (playlistId, type, categoryId, categoryName) => {
    console.log(`[getChannelsForCategory] Called for playlistId: ${playlistId}, type: ${type}, categoryId: ${categoryId}, categoryName: ${categoryName}`);
    let effectivePlaylistId = playlistId;
    if (effectivePlaylistId === 'p1' || effectivePlaylistId === 'p2' || effectivePlaylistId === 'p3') {
      const real = get().playlists.find(p => !p.isDemo && !['p1', 'p2', 'p3'].includes(p.id) && !p.url?.startsWith('demo://'));
      if (real) {
        effectivePlaylistId = real.id;
        if (get().activePlaylistId !== real.id) {
          set({ activePlaylistId: real.id });
          AsyncStorage.setItem('activePlaylistId', real.id).catch(() => {});
        }
      } else {
        const filtered = MOCK_CHANNELS.filter(c => c.type === type && (c.category === categoryId || categoryId === 'All'));
        return filtered;
      }
    }
    
    try {
      const storageKey = `channels_v4_${effectivePlaylistId}_${type}_${categoryId}`;
      
      const memCache = globalChannelsCache.get(storageKey);
      if (memCache && (Date.now() - memCache.timestamp < CACHE_TTL) && memCache.data && memCache.data.length > 0) {
        console.log(`[getChannelsForCategory] Found in memory cache for ${storageKey}`);
        return memCache.data;
      }

      const cached = await AsyncStorage.getItem(storageKey);
      
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            globalChannelsCache.set(storageKey, { data: parsed, timestamp: Date.now() });
            console.log(`[getChannelsForCategory] Found cached channels in AsyncStorage. Count: ${parsed.length}`);
            get().updateCategoryCount(type, categoryId, parsed.length, categoryName);
            return parsed;
          }
        } catch (e) {}
      }
      
      const p = get().playlists.find(x => x.id === effectivePlaylistId);
      const isXtream = p && (p.url.startsWith('xtream://') || p.url.includes('/get.php?'));
      
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
        
        if (!config) {
          console.warn('[getChannelsForCategory] Failed to parse Xtream configuration from URL:', p.url);
          return [];
        }

        // We skip auth verify here because it was done on import and doing it on every category fetch triggers rate-limiting.
        
        let action = '';
        if (type === 'live') action = 'get_live_streams';
        else if (type === 'vod') action = 'get_vod_streams';
        else if (type === 'series') action = 'get_series';
        
        const hostClean = (config.host || '').endsWith('/') ? config.host.slice(0, -1) : (config.host || '');
        const fetchUrl = `${hostClean}/player_api.php?username=${config.username}&password=${config.password}&action=${action}&category_id=${categoryId}`;
        console.log(`[getChannelsForCategory] Fetching streams from host: ${hostClean}, url: ${fetchUrl}`);
        
        const isWeb = Platform.OS === 'web';
        const isElectron = isWeb && typeof window !== 'undefined' && (
          (window as any).process?.type === 'renderer' ||
          window.navigator?.userAgent?.includes('Electron') ||
          window.location?.hostname === 'localhost' ||
          window.location?.port === '1337'
        );

        const targetUrls: string[] = [];
        if (isElectron) {
          targetUrls.push(`/proxy?url=${encodeURIComponent(fetchUrl)}`);
          targetUrls.push(fetchUrl);
        } else if (isWeb) {
          targetUrls.push(fetchUrl);
          targetUrls.push(`https://corsproxy.io/?url=${encodeURIComponent(fetchUrl)}`);
          targetUrls.push(`https://api.allorigins.win/raw?url=${encodeURIComponent(fetchUrl)}`);
        } else {
          targetUrls.push(fetchUrl);
        }
        
        let text = '';
        let fetched = false;
        
        let lastFetchErr = new Error('Init');
        for (let i = 0; i < targetUrls.length; i++) {
          const u = targetUrls[i];
          try {
            console.log(`[getChannelsForCategory] Fetching attempt ${i + 1}/${targetUrls.length} from: ${u}`);
            text = await fetchWithXHR(u, undefined, 10000);
            console.log(`[getChannelsForCategory] Fetching succeeded from: ${u}. Response text sample (first 100 chars): ${text.substring(0, 100)}`);
            fetched = true;
            break;
          } catch (e: any) {
            lastFetchErr = e;
            console.warn(`[getChannelsForCategory] Failed fetching from ${u}: ${e.message || e}`);
          }
        }
        
        if (!fetched) {
          console.warn(`[getChannelsForCategory] All target URLs failed. Last error: ${lastFetchErr}`);
        }
        
        if (fetched) {
          const rawStreams = JSON.parse(text);
          console.log(`[getChannelsForCategory] Successfully parsed JSON. Raw streams length: ${Array.isArray(rawStreams) ? rawStreams.length : 'Not an array!'}`);
          const channelsList: Channel[] = [];
          if (Array.isArray(rawStreams)) {
            for (const item of rawStreams) {
              if (!item || !item.name) continue;
              
              let decodedName = item.name;
              if (get().moreOptions.useUtf8Decode) {
                try { decodedName = decodeURIComponent(escape(item.name)); } catch (e) {}
              }
              
              let quality: '4K' | 'FHD' | 'HD' = 'HD';
              if (decodedName.toUpperCase().includes('4K') || decodedName.toUpperCase().includes('UHD')) {
                quality = '4K';
              } else if (decodedName.toUpperCase().includes('FHD') || decodedName.toUpperCase().includes('1080')) {
                quality = 'FHD';
              }
              
              if (type === 'live' && item.stream_id) {
                const ext = get().moreOptions.useM3uFormatInStreamUrl ? '.m3u8' : (get().moreOptions.useExtensionInStreamUrl ? '.ts' : '');
                const streamUrl = `${hostClean}/live/${config.username}/${config.password}/${item.stream_id}${ext}`;
                const hasArchive = item.tv_archive === 1 || item.tv_archive === '1';
                const archiveDuration = parseInt(item.tv_archive_duration, 10) || 0;
                channelsList.push({
                  id: `xt_live_${item.stream_id}`,
                  name: decodedName,
                  logo: item.stream_icon || '',
                  category: categoryName,
                  streamUrl,
                  current: 'Live Channel',
                  next: 'Upcoming Program',
                  quality,
                  isLive: true,
                  type: 'live',
                  hasArchive,
                  archiveDuration,
                  num: item.num
                });
              } else if (type === 'vod' && item.stream_id) {
                const ext = get().moreOptions.useExtensionInStreamUrl ? `.${item.container_extension || 'mp4'}` : '';
                const streamUrl = `${hostClean}/movie/${config.username}/${config.password}/${item.stream_id}${ext}`;
                channelsList.push({
                  id: `xt_vod_${item.stream_id}`,
                  name: decodedName,
                  logo: item.stream_icon || '',
                  category: categoryName,
                  streamUrl,
                  current: 'Movie',
                  next: 'VOD',
                  quality,
                  isLive: false,
                  type: 'vod'
                });
              } else if (type === 'series' && item.series_id) {
                const streamUrl = `${hostClean}/series/${config.username}/${config.password}/${item.series_id}`;
                if (channelsList.length > 0) {
                  // Do not store in cache to prevent OOM crashes
                }
                channelsList.push({
                  id: `xt_series_${item.series_id}`,
                  name: decodedName,
                  logo: item.cover || '',
                  category: categoryName,
                  streamUrl,
                  current: item.plot || 'TV Series',
                  next: 'Episodes Available',
                  quality: 'FHD',
                  isLive: false,
                  type: 'series'
                });
              }
            }
          } else {
            console.warn('[getChannelsForCategory] rawStreams is not an array, but type is:', typeof rawStreams);
          }
          
          console.log(`[getChannelsForCategory] Processed ${channelsList.length} channels. Live fetch successful.`);
          get().updateCategoryCount(type, categoryId, channelsList.length, categoryName);
          
          // Store in disk cache only if non-empty
          if (channelsList.length > 0) {
            AsyncStorage.setItem(storageKey, JSON.stringify(channelsList)).catch(e => console.warn('Cache write failed', e));
            // Store in memory cache
            globalChannelsCache.set(storageKey, { data: channelsList, timestamp: Date.now() });
          }
          
          return channelsList;
        } else {
          console.error('[getChannelsForCategory] All target URLs failed.');
          return [];
        }
      } else {
        console.warn(`[getChannelsForCategory] Playlist not found or not an Xtream Codes type. url: ${p?.url}`);
        return [];
      }
    } catch (e: any) {
      console.error('[getChannelsForCategory] Error in getChannelsForCategory:', e);
      return [];
    }
  },

  loadChannelsForCategory: async (playlistId, type, categoryId, categoryName) => {
    set({ loadingChannels: true });
    try {
      const channelsList = await get().getChannelsForCategory(playlistId, type, categoryId, categoryName);
      set({ channels: channelsList });
    } catch (e: any) {
      console.error('[loadChannelsForCategory] Error:', e);
      set({ channels: [] });
    } finally {
      set({ loadingChannels: false });
    }
  },

  getActiveChannels: (type) => {
    const activeId = get().activePlaylistId;
    if (activeId === 'p1' || activeId === 'p2' || activeId === 'p3') {
      const real = get().playlists.find(p => !p.isDemo && !['p1', 'p2', 'p3'].includes(p.id) && !p.url?.startsWith('demo://'));
      if (!real) {
        return MOCK_CHANNELS.filter((c) => c.type === type);
      }
    }
    return get().channels.filter((c) => c.type === type);
  },

  playbackQueue: [],
  playbackIndex: 0,
  setPlaybackQueue: (queue, index) => set({ playbackQueue: queue, playbackIndex: index }),
  setPlaybackIndex: (index) => set({ playbackIndex: index }),

  globalShowTour: false,
  setGlobalShowTour: (show) => set({ globalShowTour: show }),

  favorites: [],
  favoriteItems: [],
  toggleFavorite: (item) => {
    const favs = get().favorites || [];
    const items = get().favoriteItems || [];
    const id = String(item.id || '');
    const url = item.streamUrl ? String(item.streamUrl) : '';

    const isFav = favs.some((f) => String(f) === id || (url && String(f) === url)) ||
                  items.some((x) => String(x.id) === id || (url && x.streamUrl === url));

    let newFavs: string[];
    let newItems: Channel[];
    if (isFav) {
      newFavs = favs.filter((f) => String(f) !== id && (!url || String(f) !== url));
      newItems = items.filter((x) => String(x.id) !== id && (!url || x.streamUrl !== url));
    } else {
      newFavs = [...favs.filter((f) => String(f) !== id && (!url || String(f) !== url)), id];
      newItems = [...items.filter((x) => String(x.id) !== id && (!url || x.streamUrl !== url)), item];
    }
    set({ favorites: newFavs, favoriteItems: newItems });
    AsyncStorage.setItem('favorites', JSON.stringify(newFavs));
    AsyncStorage.setItem('favoriteItems', JSON.stringify(newItems));
  },

  isPlayerOpen: false,
  setIsPlayerOpen: (isOpen) => set({ isPlayerOpen: isOpen }),
  lastNonPlayerOrientation: (() => {
    try {
      const dim = Dimensions.get('window');
      return dim.height > dim.width ? 'portrait' : 'landscape';
    } catch {
      return 'landscape';
    }
  })(),
  setLastNonPlayerOrientation: (orientation) => set({ lastNonPlayerOrientation: orientation }),

  settings: {
    quality: 'Auto',
    forceHttp: false,
    notifications: true,
    parentalControl: false,
    liveTvPlayer: 'exo',
    vodPlayer: 'exo',
    autoBoot: false,
    language: 'en',
  },
  updateSettings: (s) => set((state) => {
    const newSettings = { ...state.settings, ...s };
    AsyncStorage.setItem('settings', JSON.stringify(newSettings));
    return { settings: newSettings };
  }),

  setLanguage: (lang) => {
    set((state) => {
      const newSettings = { ...state.settings, language: lang };
      AsyncStorage.setItem('settings', JSON.stringify(newSettings));
      return { 
        settings: newSettings,
        cachedHomeContent: null,
        refreshCounter: (state.refreshCounter || 0) + 1,
      };
    });
  },

  moreOptions: {
    streamUrlRedirectionCheck: false,
    liveTvEpg: true,
    useExtensionInStreamUrl: true,
    useM3uFormatInStreamUrl: false,
    useRuntimeFunctionInMovies: false,
    useRuntimeFunctionInSeries: false,
    useUtf8Decode: false,
  },
  updateMoreOptions: (opts) => {
    set((state) => {
      const newOptions = { ...state.moreOptions, ...opts };
      AsyncStorage.setItem('moreOptions', JSON.stringify(newOptions));
      return { moreOptions: newOptions };
    });
  },

  appIsReady: false,
  appExpiry: null,
  globalToast: null,
  showToast: (title, message, type = 'info') => set({ globalToast: { title, message, type } }),
  hideToast: () => set({ globalToast: null }),
  refreshCounter: 0,
  isNetworkOnline: true,
  setIsNetworkOnline: (status) => set({ isNetworkOnline: status }),

  checkAuthStatus: async (options) => {
    try {
      const deviceData = await getOrCreateDeviceData();
      let SERVER_URL = 'https://entecstreamingnestjs-production.up.railway.app/api';

      const response = await fetch(`${SERVER_URL}/client/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ 
          macAddress: deviceData.macAddress, 
          deviceKey: deviceData.deviceKey,
          clientTime: new Date().toISOString()
        }),
      });
      
      const data = await response.json().catch(() => null);

      if (data && data.serverTime) {
        const sTime = Date.parse(data.serverTime);
        if (!isNaN(sTime)) {
          set({ serverTime: data.serverTime, serverTimeOffset: sTime - Date.now() });
        }
      }

      if (response.status === 403 && data && (data.error === 'trial_expired' || data.isAppLocked)) {
        console.log('[checkAuthStatus] App trial expired. App is locked.');
        set({ 
          isAppLocked: true, 
          subscriptionExpired: true, 
          isTrialActive: false,
          trialDaysRemaining: 0,
          trialEndsAt: data.trial?.trialEndsAt || data.trialEndsAt || null,
        });
        return;
      }

      if (response.status === 401 || response.status === 403 || response.status === 404) {
        console.log('[checkAuthStatus] User deleted or blocked. Logging out.');
        get().logout();
        set({ isAppLocked: true, subscriptionExpired: true });
      } else if (response.ok && data) {
        const trial = data.trial;
        if (trial) {
          set({
            isTrialActive: trial.isTrialActive,
            trialDaysRemaining: trial.daysRemaining ?? trial.trialDaysRemaining ?? 0,
            trialHoursRemaining: trial.hoursRemaining ?? 0,
            trialEndsAt: trial.trialEndsAt || null,
            isAppLocked: data.isAppLocked === true,
            subscriptionExpired: data.isAppLocked === true,
          });
        }

        if (data.customer && data.customer.subscriptions) {
           const currentMacSub = data.customer.subscriptions.find((s: any) => s.macAddress === deviceData.macAddress);
           if (currentMacSub && currentMacSub.appExpiry) {
             set({ appExpiry: currentMacSub.appExpiry });
           } else {
             set({ appExpiry: data.appExpiry || null });
           }
           await get().syncAdminSubscriptions(data.customer.subscriptions, options);
        }
      }
    } catch (err) {
      console.warn('[checkAuthStatus] Error checking auth status', err);
    }
  },

  sendHeartbeatPing: async () => {
    try {
      const deviceData = await getOrCreateDeviceData();
      const SERVER_URL = 'https://entecstreamingnestjs-production.up.railway.app/api';
      const response = await fetch(`${SERVER_URL}/client/ping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ 
          macAddress: deviceData.macAddress, 
          clientTime: new Date().toISOString()
        }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.serverTime) {
          const sTime = Date.parse(data.serverTime);
          if (!isNaN(sTime)) {
            set({ serverTime: data.serverTime, serverTimeOffset: sTime - Date.now() });
          }
        }
        if (data.trial) {
          set({
            isTrialActive: data.trial.isTrialActive,
            trialDaysRemaining: data.trial.daysRemaining ?? data.trial.trialDaysRemaining ?? 0,
            trialHoursRemaining: data.trial.hoursRemaining ?? 0,
            trialEndsAt: data.trial.trialEndsAt || null,
          });
        }
        if (data.isAppLocked) {
          set({ isAppLocked: true, subscriptionExpired: true, isTrialActive: false });
        }
      }
    } catch (e) {
      // Silent heartbeat ping failure
    }
  },

  initializeFromStorage: async () => {
    try {
      const storedUser = await AsyncStorage.getItem('user');
      const storedFavs = await AsyncStorage.getItem('favorites');
      const storedFavItems = await AsyncStorage.getItem('favoriteItems');
      const storedSettings = await AsyncStorage.getItem('settings');
      const storedContinueWatching = await AsyncStorage.getItem('continueWatching');
      const storedDownloads = await AsyncStorage.getItem('downloads');
      const storedCatPrefs = await AsyncStorage.getItem('categoryPreferences');
      const storedLazyLoad = await AsyncStorage.getItem('lazyLoadContent');
      const storedAutoPlay = await AsyncStorage.getItem('autoPlayOnStartup');
      const storedLastWatched = await AsyncStorage.getItem('lastWatchedChannel');
      const storedMoreOptions = await AsyncStorage.getItem('moreOptions');
      const storedParentalPin = await AsyncStorage.getItem('parental_pin');
      const storedLockedChannels = await AsyncStorage.getItem('locked_channels');

      const deviceData = await getOrCreateDeviceData();

      const updates: Partial<AppState> = {
        deviceId: deviceData.macAddress,
        deviceKey: deviceData.deviceKey,
      };

      let SERVER_URL = 'https://entecstreamingnestjs-production.up.railway.app/api';
      
      // Use live server unconditionally per user request
      // if (__DEV__) {
      //   const hostUri = Constants.expoConfig?.hostUri;
      //   if (hostUri) {
      //     const ip = hostUri.split(':')[0];
      //     SERVER_URL = `http://${ip}:3000/api`;
      //   } else {
      //     SERVER_URL = Platform.OS === 'android' ? 'http://10.0.2.2:3000/api' : 'http://localhost:3000/api';
      //   }
      // }

      let isBackendAuthorized = false;
      
      const fetchWithTimeout = (url: string, options: any = {}, timeoutMs = 10000) => {
        return Promise.race([
          fetch(url, options),
          new Promise<Response>((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), timeoutMs)
          )
        ]);
      };

      try {
        // Register Device First
        const regRes = await fetchWithTimeout(`${SERVER_URL}/client/register-device`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ macAddress: deviceData.macAddress, deviceKey: deviceData.deviceKey }),
        }, 5000);

        if (regRes.ok) {
          const regData = await regRes.json();
          if (regData.serverTime) {
            const sTime = Date.parse(regData.serverTime);
            if (!isNaN(sTime)) {
              set({ serverTime: regData.serverTime, serverTimeOffset: sTime - Date.now() });
            }
          }
          if (regData.trial) {
            set({
              isTrialActive: regData.trial.isTrialActive,
              trialDaysRemaining: regData.trial.daysRemaining ?? regData.trial.trialDaysRemaining ?? 0,
              trialHoursRemaining: regData.trial.hoursRemaining ?? 0,
              trialEndsAt: regData.trial.trialEndsAt || null,
              isAppLocked: regData.isAppLocked === true,
              subscriptionExpired: regData.isAppLocked === true,
            });
          }
        }

        const response = await fetchWithTimeout(`${SERVER_URL}/client/auth`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ 
            macAddress: deviceData.macAddress, 
            deviceKey: deviceData.deviceKey,
            clientTime: new Date().toISOString()
          }),
        }, 5000);

        const authData = await response.json().catch(() => null);

        if (authData && authData.serverTime) {
          const sTime = Date.parse(authData.serverTime);
          if (!isNaN(sTime)) {
            set({ serverTime: authData.serverTime, serverTimeOffset: sTime - Date.now() });
          }
        }

        if (response.ok && authData) {
          isBackendAuthorized = true;
          if (authData.trial) {
            set({
              isTrialActive: authData.trial.isTrialActive,
              trialDaysRemaining: authData.trial.daysRemaining ?? authData.trial.trialDaysRemaining ?? 0,
              trialHoursRemaining: authData.trial.hoursRemaining ?? 0,
              trialEndsAt: authData.trial.trialEndsAt || null,
              isAppLocked: authData.isAppLocked === true,
              subscriptionExpired: authData.isAppLocked === true,
            });
          }
        } else if (response.status === 403 && authData && (authData.error === 'trial_expired' || authData.isAppLocked)) {
          isBackendAuthorized = false;
          set({
            isAppLocked: true,
            subscriptionExpired: true,
            isTrialActive: false,
            trialDaysRemaining: 0,
            trialEndsAt: authData.trial?.trialEndsAt || authData.trialEndsAt || null,
          });
          await AsyncStorage.removeItem('user');
          await AsyncStorage.removeItem('activePlaylistId');
        } else if (response.status === 401 || response.status === 403 || response.status === 404) {
          isBackendAuthorized = false;
          set({ isAppLocked: true, subscriptionExpired: true });
          await AsyncStorage.removeItem('user');
          await AsyncStorage.removeItem('activePlaylistId');
        } else {
          isBackendAuthorized = storedUser ? true : false;
        }
      } catch (e) {
        // Network error, keep existing state
        isBackendAuthorized = storedUser ? true : false;
      }

      const safeJson = (val: string | null, fallback: any = null) => {
        if (!val || typeof val !== 'string' || !val.trim()) return fallback;
        try {
          return JSON.parse(val);
        } catch {
          return fallback;
        }
      };

      if (storedLockedChannels) updates.lockedChannels = safeJson(storedLockedChannels, []);
      if (storedFavs) updates.favorites = safeJson(storedFavs, []);
      if (storedFavItems) updates.favoriteItems = safeJson(storedFavItems, []);
      if (storedSettings) updates.settings = { ...get().settings, ...safeJson(storedSettings, {}) };
      if (storedContinueWatching) {
        const parsed = safeJson(storedContinueWatching, []);
        if (Array.isArray(parsed)) {
          updates.continueWatching = parsed.map(item => ({
            ...item,
            title: item.title || item.name || 'Unknown Title',
            poster: item.poster || item.logo || item.thumbnail || '',
            backdrop: item.backdrop || item.poster || item.logo || '',
          })).filter(item => item.id && item.streamUrl);
        }
      }
      if (storedDownloads) updates.downloads = safeJson(storedDownloads, []);
      if (storedCatPrefs) updates.categoryPreferences = safeJson(storedCatPrefs, {});
      if (storedLazyLoad !== null) updates.lazyLoadContent = safeJson(storedLazyLoad, true);
      if (storedAutoPlay !== null) updates.autoPlayOnStartup = safeJson(storedAutoPlay, false);
      if (storedLastWatched !== null) updates.lastWatchedChannel = safeJson(storedLastWatched, null);
      if (storedMoreOptions) updates.moreOptions = { ...get().moreOptions, ...safeJson(storedMoreOptions, {}) };
      if (storedParentalPin !== null) updates.parentalPin = storedParentalPin;

      set(updates as any);

      const playlistsStr = await AsyncStorage.getItem('playlists');
      let loadedPlaylists: Playlist[] = [];
      const parsedPlaylists = safeJson(playlistsStr, []);
      if (Array.isArray(parsedPlaylists) && parsedPlaylists.length > 0) {
        loadedPlaylists = parsedPlaylists
          .filter((p: any) => !p.isDemo && !p.url?.startsWith('demo://') && !['p1', 'p2', 'p3'].includes(p.id))
          .map((p: any) => p.id?.startsWith('admin_sub_') ? { ...p, name: 'admin_subscription' } : p);
        set({ playlists: loadedPlaylists });
      } else {
        set({ playlists: [] });
      }

      const parsedUser = safeJson(storedUser, null);
      if (!get().isAppLocked && isBackendAuthorized && parsedUser && loadedPlaylists.length > 0) {
        updates.isLoggedIn = true;
        updates.user = parsedUser;
      } else {
        updates.isLoggedIn = false;
        updates.user = null;
      }

      set(updates as any);

      // Fetch custom M3U playlists from the server if we have device data
      try {
        const plRes = await fetchWithTimeout(`${SERVER_URL}/portal/playlists?macAddress=${deviceData.macAddress}&deviceKey=${deviceData.deviceKey}`, {}, 5000);
        if (plRes.ok) {
          const serverPlaylists = await plRes.json();
          await get().syncM3uPlaylists(serverPlaylists);
        }
      } catch (err) {
        console.warn('Could not fetch server playlists', err);
      }

      const activeId = await AsyncStorage.getItem('activePlaylistId');
      let finalActiveId = '';
      if (activeId && !['p1', 'p2', 'p3'].includes(activeId) && loadedPlaylists.some(p => p.id === activeId)) {
        finalActiveId = activeId;
        set({ activePlaylistId: activeId });
        const cachedCats = await AsyncStorage.getItem(`categories_${activeId}`);
        if (cachedCats) set({ activeCategories: JSON.parse(cachedCats) });
      } else if (loadedPlaylists.length > 0) {
        const fallbackId = loadedPlaylists[0].id;
        finalActiveId = fallbackId;
        set({ activePlaylistId: fallbackId });
        await AsyncStorage.setItem('activePlaylistId', fallbackId);
        const cachedCats = await AsyncStorage.getItem(`categories_${fallbackId}`);
        if (cachedCats) set({ activeCategories: JSON.parse(cachedCats) });
      } else {
        set({ activePlaylistId: '', activeCategories: null });
      }

      if (finalActiveId) {
        try {
          const cachedCounts = await AsyncStorage.getItem(`category_counts_${finalActiveId}`);
          if (cachedCounts) {
            set({ categoryCounts: JSON.parse(cachedCounts) });
          } else {
            const cachedSearchIdx = await AsyncStorage.getItem(`search_index_${finalActiveId}`);
            if (cachedSearchIdx) {
              const parsed = JSON.parse(cachedSearchIdx);
              if (Array.isArray(parsed) && parsed.length > 0) {
                globalSearchIndex = parsed;
                set({ searchIndexReady: true });
                get().computeAndSetCategoryCounts(parsed);
              }
            }
          }
        } catch (e) {
          console.warn('Failed loading category counts on init', e);
        }
      }

      const favsStr = await AsyncStorage.getItem('favorites');
      if (favsStr) set({ favorites: JSON.parse(favsStr) });

      // Initialize network connectivity monitoring
      networkManager.init((isOnline) => {
        set({ isNetworkOnline: isOnline });
        if (isOnline) {
          console.log('[AppStore] Internet connection restored! Triggering content refresh...');
          set((s) => ({ refreshCounter: (s.refreshCounter || 0) + 1 }));
          get().checkAuthStatus();
          get().setupSseConnection();
          get().showToast('الاتصال بالإنترنت', 'تمت استعادة الاتصال بالإنترنت بنجاح', 'success');
        } else {
          console.log('[AppStore] Internet connection lost.');
          get().showToast('انقطاع الاتصال', 'انقطع الاتصال بالإنترنت، يرجى التحقق من الشبكة', 'warning');
        }
      });
      const itemsStr = await AsyncStorage.getItem('favoriteItems');
      if (itemsStr) set({ favoriteItems: JSON.parse(itemsStr) ?? [] });

      const cwStr = await AsyncStorage.getItem('continueWatching');
      if (cwStr) set({ continueWatching: JSON.parse(cwStr) ?? [] });

      set({ appIsReady: true });
      get().setupSseConnection();
    } catch (e) {
      console.error('Failed to load store', e);
      set({ appIsReady: true });
    }
  },

  setupSseConnection: () => {
    const { deviceId } = get();
    if (!deviceId) return;

    let SERVER_URL = 'https://entecstreamingnestjs-production.up.railway.app/api';
    const sseUrl = `${SERVER_URL}/client/events?macAddress=${deviceId}`;
    
    // Close existing connection if any
    const existingEs = (global as any).__appSseConnection;
    if (existingEs && typeof existingEs.close === 'function') {
      existingEs.close();
    }

    console.log(`[SSE] Connecting to real-time events for device: ${deviceId}`);
    const es = createEventSource(sseUrl);
    (global as any).__appSseConnection = es;

    es.addEventListener('message', async (event: any) => {
      try {
        let data = event.data;
        if (typeof data === 'string') {
          try { data = JSON.parse(data); } catch {}
        }
        if (data && (data.type === 'REFRESH' || data === 'REFRESH')) {
          console.log('[SSE] Received REFRESH event. Triggering deep app refresh...');
          
          // 1. Clear memory caches
          globalChannelsCache.clear();
          globalSearchIndex = [];
          set({ searchIndexReady: false });

          // 2. Check auth status & force reload admin subscriptions
          await get().checkAuthStatus({ forceReload: true });

          // 3. Refresh active playlist
          const currentPlaylistId = get().activePlaylistId;
          if (currentPlaylistId) {
            await get().refreshPlaylist(currentPlaylistId);
          }

          // 4. Increment refresh counter to notify listening screens
          set(s => ({ refreshCounter: (s.refreshCounter || 0) + 1 }));

          // 5. Show user confirmation toast
          get().showToast(
            'تحديث التطبيق',
            'تم تحديث بيانات التطبيق والقنوات من لوحة التحكم بنجاح',
            'success'
          );
        }
      } catch (err) {
        console.warn('[SSE] Error handling event data:', err);
      }
    });

    es.addEventListener('error', (err: any) => {
      console.log('[SSE] Connection notice:', err);
    });
  },

  loadSearchIndex: async (playlistId) => {
    if (!playlistId) {
      globalSearchIndex = [];
      set({ searchIndexReady: false });
      return;
    }
    if (globalSearchIndex.length > 0 && get().searchIndexReady) {
      return;
    }
    try {
      // 1. Instant load from disk cache if available
      const cached = await AsyncStorage.getItem(`search_index_${playlistId}`);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            globalSearchIndex = parsed;
            set({ searchIndexReady: true, loadingSearchIndex: false });
            get().computeAndSetCategoryCounts(parsed);
            console.log(`[loadSearchIndex] Loaded ${parsed.length} items from cache`);
            return;
          }
        } catch (e) {}
      }

      set({ loadingSearchIndex: true });
      await get().buildSearchIndex(playlistId);
    } catch (e) {
      console.error('Failed to load search index', e);
      if (globalSearchIndex.length === 0) {
        set({ searchIndexReady: false, loadingSearchIndex: false });
      }
    }
  },

  buildSearchIndex: async (playlistId, onProgress) => {
    set({ loadingSearchIndex: true, searchIndexReady: false });
    onProgress?.('Building search index...');
    
    try {
      let tempIndex = [];
      const playlist = get().playlists.find(x => x.id === playlistId);
      const isXtream = playlist && (playlist.url.startsWith('xtream://') || playlist.url.includes('/get.php?'));
      
      if (isXtream) {
        // Xtream Codes API: fetch all streams from server
        let config = null;
        if (playlist.url.startsWith('xtream://')) {
          try {
            config = JSON.parse(base64Decode(playlist.url.replace('xtream://', '')));
          } catch(e) {}
        } else {
          const match = playlist.url.match(/^(https?:\/\/[^/]+)\/get\.php\?username=([^&]+)&password=([^&]+)/);
          if (match) config = { host: match[1], username: match[2], password: match[3] };
        }
        
        if (config) {
          const hostClean = (config.host || '').endsWith('/') ? config.host.slice(0, -1) : (config.host || '');
          const catMap = new Map();
          const categories = get().activeCategories;
          if (categories) {
            for (const t of ['live', 'vod', 'series']) {
              for (const cat of (categories[t as keyof PlaylistCategories] || [])) {
                catMap.set(String(cat.id), cat.name);
              }
            }
          }
          const actions = [
            { action: 'get_live_streams', type: 'live', name: 'Live TV' },
            { action: 'get_vod_streams', type: 'vod', name: 'Movies' },
            { action: 'get_series', type: 'series', name: 'Series' }
          ];
          
          for (const a of actions) {
            onProgress?.(`Fetching ${a.name} database...`);
            console.log(`[buildSearchIndex] Fetching ${a.action}...`);
            try {
              const url = `${hostClean}/player_api.php?username=${config.username}&password=${config.password}&action=${a.action}`;
              let data: any = null;
              
              const isWeb = Platform.OS === 'web';
              const targetUrls = isWeb ? [
                `/proxy?url=${encodeURIComponent(url)}`,
                url,
                `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
                `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
              ] : [
                url
              ];
              
              let text = '';
              let fetched = false;
              for (const u of targetUrls) {
                try {
                  const timeout = a.type === 'vod' || a.type === 'series' ? 120000 : 30000;
                  text = await fetchWithXHR(u, undefined, timeout);
                  fetched = true;
                  break;
                } catch (e) { }
              }
              
              if (!fetched) throw new Error('Failed to fetch from all sources');
              data = JSON.parse(text);
              
              console.log(`[buildSearchIndex] Parsed JSON for ${a.action}. Array length: ${Array.isArray(data) ? data.length : 'Not Array'}`);
              if (Array.isArray(data)) {
                let batchCount = 0;
                for (const item of data) {
                  if (!item || !item.name) continue;

                  let decodedName = item.name;
                  if (get().moreOptions.useUtf8Decode) {
                    try { decodedName = decodeURIComponent(escape(item.name)); } catch (e) {}
                  }

                  let quality: '4K' | 'FHD' | 'HD' = 'HD';
                  if (decodedName.toUpperCase().includes('4K') || decodedName.toUpperCase().includes('UHD')) quality = '4K';
                  else if (decodedName.toUpperCase().includes('FHD') || decodedName.toUpperCase().includes('1080')) quality = 'FHD';
                  
                  let streamUrl = '';
                  let id = '';
                  let logo = '';
                  
                  if (a.type === 'live' && item.stream_id) {
                    const ext = get().moreOptions.useM3uFormatInStreamUrl ? '.m3u8' : (get().moreOptions.useExtensionInStreamUrl ? '.ts' : '');
                    streamUrl = `${hostClean}/live/${config.username}/${config.password}/${item.stream_id}${ext}`;
                    id = `xt_live_${item.stream_id}`;
                    logo = item.stream_icon || '';
                  } else if (a.type === 'vod' && item.stream_id) {
                    const ext = get().moreOptions.useExtensionInStreamUrl ? `.${item.container_extension || 'mp4'}` : '';
                    streamUrl = `${hostClean}/movie/${config.username}/${config.password}/${item.stream_id}${ext}`;
                    id = `xt_vod_${item.stream_id}`;
                    logo = item.stream_icon || '';
                  } else if (a.type === 'series' && item.series_id) {
                    streamUrl = `${hostClean}/series/${config.username}/${config.password}/${item.series_id}`;
                    id = `xt_series_${item.series_id}`;
                    logo = item.cover || '';
                  }
                  
                  if (id) {
                    const hasArchive = a.type === 'live' && (item.tv_archive === 1 || item.tv_archive === '1');
                    const archiveDuration = a.type === 'live' ? (parseInt(item.tv_archive_duration, 10) || 0) : 0;
                    tempIndex.push({
                      id,
                      name: decodedName,
                      type: a.type as 'live' | 'vod' | 'series',
                      logo,
                      category: catMap.get(String(item.category_id)) || item.category_name || (item.name ? item.name.split(/[:|-]/)[0].trim() : 'Unknown'),
                      categoryId: String(item.category_id || ''),
                      streamUrl,
                      current: a.type === 'live' ? 'Live Stream' : (a.type === 'vod' ? 'Movie' : (item.plot || 'TV Series')),
                      next: '',
                      quality,
                      isLive: a.type === 'live',
                      hasArchive,
                      archiveDuration
                    });
                  }

                  batchCount++;
                  if (batchCount % 300 === 0) {
                    await new Promise(r => setTimeout(r, 0));
                  }
                }
              }
              console.log(`[buildSearchIndex] Successfully pushed ${a.action} to index.`);
              globalSearchIndex = [...tempIndex];
              set({ searchIndexReady: true });
            } catch (e) {
              console.warn(`[buildSearchIndex] Failed fetching ${a.action} for search index`, e);
            }
          }
        }
      } else {
        // Standard M3U: read from local chunks
        const catsJson = await AsyncStorage.getItem(`categories_${playlistId}`);
        if (catsJson) {
          const categories = JSON.parse(catsJson);
          const types = ['live', 'vod', 'series'];
          
          for (const type of types) {
            const typeCats = categories[type] || [];
            for (const cat of typeCats) {
              const chunkJson = await AsyncStorage.getItem(`channels_${playlistId}_${type}_${cat.id}`);
              if (chunkJson) {
                const chunk = JSON.parse(chunkJson);
                for (const c of chunk) {
                  tempIndex.push({
                    id: c.id,
                    name: c.name,
                    type: c.type,
                    logo: c.logo,
                    category: c.category,
                    streamUrl: c.streamUrl,
                    current: c.current || '',
                    next: c.next || '',
                    quality: c.quality || 'Auto',
                    isLive: c.type === 'live'
                  });
                }
              }
            }
          }
        }
      }
      
      globalSearchIndex = tempIndex;
      set({ searchIndexReady: true, loadingSearchIndex: false });
      get().computeAndSetCategoryCounts(tempIndex);

      // Pre-cache channels by category so getChannelsForCategory returns in 0ms!
      try {
        const catMap = new Map<string, Channel[]>();
        for (const item of tempIndex) {
          if (item.categoryId) {
            const key = `channels_v4_${playlistId}_${item.type}_${item.categoryId}`;
            if (!catMap.has(key)) catMap.set(key, []);
            catMap.get(key)!.push(item as Channel);
          }
        }
        for (const [key, items] of catMap.entries()) {
          globalChannelsCache.set(key, { data: items, timestamp: Date.now() });
          AsyncStorage.setItem(key, JSON.stringify(items)).catch(() => {});
        }
      } catch (err) {
        console.warn('Failed caching category channels:', err);
      }

      onProgress?.('Search index ready!');
      if (tempIndex.length > 0) {
        AsyncStorage.setItem(`search_index_${playlistId}`, JSON.stringify(tempIndex)).catch(() => {});
      }
    } catch (e) {
      console.error('Failed to build search index:', e);
      if (globalSearchIndex.length === 0) {
        set({ searchIndexReady: false, loadingSearchIndex: false });
      } else {
        set({ loadingSearchIndex: false });
      }
      onProgress?.('Failed to build index.');
    }
  },

  preloadFullPlaylistContent: async (playlistId, onProgress) => {
    try {
      const playlist = get().playlists.find(p => p.id === playlistId);
      if (!playlist) {
        console.warn(`[preloadFullPlaylistContent] Playlist ${playlistId} not found`);
        return false;
      }

      console.log(`[preloadFullPlaylistContent] Preloading playlist: ${playlistId} (${playlist.name})`);
      onProgress?.(10, 'جاري التحقق من القائمة والاتصال بالخادم...');

      // Step 1: Verify credentials and fetch categories (10% -> 30%)
      await get().loadPlaylistFromUrl(
        playlistId, 
        playlist.url, 
        (msg) => onProgress?.(25, msg || 'جاري استيراد وتحديث الفئات...')
      );

      onProgress?.(35, 'تم استيراد الفئات، جاري مزامنة القنوات والمكتبة...');

      // Step 2: Fetch all streams and build catalog & counts (35% -> 85%)
      await get().buildSearchIndex(playlistId, (msg) => {
        if (msg.includes('Live')) {
          onProgress?.(50, 'جاري تحميل قنوات البث المباشر...');
        } else if (msg.includes('Movies') || msg.includes('vod')) {
          onProgress?.(68, 'جاري تحميل مكتبة الأفلام...');
        } else if (msg.includes('Series')) {
          onProgress?.(82, 'جاري تحميل مكتبة المسلسلات...');
        } else {
          onProgress?.(60, msg);
        }
      });

      // Step 3: Preload Home content rows so (tabs)/index.tsx opens in 0ms (85% -> 98%)
      onProgress?.(90, 'جاري تجهيز محتوى الصفحة الرئيسية...');
      const activeCats = get().activeCategories;
      if (activeCats) {
        try {
          const rows: any[] = [];
          const heroPool: Channel[] = [];

          const fetchAndAddRow = async (type: 'live' | 'vod' | 'series', category: any) => {
            if (!category) return;
            const items = await get().getChannelsForCategory(playlistId, type, category.id, category.name);
            if (items && items.length > 0) {
              if (type !== 'live') heroPool.push(...items);
              const mapped = items.slice(0, 15).map(m => {
                if (type === 'live') return m;
                return {
                  id: m.id,
                  title: m.name,
                  poster: m.logo || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.name)}&background=1A1A1A&color=D4A843&bold=true&size=300&format=svg`,
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
              rows.push({
                title: category.name,
                type,
                categoryId: category.id,
                items: mapped
              });
            }
          };

          for (const cat of (activeCats.live || []).slice(0, 2)) await fetchAndAddRow('live', cat);
          for (const cat of (activeCats.vod || []).slice(0, 2)) await fetchAndAddRow('vod', cat);
          for (const cat of (activeCats.series || []).slice(0, 2)) await fetchAndAddRow('series', cat);

          const featured = heroPool.slice(0, 4).map(item => ({
            id: item.id,
            title: item.name,
            subtitle: item.type === 'live' ? 'FEATURED LIVE TV' : item.type === 'series' ? 'FEATURED SERIES' : 'FEATURED MOVIE',
            backdrop: { uri: item.logo || '' },
            poster: { uri: item.logo || '' },
            description: item.category || 'Featured Content',
            rating: 8.5,
            year: 2026,
            duration: item.type === 'live' ? 'LIVE' : 'VOD',
            genres: [item.category],
            streamUrl: item.streamUrl,
            originalItem: item
          }));

          if (rows.length > 0) {
            get().setCachedHomeContent(playlistId, rows, featured);
          }
        } catch (e) {
          console.warn('[preloadFullPlaylistContent] Home rows prefetch error:', e);
        }
      }

      onProgress?.(100, 'اكتمل التحميل بنجاح! جاري الدخول...');
      await new Promise(r => setTimeout(r, 600));
      return true;
    } catch (e: any) {
      console.error('[preloadFullPlaylistContent] Error during preload:', e);
      onProgress?.(100, 'اكتمل التحميل');
      return false;
    }
  },
}));