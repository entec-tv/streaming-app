import re

file_path = r"c:\streaming\artifacts\streaming\store\app-store.ts"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add import
if "import { networkManager } from '../lib/network';" not in content:
    content = content.replace(
        "import { createEventSource } from '../lib/event-source';",
        "import { createEventSource } from '../lib/event-source';\nimport { networkManager } from '../lib/network';"
    )

# 2. Add to AppState interface
if "isNetworkOnline: boolean;" not in content:
    content = content.replace(
        "  refreshCounter: number;",
        "  refreshCounter: number;\n  isNetworkOnline: boolean;\n  setIsNetworkOnline: (status: boolean) => void;"
    )

# 3. Add to initial state
if "setIsNetworkOnline: (status)" not in content:
    content = content.replace(
        "  refreshCounter: 0,",
        "  refreshCounter: 0,\n  isNetworkOnline: true,\n  setIsNetworkOnline: (status) => set({ isNetworkOnline: status }),"
    )

# 4. In fetchWithXHR: check offline immediately
old_fetch = """const fetchWithXHR = (targetUrl: string, acceptHeader?: string, timeoutMs: number = 30000): Promise<string> =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();"""

new_fetch = """const fetchWithXHR = (targetUrl: string, acceptHeader?: string, timeoutMs: number = 30000): Promise<string> =>
  new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && typeof window.navigator !== 'undefined' && window.navigator.onLine === false) {
      return reject(new Error('OFFLINE'));
    }
    const xhr = new XMLHttpRequest();"""

if old_fetch in content:
    content = content.replace(old_fetch, new_fetch)

# 5. In getChannelsForCategory: cache validation and targetUrls and write
old_cache_check = """      const memCache = globalChannelsCache.get(storageKey);
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
      }"""

new_cache_check = """      const memCache = globalChannelsCache.get(storageKey);
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
            return parsed;
          }
        } catch (e) {}
      }"""

if old_cache_check in content:
    content = content.replace(old_cache_check, new_cache_check)

old_target_urls = """        const isWeb = Platform.OS === 'web';
        const targetUrls = isWeb ? [
          fetchUrl,
          `https://corsproxy.io/?url=${encodeURIComponent(fetchUrl)}`,
          `https://api.allorigins.win/raw?url=${encodeURIComponent(fetchUrl)}`
        ] : [
          fetchUrl
        ];
        
        let text = '';
        let fetched = false;
        
        let lastFetchErr = new Error('Init');
        for (let i = 0; i < targetUrls.length; i++) {
          const u = targetUrls[i];
          try {
            console.log(`[getChannelsForCategory] Fetching attempt ${i + 1}/${targetUrls.length} from: ${u}`);
            text = await fetchWithXHR(u);"""

new_target_urls = """        const isWeb = Platform.OS === 'web';
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
            text = await fetchWithXHR(u, undefined, 10000);"""

if old_target_urls in content:
    content = content.replace(old_target_urls, new_target_urls)

old_cache_write = """          // Store in disk cache
          AsyncStorage.setItem(storageKey, JSON.stringify(channelsList)).catch(e => console.warn('Cache write failed', e));
          // Store in memory cache
          globalChannelsCache.set(storageKey, { data: channelsList, timestamp: Date.now() });"""

new_cache_write = """          // Store in disk cache only if non-empty
          if (channelsList.length > 0) {
            AsyncStorage.setItem(storageKey, JSON.stringify(channelsList)).catch(e => console.warn('Cache write failed', e));
            // Store in memory cache
            globalChannelsCache.set(storageKey, { data: channelsList, timestamp: Date.now() });
          }"""

if old_cache_write in content:
    content = content.replace(old_cache_write, new_cache_write)

# 6. In initializeFromStorage: add networkManager initialization
old_init_end = """      const favsStr = await AsyncStorage.getItem('favorites');
      if (favsStr) set({ favorites: JSON.parse(favsStr) });"""

new_init_end = """      const favsStr = await AsyncStorage.getItem('favorites');
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
      });"""

if old_init_end in content and "networkManager.init" not in content:
    content = content.replace(old_init_end, new_init_end)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Updated app-store.ts successfully!")
