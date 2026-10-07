// The prompts the `ParseProvider` sends to the model, one per input (ADR 0004, ADR 0019). Kept apart
// from the provider code so they can be tuned (and golden-tested) on their own.

/** Booking import (TR-25): a PDF or screenshot in, one booking out. */
export const BOOKING_PROMPT = `You read travel bookings (confirmation emails saved as PDF, screenshots of apps).
Return one JSON object, nothing else: { "booking": <booking>, "uncertain": [<paths>] }.
<booking> is exactly one of these shapes ("type" decides which):
- {"type":"flight","confirmation","passenger","legs":[{"airline","airlineCode","flightNumber","from":{"code","city","country"},"to":{"code","city","country"},"departs":{"date","time"},"arrives":{"date","time"},"terminal","gate","seat","cabin"}],"price"}
- {"type":"hotel","hotel":{"name","address","city","country"},"checkIn":{"date","time"},"checkOut":{"date","time"},"confirmation","room","phone","website","email","price"}
- {"type":"car","company","pickupLocation":{"name","address","city","country"},"returnLocation":<same shape, or null when returned where picked up>,"pickup":{"date","time"},"dropoff":{"date","time"},"confirmation","vehicle","price"}
- {"type":"ticket","event","venue":{"name","address","city","country"},"starts":{"date","time"},"section","row","seats","confirmation","price"}
- {"type":"reservation","venue":{"name","address","city","country"},"starts":{"date","time"},"partySize","confirmation","price"}
Rules: dates YYYY-MM-DD; times HH:MM 24-hour, local time where it happens; airport codes are 3-letter IATA; flightNumber as printed with the airline code ("AA 2410"); list every flight leg in order, including the return; "price" is {"amount": number in major units like 412.30, "currency": ISO code} for the total paid, or null; partySize is a number or null. Use null for anything the booking doesn't say; never guess a value. Restaurants and other table bookings are "reservation"; concerts, games and shows are "ticket".
"uncertain" lists the paths of fields you are unsure about, like "checkIn.time" or "legs.0.seat".`;

/**
 * TikTok and Reel links (TR-30): a video's caption in, the places it names out. `{city}` and
 * `{caption}` are filled in by `linkPrompt`.
 */
export const LINK_PROMPT = `You read the caption of a short travel video (a TikTok or an Instagram Reel) and list the specific places it tells people to go: restaurants, cafes, bars, clubs, shows, attractions, viewpoints, shops.
Return one JSON object, nothing else: {"places":[{"name","city","kind"}]}.
Rules: "name" is the place's own name as a traveller would search for it ("Lotus of Siam", not "this Thai spot"); "city" is the city it is in, or null when the caption doesn't say; "kind" is one of "food", "bar", "nightlife", "attraction", "landmark", "hotel", "arena", or null. Only places the caption names; never invent one. Leave out the creator, hashtags that aren't places, and whole cities, neighbourhoods or streets. At most 10 places, in the order they appear. When it names none: {"places":[]}.
The traveller's trip is in: {city}
Caption:
{caption}`;

/** The link prompt for one caption; the trip's city helps the model place names that need one. */
export function linkPrompt(caption: string, city: string | null): string {
  // Functions, so a `$` in the caption is never read as a replacement pattern.
  return LINK_PROMPT.replace('{city}', () => city ?? 'unknown').replace('{caption}', () => caption);
}
