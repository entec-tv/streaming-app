import { create } from 'zustand';
import { Platform } from 'react-native';
import AsyncStorageOriginal from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

import { readCacheString, writeCacheString, deleteCache } from '../lib/storage';

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
import { base64Decode } from '../lib/base64';
import { getOrCreateDeviceData } from '../utils/device';

export interface PlaylistCategories {
  live: { id: string; name: string }[];
  vod: { id: string; name: string }[];
  series: { id: string; name: string }[];
}

export interface CategoryPreferences {
  hiddenIds: string[];
  liveOrder: string[];
  vodOrder: string[];
  seriesOrder: string[];
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
  isFullscreen: boolean;
  setIsFullscreen: (full: boolean) => void;

  loadingSearchIndex: boolean;
  searchIndexReady: boolean;
  searchIndexProgress: string;
  loadSearchIndex: (playlistId: string) => Promise<void>;
  buildSearchIndex: (playlistId: string, onProgress?: (msg: string) => void) => Promise<void>;
  searchChannels: (query: string, typeFilter?: string) => Promise<Channel[]>;
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
  checkAuthStatus: () => Promise<void>;
  isPlayerOpen: boolean;
  setIsPlayerOpen: (isOpen: boolean) => void;

  syncAdminSubscriptions: (subscriptions: { id: string; host: string; username: string; password: string; name: string }[]) => Promise<void>;
  syncM3uPlaylists: (playlists: { name: string; url: string }[]) => Promise<void>;
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

const fetchWithXHR = (targetUrl: string, acceptHeader?: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', targetUrl, true);
    xhr.timeout = 30000;
    try {
      xhr.setRequestHeader('Accept', acceptHeader || 'application/json, application/x-mpegurl, */*');
      xhr.setRequestHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
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
      const newDownloads = state.downloads.map(d => d.id === id ? { ...d, ...updates } : d);
      AsyncStorage.setItem('downloads', JSON.stringify(newDownloads));
      return { downloads: newDownloads };
    });
  },

  startDownload: async (item) => {
    const fileUri = (FileSystem as any).documentDirectory + `${item.id}.mp4`;
    
    const newDownload: DownloadItem = {
      ...item,
      status: 'downloading',
      progress: 0,
      localUri: Platform.OS === 'web' ? '' : fileUri
    };
    get().addDownload(newDownload);

    if (Platform.OS === 'web') {
      try {
        const url = `/api/download/start?id=${item.id}&url=${encodeURIComponent(item.streamUrl)}`;
        const res = await fetch(url);
        const data = await res.json();
        get().updateDownloadItem(item.id, { localUri: data.localUri });

        if (!(window as any).downloadPoller) {
          (window as any).downloadPoller = setInterval(async () => {
            try {
              const statRes = await fetch('/api/download/status');
              const stats = await statRes.json();
              for (const [id, info] of Object.entries(stats)) {
                get().updateDownloadItem(id, info as any);
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
      activateKeepAwakeAsync().catch(() => {});
      const downloadResumable = FileSystem.createDownloadResumable(
        item.streamUrl,
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
        deactivateKeepAwake().catch(() => {});
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
        await fetch(`/api/download/resume?id=${id}`);
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
      activateKeepAwakeAsync().catch(() => {});
      const parsedResumeData = JSON.parse(download.resumeData);
      const downloadResumable = FileSystem.createDownloadResumable(
        download.streamUrl,
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
        deactivateKeepAwake().catch(() => {});
      }
    }
  },

  cancelDownload: async (id) => {
    if (Platform.OS === 'web') {
      try {
        await fetch(`/api/download/cancel?id=${id}`);
      } catch (e) {
        console.error("Failed to cancel web download", e);
      }
      get().removeDownload(id);
      return;
    }

    const download = get().downloads.find(d => d.id === id);
    const resumable = activeDownloads[id];
    if (resumable) {
      try {
        await resumable.pauseAsync(); // Stop active download safely
      } catch (e) {}
    }
    delete activeDownloads[id];
    get().removeDownload(id);
    
    if (download && download.localUri) {
      try {
        await FileSystem.deleteAsync(download.localUri, { idempotent: true });
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

  syncAdminSubscriptions: async (subscriptions) => {
    const btoa = (str: string) => typeof window !== 'undefined' ? window.btoa(str) : Buffer.from(str).toString('base64');
    const AsyncStorageOriginal = typeof window !== 'undefined' ? require('@react-native-async-storage/async-storage').default : null;
    
    const adminIds = subscriptions.map(s => `admin_sub_${s.id}`);
    
    // Remove old admin subscriptions that are no longer in the list
    let currentPlaylists = [...get().playlists];
    const oldAdminPlaylists = currentPlaylists.filter(p => p.id.startsWith('admin_sub_') && !adminIds.includes(p.id));
    for (const old of oldAdminPlaylists) {
      currentPlaylists = currentPlaylists.filter(p => p.id !== old.id);
      if (AsyncStorageOriginal) {
        try {
          await AsyncStorageOriginal.removeItem(`channels_${old.id}`);
          await AsyncStorageOriginal.removeItem(`categories_${old.id}`);
        } catch(e) {}
      }
    }
    
    let activePlaylistIdChanged = false;
    if (oldAdminPlaylists.some(p => p.id === get().activePlaylistId)) {
      activePlaylistIdChanged = true;
    }

    // Process new/updated subscriptions
    for (const sub of subscriptions) {
      const playlistId = `admin_sub_${sub.id}`;
      const credentials = JSON.stringify({ host: sub.host, username: sub.username, password: sub.password });
      const xtreamUrl = `xtream://${btoa(credentials)}`;
      
      const existingIndex = currentPlaylists.findIndex(p => p.id === playlistId);
      let needsUpdate = false;
      let existing = null;
      
      if (existingIndex >= 0) {
        existing = currentPlaylists[existingIndex];
        if (existing.url !== xtreamUrl || existing.name !== sub.name) {
          needsUpdate = true;
        }
      } else {
        needsUpdate = true;
      }
      
      if (needsUpdate) {
        try {
          const hostClean = sub.host.endsWith('/') ? sub.host.slice(0, -1) : sub.host;
          const m3uUrl = `${hostClean}/get.php?username=${sub.username}&password=${sub.password}&type=m3u_plus&output=ts`;
          const { channels, expireText } = await get().loadPlaylistFromUrl(playlistId, m3uUrl);
          
          if (existingIndex >= 0 && existing) {
            currentPlaylists[existingIndex] = { ...existing, url: xtreamUrl, name: sub.name, channels, updated: expireText || 'Active', lastUpdatedTimestamp: Date.now() };
          } else {
            currentPlaylists.push({
              id: playlistId,
              name: sub.name || "admin_subscription",
              url: xtreamUrl,
              channels,
              updated: expireText || 'Active',
              lastUpdatedTimestamp: Date.now(),
            });
            if (!get().activePlaylistId || activePlaylistIdChanged) {
              set({ activePlaylistId: playlistId });
              activePlaylistIdChanged = false;
            }
          }
        } catch (err) {
          console.error(`Failed to sync admin playlist ${sub.name}`, err);
        }
      }
    }
    
    set({ playlists: currentPlaylists });
    if (AsyncStorageOriginal) {
      try {
        await AsyncStorageOriginal.setItem('playlists', JSON.stringify(currentPlaylists));
        const currentActive = get().activePlaylistId;
        if (currentActive && !currentPlaylists.some(p => p.id === currentActive) && currentPlaylists.length > 0) {
          set({ activePlaylistId: currentPlaylists[0].id });
          await AsyncStorageOriginal.setItem('activePlaylistId', currentPlaylists[0].id);
        } else if (currentActive) {
          await AsyncStorageOriginal.setItem('activePlaylistId', currentActive);
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
  setSubscriptionExpired: (expired) => set({ subscriptionExpired: expired }),
  isFullscreen: false,
  setIsFullscreen: (full) => set({ isFullscreen: full }),

  loadingSearchIndex: false,
  searchIndexReady: false,
  searchIndexProgress: '',

  cachedHomeContent: null,
  setCachedHomeContent: (playlistId, rows, featured) => {
    set({ cachedHomeContent: { playlistId, rows, featured } });
  },

  searchChannels: async (query: string, typeFilter?: string) => {
    if (!query) return [];
    const q = query.toLowerCase();
    
    // إذا كان هناك فلتر محدد، ابحث فقط في هذا النوع
    if (typeFilter && typeFilter !== 'all') {
      const results: Channel[] = [];
      for (const item of globalSearchIndex) {
        if (results.length >= 50) break;
        if (item.type !== typeFilter) continue;
        const matchName = item.name && item.name.toLowerCase().includes(q);
        const matchCategory = item.category && item.category.toLowerCase().includes(q);
        if (matchName || matchCategory) {
          results.push(item);
        }
      }
      return results;
    }
    
    // بدون فلتر: اجمع نتائج من كل نوع بالتساوي
    const liveResults: Channel[] = [];
    const vodResults: Channel[] = [];
    const seriesResults: Channel[] = [];
    const MAX_PER_TYPE = 20;
    
    for (const item of globalSearchIndex) {
      // توقف إذا امتلأت كل الأنواع
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

    // Build the search index automatically in the background
    get().buildSearchIndex(playlist.id).catch((err) => {
      console.error('[addPlaylist] Auto-building search index failed:', err);
    });
  },

  deletePlaylist: async (id) => {
    const newPlaylists = get().playlists.filter((p) => p.id !== id);
    const newChannels = { ...get().playlistChannels };
    delete newChannels[id];
    set({ playlists: newPlaylists, playlistChannels: newChannels, activeCategories: null, channels: [] });
    if (get().activePlaylistId === id) {
      set({ activePlaylistId: newPlaylists[0]?.id ?? '' });
    }
    await AsyncStorage.setItem('playlists', JSON.stringify(newPlaylists));
    await AsyncStorage.removeItem(`channels_${id}`);
    await AsyncStorage.removeItem(`categories_${id}`);
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
    }

    // Auto-load search index and build it in the background
    try {
      get().loadSearchIndex(id).catch((err) => {
        console.error('[setActivePlaylist] Error building search index:', err);
      });
    } catch (err) {
      console.error('[setActivePlaylist] Failed starting search index build:', err);
    }
  },

  refreshPlaylist: async (id) => {
    const playlist = get().playlists.find((p) => p.id === id);
    if (!playlist || playlist.isDemo) return;
    await get().loadPlaylistFromUrl(id, playlist.url);
  },

  loadPlaylistFromUrl: async (playlistId, url, onProgress) => {
    onProgress?.('Connecting to server...');

    // Build the list of URLs to try for this playlist load.
    // For Xtream Codes the url was already built by playlists.tsx as the
    // get.php URL; we also generate a simplified path variant as fallback.
    let getPhpMatch = url.match(/^(https?:\/\/[^/]+)\/get\.php\?username=([^&]+)&password=([^&]+)/);
    
    if (url.startsWith('xtream://')) {
      try {
        const b64 = url.replace('xtream://', '');
        const creds = JSON.parse(typeof window !== 'undefined' ? window.atob(b64) : Buffer.from(b64, 'base64').toString());
        getPhpMatch = [url, creds.host, creds.username, creds.password];
      } catch(e) {}
    }
    
    // If it is an Xtream Codes URL, try fetching via player_api.php dynamically
    // to avoid the IPTV server crashing with a 500 error on get.php.
    if (getPhpMatch) {
      const [, host, username, password] = getPhpMatch;
      
      const fetchJsonWithFallback = async (endpoint: string): Promise<any> => {
        const targetUrls = [
          `/proxy?url=${encodeURIComponent(endpoint)}`,
          endpoint,
          `https://corsproxy.io/?url=${encodeURIComponent(endpoint)}`,
          `https://api.allorigins.win/raw?url=${encodeURIComponent(endpoint)}`
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
    if (playlistId === 'p1' || playlistId === 'p2' || playlistId === 'p3') {
      const filtered = MOCK_CHANNELS.filter(c => c.type === type && (c.category === categoryId || categoryId === 'All'));
      return filtered;
    }
    
    try {
      const storageKey = `channels_v4_${playlistId}_${type}_${categoryId}`;
      
      const memCache = globalChannelsCache.get(storageKey);
      if (memCache && (Date.now() - memCache.timestamp < CACHE_TTL)) {
        console.log(`[getChannelsForCategory] Found in memory cache for ${storageKey}`);
        return memCache.data;
      }

      const cached = await AsyncStorage.getItem(storageKey);
      
      if (cached) {
        const parsed = JSON.parse(cached);
        globalChannelsCache.set(storageKey, { data: parsed, timestamp: Date.now() });
        console.log(`[getChannelsForCategory] Found cached channels in AsyncStorage. Count: ${parsed.length}`);
        return parsed;
      }
      
      const p = get().playlists.find(x => x.id === playlistId);
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
        
        const fetchUrl = `${config.host}/player_api.php?username=${config.username}&password=${config.password}&action=${action}&category_id=${categoryId}&_t=${Date.now()}`;
        console.log(`[getChannelsForCategory] Fetching streams from host: ${config.host}, url: ${fetchUrl}`);
        
        const targetUrls = [
          fetchUrl,
          `https://corsproxy.io/?url=${encodeURIComponent(fetchUrl)}`,
          `https://api.allorigins.win/raw?url=${encodeURIComponent(fetchUrl)}`
        ];
        
        let text = '';
        let fetched = false;
        
        try {
          const res = await fetch(fetchUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
          });
          if (!res.ok) throw new Error(`HTTP error ${res.status}`);
          text = await res.text();
          fetched = true;
        } catch (fetchErr) {
          console.warn(`[getChannelsForCategory] Direct fetch failed, trying proxies. Error: ${fetchErr}`);
          for (let i = 0; i < targetUrls.length; i++) {
            const u = targetUrls[i];
            try {
              console.log(`[getChannelsForCategory] Fetching attempt ${i + 1}/${targetUrls.length} from: ${u}`);
              text = await new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('GET', u, true);
                xhr.timeout = 20000;
                xhr.onload = () => {
                  if (xhr.status >= 200 && xhr.status < 300) {
                    if (xhr.responseText && xhr.responseText.trim().length > 0) resolve(xhr.responseText);
                    else reject(new Error(`Empty response, status: ${xhr.status}`));
                  } else {
                    reject(new Error(`HTTP status error: ${xhr.status}`));
                  }
                };
                xhr.onerror = () => reject(new Error('Network error'));
                xhr.ontimeout = () => reject(new Error('Timeout'));
                xhr.send();
              });
              console.log(`[getChannelsForCategory] Fetching succeeded from: ${u}. Response text sample (first 100 chars): ${text.substring(0, 100)}`);
              fetched = true;
              break;
            } catch (e: any) {
              console.warn(`[getChannelsForCategory] Failed fetching from ${u}: ${e.message || e}`);
            }
          }
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
                const streamUrl = `${config.host}/live/${config.username}/${config.password}/${item.stream_id}${ext}`;
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
                const streamUrl = `${config.host}/movie/${config.username}/${config.password}/${item.stream_id}${ext}`;
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
                const streamUrl = `${config.host}/series/${config.username}/${config.password}/${item.series_id}`;
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
          
          // Store in disk cache
          AsyncStorage.setItem(storageKey, JSON.stringify(channelsList)).catch(e => console.warn('Cache write failed', e));
          // Store in memory cache
          globalChannelsCache.set(storageKey, { data: channelsList, timestamp: Date.now() });
          
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
      return MOCK_CHANNELS.filter((c) => c.type === type);
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
    const favs = get().favorites;
    const items = get().favoriteItems || [];
    const id = item.id;
    let newFavs: string[];
    let newItems: Channel[];
    if (favs.includes(id)) {
      newFavs = favs.filter((f) => f !== id);
      newItems = items.filter((x) => x.id !== id);
    } else {
      newFavs = [...favs, id];
      newItems = [...items, item];
    }
    set({ favorites: newFavs, favoriteItems: newItems });
    AsyncStorage.setItem('favorites', JSON.stringify(newFavs));
    AsyncStorage.setItem('favoriteItems', JSON.stringify(newItems));
  },

  isPlayerOpen: false,
  setIsPlayerOpen: (isOpen) => set({ isPlayerOpen: isOpen }),

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
      return { settings: newSettings };
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

  checkAuthStatus: async () => {
    try {
      const deviceData = await getOrCreateDeviceData();
      let SERVER_URL = 'https://entecstreamingnestjs-production.up.railway.app/api';
      
      if (__DEV__) {
        SERVER_URL = Platform.OS === 'android' ? 'http://10.0.2.2:3000/api' : 'http://localhost:3000/api';
      }

      const response = await fetch(`${SERVER_URL}/client/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ macAddress: deviceData.macAddress, deviceKey: deviceData.deviceKey }),
      });
      
      if (response.status === 401 || response.status === 403 || response.status === 404) {
        console.log('[checkAuthStatus] User deleted or blocked. Logging out.');
        get().logout();
      } else if (response.ok) {
        const data = await response.json();
        if (data && data.customer && data.customer.subscriptions) {
           // Get appExpiry from the first matching subscription (they all share the same for a MAC)
           const currentMacSub = data.customer.subscriptions.find((s: any) => s.macAddress === deviceData.macAddress);
           if (currentMacSub && currentMacSub.appExpiry) {
             set({ appExpiry: currentMacSub.appExpiry });
           } else {
             set({ appExpiry: null });
           }
           await get().syncAdminSubscriptions(data.customer.subscriptions);
        }
      }
    } catch (err) {
      console.warn('[checkAuthStatus] Error checking auth status', err);
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
      
      if (__DEV__) {
        const hostUri = Constants.expoConfig?.hostUri;
        if (hostUri) {
          const ip = hostUri.split(':')[0];
          SERVER_URL = `http://${ip}:3000/api`;
        } else {
          SERVER_URL = Platform.OS === 'android' ? 'http://10.0.2.2:3000/api' : 'http://localhost:3000/api';
        }
      }

      let isBackendAuthorized = false;
      try {
        // Register Device First
        await fetch(`${SERVER_URL}/client/register-device`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ macAddress: deviceData.macAddress, deviceKey: deviceData.deviceKey }),
        });

        const response = await fetch(`${SERVER_URL}/client/auth`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ macAddress: deviceData.macAddress, deviceKey: deviceData.deviceKey }),
        });
        if (response.ok) {
          isBackendAuthorized = true;
        } else if (response.status === 401 || response.status === 403 || response.status === 404) {
          isBackendAuthorized = false;
          await AsyncStorage.removeItem('user');
          await AsyncStorage.removeItem('activePlaylistId');
        } else {
          isBackendAuthorized = storedUser ? true : false;
        }
      } catch (e) {
        // Network error, keep existing state
        isBackendAuthorized = storedUser ? true : false;
      }

      if (storedLockedChannels) {
        try {
          updates.lockedChannels = JSON.parse(storedLockedChannels);
        } catch (e) {
          console.error("Failed to parse locked channels", e);
        }
      }
      if (storedFavs) updates.favorites = JSON.parse(storedFavs);
      if (storedFavItems) updates.favoriteItems = JSON.parse(storedFavItems);
      if (storedSettings) updates.settings = { ...get().settings, ...JSON.parse(storedSettings) };
      if (storedContinueWatching) {
        try {
          const parsed = JSON.parse(storedContinueWatching);
          if (Array.isArray(parsed)) {
            updates.continueWatching = parsed.map(item => ({
              ...item,
              title: item.title || item.name || 'Unknown Title',
              poster: item.poster || item.logo || item.thumbnail || '',
              backdrop: item.backdrop || item.poster || item.logo || '',
            })).filter(item => item.id && item.streamUrl);
          }
        } catch (e) {
          console.warn('Failed to parse continueWatching', e);
        }
      }
      if (storedDownloads) updates.downloads = JSON.parse(storedDownloads);
      if (storedCatPrefs) updates.categoryPreferences = JSON.parse(storedCatPrefs);
      if (storedLazyLoad !== null) updates.lazyLoadContent = JSON.parse(storedLazyLoad);
      if (storedAutoPlay !== null) updates.autoPlayOnStartup = JSON.parse(storedAutoPlay);
      if (storedLastWatched !== null) updates.lastWatchedChannel = JSON.parse(storedLastWatched);
      if (storedMoreOptions) updates.moreOptions = { ...get().moreOptions, ...JSON.parse(storedMoreOptions) };
      if (storedParentalPin !== null) updates.parentalPin = storedParentalPin;

      set(updates as any);

      const playlistsStr = await AsyncStorage.getItem('playlists');
      let loadedPlaylists: Playlist[] = [];
      if (playlistsStr) {
        loadedPlaylists = JSON.parse(playlistsStr).filter((p: any) => !p.isDemo);
        set({ playlists: loadedPlaylists });
      } else {
        set({ playlists: [] });
      }

      if (isBackendAuthorized && storedUser && loadedPlaylists.length > 0) {
        updates.isLoggedIn = true;
        updates.user = JSON.parse(storedUser);
      } else {
        updates.isLoggedIn = false;
        updates.user = null;
      }

      set(updates as any);

      // Fetch custom M3U playlists from the server if we have device data
      try {
        const plRes = await fetch(`${SERVER_URL}/portal/playlists?macAddress=${deviceData.macAddress}&deviceKey=${deviceData.deviceKey}`);
        if (plRes.ok) {
          const serverPlaylists = await plRes.json();
          await get().syncM3uPlaylists(serverPlaylists);
        }
      } catch (err) {
        console.warn('Could not fetch server playlists', err);
      }

      const activeId = await AsyncStorage.getItem('activePlaylistId');
      let finalActiveId = '';
      if (activeId && loadedPlaylists.some(p => p.id === activeId)) {
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

      // Auto-load search index for active playlist on start
      if (finalActiveId) {
        try {
          get().loadSearchIndex(finalActiveId).then(() => {
            if (globalSearchIndex.length === 0) {
              get().buildSearchIndex(finalActiveId).catch(() => {});
            }
          }).catch(err => {
            console.error('[initializeFromStorage] Failed loading search index:', err);
          });
        } catch (err) {
          console.error('[initializeFromStorage] Error triggering search index:', err);
        }
      }

      const favsStr = await AsyncStorage.getItem('favorites');
      if (favsStr) set({ favorites: JSON.parse(favsStr) });
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
    if (__DEV__) {
      const hostUri = Constants.expoConfig?.hostUri;
      if (hostUri) {
        const ip = hostUri.split(':')[0];
        SERVER_URL = `http://${ip}:3000/api`;
      } else {
        SERVER_URL = Platform.OS === 'android' ? 'http://10.0.2.2:3000/api' : 'http://localhost:3000/api';
      }
      }

    const sseUrl = `${SERVER_URL}/client/events?macAddress=${deviceId}`;
    
    // Close existing connection if any
    const existingEs = (global as any).__appSseConnection;
    if (existingEs) {
      existingEs.close();
    }

    const EventSourceConstructor = typeof window !== 'undefined' ? window.EventSource : (global as any).EventSource;
    if (!EventSourceConstructor) {
      console.warn('[SSE] EventSource is not supported on this platform natively.');
      return;
    }

    const es = new EventSourceConstructor(sseUrl);
    (global as any).__appSseConnection = es;

    es.addEventListener('message', async (event: any) => {
      try {
        const data = JSON.parse(event.data);
        if (data && data.type === 'REFRESH') {
          console.log('[SSE] Received REFRESH event. Refreshing app data...');
          await get().checkAuthStatus();
          const currentPlaylistId = get().activePlaylistId;
          if (currentPlaylistId) {
            await get().refreshPlaylist(currentPlaylistId);
          }
        }
      } catch (err) {
        console.warn('[SSE] Error parsing event data:', err);
      }
    });

    es.addEventListener('error', (err: any) => {
      console.log('[SSE] Connection error. Reconnecting...');
    });
  },

  getChannelsByType: async (type) => {
    return globalSearchIndex.filter(item => item.type === type);
  },

  loadSearchIndex: async (playlistId) => {
    if (!playlistId) {
      globalSearchIndex = [];
      set({ searchIndexReady: false });
      return;
    }
    try {
      set({ loadingSearchIndex: true });
      await get().buildSearchIndex(playlistId);
    } catch (e) {
      console.error('Failed to load search index', e);
      globalSearchIndex = [];
      set({ searchIndexReady: false, loadingSearchIndex: false });
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
          config = JSON.parse(atob(playlist.url.replace('xtream://', '')));
        } else {
          const match = playlist.url.match(/^(https?:\/\/[^/]+)\/get\.php\?username=([^&]+)&password=([^&]+)/);
          if (match) config = { host: match[1], username: match[2], password: match[3] };
        }
        
        if (config) {
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
              const url = `${config.host}/player_api.php?username=${config.username}&password=${config.password}&action=${a.action}`;
              let data: any = null;
              
              try {
                const res = await fetch(url, {
                  headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                  }
                });
                if (!res.ok) throw new Error(`HTTP error ${res.status}`);
                data = await res.json();
              } catch (fetchErr) {
                console.warn(`[buildSearchIndex] Direct fetch failed for ${a.action}, trying proxies. Error: ${fetchErr}`);
                const targetUrls = [
                  url,
                  `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
                  `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
                ];
                let text = '';
                let fetched = false;
                for (const u of targetUrls) {
                  try {
                    text = await new Promise((resolve, reject) => {
                      const xhr = new XMLHttpRequest();
                      xhr.open('GET', u, true);
                      xhr.timeout = 30000;
                      xhr.onload = () => {
                        if (xhr.status >= 200 && xhr.status < 300) {
                          if (xhr.responseText) resolve(xhr.responseText);
                          else reject(new Error('Empty'));
                        } else reject(new Error('Status ' + xhr.status));
                      };
                      xhr.onerror = () => reject(new Error('Network error'));
                      xhr.ontimeout = () => reject(new Error('Timeout'));
                      xhr.send();
                    });
                    fetched = true;
                    break;
                  } catch (e) { }
                }
                if (!fetched) throw new Error('Failed to fetch from all sources on web');
                data = JSON.parse(text);
              }
              
              console.log(`[buildSearchIndex] Parsed JSON for ${a.action}. Array length: ${Array.isArray(data) ? data.length : 'Not Array'}`);
              if (Array.isArray(data)) {
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
                    streamUrl = `${config.host}/live/${config.username}/${config.password}/${item.stream_id}${ext}`;
                    id = `xt_live_${item.stream_id}`;
                    logo = item.stream_icon || '';
                  } else if (a.type === 'vod' && item.stream_id) {
                    const ext = get().moreOptions.useExtensionInStreamUrl ? `.${item.container_extension || 'mp4'}` : '';
                    streamUrl = `${config.host}/movie/${config.username}/${config.password}/${item.stream_id}${ext}`;
                    id = `xt_vod_${item.stream_id}`;
                    logo = item.stream_icon || '';
                  } else if (a.type === 'series' && item.series_id) {
                    streamUrl = `${config.host}/series/${config.username}/${config.password}/${item.series_id}`;
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
                }
              }
              console.log(`[buildSearchIndex] Successfully pushed ${a.action} to index.`);
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
      onProgress?.('Search index ready!');
    } catch (e) {
      console.error('Failed to build search index:', e);
      globalSearchIndex = [];
      set({ searchIndexReady: false, loadingSearchIndex: false });
      onProgress?.('Failed to build index.');
    }
  },
}));