---
name: trial-and-server-clock
description: Technical workflow for verifying the 7-day trial period and license validity using server-authoritative time and enforcing app lock.
---

# Trial Period & Server Clock Verification Skill

This skill explains how the 7-day complimentary trial and server-authoritative time verification is implemented across the EN-TEC Streaming ecosystem.

## Why Server Time?
Users can easily roll back their device clock on Windows, Android TV, or smartphones to bypass local expiration timers. To prevent piracy and trial abuse:
- The NestJS backend server (`c:\streaming-nest`) provides the authoritative timestamp (`new Date()`).
- All calculations (`isTrialActive`, `trialDaysRemaining`, `appExpiry`) are resolved on the server.

## Data Model (`streaming-nest`)
In `DeviceSchema` (`c:\streaming-nest\src\schemas\device.schema.ts`):
```typescript
@Prop({ type: Date, default: Date.now })
trialStartsAt: Date;

@Prop({ type: Date })
trialEndsAt: Date; // trialStartsAt + 7 days
```

## Backend Trial Calculation (`devices.service.ts` & `client.service.ts`)
```typescript
const serverNow = new Date();
const trialEndsAt = new Date(device.trialEndsAt);
const isTrialActive = serverNow.getTime() < trialEndsAt.getTime();
const diffMs = trialEndsAt.getTime() - serverNow.getTime();
const daysRemaining = isTrialActive ? Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24))) : 0;
```

## App-Side Time Synchronization (`store/app-store.ts`)
On any API call returning `serverTime`:
```typescript
if (data?.serverTime) {
  const sTime = Date.parse(data.serverTime);
  if (!isNaN(sTime)) {
    const offset = sTime - Date.now();
    set({ serverTime: data.serverTime, serverTimeOffset: offset });
  }
}

// Tamper-proof time getter:
const now = getServerTime(); // new Date(Date.now() + serverTimeOffset)
```

## App Lock Flow
1. **Initial Registration (`/client/register-device`)**: Backend registers device, establishes 7-day window.
2. **Authentication (`/client/auth`)**:
   - If device is within 7 days OR has an active admin subscription (`appActive === true` and `appExpiry > serverNow`):
     - `isAppActive = true`, `isAppLocked = false`.
   - If trial has expired AND no active admin license:
     - Returns status `403` with `{ error: 'trial_expired', isAppLocked: true }`.
     - Store sets `isAppLocked = true`, `subscriptionExpired = true`.
3. **Route Protection (`app/_layout.tsx`)**:
   `AuthGuard` checks `if ((!isLoggedIn || isAppLocked || subscriptionExpired) && !inAuthGroup)` -> Forces navigation to `/activation`.
4. **Activation Screen (`app/activation.tsx`)**:
   - Shows dynamic remaining days based on server clock.
   - If expired, disables Demo mode with warning modal directing user to store.
5. **Heartbeat (`sendHeartbeatPing`)**: Runs every 60s to catch real-time expiration during active watching sessions.
