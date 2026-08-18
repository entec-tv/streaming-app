const fs = require("fs");
const path = require("path");

function processFile(filePath) {
  let content = fs.readFileSync(filePath, "utf-8");
  let changed = false;

  if (content.includes("glassPaneStyle") && content.includes("tvPaneCategories")) {
    console.log("Processing", filePath);
    
    // 1. Replace the glassPaneStyle block with floatingCardStyle
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

    // 2. Fix the tvContainer line
    content = content.replace(/<View style=\{\[styles.tvContainer.*?\]\}>/, `<View style={[styles.tvContainer, { backgroundColor: "#0A0C10", gap: 16, padding: 16, opacity: isFocused ? 1 : 0, pointerEvents: isFocused ? 'auto' : 'none' }]}>`);

    // 3. Remove the inner <View style={[{ flexDirection: 'row', flex: 1 }, glassPaneStyle]}>
    content = content.replace(/<View style=\{\[\{ flexDirection: 'row', flex: 1 \}, glassPaneStyle\]\}>/, ``);
    
    // 4. Change tvPaneCategories to use floatingCardStyle and remove its borderRight
    content = content.replace(/<View style=\{\[styles.tvPaneCategories, \{ borderRightWidth.*?\}\]\}>/, `<View style={[styles.tvPaneCategories, floatingCardStyle]}>`);
    
    // 5. Change tvPaneContent to use floatingCardStyle and remove its inline style
    content = content.replace(/<View style=\{\[styles.tvPaneContent, \{ flex: 1 \}\]\}>/, `<View style={[styles.tvPaneContent, floatingCardStyle]}>`);

    // 6. We need to remove the closing </View> for the inner wrapper we removed in step 3. 
    // The easiest way is to find the last </View> before } else { (which closes the if (isLargeScreen) block)
    content = content.replace(/<\/View>\s*<\/View>\s*\);\s*\}/, `</View>\n    );\n  }`);

    // Update stylesheet for TV Title and Categories
    content = content.replace(/tvTitle: \{ fontSize: 24, fontWeight: 'bold' \}/g, `tvTitle: { fontSize: 28, fontWeight: '900', letterSpacing: 0.5 }`);
    content = content.replace(/tvCategoryItem: \{ paddingHorizontal: 24, paddingVertical: 16, borderLeftWidth: 3, borderLeftColor: 'transparent' \}/g, `tvCategoryItem: { paddingHorizontal: 16, paddingVertical: 14, marginHorizontal: 16, marginBottom: 8, borderRadius: 12, borderWidth: 1, borderColor: 'transparent' }`);
    content = content.replace(/tvCategoryText: \{ fontSize: 16 \}/g, `tvCategoryText: { fontSize: 16, letterSpacing: 0.2 }`);
    content = content.replace(/tvPaneCategories: \{ width: 320, borderRightWidth: 1 \}/g, `tvPaneCategories: { width: 320 }`);

    // Also we need to fix the category items padding in `movies.tsx`, `series.tsx`, etc
    // In the TVFocusable rendered for categories, there's `isSelected && { backgroundColor: ..., borderLeftWidth: 3 ... }`
    // We should simplify it to match our new unified design.
    // Replace: `isSelected && { backgroundColor: 'rgba(212,168,67,0.15)', borderLeftWidth: 3, borderLeftColor: colors.gold },`
    content = content.replace(/isSelected && \{ backgroundColor: 'rgba\(.*?\)', borderLeftWidth: 3, borderLeftColor: colors\.gold \},/g, `isSelected && { backgroundColor: 'rgba(255,255,255,0.03)' },`);
    
    // Replace: `focused && { backgroundColor: colors.gold, transform: [{ scale: 1.02 }] }`
    content = content.replace(/focused && \{ backgroundColor: colors\.gold, transform: \[\{ scale: 1\.02 \}\] \}/g, `focused && { backgroundColor: colors.surface }`);
    
    // For text color inside that:
    // Replace: `color: focused ? '#000' : (isSelected ? colors.gold : colors.text)`
    content = content.replace(/color: focused \? '#000' : \(isSelected \? colors\.gold : colors\.text\)/g, `color: focused || isSelected ? colors.gold : colors.mutedForeground`);
    
    fs.writeFileSync(filePath, content, "utf-8");
    changed = true;
  }
}

["series.tsx", "movies.tsx", "catchup.tsx"].forEach(f => {
    processFile(path.join("c:/streaming/artifacts/streaming/app/(tabs)", f));
});
