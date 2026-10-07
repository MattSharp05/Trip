# Demo script (about 3 minutes)

The whole loop from the PRD (flows 2–7) on an iPhone in Expo Go, without a dead end. The same loop
runs on every push to `main` as the Maestro flow `maestro/demo-loop.yaml` (screenshots
`demo-*.png` in the E2E run's `e2e-screenshots` artifact).

## Before the demo (once, 1 minute)

1. Open the latest `main` in Expo Go: scan the QR on expo.dev (project `matthew` → Updates →
   branch `main`) or open
   `exp://u.expo.dev/0458c1dd-61a0-47f7-ac52-c648b4458fea?runtime-version=exposdk:57.0.0&channel-name=main`.
2. Sign in with your account.
3. Trips → profile button → Settings → Developer → **Add the sample Las Vegas trip**. Plan opens on
   Las Vegas (Nov 12–16, 2026) with its bookings, itinerary, Bucket List and budget. Adding again
   changes nothing; **Remove sample data** takes it out again and keeps your own trips.

Until the Gemini key is set (`GEMINI_API_KEY=… npm run db:secrets`), importing a real PDF and
reading a real TikTok say "isn't set up yet". For steps 3 and 6, open the scenario links instead
(Settings → Developer → Scenarios, or the links below); they show the same screens with sample
answers and save nothing.

## The loop

| # | Say | Tap | You should see |
|---|-----|-----|----------------|
| 2 | "A new trip takes ten seconds." | Trips → **+** → type "Lisbon" → pick it → **Save** | Lisbon on Trips (a cover photo once the Unsplash key is set) |
| 3 | "Bookings turn into cards." | Organize → **+** → a booking PDF or screenshot (or scenario `import-review-flight`) → **Save to wallet** | "Saved to your wallet. Also added to … on your plan and map." The flight card in the wallet |
| 4 | "Each day on a map." | Plan → Las Vegas → **Fri 13** → tap Bellagio Fountains | The map frames Friday's pins; the row and its pin highlight together |
| 5 | "Events on your dates, placed for you." | Discover → **+** on O by Cirque → Plan → **Bucket List** → **Smart Add** on Golden Tiki | "Added … to your Bucket List", then "Added to Sun 15, 4:00 PM · Undo" |
| 6 | "Save places straight from TikTok." | Copy a TikTok link → back to Trip → **Add this TikTok?** (or scenario `link-results`) → **Save** | "Added 3 places to your Bucket List"; rows "Saved from TikTok" with a play button |
| 7 | "Travel day." | Plan → **Thu 12** → **Arrive in Las Vegas** | The globe with the TPA → LAS arc and the AA 2410 card; tap the card → flight details → **View boarding pass** |

Scenario links (Expo Go):

- `import-review-flight`: `exp://u.expo.dev/0458c1dd-61a0-47f7-ac52-c648b4458fea/--/scenario/import-review-flight?runtime-version=exposdk:57.0.0&channel-name=main`
- `link-results`: `exp://u.expo.dev/0458c1dd-61a0-47f7-ac52-c648b4458fea/--/scenario/link-results?runtime-version=exposdk:57.0.0&channel-name=main`

## If something goes wrong

- No connection: each screen says what couldn't load and offers **Try again**.
- A step shows old data: close and reopen the app.
- After the demo: Settings → Developer → **Remove sample data**.
