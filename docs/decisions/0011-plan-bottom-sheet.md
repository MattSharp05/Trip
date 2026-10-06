# 0011 — The Plan sheet: `@gorhom/bottom-sheet`

**Context.** TR-17 puts the itinerary in a sheet over the Plan map, snapping at half and full
height, with a list that scrolls inside it. The TDD's stack table names `@gorhom/bottom-sheet` for
sheets; it was installed with the design system (TR-3, `Sheet`) and its `BottomSheetModalProvider`
is in the root layout. This records using its persistent (non-modal) `BottomSheet` for the Plan
screen.

**Decision.**
- `@gorhom/bottom-sheet` v5: pure JavaScript on `react-native-reanimated` and
  `react-native-gesture-handler`, both bundled in Expo Go, so it fits ADR 0001 and the Expo Go
  dependency test stays green.
- The Plan sheet (`src/features/plan/PlanSheet.tsx`) is a persistent `BottomSheet` with two snap
  points: half (its top overlaps the map's bottom edge by the corner radius) and full. Dynamic
  sizing and over-drag are off, so it springs only between those two.
- The timeline is a `BottomSheetFlatList` with fixed row heights, so the list can scroll to a row
  the map picked without measuring it.
- Jest uses the library's own mock (`jest.setup.ts`), with `__esModule` added so the default
  `BottomSheet` export resolves.

**Consequences.**
- No native code, nothing new to install. Modal sheets keep using `Sheet` (`src/ui`).
- Sheet gestures and snapping only run on a device; Jest covers the content and linking, the feel
  is checked on the phone at the Plan checkpoint.
