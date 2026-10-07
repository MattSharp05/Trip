import { render, screen } from '@testing-library/react-native';

import type { BucketEntry } from './bucket';
import { BucketRow } from './BucketRow';

const entry: BucketEntry = {
  id: 'bucket-fremont',
  placeId: 'place-fremont',
  title: 'Fremont Street Experience',
  subtitle: 'Fremont St · Landmark',
  source: 'From search',
  photo: null,
  symbol: 'star.fill',
  watch: null,
};

describe('BucketRow', () => {
  it('shows where the item came from', () => {
    render(<BucketRow entry={entry} onPress={jest.fn()} onDelete={jest.fn()} />);
    expect(screen.getByText('From search')).toBeTruthy();
  });

  it("shows Plan my bucket list's note instead, and reads it out", () => {
    render(
      <BucketRow
        entry={entry}
        onPress={jest.fn()}
        onDelete={jest.fn()}
        note="Didn't fit any day's free time"
      />,
    );
    expect(screen.getByTestId('bucket-note-bucket-fremont')).toHaveTextContent(
      "Didn't fit any day's free time",
    );
    expect(screen.queryByText('From search')).toBeNull();
    expect(screen.getByTestId('bucket-row-bucket-fremont')).toHaveAccessibleName(
      "Fremont Street Experience, Fremont St · Landmark, Didn't fit any day's free time",
    );
  });
});
