const fs = require("fs");

function fixFile(file) {
  let content = fs.readFileSync(file, "utf8");

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

  content = content.replace(/<View style=\{\[styles\.tvContainer, \{ backgroundColor: isLargeScreen \? 'transparent' : colors\.background, paddingLeft: 24, opacity: isFocused \? 1 : 0, pointerEvents: isFocused \? 'auto' : 'none' \}\]\}>/, 
  `<View style={[styles.tvContainer, { backgroundColor: "#0A0C10", gap: 16, padding: 16, opacity: isFocused ? 1 : 0, pointerEvents: isFocused ? 'auto' : 'none' }]}>`);

  content = content.replace(/<View style=\{\[\{ flexDirection: 'row', flex: 1 \}, glassPaneStyle\]\}>/, ``);

  // Remove the corresponding closing </View> which is just before <SearchKeyboardModal
  content = content.replace(/<\/View>\s*<SearchKeyboardModal/g, `<SearchKeyboardModal`);
  // Or in catchup, it's just before </View> ); }
  content = content.replace(/<\/View>\s*<\/View>\s*\);\s*\}/g, `</View>\n    );\n  }`);

  content = content.replace(/<View style=\{\[styles\.tvPaneCategories, \{ borderRightWidth: 1, borderRightColor: 'rgba\(255,255,255,0\.08\)' \}\]\}>/, 
  `<View style={[styles.tvPaneCategories, floatingCardStyle]}>`);

  content = content.replace(/<View style=\{\[styles\.tvPaneChannels, \{ borderRightWidth: 1, borderRightColor: 'rgba\(255,255,255,0\.08\)' \}\]\}>/, 
  `<View style={[styles.tvPaneChannels, floatingCardStyle]}>`);

  content = content.replace(/<View style=\{\[styles\.tvPaneDays, \{ borderRightWidth: 1, borderRightColor: 'rgba\(255,255,255,0\.08\)' \}\]\}>/, 
  `<View style={[styles.tvPaneDays, floatingCardStyle]}>`);

  content = content.replace(/<View style=\{\[styles\.tvPaneContent, \{ flex: 1 \}\]\}>/, 
  `<View style={[styles.tvPaneContent, floatingCardStyle]}>`);

  content = content.replace(/<View style=\{\[styles\.tvPaneEpg, \{ flex: 1 \}\]\}>/, 
  `<View style={[styles.tvPaneEpg, floatingCardStyle]}>`);

  content = content.replace(/tvTitle: \{ fontSize: 24, fontWeight: 'bold' \}/g, `tvTitle: { fontSize: 28, fontWeight: '900', letterSpacing: 0.5 }`);
  content = content.replace(/tvCategoryItem: \{ paddingHorizontal: 24, paddingVertical: 16, borderLeftWidth: 3, borderLeftColor: 'transparent' \}/g, `tvCategoryItem: { paddingHorizontal: 16, paddingVertical: 14, marginHorizontal: 16, marginBottom: 8, borderRadius: 12, borderWidth: 1, borderColor: 'transparent', transitionDuration: '200ms' }`);
  content = content.replace(/tvChannelItem: \{ paddingHorizontal: 24, paddingVertical: 16, borderLeftWidth: 3, borderLeftColor: 'transparent' \}/g, `tvChannelItem: { paddingHorizontal: 16, paddingVertical: 14, marginHorizontal: 16, marginBottom: 8, borderRadius: 12, borderWidth: 1, borderColor: 'transparent', transitionDuration: '200ms' }`);
  content = content.replace(/tvDayItem: \{ paddingHorizontal: 24, paddingVertical: 16, borderLeftWidth: 3, borderLeftColor: 'transparent' \}/g, `tvDayItem: { paddingHorizontal: 16, paddingVertical: 14, marginHorizontal: 16, marginBottom: 8, borderRadius: 12, borderWidth: 1, borderColor: 'transparent', transitionDuration: '200ms' }`);
  content = content.replace(/tvCategoryText: \{ fontSize: 16 \}/g, `tvCategoryText: { fontSize: 16, letterSpacing: 0.2 }`);
  content = content.replace(/tvPaneCategories: \{ width: 320, borderRightWidth: 1 \}/g, `tvPaneCategories: { width: 320 }`);
  content = content.replace(/tvPaneChannels: \{ width: 320, borderRightWidth: 1 \}/g, `tvPaneChannels: { width: 320 }`);
  content = content.replace(/tvPaneDays: \{ width: 160, borderRightWidth: 1 \}/g, `tvPaneDays: { width: 160 }`);

  content = content.replace(/isSelected && \{ backgroundColor: 'rgba\(212,168,67,0\.15\)', borderLeftWidth: 3, borderLeftColor: colors\.gold \},/g, `isSelected && { backgroundColor: 'rgba(255,255,255,0.03)' },`);
  content = content.replace(/focused && \{ backgroundColor: colors\.gold, transform: \[\{ scale: 1\.02 \}\] \}/g, `focused && { backgroundColor: colors.surface }`);
  content = content.replace(/color: focused \? '#000' : \(isSelected \? colors\.gold : colors\.text\)/g, `color: focused || isSelected ? colors.gold : colors.mutedForeground`);
  
  // catchup specific focus rules
  content = content.replace(/focused \? '#000' : colors\.text/g, `focused || isSelected ? colors.gold : colors.text`);

  fs.writeFileSync(file, content);
  console.log("Fixed", file);
}

fixFile("c:/streaming/artifacts/streaming/app/(tabs)/series.tsx");
fixFile("c:/streaming/artifacts/streaming/app/(tabs)/movies.tsx");
fixFile("c:/streaming/artifacts/streaming/app/(tabs)/catchup.tsx");
