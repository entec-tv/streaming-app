const fs = require('fs');

const layoutFile = 'c:/streaming/artifacts/streaming/app/_layout.tsx';
let layoutContent = fs.readFileSync(layoutFile, 'utf8');

// Add ImageBackground to imports if not already there
if (!layoutContent.includes('ImageBackground')) {
  layoutContent = layoutContent.replace(
    /import \{ Platform, View, Text, Pressable, useWindowDimensions, StatusBar as RNStatusBar, AppState \} from "react-native";/,
    'import { Platform, View, Text, Pressable, useWindowDimensions, StatusBar as RNStatusBar, AppState, ImageBackground } from "react-native";'
  );
}

// Wrap with ImageBackground
if (!layoutContent.includes('ImageBackground source={require(')) {
  layoutContent = layoutContent.replace(
    /<GestureHandlerRootView style=\{\{ flex: 1 \}\}>\s*<StatusBar style="light" hidden=\{true\} \/>\s*<DesktopTitleBar \/>\s*<KeyboardProvider>\s*<RootLayoutNav \/>\s*<\/KeyboardProvider>\s*<GlobalAlert \/>\s*<\/GestureHandlerRootView>/,
    `<GestureHandlerRootView style={{ flex: 1 }}>
            <ImageBackground source={require('../assets/images/background.png')} style={{ flex: 1, backgroundColor: '#05070a' }} resizeMode="cover">
              <StatusBar style="light" hidden={true} />
              <DesktopTitleBar />
              <KeyboardProvider>
                <RootLayoutNav />
              </KeyboardProvider>
              <GlobalAlert />
            </ImageBackground>
          </GestureHandlerRootView>`
  );
}

fs.writeFileSync(layoutFile, layoutContent);
console.log('Fixed _layout.tsx');
