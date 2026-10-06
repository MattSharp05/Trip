import {
  BookingDetailScreen,
  BookingHeader,
  BookingLinks,
  destinationOf,
  directionsUrl,
  Facts,
  useBooking,
  useLinkActions,
} from '../details';
import { brandCode } from '../format';
import { carFacts } from './carInfo';

/** A rental car: company, pickup and return (time and place), confirmation, car class. */
export function CarDetail({ id }: { id: string }) {
  const { booking, places, isLoading } = useBooking(id, 'car');
  const { toast, dismissToast, open, viewOriginal } = useLinkActions();
  const car = booking?.data;
  const pickup = car ? places.get(car.pickupPlaceId) : undefined;
  const dropoff = car ? places.get(car.returnPlaceId) : undefined;
  const destination = destinationOf(pickup);

  return (
    <BookingDetailScreen
      title="Rental car"
      isLoading={isLoading}
      missing={car ? null : 'This rental car is no longer in your wallet'}
      toast={toast}
      onDismissToast={dismissToast}
    >
      {car ? (
        <>
          <BookingHeader
            badge={{ code: brandCode(car.company) }}
            title={`${car.company} rental car`}
          />
          <Facts
            rows={carFacts(car, pickup?.name ?? null, dropoff?.name ?? null)}
            testID="car-facts"
          />
          <BookingLinks
            directions={{
              title: 'Directions to pickup',
              subtitle: pickup?.address ?? null,
              url: destination ? directionsUrl(destination) : null,
            }}
            originalPath={booking.originalPath}
            originalTitle="View original"
            onOpen={open}
            onViewOriginal={viewOriginal}
          />
        </>
      ) : null}
    </BookingDetailScreen>
  );
}
