import { Link } from 'expo-router';

import { devToolsEnabled } from '@/core/devTools';
import { tabTitle } from '@/core/tabs';
import { Button, PlaceholderScreen } from '@/ui';

export default function TripsScreen() {
  return (
    <PlaceholderScreen title={tabTitle('trips')}>
      {/* Temporary: moves to Settings → Developer when that screen exists. */}
      {devToolsEnabled() ? (
        <Link href="/dev/gallery" asChild>
          <Button label="Design gallery" variant="secondary" icon="square.grid.2x2" />
        </Link>
      ) : null}
    </PlaceholderScreen>
  );
}
