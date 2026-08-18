import React, { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';
import { View, StyleSheet, Platform, Text } from 'react-native';
let Hls: any;
let mpegts: any;
let probeStreamType: any;
if (Platform.OS === 'web') {
  Hls = require('hls.js');
  mpegts = require('mpegts.js');
  probeStreamType = require('./streamProbe').probeStreamType;
}
export interface WebVideoPlayerRef {
  seek: (time: number) => void;
  toggleSubtitle: () => string | null | false;
  requestFullscreen: () => void;
  exitFullscreen: () => void;
  togglePiP: () => Promise<void>;
  setVolume: (v: number) => void;
}

interface WebVideoPlayerProps {
  source: string;
  aspectMode?: number;
  style?: any;
  onProgress?: (time: number, duration: number) => void;
  onEnd?: () => void;
  paused?: boolean;
  muted?: boolean;
  onReady?: () => void;
  onError?: (e: any) => void;
  controls?: boolean;
  onFullscreenExit?: () => void;
  preferredPlayer?: 'android' | 'exo';
  subtitleUrl?: string;
  onSubtitleChange?: (text: string) => void;
}

export const WebVideoPlayer = forwardRef<WebVideoPlayerRef, WebVideoPlayerProps>(
  ({ source, style, onProgress, onEnd, aspectMode = 0, paused = false, muted = false, controls = false, onReady, onError, onFullscreenExit, preferredPlayer = 'exo', subtitleUrl, onSubtitleChange }, ref) => {
    const [internalSource, setInternalSource] = React.useState(source);

    useEffect(() => {
      setInternalSource(source);
    }, [source]);

    const videoRef = useRef<HTMLVideoElement>(null);
    const hlsRef = useRef<any | null>(null);
    const transcodeOffset = useRef<number>(0);
    const parsedCues = useRef<{start: number, end: number, text: string}[]>([]);

    useImperativeHandle(ref, () => ({
      seek: (time: number) => {
        if (videoRef.current) {
          if (internalSource.includes('/proxy-vod')) {
            const baseUrl = internalSource.split('&t=')[0];
            transcodeOffset.current = time;
            setInternalSource(`${baseUrl}&t=${time}`);
          } else {
            videoRef.current.currentTime = time;
          }
        }
      },
      toggleSubtitle: () => {
        const hls = hlsRef.current;
        if (hls && hls.subtitleTracks.length > 0) {
          const tracks = hls.subtitleTracks;
          const current = hls.subtitleTrack;
          const next = current + 1;
          if (next >= tracks.length) {
            hls.subtitleTrack = -1; // off
            return null;
          } else {
            hls.subtitleTrack = next;
            return tracks[next].name || `Track ${next + 1}`;
          }
        }
        return false; // No tracks
      },
      requestFullscreen: () => {
        if (videoRef.current) {
          const v = videoRef.current as any;
          if (v.requestFullscreen) v.requestFullscreen();
          else if (v.webkitRequestFullscreen) v.webkitRequestFullscreen();
          else if (v.mozRequestFullScreen) v.mozRequestFullScreen();
          else if (v.msRequestFullscreen) v.msRequestFullscreen();
        }
      },
      exitFullscreen: () => {
        const d = document as any;
        if (d.exitFullscreen) d.exitFullscreen();
        else if (d.webkitExitFullscreen) d.webkitExitFullscreen();
        else if (d.mozCancelFullScreen) d.mozCancelFullScreen();
        else if (d.msExitFullscreen) d.msExitFullscreen();
      },
      togglePiP: async () => {
        if (videoRef.current) {
          if (document.pictureInPictureElement) {
            await document.exitPictureInPicture().catch(e => console.log('PiP exit error:', e));
          } else {
            await (videoRef.current as HTMLVideoElement).requestPictureInPicture().catch(e => console.log('PiP request error:', e));
          }
        }
      },
      setVolume: (v: number) => {
        if (videoRef.current) {
          videoRef.current.volume = Math.max(0, Math.min(1, v));
        }
      }
    }));

    const prevSourceProp = useRef(source);

    useEffect(() => {
      if (Platform.OS !== 'web' || !videoRef.current || !internalSource) return;

      if (prevSourceProp.current !== source) {
         transcodeOffset.current = 0;
         prevSourceProp.current = source;
      }
      
      const video = videoRef.current;
      
      const handleTimeUpdate = () => {
        let currentRealTime = video.currentTime;
        if (internalSource.includes('/proxy-vod')) {
          currentRealTime += transcodeOffset.current;
        }

        if (onProgress) {
          onProgress(currentRealTime, video.duration);
        }

        if (parsedCues.current.length > 0) {
          const activeCue = parsedCues.current.find(c => currentRealTime >= c.start && currentRealTime <= c.end);
          if (activeCue) {
            onSubtitleChange?.(activeCue.text);
          } else {
            onSubtitleChange?.('');
          }
        } else {
          onSubtitleChange?.('');
        }
      };

      const handleEnded = () => {
        if (onEnd) onEnd();
      };

      const handleError = (e: any) => {
        const err = video.error;
        if (onError) {
          if (err) {
            onError({ type: 'html5', code: err.code, message: err.message });
          } else {
            onError(e);
          }
        }
      };

      video.addEventListener('timeupdate', handleTimeUpdate);
      video.addEventListener('ended', handleEnded);
      video.addEventListener('error', handleError);

      let hls: any | null = null;
      let hlsRetryCount = 0;
      let retryTimeout: ReturnType<typeof setTimeout>;
      let mpegtsPlayer: any = null;

      const loadHls = (targetUrl: string = internalSource) => {
        if (hls) {
          hls.destroy();
        }
        hls = new Hls({
          debug: false,
          enableWorker: true,
          lowLatencyMode: false,
          liveBackBufferLength: 0,
          backBufferLength: 90,
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          maxBufferSize: 50 * 1000 * 1000,
          liveSyncDurationCount: 3,
          liveMaxLatencyDurationCount: 15,
          startFragPrefetch: true,
          testBandwidth: false,
        });
        hlsRef.current = hls;

        hls.loadSource(targetUrl);
        hls.attachMedia(video);
        
        hls.on(Hls.Events.ERROR, (event: any, data: any) => {
          if (data.fatal) {
            console.log('HLS fatal error:', data);
            if (hlsRetryCount < 3) {
              hlsRetryCount++;
              const delay = [3000, 5000, 8000][hlsRetryCount - 1];
              console.log(`Hls.js fatal error, retrying in ${delay}ms...`);
              retryTimeout = setTimeout(() => {
                 loadHls(targetUrl);
              }, delay);
            } else {
              if (onError) onError(data);
            }
          }
        });

        hls.on(Hls.Events.MANIFEST_PARSED, function (event: any, data: any) {
          hlsRetryCount = 0; // reset on success
          if (!active) return; // stale handler — source has changed
          if (!paused) {
            video.play().catch(e => {
              console.log('Autoplay prevented, trying muted autoplay', e.name, e.message);
              video.muted = true;
              video.play().catch(e2 => console.log('Muted autoplay also prevented', e2.name, e2.message));
            });
          }
        });
      };

      const loadMpegTs = (targetUrl: string = internalSource) => {
        if (mpegtsPlayer) {
          mpegtsPlayer.destroy();
        }
        
        let finalUrl = targetUrl;
        if (finalUrl.startsWith('/')) {
          finalUrl = window.location.origin + finalUrl;
        }
        
        mpegtsPlayer = mpegts.createPlayer({
          type: 'mse',
          isLive: !targetUrl.includes('/proxy-vod'),
          url: finalUrl,
        }, {
          enableWorker: true,
          liveBufferLatencyChasing: false,
          liveBufferLatencyMaxLatency: 10,
          liveBufferLatencyMinRemain: 2,
          lazyLoad: false,
        });
        mpegtsPlayer.attachMediaElement(video);
        mpegtsPlayer.load();

        mpegtsPlayer.on(mpegts.Events.ERROR, (errorType: any, errorDetail: any, errorInfo: any) => {
          console.log('mpegts error:', errorType, errorDetail, errorInfo);
          if (onError) onError({ type: errorType, code: errorDetail, message: errorInfo });
        });

        if (!active) return;
        if (!paused) {
          mpegtsPlayer.play().catch((e: any) => {
            console.log('Autoplay prevented, trying muted', e);
            video.muted = true;
            mpegtsPlayer?.play().catch((e2: any) => console.log('Muted also prevented', e2));
          });
        }
      };

      let active = true; // guard against stale closures when source changes
      let handleLoadedMetadata: (() => void) | null = null;

      const initPlayback = async () => {
        const isVOD = internalSource.toLowerCase().includes('.mp4') || internalSource.toLowerCase().includes('.mkv') || internalSource.toLowerCase().includes('.avi');
        const isProxyLive = internalSource.includes('/proxy') && !internalSource.includes('/proxy-vod') && !internalSource.includes('.m3u8');
        const isProxyVOD = internalSource.includes('/proxy-vod');
        const isTs = internalSource.toLowerCase().includes('.ts');
        
        const isNativePreferred = preferredPlayer === 'android';

        // Fast path for obvious VOD or Proxy links
        if (isVOD || isProxyVOD || isProxyLive || isTs || internalSource.includes('.m3u8')) {
          let shouldMpegTs = false;
          try {
            shouldMpegTs = !isNativePreferred && mpegts.getFeatureList().mseLivePlayback && (isTs || isProxyLive);
          } catch (e) { }

          if (shouldMpegTs) {
            loadMpegTs(internalSource);
          } else if (!isProxyVOD && preferredPlayer === 'exo' && Hls.isSupported() && !isVOD && (internalSource.includes('.m3u8') || internalSource.includes('mpegurl') || isProxyLive)) {
            loadHls(internalSource);
          } else {
            video.src = internalSource;
            handleLoadedMetadata = () => {
              if (!active) return;
              if (!paused) {
                video.play().catch(e => {
                  console.log('Autoplay prevented, trying muted autoplay', e.name, e.message);
                  video.muted = true;
                  video.play().catch(e2 => console.log('Muted autoplay also prevented', e2.name, e2.message));
                });
              }
            };
            video.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true });
          }
          return;
        }

        // It's likely an extensionless direct URL. Let's probe it!
        const { kind, resolvedUrl } = await probeStreamType(internalSource);
        if (!active) return; // Component unmounted or source changed

        if (kind === 'ts') {
          let shouldMpegTs = false;
          try {
            shouldMpegTs = !isNativePreferred && mpegts.getFeatureList().mseLivePlayback;
          } catch (e) { }
          
          if (shouldMpegTs) {
            loadMpegTs(resolvedUrl);
            return;
          }
        } else if (kind === 'hls' && preferredPlayer === 'exo' && Hls.isSupported()) {
          loadHls(resolvedUrl);
          return;
        }

        // Fallback or Unknown
        try {
          if (!isNativePreferred && mpegts.getFeatureList().mseLivePlayback) {
            loadMpegTs(resolvedUrl);
            return;
          }
        } catch(e) {}
        
        if (preferredPlayer === 'exo' && Hls.isSupported()) {
          loadHls(resolvedUrl);
          return;
        }
        
        // Final desperate fallback to native video
        video.src = resolvedUrl;
        handleLoadedMetadata = () => {
          if (!active) return;
          if (!paused) {
            video.play().catch(e => {
              console.log('Autoplay prevented, trying muted autoplay', e.name, e.message);
              video.muted = true;
              video.play().catch(e2 => console.log('Muted autoplay also prevented', e2.name, e2.message));
            });
          }
        };
        video.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true });
      };

      initPlayback();

      const handlePlaying = () => {
        console.log('[FRONTEND]: [WebVideoPlayer] Video playing event fired!');
        if (onReady) onReady();
      };
      video.addEventListener('playing', handlePlaying);

      const handleFullscreenChange = () => {
        const isFs = document.fullscreenElement || (document as any).webkitFullscreenElement || (document as any).mozFullScreenElement || (document as any).msFullscreenElement;
        if (!isFs && onFullscreenExit) {
          onFullscreenExit();
        }
      };
      document.addEventListener('fullscreenchange', handleFullscreenChange);
      document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.addEventListener('mozfullscreenchange', handleFullscreenChange);
      document.addEventListener('msfullscreenchange', handleFullscreenChange);

      return () => {
        console.log('[FRONTEND]: [WebVideoPlayer] Cleanup running for source:', internalSource);
        active = false; // disable all pending async callbacks for this source
        if (retryTimeout) clearTimeout(retryTimeout);
        video.removeEventListener('timeupdate', handleTimeUpdate);
        video.removeEventListener('ended', handleEnded);
        video.removeEventListener('playing', handlePlaying);
        video.removeEventListener('error', handleError);
        if (handleLoadedMetadata) {
          video.removeEventListener('loadedmetadata', handleLoadedMetadata);
        }
        document.removeEventListener('fullscreenchange', handleFullscreenChange);
        document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
        document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
        document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
        video.pause();
        video.removeAttribute('src');
        video.load();
        if (hls) {
          console.log('[FRONTEND]: [WebVideoPlayer] Destroying HLS instance');
          hls.destroy();
        }
        if (mpegtsPlayer) {
          console.log('[FRONTEND]: [WebVideoPlayer] Destroying mpegts instance');
          mpegtsPlayer.destroy();
        }
      };
    }, [internalSource]);

    useEffect(() => {
      if (Platform.OS !== 'web' || !videoRef.current) return;
      const video = videoRef.current;
      // Auto-focus the video element so keyboard controls work immediately
      video.focus();
      // Only act if the video already has a source loaded
      if (!video.src && !video.currentSrc) return;
      if (paused) {
        video.pause();
      } else {
        video.play().catch(e => {
          console.log('Autoplay prevented, trying muted autoplay', e.name, e.message);
          video.muted = true;
          video.play().catch(e2 => console.log('Muted autoplay also prevented', e2.name, e2.message));
        });
      }
    }, [paused]);

    useEffect(() => {
      if (Platform.OS !== 'web' || !videoRef.current) return;
      const video = videoRef.current;
      
      if (subtitleUrl) {
        console.log('[FRONTEND]: [WebVideoPlayer] Fetching subtitle track dynamically:', subtitleUrl);
        parsedCues.current = [];
        onSubtitleChange?.('');
        
        const abortController = new AbortController();
        (video as any).subtitleFetchController = abortController;
        
        const parseVttTime = (timeStr: string) => {
          const parts = timeStr.trim().split(':');
          let seconds = 0;
          if (parts.length === 3) {
            seconds += parseFloat(parts[0]) * 3600;
            seconds += parseFloat(parts[1]) * 60;
            seconds += parseFloat(parts[2]);
          } else if (parts.length === 2) {
            seconds += parseFloat(parts[0]) * 60;
            seconds += parseFloat(parts[1]);
          }
          return seconds;
        };

        fetch(subtitleUrl, { signal: abortController.signal }).then(async (response) => {
          if (!response.body) return;
          const reader = response.body.getReader();
          const decoder = new TextDecoder('utf-8');
          let buffer = '';
          
          const processParts = (parts: string[]) => {
            for (const part of parts) {
              const lines = part.trim().split(/\r?\n/);
              let timeLineIdx = lines.findIndex(l => l.includes('-->'));
              if (timeLineIdx !== -1) {
                const timeLine = lines[timeLineIdx];
                const textLines = lines.slice(timeLineIdx + 1).join('\n');
                const [startStr, endStr] = timeLine.split('-->');
                const start = parseVttTime(startStr);
                const end = parseVttTime(endStr);
                
                parsedCues.current.push({ start, end, text: textLines });
              }
            }
          };

          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              if (buffer.trim()) {
                processParts([buffer]);
              }
              break;
            }
            
            buffer += decoder.decode(value, { stream: true });
            let parts = buffer.split(/\r?\n\r?\n/);
            buffer = parts.pop() || '';
            processParts(parts);
          }
        }).catch(err => {
          if (err.name !== 'AbortError') console.log('VTT fetch error', err);
        });
      } else {
        parsedCues.current = [];
        onSubtitleChange?.('');
      }
      
      return () => {
        if ((video as any).subtitleFetchController) {
          (video as any).subtitleFetchController.abort();
        }
      };
    }, [subtitleUrl]);

    if (Platform.OS !== 'web') return null;

    return (
      <View style={style}>
        <video
          ref={videoRef}
          tabIndex={0}
          style={{
            width: '100%',
            height: '100%',
            objectFit: aspectMode === 0 ? 'contain' : aspectMode === 1 ? 'fill' : aspectMode === 2 ? 'cover' : aspectMode === 3 ? 'fill' : 'contain',
            transform: aspectMode === 3 ? 'scaleX(1.33)' : aspectMode === 4 ? 'scaleX(0.75)' : 'none',
            outline: 'none'
          }}
          controls={controls}
          playsInline
          muted={muted}
          crossOrigin="anonymous"
        >
        </video>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
});
