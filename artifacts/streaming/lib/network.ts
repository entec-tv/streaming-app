import { Platform } from 'react-native';

export type NetworkListener = (isOnline: boolean) => void;

class NetworkManager {
  private isOnlineStatus: boolean = true;
  private listeners: Set<NetworkListener> = new Set();
  private pingInterval: any = null;
  private isInitialized: boolean = false;
  private isChecking: boolean = false;

  constructor() {
    if (typeof window !== 'undefined' && typeof window.navigator !== 'undefined') {
      this.isOnlineStatus = typeof window.navigator.onLine === 'boolean' ? window.navigator.onLine : true;
    }
  }

  public init(onStatusChange?: NetworkListener) {
    if (onStatusChange) {
      this.listeners.add(onStatusChange);
    }

    if (this.isInitialized) return;
    this.isInitialized = true;

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('[NetworkManager] Native window "online" event received');
        this.setOnline(true);
      });

      window.addEventListener('offline', () => {
        console.log('[NetworkManager] Native window "offline" event received');
        this.setOnline(false);
      });
    }

    // Start background connectivity ping check
    this.startPingMonitor();
  }

  public async checkConnectivity(): Promise<boolean> {
    if (typeof window !== 'undefined' && typeof window.navigator !== 'undefined') {
      if (window.navigator.onLine === false) {
        return false;
      }
    }

    const testUrls = [
      'https://clients3.google.com/generate_204',
      'https://www.cloudflare.com/cdn-cgi/trace',
      'https://streamingnest-production.up.railway.app/api/client/ping',
    ];

    for (const url of testUrls) {
      try {
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timer = setTimeout(() => {
          try { controller?.abort(); } catch {}
        }, 3000);

        await fetch(url, {
          method: 'HEAD',
          mode: 'no-cors',
          cache: 'no-store',
          signal: controller?.signal,
        });

        clearTimeout(timer);
        return true;
      } catch (e) {
        // try next endpoint
      }
    }

    return false;
  }

  private startPingMonitor() {
    if (this.pingInterval) clearInterval(this.pingInterval);

    // If currently offline, check frequently (every 3.5s) to detect recovery immediately
    // If online, check every 15s to catch silent drops
    const delay = this.isOnlineStatus ? 15000 : 3500;

    this.pingInterval = setInterval(async () => {
      if (this.isChecking) return;
      this.isChecking = true;
      try {
        const connected = await this.checkConnectivity();
        if (connected !== this.isOnlineStatus) {
          this.setOnline(connected);
        }
      } catch {
        if (this.isOnlineStatus) {
          this.setOnline(false);
        }
      } finally {
        this.isChecking = false;
      }
    }, delay);
  }

  public getOnlineStatus(): boolean {
    return this.isOnlineStatus;
  }

  private setOnline(newStatus: boolean) {
    if (this.isOnlineStatus === newStatus) return;
    console.log(`[NetworkManager] Network transition: ${this.isOnlineStatus ? 'ONLINE' : 'OFFLINE'} -> ${newStatus ? 'ONLINE' : 'OFFLINE'}`);
    this.isOnlineStatus = newStatus;

    // Reset ping monitor interval based on new status
    this.startPingMonitor();

    // Notify listeners
    this.listeners.forEach((listener) => {
      try {
        listener(newStatus);
      } catch (err) {
        console.error('[NetworkManager] Listener error:', err);
      }
    });
  }

  public addListener(listener: NetworkListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const networkManager = new NetworkManager();
