# 0012 — Document photos: `expo-image-picker`, private Storage, never AI

**Context.** TR-20 lets the user add passport and visa photos from the camera or the photo
library and view them full-screen with pinch zoom. The PRD and ADR 0004 say these images never go
to AI: Gemini's free tier may use prompts to improve Google's products.

**Decision.**
- `expo-image-picker` (installed with `npx expo install`, SDK 57 version) picks from the camera or
  the library. It is in Expo Go's bundled modules, so it fits ADR 0001 and the Expo Go dependency
  test stays green. A native action sheet (`ActionSheetIOS`) asks which source.
- Photos upload to the private `originals` bucket under `<uid>/documents/`, which the Storage RLS
  from migration 0001 limits to the owner. Screens show them through signed URLs valid for one
  hour; nothing is public. Demo sessions keep the picked file's local URI and never upload.
- `documents` gains `number` and `image_paths text[]` (migration 0003). The old single
  `image_path` column stays, unused, for builds from before 0003.
- Pinch zoom is the native iOS `UIScrollView` zoom exposed by React Native's `ScrollView`
  (`maximumZoomScale`), in a full-screen `Modal`: no gesture library code.
- **Never AI**, enforced twice: an ESLint `no-restricted-imports` rule on `src/features/documents/**`
  bans the Edge Function caller (`services/functions`) and any parse, import, Smart Add or AI module,
  and `src/features/documents/noAi.test.ts` proves the rule fires and scans the folder for Edge
  Function calls.

**Consequences.**
- Phase B (standalone build) needs `NSCameraUsageDescription` and `NSPhotoLibraryUsageDescription`
  strings via the `expo-image-picker` config plugin; Expo Go ships its own.
- Removing a photo deletes its file after the row saves; a failed clean-up leaves a private
  orphan file rather than failing the save.
