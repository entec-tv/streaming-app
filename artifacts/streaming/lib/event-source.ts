import { Platform } from 'react-native';

export interface EventSourceListener {
  (event: { data: string; type?: string }): void;
}

export interface EventSourceInstance {
  close: () => void;
  addEventListener: (type: string, listener: EventSourceListener) => void;
  removeEventListener: (type: string, listener: EventSourceListener) => void;
}

export function createEventSource(url: string): EventSourceInstance {
  let isClosed = false;
  const messageListeners = new Set<EventSourceListener>();
  const errorListeners = new Set<(err: any) => void>();
  let xhr: XMLHttpRequest | null = null;
  let reconnectTimer: any = null;
  let reconnectAttempts = 0;

  // On Web, use native EventSource if available
  if (Platform.OS === 'web' && typeof window !== 'undefined' && (window as any).EventSource) {
    const es = new (window as any).EventSource(url);

    es.onmessage = (e: any) => {
      messageListeners.forEach(listener => listener({ data: e.data, type: 'message' }));
    };

    es.onerror = (err: any) => {
      errorListeners.forEach(listener => listener(err));
    };

    return {
      close: () => {
        isClosed = true;
        es.close();
        messageListeners.clear();
        errorListeners.clear();
      },
      addEventListener: (type: string, listener: EventSourceListener) => {
        if (type === 'message') {
          messageListeners.add(listener);
        } else if (type === 'error') {
          errorListeners.add(listener);
        }
      },
      removeEventListener: (type: string, listener: EventSourceListener) => {
        if (type === 'message') {
          messageListeners.delete(listener);
        } else if (type === 'error') {
          errorListeners.delete(listener);
        }
      },
    };
  }

  // Pure JS SSE Client using XMLHttpRequest for React Native (Android / iOS / TV)
  const connect = () => {
    if (isClosed) return;

    try {
      xhr = new XMLHttpRequest();
      let lastIndex = 0;
      let buffer = '';

      xhr.open('GET', url, true);
      xhr.setRequestHeader('Accept', 'text/event-stream');
      xhr.setRequestHeader('Cache-Control', 'no-cache');
      xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');

      const handleData = () => {
        if (!xhr) return;
        const text = xhr.responseText || '';
        if (text.length > lastIndex) {
          const newChunk = text.substring(lastIndex);
          lastIndex = text.length;
          buffer += newChunk;

          // SSE events are separated by double newline
          const parts = buffer.split(/\r?\n\r?\n/);
          // Keep the last part in buffer as it might be incomplete
          buffer = parts.pop() || '';

          for (const part of parts) {
            const lines = part.split(/\r?\n/);
            let eventData = '';
            let eventType = 'message';

            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed.startsWith('data:')) {
                const dataPart = trimmed.substring(5).trim();
                eventData = eventData ? eventData + '\n' + dataPart : dataPart;
              } else if (trimmed.startsWith('event:')) {
                eventType = trimmed.substring(6).trim();
              }
            }

            if (eventData) {
              reconnectAttempts = 0; // reset on successful message
              messageListeners.forEach(listener => {
                try {
                  listener({ data: eventData, type: eventType });
                } catch (e) {
                  console.warn('[SSE] Error in message listener', e);
                }
              });
            }
          }
        }
      };

      xhr.onreadystatechange = () => {
        if (!xhr) return;
        if (xhr.readyState === 3 || xhr.readyState === 4) {
          handleData();
        }
        if (xhr.readyState === 4) {
          if (!isClosed) {
            const delay = Math.min(1000 * Math.pow(1.5, reconnectAttempts++), 15000);
            reconnectTimer = setTimeout(connect, delay);
          }
        }
      };

      xhr.onprogress = () => {
        handleData();
      };

      xhr.onerror = (err) => {
        errorListeners.forEach(listener => listener(err));
        if (!isClosed) {
          const delay = Math.min(2000 * Math.pow(1.5, reconnectAttempts++), 15000);
          reconnectTimer = setTimeout(connect, delay);
        }
      };

      xhr.ontimeout = () => {
        if (!isClosed) {
          reconnectTimer = setTimeout(connect, 3000);
        }
      };

      xhr.send();
    } catch (err) {
      console.warn('[SSE] Connect error:', err);
      if (!isClosed) {
        reconnectTimer = setTimeout(connect, 5000);
      }
    }
  };

  connect();

  return {
    close: () => {
      isClosed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (xhr) {
        try { xhr.abort(); } catch {}
        xhr = null;
      }
      messageListeners.clear();
      errorListeners.clear();
    },
    addEventListener: (type: string, listener: EventSourceListener) => {
      if (type === 'message') {
        messageListeners.add(listener);
      } else if (type === 'error') {
        errorListeners.add(listener);
      }
    },
    removeEventListener: (type: string, listener: EventSourceListener) => {
      if (type === 'message') {
        messageListeners.delete(listener);
      } else if (type === 'error') {
        errorListeners.delete(listener);
      }
    },
  };
}
