import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { TAB_TINT, TABS } from '@/core/tabs';
import { useClipboardOffer } from '@/features/links';
import { useTripLiveUpdates } from '@/services/realtime';
import { useTripStore } from '@/stores/trip';

export default function TabLayout() {
  // "Add this TikTok?" (TR-30): checks for a copied link on every foreground; Plan shows it.
  useClipboardOffer();
  // Other members' changes to the selected trip appear without refreshing (TR-54).
  useTripLiveUpdates(useTripStore((s) => s.selectedTripId));
  return (
    <NativeTabs tintColor={TAB_TINT}>
      {TABS.map((tab) => (
        <NativeTabs.Trigger key={tab.name} name={tab.name}>
          <NativeTabs.Trigger.Label>{tab.title}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={tab.icon} />
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}
