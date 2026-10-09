// The prompts the `ParseProvider` sends to the model, one per input (ADR 0004, ADR 0019). Kept apart
// from the provider code so they can be tuned (and golden-tested) on their own.

/**
 * Booking import (TR-25, TR-49): a PDF or screenshot in, one booking out. `{today}` is filled in by
 * `bookingPrompt`, so the model can tell which year a date without one means.
 */
export const BOOKING_PROMPT = `You read travel bookings: confirmation emails saved as PDF, and screenshots of booking apps, e-tickets, boarding passes and wallet passes.
Return one JSON object, nothing else: { "booking": <booking>, "uncertain": [<paths>] }.
<booking> is exactly one of these shapes ("type" decides which):
- {"type":"flight","confirmation","passenger","legs":[{"airline","airlineCode","flightNumber","from":{"code","city","country"},"to":{"code","city","country"},"departs":{"date","time"},"arrives":{"date","time"},"terminal","gate","seat","cabin"}],"price"}
- {"type":"hotel","hotel":{"name","address","city","country"},"checkIn":{"date","time"},"checkOut":{"date","time"},"confirmation","room","phone","website","email","price"}
- {"type":"car","company","pickupLocation":{"name","address","city","country"},"returnLocation":<same shape, or null when returned where picked up>,"pickup":{"date","time"},"dropoff":{"date","time"},"confirmation","vehicle","price"}
- {"type":"ticket","event","venue":{"name","address","city","country"},"starts":{"date","time"},"section","row","seats","confirmation","price"}
- {"type":"reservation","venue":{"name","address","city","country"},"starts":{"date","time"},"partySize","confirmation","price"}
Which type: a ticket for an event is a booking of type "ticket": concerts, sports matches and games, shows, theatre, festivals, museums and tours, whether it is an order email, an e-ticket, a ticket app screenshot or a wallet pass. A ticket only needs an event, a venue and a date; seats are optional. Restaurant and other table bookings are "reservation".
Values: dates YYYY-MM-DD; times HH:MM 24-hour, local time where it happens (the kick-off, show or doors time printed, as printed); airport codes are 3-letter IATA; flightNumber as printed with the airline code ("AA 2410"); list every flight leg in order, including the return; an airport's "city" and "country" are where that airport is, even when only its code is printed; "country" is the English country name ("Portugal", not "PT"); "address" is the whole address as printed, including postcode and city when they are printed with it; "room" is the hotel room type booked ("Deluxe King"), null for a whole home or apartment rental; "section", "row" and "seats" are text ("12", "11-12"); "price" is {"amount": number in major units like 412.30, "currency": ISO code like "EUR"} for the total paid, or null; partySize is a number or null.
Years: today is {today}. Copy a printed year exactly; never change it. Read numeric dates by the booking's country (08.05.2026 in Europe is 8 May). Only when no year is printed, use the year in which the printed weekday matches, nearest to today.
Use null for anything the booking doesn't say; never guess a value.
"uncertain" lists the paths of fields you are unsure about, like "checkIn.time" or "legs.0.seat".`;

/** The booking prompt with today's date (YYYY-MM-DD, UTC). */
export function bookingPrompt(today: Date): string {
  return BOOKING_PROMPT.replace('{today}', () => today.toISOString().slice(0, 10));
}

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
