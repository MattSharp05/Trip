/** Expo's push service: free, no key while push security is off (ADR 0032). */
export const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export interface TestPush {
  /** An `ExponentPushToken[…]` from `getExpoPushTokenAsync`. */
  to: string;
  title: string;
  body: string;
  /** Delivered with the push; the app reads it when the push is opened. */
  data?: Record<string, string>;
}

/**
 * Sends one push through the Expo Push API and returns its ticket id. Throws with Expo's own
 * message when the request or the ticket fails, so the push spike (TR-52) can show it on screen.
 */
export async function sendExpoPush(push: TestPush, fetchFn: typeof fetch = fetch): Promise<string> {
  const response = await fetchFn(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...push, sound: 'default' }),
  });
  const json = (await response.json().catch(() => null)) as {
    data?: { status?: string; id?: string; message?: string; details?: { error?: string } };
    errors?: { message?: string }[];
  } | null;
  const ticket = json?.data;
  if (response.ok && ticket?.status === 'ok' && ticket.id) return ticket.id;
  const reason =
    ticket?.details?.error ??
    ticket?.message ??
    json?.errors?.[0]?.message ??
    `HTTP ${response.status}`;
  throw new Error(`Expo Push refused it: ${reason}`);
}
