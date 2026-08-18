const fs = require('fs');

const layoutFile = 'c:/streaming/artifacts/streaming/app/_layout.tsx';
let layoutContent = fs.readFileSync(layoutFile, 'utf8');

// Modify ThemeProvider value
if (!layoutContent.includes('const customTheme = {')) {
  layoutContent = layoutContent.replace(
    /function RootLayoutNav\(\) \{/,
    `const customTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: 'transparent',
  },
};

function RootLayoutNav() {`
  );

  layoutContent = layoutContent.replace(
    /<ThemeProvider value=\{DarkTheme\}>/g,
    `<ThemeProvider value={customTheme}>`
  );
}

fs.writeFileSync(layoutFile, layoutContent);
console.log('Fixed _layout.tsx ThemeProvider');
