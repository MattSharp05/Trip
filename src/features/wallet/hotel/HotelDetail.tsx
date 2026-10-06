import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';
import { Icon, ListRow, Surface, Text } from '@/ui';

import { BookingDetailScreen, ContactActions, Facts, useBooking, useLinkActions } from '../details';
import { HotelHero } from './HotelHero';
import { hotelActions, hotelFacts, hotelPhotoQuery, stayLine } from './hotelInfo';
import { useHotelPhoto } from './useHotelPhoto';

/**
 * A hotel booking: hero photo, name, dates and nights, address, the ways to reach it, check-in and
 * check-out, confirmation and room, and the original booking.
 */
export function HotelDetail({ id }: { id: string }) {
  const { booking, places, isLoading } = useBooking(id, 'hotel');
  const { toast, dismissToast, open, viewOriginal } = useLinkActions();
  const hotel = booking?.data;
  const place = hotel ? places.get(hotel.placeId) : undefined;
  const photo = useHotelPhoto(place?.photoUrl ?? null, hotel ? hotelPhotoQuery(hotel) : '');
  const originalPath = booking?.originalPath ?? null;

  return (
    <BookingDetailScreen
      title="Hotel"
      isLoading={isLoading}
      missing={hotel ? null : 'This hotel is no longer in your wallet'}
      toast={toast}
      onDismissToast={dismissToast}
    >
      {hotel ? (
        <>
          <HotelHero photo={photo} />
          <View style={styles.title}>
            <Text variant="title">{hotel.name}</Text>
            <Text variant="subhead" tone="secondary" testID="hotel-stay">
              {stayLine(hotel)}
            </Text>
            {hotel.address ? (
              <View style={styles.address}>
                <Icon name="mappin.and.ellipse" size="sm" tone="secondary" />
                <Text variant="subhead" tone="secondary" style={styles.addressText}>
                  {hotel.address}
                </Text>
              </View>
            ) : null}
          </View>

          <ContactActions actions={hotelActions(hotel, place)} onOpen={open} />

          <Facts rows={hotelFacts(hotel)} testID="hotel-facts" />

          {originalPath ? (
            <Surface padding="none">
              <ListRow
                icon="doc.text"
                title="View booking"
                onPress={() => viewOriginal(originalPath)}
                testID="booking-original"
              />
            </Surface>
          ) : null}
        </>
      ) : null}
    </BookingDetailScreen>
  );
}

const styles = StyleSheet.create({
  title: { gap: spacing.xs },
  address: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  addressText: { flex: 1 },
});
