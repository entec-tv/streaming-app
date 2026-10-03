import os

path = r'c:\streaming\artifacts\streaming\components\WebVideoPlayer.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

content_nl = content.replace('\r\n', '\n')

# 1. HLS MANIFEST_PARSED play
old_1 = """          if (!paused) {
            video.play().catch(e => {
              console.log('Autoplay prevented, trying muted autoplay', e.name, e.message);
              video.muted = true;
              onMuteChange?.(true);
              video.play().catch(e2 => console.log('Muted autoplay also prevented', e2.name, e2.message));
            });
          }"""

new_1 = """          if (!paused) {
            video.play().catch(e => {
              console.log('[WebVideoPlayer] HLS playback play error / waiting for buffer:', e.name, e.message);
            });
          }"""
content_nl = content_nl.replace(old_1, new_1)

# 2. mpegtsPlayer play
old_2 = """        if (!paused) {
          mpegtsPlayer.play().catch((e: any) => {
            console.log('Autoplay prevented, trying muted', e);
            video.muted = true;
            onMuteChange?.(true);
            mpegtsPlayer?.play().catch((e2: any) => console.log('Muted also prevented', e2));
          });
        }"""

new_2 = """        if (!paused) {
          mpegtsPlayer.play().catch((e: any) => {
            console.log('[WebVideoPlayer] mpegts play error / waiting for buffer:', e);
          });
        }"""
content_nl = content_nl.replace(old_2, new_2)

# 3. Fast path native video play
old_3 = """            handleLoadedMetadata = () => {
              if (!active) return;
              if (!paused) {
                video.play().catch(e => {
                  console.log('Autoplay prevented, trying muted autoplay', e.name, e.message);
                  video.muted = true;
                  video.play().catch(e2 => console.log('Muted autoplay also prevented', e2.name, e2.message));
                });
              }
            };"""

new_3 = """            handleLoadedMetadata = () => {
              if (!active) return;
              if (!paused) {
                video.play().catch(e => {
                  console.log('[WebVideoPlayer] Native video play error:', e.name, e.message);
                });
              }
            };"""
content_nl = content_nl.replace(old_3, new_3)

# 4. Fallback direct video play
old_4 = """        handleLoadedMetadata = () => {
          if (!active) return;
          if (!paused) {
            video.play().catch(e => {
              console.log('Autoplay prevented, trying muted autoplay', e.name, e.message);
              video.muted = true;
              onMuteChange?.(true);
              video.play().catch(e2 => console.log('Muted autoplay also prevented', e2.name, e2.message));
            });
          }
        };"""

new_4 = """        handleLoadedMetadata = () => {
          if (!active) return;
          if (!paused) {
            video.play().catch(e => {
              console.log('[WebVideoPlayer] Direct video play error:', e.name, e.message);
            });
          }
        };"""
content_nl = content_nl.replace(old_4, new_4)

# 5. Paused useEffect play
old_5 = """      } else {
        video.play().catch(e => {
          console.log('Autoplay prevented, trying muted autoplay', e.name, e.message);
          video.muted = true;
          video.play().catch(e2 => console.log('Muted autoplay also prevented', e2.name, e2.message));
        });
      }"""

new_5 = """      } else {
        video.play().catch(e => {
          console.log('[WebVideoPlayer] Video play error:', e.name, e.message);
        });
      }"""
content_nl = content_nl.replace(old_5, new_5)

# Also ensure video.muted is explicitly initialized to muted prop and volume >= 1 if not muted
old_init = "      const initPlayback = async () => {"
new_init = """      const initPlayback = async () => {
        if (video) {
          video.muted = muted;
          if (!muted && video.volume === 0) {
            video.volume = lastNonZeroVolume.current || 1;
          }
        }"""
content_nl = content_nl.replace(old_init, new_init)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content_nl)
print("Removed automatic muting successfully from WebVideoPlayer.tsx!")
