# 📱 Codex Instructions — Streaming App Workspace (`c:\streaming`)

This workspace contains the user-facing Streaming Application for EN-TEC Streaming:
- `artifacts/streaming/`: React Native (Expo SDK 52) application for Android TV, Apple TV, Web, and Mobile.
- `windows-app/`: Electron desktop application that serves the exported Expo web bundle.

---

## 🛑 Strict Development Rules

### 1. TV Remote Navigation & Focus (MANDATORY)
Smart TVs (Android TV, tvOS) and Keyboard/D-Pad desktop users navigate using directional controls (Up, Down, Left, Right, OK):
- **NEVER** use standard React Native `<Pressable>`, `<TouchableOpacity>`, or `<TouchableWithoutFeedback>`.
- **ALWAYS** use `<TVFocusable>` located at `@/components/TVFocusable`.
- Example implementation:
  ```tsx
  import { TVFocusable } from '@/components/TVFocusable';

  <TVFocusable
    onPress={() => handleAction()}
    style={({ focused }: any) => [
      styles.button,
      focused && styles.buttonFocused, // Golden outline & scale(1.05)
    ]}
  >
    {({ focused }: any) => (
      <Text style={{ color: focused ? '#000' : '#FFF' }}>
        Click Me
      </Text>
    )}
  </TVFocusable>
  ```
- For background overlays (e.g., closing a modal on tap/click):
  Use `<TVFocusable disableBorder />` or ensure non-interactive containers have `focusable={false}` so they do NOT trap D-Pad focus.

---

## ⏱️ 2. Trial Period & App Locking Mechanics

1. **Server Clock Authority**:
   - The app NEVER evaluates license expiration against the local system clock (`Date.now()`).
   - On initial registration (`/client/register-device`) and auth (`/client/auth`), the server returns `serverTime`.
   - The store calculates `serverTimeOffset = Date.parse(serverTime) - Date.now()`.
   - `getServerTime()` returns `new Date(Date.now() + serverTimeOffset)`.

2. **Lock State**:
   - `isAppLocked`: Boolean in Zustand store (`store/app-store.ts`).
   - If `isAppLocked || subscriptionExpired`:
     - `AuthGuard` in `app/_layout.tsx` redirects the user to `/activation`.
     - In `activation.tsx`, the trial status displays `"Trial expired: Your 7-day complimentary trial has ended."`
     - The **Demo** button is locked (`"Trial Expired"` with lock icon), and clicking it displays an alert preventing entry.
     - Only an active paid license (`appActive: true` and `appExpiry > serverNow`) or an active 7-day trial unlocks the app.

---

## 🛠️ 3. Build & Deploy Workflow for Windows App

When updating UI code in `artifacts/streaming/`, you must export the bundle and copy it to `windows-app/`:

```powershell
# Step 1: Export web bundle
cd C:\streaming\artifacts\streaming
npx expo export -p web

# Step 2: Copy to windows-app/app
Copy-Item -Recurse -Force C:\streaming\artifacts\streaming\dist\* C:\streaming\windows-app\app\

# Step 3: Run Desktop App
cd C:\streaming\windows-app
npm start
```

---

## 🗃️ 4. State Management (`store/app-store.ts`)

- **Zustand Store**: Contains all global state (playlists, active channels, continue watching, categories, search index, trial status).
- **Disk Caching**: In Web/Electron, `AsyncStorage` redirects large data keys (e.g., `channels_*`, `search_index_*`) to local HTTP cache endpoints `/api/cache/read` and `/api/cache/write` implemented in `windows-app/main.js`.
- **Xtream Codes API Parser**: In `loadPlaylistFromUrl()`, validates credentials with Xtream `player_api.php`, loads categories, and parses live, vod, and series streams with fallback proxies (`/proxy?url=`, `corsproxy.io`).
