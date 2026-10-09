import { drop } from './drag';

describe('drop', () => {
  it('stays put when the row is let go where it was, without asking the editor', () => {
    const onReorder = jest.fn(() => true);
    expect(drop(2, 2, onReorder)).toBe('stay');
    expect(onReorder).not.toHaveBeenCalled();
  });

  it('saves a move the editor accepts', () => {
    const onReorder = jest.fn(() => true);
    expect(drop(0, 1, onReorder)).toBe('saved');
    expect(onReorder).toHaveBeenCalledWith(0, 1);
  });

  it('refuses a move the editor refuses', () => {
    expect(drop(1, 2, () => false)).toBe('refused');
  });
});
