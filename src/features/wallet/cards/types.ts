import type { Href } from 'expo-router';
import type { ComponentType } from 'react';

import type { PlaceLookup, WalletEntryOf, WalletType } from '../walletItems';

export interface WalletCardRendererProps<T extends WalletType> {
  entry: WalletEntryOf<T>;
  places: PlaceLookup;
  /** Opens the detail screen; absent when the card is shown inside a detail screen. */
  onPress?: () => void;
}

/** One booking type's entry in the card registry. */
export interface WalletCardDef<T extends WalletType> {
  /** What the item is, for the generic detail screen's title (`Flight`, `Passport`). */
  label: (entry: WalletEntryOf<T>) => string;
  Card: ComponentType<WalletCardRendererProps<T>>;
  /** The type's own detail screen. Without one, the card opens the generic detail. */
  detailHref?: (id: string) => Href;
}
