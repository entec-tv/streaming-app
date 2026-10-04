---
name: ecosystem-sync
description: Cross-workspace integration guide for coordinating changes across the Streaming App, Admin Dashboard, and NestJS Backend.
---

# Ecosystem Synchronization Skill

This skill outlines how data and actions flow across the three repositories in the EN-TEC Streaming ecosystem.

## Workspace Triad

1. **`c:\streaming`** (Frontend App + Electron Wrapper)
2. **`c:\streaming-admin`** (Admin Dashboard)
3. **`c:\streaming-nest`** (Backend API & Database)

## Data Flow Sequences

### Sequence 1: Client First Boot & Trial Initiation
1. App calls `POST /client/register-device` with `{ macAddress, deviceKey }`.
2. Backend checks if device exists in MongoDB:
   - If not, sets `trialStartsAt: new Date()` and `trialEndsAt: trialStartsAt + 7 days`.
3. Backend returns `serverTime` and trial timestamps.
4. App stores `serverTimeOffset = Date.parse(serverTime) - Date.now()`.
5. App displays dynamic remaining trial days on the activation screen.

### Sequence 2: Client Web Portal Playlist Upload
1. Client logs into `https://subscription.entec.store` using MAC & Key.
2. Client saves custom M3U playlist.
3. Backend saves playlist to `Device.customPlaylists`.
4. Backend checks if `Customer` exists. If not, creates new `Customer` with `name = macAddress` and `status = ACTIVE`.
5. If the playlist URL uses an unknown IPTV host, backend ensures it is accessible to admin dropdowns under `آخر: [host]`.

### Sequence 3: Admin Activation & Real-Time Push
1. Admin navigates to `/customers` in `c:\streaming-admin`.
2. Admin assigns an IPTV subscription to the customer's MAC address and sets `appActive = true`.
3. Admin saves the subscription.
4. Admin panel calls `POST /client/devices/:macAddress/refresh`.
5. Backend broadcasts a `REFRESH` event through the persistent SSE connection.
6. The app on the user's TV/PC catches the event, invalidates channel caches, re-authenticates with `/client/auth`, and immediately unlocks and syncs playlists with zero restart required.
