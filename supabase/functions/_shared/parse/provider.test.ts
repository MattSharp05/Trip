import gemini429 from '../../parse-booking/fixtures/gemini-429.json';
import geminiFlight from '../../parse-booking/fixtures/gemini-flight.json';
import gemini429Retry from './fixtures/gemini-429-retry.json';
import gemini503 from './fixtures/gemini-503.json';
import { chooseProvider, DEFAULT_FALLBACK_MODEL, DEFAULT_MODEL, geminiProvider } from './provider';

// Recorded-format Gemini responses (fixtures/): no live model calls in CI.
const respond = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const OK = { body: geminiFlight, status: 200 };
const OVERLOADED = { body: gemini503, status: 503 };

/** A fetch that answers each Gemini call with the next recorded response, and logs the model. */
function recorded(...answers: { body: unknown; status: number }[]) {
  const models: string[] = [];
  const impl = jest.fn(async (input: RequestInfo | URL) => {
    models.push(String(input).match(/models\/([^:]+):/)?.[1] ?? '');
    const next = answers[Math.min(models.length - 1, answers.length - 1)];
    return respond(next.body, next.status);
  }) as unknown as typeof fetch;
  return { impl, models };
}

function provider(fetchImpl: typeof fetch, fallbackModel: string | null = DEFAULT_FALLBACK_MODEL) {
  const sleep = jest.fn(async (_ms: number) => {});
  const gemini = geminiProvider('key', DEFAULT_MODEL, fetchImpl, undefined, {
    fallbackModel,
    sleep,
    random: () => 0.5,
  });
  return { gemini, sleep };
}

const read = (gemini: ReturnType<typeof geminiProvider>) => gemini.extractPlaces('caption', null);

describe('Gemini retries', () => {
  it('retries a 503 "model overloaded" and returns the next answer', async () => {
    const { impl, models } = recorded(OVERLOADED, OK);
    const { gemini, sleep } = provider(impl);
    await expect(read(gemini)).resolves.toHaveProperty('booking.type', 'flight');
    expect(models).toEqual([DEFAULT_MODEL, DEFAULT_MODEL]);
    expect(sleep).toHaveBeenCalledTimes(1);
    // 400 ms backoff plus jitter (at most 250 ms).
    expect(sleep.mock.calls[0][0]).toBe(525);
  });

  it('backs off exponentially, and retries a 500 too', async () => {
    const { impl, models } = recorded({ body: {}, status: 500 }, OVERLOADED, OK);
    const { gemini, sleep } = provider(impl);
    await expect(read(gemini)).resolves.toBeTruthy();
    expect(models).toHaveLength(3);
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([525, 925]);
  });

  it('tries the fallback model once when the main one keeps answering 503', async () => {
    const { impl, models } = recorded(OVERLOADED, OVERLOADED, OVERLOADED, OK);
    const { gemini } = provider(impl);
    await expect(read(gemini)).resolves.toBeTruthy();
    expect(models).toEqual([DEFAULT_MODEL, DEFAULT_MODEL, DEFAULT_MODEL, DEFAULT_FALLBACK_MODEL]);
  });

  it('gives up after the fallback with the same "failed" error as before', async () => {
    const { impl, models } = recorded(OVERLOADED);
    const { gemini } = provider(impl);
    await expect(read(gemini)).rejects.toMatchObject({
      code: 'failed',
      message: 'Gemini returned 503',
    });
    expect(models).toHaveLength(4);
  });

  it('has no fallback when none is set', async () => {
    const { impl, models } = recorded(OVERLOADED);
    const { gemini } = provider(impl, null);
    await expect(read(gemini)).rejects.toMatchObject({ code: 'failed' });
    expect(models).toHaveLength(3);
  });

  it("doesn't retry a 429 that doesn't say when, or other errors", async () => {
    const limited = recorded({ body: gemini429, status: 429 });
    await expect(read(provider(limited.impl).gemini)).rejects.toMatchObject({
      code: 'rate_limited',
    });
    expect(limited.models).toHaveLength(1);

    const bad = recorded({ body: {}, status: 400 });
    await expect(read(provider(bad.impl).gemini)).rejects.toMatchObject({ code: 'failed' });
    expect(bad.models).toHaveLength(1);
  });

  it('retries a 429 that asks for a short wait, after that wait', async () => {
    const { impl, models } = recorded({ body: gemini429Retry, status: 429 }, OK);
    const { gemini, sleep } = provider(impl);
    await expect(read(gemini)).resolves.toBeTruthy();
    expect(models).toHaveLength(2);
    expect(sleep).toHaveBeenCalledWith(1000);
  });

  it('reads the fallback model from GEMINI_FALLBACK_MODEL', async () => {
    const { impl, models } = recorded(OVERLOADED, OVERLOADED, OVERLOADED, OK);
    const env = (name: string) =>
      ({ GEMINI_API_KEY: 'key', GEMINI_FALLBACK_MODEL: 'gemini-2.5-flash-lite' })[name];
    jest.useFakeTimers();
    try {
      const pending = read(chooseProvider(env, impl) as ReturnType<typeof geminiProvider>);
      await jest.runAllTimersAsync();
      await expect(pending).resolves.toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
    expect(models.at(-1)).toBe('gemini-2.5-flash-lite');
  });
});
