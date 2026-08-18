const fs = require("fs");
const path = require("path");

const filePath = "c:/streaming/artifacts/streaming/app/(tabs)/catchup.tsx";
let content = fs.readFileSync(filePath, "utf-8");

if (content.includes("glassPaneStyle")) {
  content = content.replace(/const glassPaneStyle: any = isWeb \? \{[\s\S]*?\} : \{[\s\S]*?\};/, `const floatingCardStyle = isLargeScreen ? {
    backgroundColor: "#0F1115",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.03)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    overflow: "hidden"
  } : {};`);

  content = content.replace(/<View style=\{\[styles.tvContainer.*?\]\}>/, `<View style={[styles.tvContainer, { backgroundColor: "#0A0C10", gap: 16, padding: 16, opacity: isFocused ? 1 : 0, pointerEvents: isFocused ? 'auto' : 'none' }]}>`);
  content = content.replace(/<View style=\{\[\{ flexDirection: 'row', flex: 1 \}, glassPaneStyle\]\}>/, ``);
  
  content = content.replace(/<View style=\{\[styles.tvPaneChannels, \{ borderRightWidth.*?\}\]\}>/, `<View style={[styles.tvPaneChannels, floatingCardStyle]}>`);
  content = content.replace(/<View style=\{\[styles.tvPaneDays, \{ borderRightWidth.*?\}\]\}>/, `<View style={[styles.tvPaneDays, floatingCardStyle]}>`);
  content = content.replace(/<View style=\{\[styles.tvPaneEpg, \{ flex: 1 \}\]\}>/, `<View style={[styles.tvPaneEpg, floatingCardStyle]}>`);

  // Remove trailing </View>
  content = content.replace(/<\/View>\s*<\/View>\s*\);\s*\}/, `</View>\n    );\n  }`);

  // Clean CSS
  content = content.replace(/tvTitle: \{ fontSize: 24, fontWeight: 'bold' \}/g, `tvTitle: { fontSize: 28, fontWeight: '900', letterSpacing: 0.5 }`);
  
  // Clean focus logic
  content = content.replace(/isSelected && \{ backgroundColor: 'rgba\(.*?\)', borderLeftWidth: 3, borderLeftColor: colors\.gold \},/g, `isSelected && { backgroundColor: 'rgba(255,255,255,0.03)' },`);
  content = content.replace(/focused && \{ backgroundColor: colors\.gold, transform: \[\{ scale: 1\.02 \}\] \}/g, `focused && { backgroundColor: colors.surface }`);
  content = content.replace(/color: focused \? '#000' : \(isSelected \? colors\.gold : colors\.text\)/g, `color: focused || isSelected ? colors.gold : colors.mutedForeground`);
  
  // Clean tvPane dimensions
  content = content.replace(/tvPaneChannels: \{ width: 320, borderRightWidth: 1 \}/g, `tvPaneChannels: { width: 320 }`);
  content = content.replace(/tvPaneDays: \{ width: 160, borderRightWidth: 1 \}/g, `tvPaneDays: { width: 160 }`);
  content = content.replace(/tvChannelItem: \{ paddingHorizontal: 24, paddingVertical: 16, borderLeftWidth: 3, borderLeftColor: 'transparent' \}/g, `tvChannelItem: { paddingHorizontal: 16, paddingVertical: 14, marginHorizontal: 16, marginBottom: 8, borderRadius: 12, borderWidth: 1, borderColor: 'transparent' }`);
  content = content.replace(/tvDayItem: \{ paddingHorizontal: 24, paddingVertical: 16, borderLeftWidth: 3, borderLeftColor: 'transparent' \}/g, `tvDayItem: { paddingHorizontal: 16, paddingVertical: 14, marginHorizontal: 16, marginBottom: 8, borderRadius: 12, borderWidth: 1, borderColor: 'transparent' }`);

  fs.writeFileSync(filePath, content, "utf-8");
  console.log("Fixed catchup");
}
