# Launching Tamplan on the App Store and Google Play

Everything in this folder is ready: listing text (`LISTING.md`), privacy policy (`PRIVACY.md`), screenshots and graphics. The steps below are the parts only you can do, in order.

## 1. Accounts (one-time)

| Account | Cost | Notes |
| --- | --- | --- |
| [Expo](https://expo.dev/signup) | Free | Builds the app in the cloud and uploads it to the stores |
| [Apple Developer Program](https://developer.apple.com/programs/enroll/) | US$99 per year | Enroll as an individual using your Apple ID; approval can take a day or two |
| [Google Play Console](https://play.google.com/console/signup) | US$25 once | Needs ID verification, which can take a few days |

You also need a **support email** for both stores, and a **public link to the privacy policy**. Publishing `PRIVACY.md` as a web page works (ask Claude to do this), as does GitHub Pages.

On a computer with [Node.js](https://nodejs.org) installed, in this project folder:

```sh
npm install
npx eas-cli@latest login
npx eas-cli@latest init        # links the project to your Expo account
```

## 2. App Store (iPhone)

1. **Build**: `npx eas-cli@latest build --platform ios --profile production`
   Sign in with your Apple ID when asked. EAS creates the certificates and the `com.tammie.tamplan` app ID for you.
2. **Upload**: `npx eas-cli@latest submit --platform ios --latest`
   This creates the app in App Store Connect if it doesn't exist yet, and sends the build there. It appears under **TestFlight** after Apple processes it (about 10–30 minutes). Install it on your iPhone through TestFlight and test the alarms.
3. **Fill in the listing** in [App Store Connect](https://appstoreconnect.apple.com) → your app:
   - Text and URLs from `LISTING.md`
   - Screenshots: upload `store/ios/*.png` to the **6.9" iPhone** slot
   - **App Privacy**: Data Not Collected
   - **Age rating** questionnaire: answer No to everything (4+)
   - Pricing: Free, and choose the countries you want
4. **Submit for review**: pick the build, then **Add for Review → Submit**. Review usually takes 1–3 days.

## 3. Google Play (Android)

1. **Create the app** in [Play Console](https://play.google.com/console): *Create app* → name Tamplan, App, Free.
2. **Build**: `npx eas-cli@latest build --platform android --profile production`. This produces an `.aab` file to download.
3. **First upload by hand**: Google requires the very first build to be uploaded manually. In Play Console go to **Test and release → Testing → Internal testing → Create release**, and upload the `.aab`. Later builds can go up automatically with `npx eas-cli@latest submit --platform android` once you add a Google service account key, following EAS's prompts.
4. **App content** (left menu): privacy policy URL, ads (No), content rating, target audience, data safety, and the **exact alarm** declaration. All the answers are in `LISTING.md`.
5. **Store listing**: the short and full description, plus the graphics from `store/android/`.
6. **Testing before production**: new *personal* developer accounts must run a **closed test with at least 12 testers for 14 days** before Google allows a production release. Create a closed testing track, add testers by email (friends and family work), and ask them to install the app and keep it installed. Check Play Console for the current requirement on your account.
7. **Production**: after the test period, choose **Apply for production**, then create a production release with the same build and roll it out. Google's review usually takes a few days for a new app.

## 4. Updates later

For each new version, raise `"version"` in `app.json` (for example `1.0.1`), then run the same `build` and `submit` commands. Build numbers increase automatically.
