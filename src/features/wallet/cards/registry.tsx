import type { Href } from 'expo-router';
import type { ComponentType } from 'react';

import type { PlaceLookup, WalletEntry, WalletType } from '../walletItems';
import { carCard } from './car';
import { documentCard } from './document';
import { flightCard } from './flight';
import { hotelCard } from './hotel';
import { ticketCard } from './ticket';
import type { WalletCardDef } from './types';

/**
 * The card renderer for each wallet type. A new type, or a type's own detail screen, is one file in
 * this folder plus one line here; the wallet list never changes.
 */
export const WALLET_CARDS: { [T in WalletType]: WalletCardDef<T> } = {
  flight: flightCard,
  hotel: hotelCard,
  car: carCard,
  ticket: ticketCard,
  document: documentCard,
};

interface WalletEntryCardProps {
  entry: WalletEntry;
  places: PlaceLookup;
  onPress?: () => void;
}

/** A registry entry seen through any wallet entry (what the list holds). */
interface AnyWalletCardDef {
  label: (entry: WalletEntry) => string;
  Card: ComponentType<WalletEntryCardProps>;
  detailHref?: (id: string) => Href;
}

// The map's key always matches its entry's `type`, so reading it through WalletEntry is safe.
const defFor = (entry: WalletEntry) => WALLET_CARDS[entry.type] as unknown as AnyWalletCardDef;

/** Where tapping a card goes: the type's detail screen, else the generic one. */
export function walletDetailHref(entry: WalletEntry): Href {
  return defFor(entry).detailHref?.(entry.id) ?? `/organize/item/${encodeURIComponent(entry.id)}`;
}

/** What the item is (`Flight`, `Passport`), for the generic detail screen's title. */
export function walletLabel(entry: WalletEntry): string {
  return defFor(entry).label(entry);
}

/** Renders any wallet entry with its type's card. */
export function WalletEntryCard({ entry, places, onPress }: WalletEntryCardProps) {
  const { Card } = defFor(entry);
  return <Card entry={entry} places={places} onPress={onPress} />;
}
