import { fireEvent, render, screen } from '@testing-library/react-native';

import { Segmented } from './Segmented';

const SEGMENTS = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'past', label: 'Past' },
] as const;

describe('Segmented', () => {
  it('marks only the current segment as selected', () => {
    render(<Segmented segments={SEGMENTS} value="upcoming" onChange={() => {}} />);
    expect(screen.getByRole('tab', { name: 'Upcoming' })).toBeSelected();
    expect(screen.getByRole('tab', { name: 'Past' })).not.toBeSelected();
  });

  it('reports the tapped segment', () => {
    const onChange = jest.fn();
    render(<Segmented segments={SEGMENTS} value="upcoming" onChange={onChange} />);
    fireEvent.press(screen.getByRole('tab', { name: 'Past' }));
    expect(onChange).toHaveBeenCalledWith('past');
  });

  it('leaves each segment its own accessibility element (TR-42: VoiceOver and Maestro)', () => {
    render(<Segmented segments={SEGMENTS} value="upcoming" onChange={() => {}} testID="seg" />);
    const track = screen.getByTestId('seg');
    expect(track.props.accessible).toBe(false);
    expect(track.props.accessibilityRole).toBeUndefined();
    for (const label of ['Upcoming', 'Past']) {
      const tab = screen.getByRole('tab', { name: label });
      expect(tab.props.accessible).toBe(true);
      expect(tab.props.accessibilityLabel).toBe(label);
    }
  });
});
