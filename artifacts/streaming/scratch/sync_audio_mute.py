import os

def update_web_video_player():
    path = r'c:\streaming\artifacts\streaming\components\WebVideoPlayer.tsx'
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    content_nl = content.replace('\r\n', '\n')

    # 1. Update WebVideoPlayerRef
    old_ref = """export interface WebVideoPlayerRef {
  seek: (time: number) => void;
  toggleSubtitle: () => string | null | false;
  requestFullscreen: () => void;
  exitFullscreen: () => void;
  togglePiP: () => Promise<void>;
  setVolume: (v: number) => void;
}"""

    new_ref = """export interface WebVideoPlayerRef {
  seek: (time: number) => void;
  toggleSubtitle: () => string | null | false;
  requestFullscreen: () => void;
  exitFullscreen: () => void;
  togglePiP: () => Promise<void>;
  setVolume: (v: number) => void;
  setMuted: (muted: boolean) => void;
  toggleMute: () => boolean;
  getMuted: () => boolean;
  getVolume: () => number;
}"""
    if old_ref in content_nl:
        content_nl = content_nl.replace(old_ref, new_ref, 1)

    # 2. Update WebVideoPlayerProps
    old_props = """  subtitleUrl?: string;
  onSubtitleChange?: (text: string) => void;
}"""

    new_props = """  subtitleUrl?: string;
  onSubtitleChange?: (text: string) => void;
  onMuteChange?: (isMuted: boolean) => void;
  onVolumeChange?: (volume: number) => void;
}"""
    if old_props in content_nl:
        content_nl = content_nl.replace(old_props, new_props, 1)

    # 3. Update component parameters
    old_params = "({ source, style, onProgress, onEnd, aspectMode = 0, paused = false, muted = false, controls = false, onReady, onError, onFullscreenExit, preferredPlayer = 'exo', subtitleUrl, onSubtitleChange }, ref) => {"
    new_params = "({ source, style, onProgress, onEnd, aspectMode = 0, paused = false, muted = false, controls = false, onReady, onError, onFullscreenExit, preferredPlayer = 'exo', subtitleUrl, onSubtitleChange, onMuteChange, onVolumeChange }, ref) => {"
    if old_params in content_nl:
        content_nl = content_nl.replace(old_params, new_params, 1)

    # 4. Add lastNonZeroVolume and dynamic muted sync
    old_parsed_cues = "    const parsedCues = useRef<{start: number, end: number, text: string}[]>([]);"
    new_parsed_cues = """    const parsedCues = useRef<{start: number, end: number, text: string}[]>([]);
    const lastNonZeroVolume = useRef<number>(1);

    // Sync muted prop with actual video element
    useEffect(() => {
      if (videoRef.current) {
        if (videoRef.current.muted !== muted) {
          videoRef.current.muted = muted;
        }
        if (!muted && videoRef.current.volume === 0) {
          videoRef.current.volume = lastNonZeroVolume.current || 1;
        }
      }
    }, [muted]);"""
    if old_parsed_cues in content_nl:
        content_nl = content_nl.replace(old_parsed_cues, new_parsed_cues, 1)

    # 5. Update useImperativeHandle
    old_handle = """      setVolume: (v: number) => {
        if (videoRef.current) {
          videoRef.current.volume = Math.max(0, Math.min(1, v));
        }
      }
    }));"""

    new_handle = """      setVolume: (v: number) => {
        if (videoRef.current) {
          const val = Math.max(0, Math.min(1, v));
          videoRef.current.volume = val;
          if (val > 0) {
            lastNonZeroVolume.current = val;
          }
        }
      },
      setMuted: (m: boolean) => {
        if (videoRef.current) {
          videoRef.current.muted = m;
          if (!m && videoRef.current.volume === 0) {
            videoRef.current.volume = lastNonZeroVolume.current || 1;
          }
          onMuteChange?.(m);
        }
      },
      toggleMute: () => {
        if (videoRef.current) {
          const isCurrentlyMuted = videoRef.current.muted || videoRef.current.volume === 0;
          const next = !isCurrentlyMuted;
          videoRef.current.muted = next;
          if (!next && videoRef.current.volume === 0) {
            videoRef.current.volume = lastNonZeroVolume.current || 1;
          }
          onMuteChange?.(next);
          return next;
        }
        return false;
      },
      getMuted: () => {
        if (videoRef.current) {
          return videoRef.current.muted || videoRef.current.volume === 0;
        }
        return false;
      },
      getVolume: () => videoRef.current?.volume ?? 1
    }));"""
    if old_handle in content_nl:
        content_nl = content_nl.replace(old_handle, new_handle, 1)

    # 6. Add volumechange listener
    old_listeners = """      video.addEventListener('timeupdate', handleTimeUpdate);
      video.addEventListener('ended', handleEnded);
      video.addEventListener('error', handleError);"""

    new_listeners = """      const handleVolumeChange = () => {
        if (!videoRef.current) return;
        const isEffectivelyMuted = videoRef.current.muted || videoRef.current.volume === 0;
        if (videoRef.current.volume > 0) {
          lastNonZeroVolume.current = videoRef.current.volume;
        }
        onMuteChange?.(isEffectivelyMuted);
        onVolumeChange?.(videoRef.current.volume);
      };

      video.addEventListener('timeupdate', handleTimeUpdate);
      video.addEventListener('ended', handleEnded);
      video.addEventListener('error', handleError);
      video.addEventListener('volumechange', handleVolumeChange);

      // Initial check
      handleVolumeChange();"""
    if old_listeners in content_nl:
        content_nl = content_nl.replace(old_listeners, new_listeners, 1)

    # 7. Update handlePlaying to re-check volume state
    old_playing = """      const handlePlaying = () => {
        console.log('[FRONTEND]: [WebVideoPlayer] Video playing event fired!');
        if (onReady) onReady();
      };"""

    new_playing = """      const handlePlaying = () => {
        console.log('[FRONTEND]: [WebVideoPlayer] Video playing event fired!');
        handleVolumeChange();
        if (onReady) onReady();
      };"""
    if old_playing in content_nl:
        content_nl = content_nl.replace(old_playing, new_playing, 1)

    # 8. Update autoplay fallback mute notifications
    old_autoplay1 = """            video.play().catch(e => {
              console.log('Autoplay prevented, trying muted autoplay', e.name, e.message);
              video.muted = true;
              video.play().catch(e2 => console.log('Muted autoplay also prevented', e2.name, e2.message));
            });"""

    new_autoplay1 = """            video.play().catch(e => {
              console.log('Autoplay prevented, trying muted autoplay', e.name, e.message);
              video.muted = true;
              onMuteChange?.(true);
              video.play().catch(e2 => console.log('Muted autoplay also prevented', e2.name, e2.message));
            });"""
    content_nl = content_nl.replace(old_autoplay1, new_autoplay1)

    old_autoplay2 = """          mpegtsPlayer.play().catch((e: any) => {
            console.log('Autoplay prevented, trying muted', e);
            video.muted = true;
            mpegtsPlayer?.play().catch((e2: any) => console.log('Muted also prevented', e2));
          });"""

    new_autoplay2 = """          mpegtsPlayer.play().catch((e: any) => {
            console.log('Autoplay prevented, trying muted', e);
            video.muted = true;
            onMuteChange?.(true);
            mpegtsPlayer?.play().catch((e2: any) => console.log('Muted also prevented', e2));
          });"""
    content_nl = content_nl.replace(old_autoplay2, new_autoplay2)

    # 9. Update cleanup
    old_cleanup = """        video.removeEventListener('timeupdate', handleTimeUpdate);
        video.removeEventListener('ended', handleEnded);
        video.removeEventListener('error', handleError);"""

    new_cleanup = """        video.removeEventListener('timeupdate', handleTimeUpdate);
        video.removeEventListener('ended', handleEnded);
        video.removeEventListener('error', handleError);
        video.removeEventListener('volumechange', handleVolumeChange);"""
    if old_cleanup in content_nl:
        content_nl = content_nl.replace(old_cleanup, new_cleanup, 1)

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content_nl)
    print("WebVideoPlayer.tsx updated successfully!")

def update_player():
    path = r'c:\streaming\artifacts\streaming\app\player.tsx'
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    content_nl = content.replace('\r\n', '\n')

    # 1. Update toggleMute
    old_toggle_mute = """  const toggleMute = () => {
    if (Platform.OS === 'web') {
      setIsMuted(!isMuted);
      return;
    }
    if (!player) return;
    const next = !isMuted;
    player.muted = next;
    setIsMuted(next);
  };"""

    new_toggle_mute = """  const toggleMute = () => {
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
  };"""
    if old_toggle_mute in content_nl:
        content_nl = content_nl.replace(old_toggle_mute, new_toggle_mute, 1)

    # 2. Update WebVideoPlayer usage with onMuteChange and onVolumeChange
    old_web_player = """            <WebVideoPlayer
              key={retryKey}
              ref={webPlayerRef}
              source={proxiedUrl || ''}
              subtitleUrl={selectedSubtitle !== null && proxiedUrl?.includes('/proxy-vod') ? proxiedUrl.replace('/proxy-vod', '/proxy-sub') + `&track=${selectedSubtitle}` : undefined}
              onSubtitleChange={setCurrentSubtitle}
              paused={!isPlaying}
              muted={isMuted}
              aspectMode={aspectMode}"""

    new_web_player = """            <WebVideoPlayer
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
              aspectMode={aspectMode}"""
    if old_web_player in content_nl:
        content_nl = content_nl.replace(old_web_player, new_web_player, 1)

    # 3. Add Mute button next to Favorite in bottom bar controls
    old_fav_btn = """                <TVFocusable 
                  style={({ focused }: any) => [
                    styles.iconBtn,
                    focused && { transform: [{ scale: 1.1 }], backgroundColor: colors.gold, borderWidth: 3, borderColor: '#FFF' }
                  ]} 
                  onPress={handleToggleFavorite}
                >
                  {({ focused }: any) => (
                    <Lineicons icon={HeartBulk} size={20} color={focused ? "#0A0A0A" : (isFavorite ? '#E53935' : '#FFF')} fill={isFavorite ? '#E53935' : 'transparent'} />
                  )}
                </TVFocusable>"""

    new_fav_btn = """                <TVFocusable 
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
                </TVFocusable>"""
    if old_fav_btn in content_nl:
        content_nl = content_nl.replace(old_fav_btn, new_fav_btn, 1)

    # 4. Make the volume slider icon clickable to toggle mute
    old_vol_icon = """              <View style={{ marginTop: 16 }} pointerEvents="none">
                <Lineicons icon={volume === 0 ? VolumeMuteBulk : volume > 0.5 ? VolumeHighBulk : VolumeLowBulk} size={20} color="#FFF" />
              </View>"""

    new_vol_icon = """              <TVFocusable onPress={toggleMute} style={{ marginTop: 16 }} disableBorder>
                <Lineicons icon={isMuted || volume === 0 ? VolumeMuteBulk : volume > 0.5 ? VolumeHighBulk : VolumeLowBulk} size={20} color={isMuted ? "#E53935" : "#FFF"} />
              </TVFocusable>"""
    if old_vol_icon in content_nl:
        content_nl = content_nl.replace(old_vol_icon, new_vol_icon, 1)

    # 5. Update volume pan responder to unmute on positive drag and mute on 0
    old_vol_pan = """        const ratio = 1 - Math.max(0, Math.min(1, evt.nativeEvent.locationY / sliderH));
        setVolume(ratio);
        if (Platform.OS === 'web') {
          webPlayerRef.current?.setVolume(ratio);
        } else {
          if (player) player.volume = ratio;
        }"""

    new_vol_pan = """        const ratio = 1 - Math.max(0, Math.min(1, evt.nativeEvent.locationY / sliderH));
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
        }"""
    if old_vol_pan in content_nl:
        content_nl = content_nl.replace(old_vol_pan, new_vol_pan, 1)

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content_nl)
    print("player.tsx updated successfully!")

def update_live():
    path = r'c:\streaming\artifacts\streaming\app\(tabs)\live.tsx'
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    content_nl = content.replace('\r\n', '\n')

    # 1. Update WebVideoPlayer in live.tsx to pass onMuteChange
    old_live_web_player = """                    <WebVideoPlayer
                      ref={webVideoRef}
                      source={`/proxy?url=${encodeURIComponent(selectedChannel.streamUrl)}`}
                      style={StyleSheet.absoluteFill}
                      paused={isPaused}
                      muted={isMuted}
                      controls={false}"""

    new_live_web_player = """                    <WebVideoPlayer
                      ref={webVideoRef}
                      source={`/proxy?url=${encodeURIComponent(selectedChannel.streamUrl)}`}
                      style={StyleSheet.absoluteFill}
                      paused={isPaused}
                      muted={isMuted}
                      onMuteChange={(mutedState) => setIsMuted(mutedState)}
                      controls={false}"""
    if old_live_web_player in content_nl:
        content_nl = content_nl.replace(old_live_web_player, new_live_web_player, 1)

    # 2. Update fullscreen mute button in live.tsx
    old_fs_mute = """                      <TVFocusable 
                        onPress={() => setIsMuted(!isMuted)}
                        style={({ focused }: any) => [
                          { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
                          focused && { backgroundColor: colors.gold, transform: [{ scale: 1.1 }] }
                        ]}
                      >
                        {({ focused }: any) => <Ionicons name={isMuted ? "volume-mute" : "volume-high"} size={28} color={focused ? "#000" : "#FFF"} />}
                      </TVFocusable>"""

    new_fs_mute = """                      <TVFocusable 
                        onPress={() => {
                          if (Platform.OS === 'web') {
                            if (webVideoRef.current) {
                              const next = webVideoRef.current.toggleMute();
                              setIsMuted(next);
                            } else {
                              setIsMuted(!isMuted);
                            }
                          } else {
                            setIsMuted(!isMuted);
                          }
                        }}
                        style={({ focused }: any) => [
                          { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
                          focused && { backgroundColor: colors.gold, transform: [{ scale: 1.1 }] }
                        ]}
                      >
                        {({ focused }: any) => <Ionicons name={isMuted ? "volume-mute" : "volume-high"} size={28} color={focused ? "#000" : (isMuted ? '#E53935' : '#FFF')} />}
                      </TVFocusable>"""
    if old_fs_mute in content_nl:
        content_nl = content_nl.replace(old_fs_mute, new_fs_mute, 1)

    # 3. Add mute button to small player controls under the player
    old_small_player_fav = """                    <TVFocusable
                      onPress={() => {
                        if (!selectedChannel) return;
                        const channelItem: any = {
                          id: selectedChannel.id,
                          name: selectedChannel.name,
                          logo: selectedChannel.logo || '',
                          category: selectedChannel.category || 'Live TV',
                          streamUrl: selectedChannel.streamUrl,
                          current: selectedChannel.current || '',
                          next: selectedChannel.next || '',
                          quality: selectedChannel.quality || 'HD',
                          isLive: true,
                          type: 'live'
                        };
                        toggleFavorite(channelItem);
                      }}
                      style={({ focused }: any) => [
                        styles.tvFavoriteBtn,
                        { backgroundColor: focused ? colors.gold : 'rgba(255,255,255,0.05)', borderColor: isFavorite ? colors.gold : colors.border, marginTop: 0, paddingHorizontal: 16 }
                      ]}
                    >
                      {({ focused }: any) => (
                        <Lineicons icon={HeartBulk} size={22} color={focused ? '#000' : (isFavorite ? colors.gold : colors.text)} />
                      )}
                    </TVFocusable>"""

    new_small_player_fav = """                    <TVFocusable
                      onPress={() => {
                        if (Platform.OS === 'web') {
                          if (webVideoRef.current) {
                            const next = webVideoRef.current.toggleMute();
                            setIsMuted(next);
                          } else {
                            setIsMuted(!isMuted);
                          }
                        } else {
                          setIsMuted(!isMuted);
                        }
                      }}
                      style={({ focused }: any) => [
                        styles.tvFavoriteBtn,
                        { backgroundColor: focused ? colors.gold : 'rgba(255,255,255,0.05)', borderColor: isMuted ? '#E53935' : colors.border, marginTop: 0, paddingHorizontal: 16 }
                      ]}
                    >
                      {({ focused }: any) => (
                        <Ionicons name={isMuted ? "volume-mute" : "volume-high"} size={22} color={focused ? '#000' : (isMuted ? '#E53935' : colors.text)} />
                      )}
                    </TVFocusable>

                    <TVFocusable
                      onPress={() => {
                        if (!selectedChannel) return;
                        const channelItem: any = {
                          id: selectedChannel.id,
                          name: selectedChannel.name,
                          logo: selectedChannel.logo || '',
                          category: selectedChannel.category || 'Live TV',
                          streamUrl: selectedChannel.streamUrl,
                          current: selectedChannel.current || '',
                          next: selectedChannel.next || '',
                          quality: selectedChannel.quality || 'HD',
                          isLive: true,
                          type: 'live'
                        };
                        toggleFavorite(channelItem);
                      }}
                      style={({ focused }: any) => [
                        styles.tvFavoriteBtn,
                        { backgroundColor: focused ? colors.gold : 'rgba(255,255,255,0.05)', borderColor: isFavorite ? colors.gold : colors.border, marginTop: 0, paddingHorizontal: 16 }
                      ]}
                    >
                      {({ focused }: any) => (
                        <Lineicons icon={HeartBulk} size={22} color={focused ? '#000' : (isFavorite ? colors.gold : colors.text)} />
                      )}
                    </TVFocusable>"""

    if old_small_player_fav in content_nl:
        content_nl = content_nl.replace(old_small_player_fav, new_small_player_fav, 1)

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content_nl)
    print("live.tsx updated successfully!")

if __name__ == '__main__':
    update_web_video_player()
    update_player()
    update_live()
