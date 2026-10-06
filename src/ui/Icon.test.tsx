import { render } from '@testing-library/react-native';
import { SymbolView } from 'expo-symbols';

import { colors } from '@/theme';

import { Icon } from './Icon';

function symbolProps(ui: React.ReactElement) {
  return render(ui).UNSAFE_getByType(SymbolView).props;
}

describe('Icon', () => {
  it('draws an outlined SF Symbol at the medium size in white', () => {
    expect(symbolProps(<Icon name="airplane" />)).toMatchObject({
      name: 'airplane',
      size: 20,
      weight: 'regular',
      tintColor: colors.textPrimary,
    });
  });

  it('uses the size and tone props', () => {
    expect(symbolProps(<Icon name="car" size="lg" tone="secondary" />)).toMatchObject({
      size: 24,
      tintColor: colors.textSecondary,
    });
  });

  it('is orange when selected, whatever the tone', () => {
    expect(symbolProps(<Icon name="mappin" tone="secondary" selected />).tintColor).toBe(
      colors.accent,
    );
  });

  it('is hidden from VoiceOver without a label', () => {
    expect(symbolProps(<Icon name="car" />)).toMatchObject({ accessible: false });
    expect(symbolProps(<Icon name="car" label="Car" />)).toMatchObject({
      accessible: true,
      accessibilityLabel: 'Car',
    });
  });
});
