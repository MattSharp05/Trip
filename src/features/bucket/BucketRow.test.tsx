import { fireEvent, render, screen } from '@testing-library/react-native';

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
  addedBy: null,
  likes: 0,
  likedByMe: false,
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

  it('shows who added it before where it came from', () => {
    render(
      <BucketRow
        entry={{ ...entry, addedBy: 'Added by Blake' }}
        onPress={jest.fn()}
        onDelete={jest.fn()}
      />,
    );
    expect(screen.getByTestId('bucket-origin-bucket-fremont')).toHaveTextContent(
      'Added by Blake · From search',
    );
  });

  it('has a heart with the count, filled when you liked it, that toggles your like', () => {
    const onLike = jest.fn();
    const { rerender } = render(
      <BucketRow entry={entry} onPress={jest.fn()} onDelete={jest.fn()} onLike={onLike} />,
    );
    expect(screen.getByTestId('bucket-like-bucket-fremont')).toHaveAccessibleName('Like');
    expect(screen.queryByTestId('bucket-likes-bucket-fremont')).toBeNull();

    const liked = { ...entry, likes: 2, likedByMe: true };
    rerender(<BucketRow entry={liked} onPress={jest.fn()} onDelete={jest.fn()} onLike={onLike} />);
    const heart = screen.getByTestId('bucket-like-bucket-fremont');
    expect(heart).toHaveAccessibleName('Unlike');
    expect(heart).toBeSelected();
    expect(screen.getByTestId('bucket-likes-bucket-fremont')).toHaveTextContent('2');
    fireEvent.press(heart);
    expect(onLike).toHaveBeenCalledWith(liked);
  });

  it('has no heart without onLike', () => {
    render(<BucketRow entry={entry} onPress={jest.fn()} onDelete={jest.fn()} />);
    expect(screen.queryByTestId('bucket-like-bucket-fremont')).toBeNull();
  });
});
