# Tamplan — store listing

Copy these into App Store Connect and Google Play Console. Screenshots and graphics are in `store/ios` and `store/android`.

## Basics

| Field | Value |
| --- | --- |
| App name | Tamplan |
| Bundle ID / package | `com.tammie.tamplan` |
| Price | Free |
| Primary category | Productivity (App Store) · Productivity (Google Play) |
| Secondary category (App Store) | Finance |
| Age rating | 4+ (App Store) · Everyone (Google Play, via the IARC questionnaire) |

## App Store (iPhone)

**Subtitle** (max 30 characters)

> Plan, earn and split rewards

**Promotional text** (max 170 characters, can be changed without review)

> Plan your day with alarms, earn a reward for every task you finish, and split each month's rewards into expenses, savings and investment.

**Keywords** (max 100 characters, comma-separated, no spaces)

> planner,schedule,alarm,tasks,rewards,budget,savings,investment,rupee,habit,todo,money,daily

**Description**

> Tamplan turns your daily plan into rewards you can put to work.
>
> PLAN YOUR DAY
> • A clear week view with everything you've scheduled
> • Items that repeat every day, on weekdays or every week
> • Alarms at the start time or 5, 10, 15, 30 or 60 minutes before
> • Snooze for 5 minutes right from the notification
> • Alarms ring even when the app is closed
>
> EARN REWARDS FOR TASKS
> • Give every task a reward in rupees
> • Tick a task off and the reward is added to your total
> • Daily tasks can be earned again every day
> • See what you've earned today and this month
>
> SPLIT YOUR REWARDS EVERY MONTH
> • At the end of each month, split your total into expenses, savings and investment
> • Simple sliders that always add up to 100%
> • Set your own default split, like 50 / 30 / 20
> • A reminder on the last day of the month
> • Lifetime totals show how much you've saved and invested
>
> PRIVATE BY DESIGN
> • No account and no sign-up
> • Everything stays on your phone
> • Export a backup whenever you like

**Support URL**: your support page or email link. **Privacy policy URL**: the public link to `store/PRIVACY.md` (see LAUNCH.md).

**App Privacy** (the "nutrition label"): choose **Data Not Collected**.

## Google Play

**Short description** (max 80 characters)

> Plan your day with alarms, earn rewards for tasks and split them every month.

**Full description**: use the App Store description above.

**Graphics**

| Asset | File |
| --- | --- |
| App icon (512 × 512) | `store/android/play-icon-512.png` |
| Feature graphic (1024 × 500) | `store/android/feature-graphic.png` |
| Phone screenshots (1080 × 1920) | `store/android/1-schedule.png` … `5-lifetime.png` |

**Data safety form**

| Question | Answer |
| --- | --- |
| Does your app collect or share any of the required user data types? | No |
| Is all of the user data collected by your app encrypted in transit? | Not applicable (nothing is collected) |
| Do you provide a way for users to request that their data is deleted? | Yes: Settings → Erase all data, or uninstall the app |

**Exact alarm permission declaration** (Play Console → App content → Exact alarms)

> Tamplan is a day planner whose core feature is user-set alarms for scheduled items. Users choose the time each alarm rings (at the start time or up to an hour before), so the alarms must fire at that exact time.

**Content rating questionnaire**: category *Utility, Productivity, Communication or Other*; answer **No** to every content question (no violence, gambling, user-generated content, location sharing, purchases or ads).

**Target audience**: 13 and over is the simplest choice. Choosing under-13 brings extra Families policy requirements.

**Ads**: No, the app contains no ads.
