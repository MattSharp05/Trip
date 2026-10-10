import { EXPO_PUSH_URL, sendExpoPush } from './expoPush';

const push = { to: 'ExponentPushToken[abc]', title: 'Trip', body: 'Test push' };

function reply(status: number, json: unknown) {
  return jest.fn(async () => ({ ok: status < 400, status, json: async () => json }) as Response);
}

describe('sendExpoPush', () => {
  it('posts the push to Expo and returns the ticket id', async () => {
    const fetchFn = reply(200, { data: { status: 'ok', id: 'ticket-1' } });
    await expect(sendExpoPush(push, fetchFn)).resolves.toBe('ticket-1');
    expect(fetchFn).toHaveBeenCalledWith(
      EXPO_PUSH_URL,
      expect.objectContaining({ method: 'POST' }),
    );
    const init = (fetchFn.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(JSON.parse(init.body as string)).toEqual({ ...push, sound: 'default' });
  });

  it("throws with Expo's error when the ticket fails", async () => {
    const fetchFn = reply(200, {
      data: {
        status: 'error',
        message: 'not a registered push token',
        details: { error: 'DeviceNotRegistered' },
      },
    });
    await expect(sendExpoPush(push, fetchFn)).rejects.toThrow(
      'Expo Push refused it: DeviceNotRegistered',
    );
  });

  it('throws with the request error or the HTTP status', async () => {
    await expect(
      sendExpoPush(push, reply(400, { errors: [{ message: '"to" must be a token' }] })),
    ).rejects.toThrow('"to" must be a token');
    await expect(sendExpoPush(push, reply(502, null))).rejects.toThrow('HTTP 502');
  });
});
