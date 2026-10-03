import os

path = r'c:\streaming\artifacts\streaming\app\player.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

content_nl = content.replace('\r\n', '\n')

# 1. Update import to include MaterialCommunityIcons
old_import = "import { Ionicons } from '@expo/vector-icons';"
new_import = "import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';"
if old_import in content_nl:
    content_nl = content_nl.replace(old_import, new_import, 1)

# 2. Update rewind and forward buttons to 30s
old_buttons = """                {!isLive && (
                  <TVFocusable 
                    style={({ focused }: any) => [
                      styles.iconBtn,
                      focused && { transform: [{ scale: 1.1 }], backgroundColor: colors.gold, borderWidth: 3, borderColor: '#FFF' }
                    ]} 
                    onPress={() => handleSeekBy(-10)}
                  >
                    {({ focused }: any) => (
                      <Lineicons icon={ShiftLeftBulk} size={20} color={focused ? "#0A0A0A" : "#FFF"} />
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
                    onPress={() => handleSeekBy(10)}
                  >
                    {({ focused }: any) => (
                      <Lineicons icon={ShiftRightBulk} size={20} color={focused ? "#0A0A0A" : "#FFF"} />
                    )}
                  </TVFocusable>
                )}"""

new_buttons = """                {!isLive && (
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
                )}"""

if old_buttons in content_nl:
    content_nl = content_nl.replace(old_buttons, new_buttons, 1)
    print("Replaced buttons successfully!")
else:
    print("Could not find old_buttons!")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content_nl)
print("Saved player.tsx!")
