import { LINK_SAMPLES } from '../../supabase/functions/_shared/parse/linkFixtures';
import { LinkError, parseLink } from './parseLink';

const mockInvoke = jest.fn();
jest.mock('./supabase', () => ({ supabase: { functions: { invoke: mockInvoke } } }));

const AREA = { city: 'Las Vegas', near: { lat: 36.17, lng: -115.14 } };
const sample = LINK_SAMPLES['vegas-food'].result;

describe('parseLink', () => {
  it('sends the link with the trip area and checks the answer', async () => {
    mockInvoke.mockResolvedValueOnce({ data: { result: sample }, error: null });
    await expect(parseLink(sample.url, AREA)).resolves.toEqual(sample);
    expect(mockInvoke).toHaveBeenCalledWith('parse-link', {
      body: { url: sample.url, near: AREA.near, city: 'Las Vegas' },
    });
  });

  it("turns the function's error codes into the app's copy", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: { context: { json: async () => ({ error: 'not_configured' }) } },
    });
    const error = await parseLink(sample.url, AREA).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(LinkError);
    expect(error).toMatchObject({ code: 'not_configured' });
    expect((error as Error).message).toMatch(/isn't set up yet/);

    mockInvoke.mockResolvedValueOnce({ data: null, error: { message: 'offline' } });
    await expect(parseLink(sample.url, AREA)).rejects.toMatchObject({ code: 'failed' });

    mockInvoke.mockResolvedValueOnce({ data: { result: { nope: true } }, error: null });
    await expect(parseLink(sample.url, AREA)).rejects.toMatchObject({ code: 'failed' });
  });
});
