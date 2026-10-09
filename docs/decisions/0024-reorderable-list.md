# 0024 — Reordering the itinerary: `react-native-sortables`

**Status.** Accepted (TR-24 QA round 4, 2026-10-09).

**Context.** Matthew wants to touch and hold a stop in the Plan sheet, then drag it to reorder the
day. Three hand-rolled gesture-handler versions failed on his iPhone (Expo Go, SDK 57). Round 1
used a pan with `activateAfterLongPress`, and the row never lifted. Round 2 added Edit mode with
drag handles, which was never confirmed. Round 3 paired iOS's long press with a manually activated
pan: the row lifted and grew, but never followed the finger ("maybe we need an external library
for this"). The list sits in a `@gorhom/bottom-sheet` sheet (ADR 0011), so the sheet's drag, the
list's scroll, each row's swipe actions and the drag all start from the same finger. The library
has to be pure JavaScript on Reanimated and gesture-handler (ADR 0001), and it has to work inside
that sheet.

**Options** (read at their current versions, with our Reanimated 4.5 and gesture-handler 2.32).

| | How a drag starts | Inside a bottom sheet | Upkeep |
|---|---|---|---|
| `react-native-sortables` 1.10 | One `Gesture.Manual` per item. Its own UI-thread timer (`dragActivationDelay`) activates the touch the item already holds, then follows that touch's moves. It fails if the finger moves more than `dragActivationFailOffset` first | Renders inside any scroll view: we use gorhom's own `BottomSheetScrollView`, so sheet and scroll stay coordinated. `scrollableRef` adds auto-scroll. The maintainer reports grids working in a gorhom sheet (issue #298) | Very active (released 2026-09), by a Software Mansion contributor. Expo compatible. Supports Reanimated 3–4 and gesture-handler 2–3 |
| `react-native-reorderable-list` 0.18 | `Pressable onLongPress={drag}`, then a list-wide `Pan` that runs alongside the FlatList's native scroll | Brings its own `FlatList`. To sit in gorhom's scroll it would need `renderScrollComponent`, which nests two gesture detectors on one view. Its bottom-sheet issue (#35, a different sheet) closed without a fix | Active (2026-07) |
| `react-native-draggable-flatlist` 4.0 | `drag()` from a long press, then a pan | `NestableScrollContainer` is a plain ScrollView, not gorhom's. "Let it work with react-native-bottom-sheet" (#601) is open | Last release 2023; untested on Reanimated 4 |

**Decision.** `react-native-sortables` (`Sortable.Grid`, one column, our entries as `data`).

- **How it starts is different in kind.** Round 3 lost the drag in the hand-off from a long press
  to a second gesture (a pan that had to activate itself). Sortables needs no hand-off: the
  gesture that sees the finger go down is the one that activates after the hold and then reports
  every move of that finger. When it activates, gesture-handler cancels the sheet's pan and the
  scroll view's native gesture for that touch (it isn't simultaneous with them).
- The list is gorhom's `BottomSheetScrollView`, so the sheet's own drag and the list's scroll work
  as before when nothing is lifted. While a row is lifted the scroll is also switched off.
- Hold 350 ms with 10 pt of slack (`LONG_PRESS_MS`, `HOLD_SLOP`): a finger that moves sooner
  scrolls, swipes or moves the sheet.
- Our rules stay ours. `onDragEnd` asks `useItineraryEditor`'s `onReorder` (`src/core/reflow.ts`).
  A refused drop buzzes a warning and the list is rebuilt from the day's order, because the
  library keeps its own order until the data changes. Haptics come from our callbacks (medium on
  lift, a tick per row passed, a warning on refusal), not from the library's built-in haptics.
- Edit mode keeps working cheaply: `customHandle` with `Sortable.Handle`, and no hold
  (`dragActivationDelay` 0).
- No virtualisation: a day holds a handful of stops.

**Consequences.**
- One new pure-JS dependency. Nothing native, so the Expo Go dependency test stays green.
- The list is no longer a `BottomSheetFlatList`: a map pick scrolls with `scrollTo` and the rows'
  known heights (ADR 0011's fixed row heights still hold).
- Jest can't run the library's UI-thread gesture. `jest.setup.ts` mocks it to draw rows in data
  order, and tests drive its callbacks. The real gesture is covered by the Maestro shot
  `maestro/shots/vegas-plan-hold-drag.yaml` on `main`'s iOS simulator, and by Matthew on the phone.
- Known gesture-handler 2.x bug (sortables #349, gesture-handler #3560): on iOS's New Architecture,
  a drag can stick after its screen is detached and re-attached. The fix needs gesture-handler 3,
  which Expo Go SDK 57 doesn't ship. If it shows up after switching tabs, remount the list when the
  Plan tab gains focus (the reported workaround).
