# Tamplan — Schedule, Tasks & Rewards

An iPhone and Android app built with [Expo](https://expo.dev) (React Native), from a single codebase.

- **📅 Schedule**: plan each day in a week view. Items can repeat once, every day, on weekdays or every week. Each item can have an **alarm** that rings at the start time or 5–60 minutes before, with a **Snooze 5 min** button.
- **✅ Tasks**: give each task a reward. Ticking a task off adds its reward to your total; unticking removes it. Daily tasks can be earned once per day.
- **💰 Rewards**: see each month's total. When the month ends, split it into **Expenses / Savings / Investment** with sliders. The default is 50 / 30 / 20 and you can change it in Settings. The three parts always add up to the exact total. A history and lifetime totals show how much you've saved and invested. On the last day of each month at 8 PM you get a reminder notification.

Data is stored only on the phone. You can save a backup or restore one in **Settings → Backup**.

## How the alarms work

Alarms are scheduled with the phone's own notification system (`expo-notifications`), so they **ring even when the app is closed or the phone has restarted**.

- Repeating items use the operating system's own daily or weekly triggers, so they keep ringing even if you never open the app again.
- One-time items, and repeating items whose start date is more than a cycle away, are scheduled for exact dates. These are topped up automatically each time you open the app.
- **iPhone**: alarms are marked *Time Sensitive*, so they break through Focus modes. iOS limits an app to 64 pending alarms, and Tamplan keeps the 60 soonest. Unlike the built-in Clock app, a third-party app can't play a sound that loops until you stop it; you get a notification with sound.
- **Android**: alarms use a dedicated "Alarms" channel with alarm audio, vibration and *exact* timing (`USE_EXACT_ALARM`).

To check that alarms work on a phone, go to **Settings → Send a test alarm**.

## Run it on your phone

You need [Node.js](https://nodejs.org) 20+ and a free [Expo account](https://expo.dev/signup).

```sh
npm install
```

### Option A: install the real app (recommended)

Expo's EAS service builds the app in the cloud, so you don't need Xcode or Android Studio.

```sh
npx eas-cli@latest login
npx eas-cli@latest init                                         # links the project to your Expo account (first time only)

# Android: produces an .apk download link — open it on the phone to install
npx eas-cli@latest build --profile preview --platform android

# iPhone: needs an Apple Developer account ($99/year)
npx eas-cli@latest device:create                                # register your iPhone (first time only)
npx eas-cli@latest build --profile preview --platform ios
```

To publish to the stores, run `npx eas-cli@latest build --profile production` and then `npx eas-cli@latest submit`. For iOS this goes to TestFlight and the App Store; for Android it goes to Google Play.

### Option B: develop with live reload

Build a development client once (`--profile development`) and install it on the phone. Then run:

```sh
npx expo start
```

and scan the QR code. Code changes appear on the phone instantly.

## Project layout

| Path | Purpose |
| --- | --- |
| `src/app/(tabs)/index.tsx` | Schedule tab |
| `src/app/(tabs)/tasks.tsx` | Tasks tab |
| `src/app/(tabs)/rewards.tsx` | Rewards tab and monthly split |
| `src/app/event.tsx`, `task.tsx`, `settings.tsx` | Add/edit screens (opened as modals) |
| `src/lib/logic.ts` | Pure logic: repeat rules, alarm planning, rewards, split maths |
| `src/lib/notifications.ts` | Scheduling OS alarms, snooze, permission handling |
| `src/lib/store.tsx` | App state, saved on the device with AsyncStorage |
| `test/logic.test.ts` | Unit tests |

```sh
npm test          # unit tests (Node's built-in test runner)
npm run typecheck
npm run lint
```

The app ID is `com.tammie.tamplan` for both iOS and Android, set in `app.json`. Change it before the first store submission if you want a different one. The `web` target is only used for quick previews, and alarms are disabled there.
