# Plan — Schedule, Tasks & Rewards

A small installable web app (PWA) for your phone or computer that has no dependencies and works offline.

- **🗓️ Schedule**: plan each day with a week view. Items can repeat once, daily, on weekdays or weekly, and each can have an alarm that rings at the start time or 5–60 minutes before.
- **✅ Tasks**: give each task a reward amount. When you tick a task off, its reward is added to your running total; unticking removes it. Daily tasks can be earned once per day.
- **💰 Rewards**: see how much you earned each month. When the month ends, a banner reminds you to split the total into **Expenses / Savings / Investment** using sliders. The default is 50 / 30 / 20 and you can change it in Settings. A history table and lifetime totals keep track of how much you've saved and invested.

Data is stored on the device in `localStorage`. You can back it up or restore it with **Settings → Export / Import**.

## Run it

```sh
npm start          # serves the folder at http://localhost:8080
npm test           # unit tests for the scheduling / reward / split logic
```

Any static host works. On **GitHub Pages**, go to *Settings → Pages → Deploy from a branch*, choose the branch and `/ (root)`, then open the site on your phone and choose **Add to Home Screen**.

## About alarms

Browsers only let a web app ring alarms **while it is open or running in the background**:

- Tap **🔔** once to allow notifications so alarms also show as system notifications.
- For alarms that must ring even when the app is closed, open the item and tap **📅 Add to calendar**. This downloads an `.ics` file with the same time, repeat rule and alarm, so your phone's built-in calendar rings it.
- On iPhone, notifications only work after the app has been added to the Home Screen (iOS 16.4+).

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Layout, tabs and dialogs |
| `app.js` | UI, storage, alarm loop |
| `logic.js` | Pure logic: repeat rules, alarm timing, reward totals, monthly split, `.ics` export |
| `sw.js` | Offline cache and notification taps |
| `test/` | `node --test` unit tests |
