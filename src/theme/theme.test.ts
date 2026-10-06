import { colors, radii, typography } from '@/theme';

describe('theme tokens', () => {
  it('matches the design.md palette', () => {
    expect(colors).toMatchObject({
      background: '#000000',
      surface: '#111111',
      raised: '#1A1A1A',
      textPrimary: '#FFFFFF',
      textSecondary: '#A0A0A0',
      accent: '#FF6B22',
      ok: '#30D158',
    });
  });

  it('keeps list cards tighter than photo cards', () => {
    expect(radii.card).toBeLessThan(radii.photo);
  });

  it('never sets a font family (system font only)', () => {
    for (const style of Object.values(typography)) {
      expect(style).not.toHaveProperty('fontFamily');
    }
  });
});
