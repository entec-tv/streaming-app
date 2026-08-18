const fs = require('fs');
const path = require('path');

// 1. Revert app/_layout.tsx
const layoutFile = 'c:/streaming/artifacts/streaming/app/_layout.tsx';
let layoutContent = fs.readFileSync(layoutFile, 'utf8');
if (layoutContent.includes('const customTheme = {')) {
  layoutContent = layoutContent.replace(
    /const customTheme = \{\s*\.\.\.DarkTheme,\s*colors: \{\s*\.\.\.DarkTheme\.colors,\s*background: 'transparent',\s*\},\s*\};\s*function RootLayoutNav\(\) \{/s,
    `function RootLayoutNav() {`
  );
  layoutContent = layoutContent.replace(
    /<ThemeProvider value=\{customTheme\}>/g,
    `<ThemeProvider value={DarkTheme}>`
  );
}

// Remove ImageBackground
if (layoutContent.includes('<ImageBackground source={require(\'../assets/images/background.png\')}')) {
  layoutContent = layoutContent.replace(
    /<ImageBackground source=\{require\('\.\.\/assets\/images\/background\.png'\)\} style=\{\{ flex: 1, backgroundColor: '#05070a' \}\} resizeMode="cover">\s*<StatusBar style="light" hidden=\{true\} \/>\s*<DesktopTitleBar \/>\s*<KeyboardProvider>\s*<RootLayoutNav \/>\s*<\/KeyboardProvider>\s*<GlobalAlert \/>\s*<\/ImageBackground>/,
    `<StatusBar style="light" hidden={true} />
              <DesktopTitleBar />
              <KeyboardProvider>
                <RootLayoutNav />
              </KeyboardProvider>
              <GlobalAlert />`
  );
}
fs.writeFileSync(layoutFile, layoutContent);

// 2. Revert app/(tabs)/_layout.tsx
const tabsLayoutFile = 'c:/streaming/artifacts/streaming/app/(tabs)/_layout.tsx';
let tabsLayoutContent = fs.readFileSync(tabsLayoutFile, 'utf8');
tabsLayoutContent = tabsLayoutContent.replace(
  /colors=\{\['transparent', 'transparent', 'rgba\(5,7,10,0\.5\)', 'rgba\(5,7,10,0\.8\)'\]\}/g,
  `colors={['rgba(5,7,10,1)', 'rgba(5,7,10,1)', 'rgba(5,7,10,1)', 'rgba(28,49,89,0.35)']}`
);
tabsLayoutContent = tabsLayoutContent.replace(
  /style=\{\[StyleSheet\.absoluteFillObject\]\}/g,
  `style={[StyleSheet.absoluteFillObject, { backgroundColor: '#05070a' }]}`
);
fs.writeFileSync(tabsLayoutFile, tabsLayoutContent);


// 3. Revert floatingCardStyle
const dir = 'c:/streaming/artifacts/streaming/app/(tabs)';
const filesToRevert = ['movies.tsx', 'series.tsx', 'live.tsx', 'catchup.tsx'];
for (const file of filesToRevert) {
  const fullPath = path.join(dir, file);
  if (fs.existsSync(fullPath)) {
    let content = fs.readFileSync(fullPath, 'utf8');
    content = content.replace(
      /backgroundColor:\s*colors\.glass,/g,
      "backgroundColor: colors.card,"
    );
    fs.writeFileSync(fullPath, content);
  }
}

// 4. Revert backgroundColor: 'transparent' back to colors.background
function revertTransparentBackground(directory) {
  const files = fs.readdirSync(directory);
  for (const file of files) {
    const fullPath = path.join(directory, file);
    if (fs.statSync(fullPath).isDirectory()) {
      revertTransparentBackground(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      // Specifically target styles.container, { backgroundColor: 'transparent'
      if (content.includes("backgroundColor: 'transparent'") && content.includes("styles.container")) {
        content = content.replace(
          /backgroundColor:\s*'transparent'/g,
          (match, offset, string) => {
            const context = string.substring(Math.max(0, offset - 50), Math.min(string.length, offset + 50));
            // Ensure we only revert the ones we changed
            if (context.includes('styles.container') && !fullPath.includes('_layout')) {
              return "backgroundColor: colors.background";
            }
            return match;
          }
        );
        fs.writeFileSync(fullPath, content);
      }
      
      // Special case for index.tsx TV Layout
      if (fullPath.endsWith('index.tsx') && content.includes("backgroundColor: 'transparent', opacity: isFocused")) {
        content = content.replace("backgroundColor: 'transparent', opacity: isFocused", "backgroundColor: '#000', opacity: isFocused");
        fs.writeFileSync(fullPath, content);
      }
    }
  }
}

revertTransparentBackground('c:/streaming/artifacts/streaming/app');

console.log('Reverted background changes');
