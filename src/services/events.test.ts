import { EventsError, eventsRequest, fetchEvents } from './events';

const mockInvoke = jest.fn();

jest.mock('./supabase', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } },
}));

const VEGAS = { lat: 36.1147, lng: -115.1728, startDate: '2026-11-12', endDate: '2026-11-16' };

/** A non-2xx answer as supabase-js reports it: the body is on `context`. */
const httpError = (body: unknown) =>
  Object.assign(new Error('Edge Function returned a non-2xx status code'), {
    context: { json: async () => body },
  });

describe('eventsRequest', () => {
  it('needs the trip’s centre and dates', () => {
    expect(eventsRequest(VEGAS)).toEqual(VEGAS);
    expect(eventsRequest({ ...VEGAS, lat: null })).toBeNull();
    expect(eventsRequest({ ...VEGAS, startDate: '' })).toBeNull();
  });
});

describe('fetchEvents', () => {
  it('asks the events function and keeps only valid events', async () => {
    const event = {
      id: 'tm:1',
      title: 'Dead & Company',
      category: 'events',
      date: '2026-11-13',
      time: '19:30',
      venue: { name: 'Sphere', address: null, lat: 36.12, lng: -115.16 },
      imageUrl: null,
      url: null,
    };
    mockInvoke.mockResolvedValueOnce({
      data: { events: [event, { id: 'broken' }] },
      error: null,
    });
    await expect(fetchEvents(VEGAS)).resolves.toEqual([event]);
    expect(mockInvoke).toHaveBeenCalledWith('events', { body: VEGAS });
  });

  it('turns the function’s error code into an EventsError', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: httpError({ error: 'not_configured', message: 'Event listings are not set up yet.' }),
    });
    const error = await fetchEvents(VEGAS).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(EventsError);
    expect((error as EventsError).code).toBe('not_configured');

    mockInvoke.mockResolvedValueOnce({ data: null, error: new Error('Failed to fetch') });
    await expect(fetchEvents(VEGAS)).rejects.toMatchObject({ code: 'failed' });

    mockInvoke.mockResolvedValueOnce({ data: { nothing: true }, error: null });
    await expect(fetchEvents(VEGAS)).rejects.toMatchObject({ code: 'failed' });
  });
});
