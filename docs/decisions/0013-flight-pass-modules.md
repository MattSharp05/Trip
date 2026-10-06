# 0013 — Boarding pass and flight actions: Expo Go modules

**Context.** TR-18 adds the flight detail and boarding pass screens: full brightness while the pass
is open, adding the flight to the calendar, picking a photo of the boarding pass and opening the
booking's original file.

**Decision.** Use only modules bundled in Expo Go, installed with `npx expo install`:
- `expo-brightness`: full brightness on the pass, the previous level restored on close.
- `expo-calendar`, through `expo-calendar/legacy`: its newer API is a stub in Expo Go. We open
  iOS's own "New Event" sheet (`createEventInCalendarAsync`), so the app never asks for calendar
  access.
- `expo-image-picker` (already added by TR-20, ADR 0012): the system photo picker (no permission
  prompt on iOS 14+). Its plugin config now carries plain photo-library and camera copy for Phase
  B builds, covering both features; the microphone is off.
- `expo-sharing` and `expo-asset`: a bundled sample original goes to the share sheet (Quick Look,
  Save to Files). An imported original opens from the private `originals` bucket through a
  10-minute signed link.

The pass image and its code rectangle live in the flight booking's JSON (`data.passImage`,
`data.passCrop`, fractions of the image) through `DataSource.saveBooking`; no migration. Barcodes
are never generated: the pass shows the code cropped from the user's own image.

**Consequences.**
- The Expo Go dependency test stays green; no native code.
- For a signed-in account the picked image is a local file URI, so it stays on that phone until
  pass images upload to Storage (Backlog).
