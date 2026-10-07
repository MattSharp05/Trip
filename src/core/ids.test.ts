import { newId } from './ids';

it('makes uuid v4 ids', () => {
  expect(newId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  expect(newId()).not.toBe(newId());
});
