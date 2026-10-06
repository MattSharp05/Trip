import { TABS, tabTitle } from './tabs';

describe('TABS', () => {
  it('lists the four tabs in order', () => {
    expect(TABS.map((t) => t.name)).toEqual(['trips', 'plan', 'organize', 'discover']);
  });

  it('uses the SF Symbols from the design', () => {
    expect(TABS.map((t) => t.icon)).toEqual([
      'suitcase',
      'mappin.and.ellipse',
      'wallet.pass',
      'safari',
    ]);
  });

  it('looks up a tab title', () => {
    expect(tabTitle('organize')).toBe('Organize');
  });
});
