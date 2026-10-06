# 0004 — Booking and link parsing with a free AI tier, behind a switch

**Context.** Importing bookings (PDFs, screenshots) and finding places in TikTok/Reel links needs a
model that reads documents and images. Matthew set AI spend to $0 and chose a free tier from another
provider; Phase B moves to Claude.

**Decision.** A `ParseProvider` interface in the Edge Functions with one implementation now: Gemini
Flash (free tier). It returns JSON validated against shared Zod schemas (flight, hotel, car, ticket,
reservation, place list). The provider is chosen by a function secret, so adding Claude later is a
new implementation plus a config change. Passport and visa images are never sent to any model.

**Consequences.**
- Free-tier prompts may be used to improve Google's products: the app says so on the import screen,
  and documents stay manual.
- Rate limits (roughly 10–15 a minute, a few hundred a day) are fine for a demo. The app shows a
  clear "try again in a minute" state on 429s.
- Parse quality is measured on a fixed sample set of bookings in CI (golden files).
