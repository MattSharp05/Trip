import { SAMPLE_PARSES } from '../../supabase/functions/_shared/parse/fixtures';
import { ImportError, parseStoredBooking, storageName } from './parseBooking';

const mockInvoke = jest.fn();
jest.mock('./supabase', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } },
}));

const httpError = (body: unknown) => ({
  message: 'Edge Function returned a non-2xx status code',
  context: { json: async () => body },
});

describe('parseBooking service', () => {
  it('names stored files safely, with the extension of their type', () => {
    expect(storageName({ name: 'My Booking (1).PDF', mimeType: 'application/pdf' }, 'k1')).toBe(
      'k1-my-booking-1.pdf',
    );
    expect(storageName({ name: 'IMG_0042.HEIC', mimeType: 'image/jpeg' }, 'k1')).toBe(
      'k1-img-0042.jpg',
    );
    expect(storageName({ name: '...', mimeType: 'image/png' }, 'k1')).toBe('k1-booking.png');
  });

  it('returns the validated parse', async () => {
    mockInvoke.mockResolvedValueOnce({ data: { result: SAMPLE_PARSES.car }, error: null });
    await expect(parseStoredBooking('u1/imports/a.pdf')).resolves.toEqual(SAMPLE_PARSES.car);
    expect(mockInvoke).toHaveBeenCalledWith('parse-booking', {
      body: { path: 'u1/imports/a.pdf' },
    });
  });

  it.each([
    ['not_configured', "Booking import isn't set up yet. Add the booking by hand for now."],
    ['rate_limited', 'Too many bookings at once. Try again in a minute.'],
    ['unreadable', "We couldn't find a booking in that file. Try a clearer PDF or screenshot."],
  ])('shows the function’s %s answer as plain copy', async (code, message) => {
    mockInvoke.mockResolvedValueOnce({ data: null, error: httpError({ error: code }) });
    const error = await parseStoredBooking('p.pdf').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ImportError);
    expect(error).toMatchObject({ code, message });
  });

  it('treats a network failure or a malformed answer as failures', async () => {
    mockInvoke.mockResolvedValueOnce({ data: null, error: { message: 'Failed to fetch' } });
    await expect(parseStoredBooking('p.pdf')).rejects.toMatchObject({ code: 'failed' });
    mockInvoke.mockResolvedValueOnce({
      data: { result: { booking: { type: 'menu' } } },
      error: null,
    });
    await expect(parseStoredBooking('p.pdf')).rejects.toMatchObject({ code: 'unreadable' });
  });
});
