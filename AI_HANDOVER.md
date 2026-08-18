# 🤖 AI Handover Document (Project: EN-TEC-Streaming)

Hello fellow AI! The user has requested this document to help you understand the current state, architecture, and quirks of this project so you can resume work seamlessly.

## 📁 Repository Structure (Monorepo)

This project is a monorepo currently managed by **npm workspaces** (Note: it was recently migrated from `pnpm`, so avoid using `pnpm` commands). 
Key directories:
- `artifacts/streaming/`: The main Frontend application (React Native / Expo).
- `artifacts/api-server/`: The backend API Server (Node.js / Express / Drizzle ORM).
- `windows-app/`: An Electron wrapper that serves the Desktop application by hosting the exported web bundle of the frontend.
- `lib/db/`: Database schemas and ORM configurations.

## 📺 Frontend (`artifacts/streaming/`)

### Tech Stack & Libraries
- **Framework**: React Native + Expo (with Expo Router for navigation).
- **State Management**: Zustand (`store/app-store.ts`). This file is very large and handles all API interactions (Xtream Codes API), playlist parsing, and user settings (`moreOptions`).
- **Styling**: Standard React Native `StyleSheet`, with a custom hook `useColors()` for theming.

### 🎮 TV vs. Touch Compatibility (CRITICAL)
The app is designed to work on both standard touch screens (Mobile/Web) and **Smart TVs (Android TV / tvOS)**.
- **Rule**: NEVER use standard `<Pressable>`, `<TouchableOpacity>`, or `<TouchableWithoutFeedback>` for interactive elements.
- **Always use**: `<TVFocusable>` (located in `@/components/TVFocusable`). This custom component properly hooks into the TV's spatial navigation engine (D-Pad).

### 🌟 Recently Implemented Features
- **Live TV EPG**: Added a component (`EpgNowNext.tsx`) that displays "Now" and "Next" programs directly on the Live TV channel list. It uses a 500ms debounce and a 5-minute memory cache to prevent spamming the Xtream Codes server.
- **More Options Settings**: Configurable toggles for behaviors like Stream URL redirection checks, appending `.m3u8`/`.ts` to URLs, and global search toggles.

## 🛠️ Build & Deployment Workflow

Because `npm` is now the package manager, all scripts must reflect this.
- To build the frontend for the Desktop app, we use `npx expo export -p web` inside `artifacts/streaming/`.
- The resulting `dist/` directory is then copied to `windows-app/app/`.
- **Command Example**:
  ```powershell
  cd c:\streaming\artifacts\streaming
  npx expo export -p web 2>&1; if ($?) { Copy-Item -Path "dist\*" -Destination "..\..\windows-app\app" -Recurse -Force }
  ```
- To start the desktop app, run `npm start` inside `c:\streaming\windows-app`.

## 🚨 Pending Tasks & Immediate Next Steps

The user previously requested the following, which is the immediate next priority for you:
1. **Responsive Redesign for Details Pages**: 
   The files `movie-detail.tsx` and `series-detail.tsx` need to be refactored to look natural and beautiful on **small screens (Mobile)**. Currently, their layout might be geared more towards large TV screens or desktop interfaces.
   - *User's exact words*: "صفحة التفاصيل تحتاج الى اعادة تشكيل في الصفحات الصغيرة" (The details page needs restructuring on small pages/screens).

## 💡 Quirks & Known Issues
- **TypeScript Errors**: We recently cleared out some leftover TS errors (e.g., a missing `moveCategory` function in `live.tsx` that was removed during a refactor). If you run `npm run typecheck`, be careful when fixing unrelated errors; some might be incomplete refactors from previous sessions. Only fix what is necessary for the current task.
- **Workspace Versions**: In `package.json`, intra-workspace dependencies use explicit versions (e.g., `"@workspace/db": "1.0.0"`) instead of `workspace:*` because the latter caused `npm install` to throw `Invalid Version` errors.

Good luck! Build something beautiful that WOWs the user.
