---
name: electron-build-pipeline
description: Instructions for bundling the Expo web application and hosting it within the Electron Windows desktop application.
---

# Electron Build & Packaging Pipeline Skill

This skill explains how changes in the React Native / Expo application (`c:\streaming\artifacts\streaming`) are exported and served inside the Electron Windows desktop application (`c:\streaming\windows-app`).

## Development Architecture
1. `artifacts/streaming/`: Source React Native / Expo app.
2. `npx expo export -p web`: Produces a static SPA build in `artifacts/streaming/dist/`.
3. `windows-app/app/`: The folder from which the Electron app loads `index.html`.
4. `windows-app/main.js`: Electron main process which starts a local Express static server and provides cache proxy endpoints (`/api/cache/read`, `/api/cache/write`, `/proxy?url=`).

## Build & Update Steps

### Step 1: Export Web Bundle
Run inside `c:\streaming\artifacts\streaming`:
```powershell
cd C:\streaming\artifacts\streaming
npx expo export -p web
```

### Step 2: Sync to Electron App Folder
Copy all exported files from `dist` to `windows-app/app/`:
```powershell
Copy-Item -Recurse -Force C:\streaming\artifacts\streaming\dist\* C:\streaming\windows-app\app\
```

### Step 3: Run Electron Locally
```powershell
cd C:\streaming\windows-app
npm start
```

### Step 4: Packaging Windows Executable (.exe)
```powershell
cd C:\streaming\windows-app
npm run build
```
This produces an installer executable (`ENTEC Streaming Setup.exe`) inside `windows-app/build_dist/`.

## Common Pitfalls
- **Cached index.html**: Always ensure `windows-app/app/index.html` references the latest generated JS hash from `dist/` (e.g. `index-[hash].js`).
- **Web Security**: Electron's `webPreferences` has `webSecurity: false` intentionally in dev mode to allow streaming from IPTV providers without restrictive CORS headers.
