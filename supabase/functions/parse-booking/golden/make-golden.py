"""Draws the booking-import golden set (TR-28, ADR 0004): 12 made-up bookings as PDFs and PNGs,
each with the booking we expect the parser to read out of it.

Writes, next to this file:
  <name>.pdf | <name>.png   the booking as a person would receive it
  <name>.expected.json      the expected `booking` (schema in _shared/parse/schema.ts, no lat/lng)
  recorded/<name>.json      canned parser answers for `--provider fixture` (see below)

Every company, person, address, phone number and confirmation code is fabricated (`.example`
domains, 555 numbers). Airport codes and cities are real, so geocoding still has something to
find. Output is deterministic (fixed fonts, invariant PDFs), so re-running gives the same files.

The canned answers are the expected bookings with a few deliberate, realistic slips (a wrong time,
a missing seat, an extra field), so the scorer has misses to count. They are not Gemini output: a
live run with `--record` replaces them with real answers.

  python3 supabase/functions/parse-booking/golden/make-golden.py
  npx prettier --write supabase/functions/parse-booking/golden
"""
import copy, json, os
from PIL import Image, ImageDraw, ImageFont
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

HERE = os.path.dirname(os.path.abspath(__file__))
RECORDED = os.path.join(HERE, "recorded")


def loc(name, address=None, city=None, country=None):
    return {"name": name, "address": address, "city": city, "country": country}


def airport(code, city, country):
    return {"code": code, "city": city, "country": country}


def when(date, time=None):
    return {"date": date, "time": time}


def price(amount, currency):
    return {"amount": amount, "currency": currency}


def leg(airline, code, number, frm, to, departs, arrives, terminal=None, gate=None, seat=None, cabin=None):
    return {
        "airline": airline, "airlineCode": code, "flightNumber": number, "from": frm, "to": to,
        "departs": departs, "arrives": arrives, "terminal": terminal, "gate": gate, "seat": seat,
        "cabin": cabin,
    }


# ---------------------------------------------------------------------------------------------
# Drawing helpers
# ---------------------------------------------------------------------------------------------

def pdf(name, title, subtitle, sections, footer="This is a sample booking made for testing. Not valid for travel."):
    """An email-style confirmation: a title band, then sections of label/value rows."""
    path = os.path.join(HERE, f"{name}.pdf")
    c = canvas.Canvas(path, pagesize=letter, invariant=1)
    c.setTitle(title)
    w, h = letter
    c.setFillColorRGB(0.16, 0.22, 0.32)
    c.rect(0, h - 90, w, 90, stroke=0, fill=1)
    c.setFillColorRGB(1, 1, 1)
    c.setFont("Helvetica-Bold", 22)
    c.drawString(48, h - 50, title)
    c.setFont("Helvetica", 11)
    c.drawString(48, h - 72, subtitle)
    y = h - 130
    for heading, rows in sections:
        c.setFillColorRGB(0.16, 0.22, 0.32)
        c.setFont("Helvetica-Bold", 13)
        c.drawString(48, y, heading)
        y -= 6
        c.setStrokeColorRGB(0.8, 0.8, 0.8)
        c.line(48, y, w - 48, y)
        y -= 18
        for label, value in rows:
            c.setFillColorRGB(0.4, 0.4, 0.4)
            c.setFont("Helvetica", 10)
            c.drawString(48, y, label)
            c.setFillColorRGB(0.1, 0.1, 0.1)
            c.setFont("Helvetica-Bold", 11)
            c.drawString(200, y, value)
            y -= 18
        y -= 14
    c.setFillColorRGB(0.5, 0.5, 0.5)
    c.setFont("Helvetica-Oblique", 9)
    c.drawString(48, 48, footer)
    c.showPage()
    c.save()


def font(size, bold=False):
    try:
        return ImageFont.truetype("DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf", size)
    except OSError:
        return ImageFont.load_default(size)


def png(name, brand, colour, blocks, note="Sample screenshot made for testing."):
    """A phone screenshot (750x1334): a coloured app bar, then cards of label/value rows or text."""
    W, H = 750, 1334
    img = Image.new("RGB", (W, H), (244, 244, 246))
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, W, 150], fill=colour)
    d.text((40, 70), brand, font=font(38, True), fill=(255, 255, 255))
    y = 190
    for block in blocks:
        kind = block[0]
        if kind == "big":
            d.text((40, y), block[1], font=font(40, True), fill=(25, 25, 25))
            y += 60
            if len(block) > 2:
                d.text((40, y), block[2], font=font(24), fill=(100, 100, 100))
                y += 44
        elif kind == "text":
            d.text((40, y), block[1], font=font(26), fill=(50, 50, 50))
            y += 42
        elif kind == "grid":
            rows = block[1]
            y += 24
            top = y
            d.rounded_rectangle([24, top - 16, W - 24, top + 92 * len(rows)], radius=18, fill=(255, 255, 255))
            for row in rows:
                for i, (label, value) in enumerate(row):
                    x = 48 + i * (660 // len(row))
                    d.text((x, y), label, font=font(19), fill=(120, 120, 120))
                    d.text((x, y + 28), value, font=font(30, True), fill=(25, 25, 25))
                y += 92
            y += 36
    d.text((W // 2, H - 50), note, font=font(20), fill=(140, 140, 140), anchor="mm")
    img.save(os.path.join(HERE, f"{name}.png"), optimize=True)


# ---------------------------------------------------------------------------------------------
# The 12 bookings: (name, expected booking, draw function, slips for the canned answer)
# A slip is (path, value): set that path in the canned answer (a miss or an extra field), or
# ("~path", value): a different spelling the scorer must still accept (a hit).
# ---------------------------------------------------------------------------------------------

GOLDEN = []


def golden(name, booking, draw, slips=()):
    GOLDEN.append((name, booking, draw, slips))


# 1. Flight, one way, email PDF
golden(
    "flight-oneway",
    {
        "type": "flight", "confirmation": "KXJ4PL", "passenger": "Matthew Sample",
        "legs": [leg("Bluejay Airways", "BJ", "BJ 512", airport("TPA", "Tampa", "United States"),
                     airport("LAS", "Las Vegas", "United States"), when("2026-11-12", "08:25"),
                     when("2026-11-12", "10:05"), seat="14A", cabin="Economy")],
        "price": price(289.40, "USD"),
    },
    lambda: pdf("flight-oneway", "Bluejay Airways", "Your trip is confirmed  ·  Confirmation KXJ4PL", [
        ("Passenger", [("Name", "Matthew Sample")]),
        ("Flight", [("Flight", "BJ 512"), ("From", "Tampa (TPA), United States"),
                    ("To", "Las Vegas (LAS), United States"), ("Departs", "Thu, Nov 12, 2026 at 8:25 AM"),
                    ("Arrives", "Thu, Nov 12, 2026 at 10:05 AM"), ("Seat", "14A"), ("Cabin", "Economy")]),
        ("Payment", [("Total paid", "$289.40 USD")]),
    ]),
    [("~legs.0.departs.time", "8:25"), ("~passenger", "MATTHEW SAMPLE")],
)

# 2. Flight, round trip (2 legs), email PDF
golden(
    "flight-roundtrip",
    {
        "type": "flight", "confirmation": "7QW2ZR", "passenger": "Alex Example",
        "legs": [
            leg("Coastline Air", "CL", "CL 88", airport("JFK", "New York", "United States"),
                airport("LIS", "Lisbon", "Portugal"), when("2026-05-03", "19:40"), when("2026-05-04", "07:55"),
                terminal="4", seat="22C", cabin="Economy"),
            leg("Coastline Air", "CL", "CL 89", airport("LIS", "Lisbon", "Portugal"),
                airport("JFK", "New York", "United States"), when("2026-05-10", "11:30"), when("2026-05-10", "14:20"),
                terminal="1", seat="23C", cabin="Economy"),
        ],
        "price": price(742.18, "USD"),
    },
    lambda: pdf("flight-roundtrip", "Coastline Air", "Booking reference 7QW2ZR  ·  Round trip", [
        ("Traveller", [("Passenger", "Alex Example")]),
        ("Outbound  ·  CL 88", [("From", "New York JFK, Terminal 4"), ("To", "Lisbon LIS, Portugal"),
                               ("Departs", "Sun 3 May 2026, 19:40"), ("Arrives", "Mon 4 May 2026, 07:55"),
                               ("Seat", "22C  ·  Economy")]),
        ("Return  ·  CL 89", [("From", "Lisbon LIS, Terminal 1"), ("To", "New York JFK, United States"),
                             ("Departs", "Sun 10 May 2026, 11:30"), ("Arrives", "Sun 10 May 2026, 14:20"),
                             ("Seat", "23C  ·  Economy")]),
        ("Fare", [("Total", "USD 742.18")]),
    ]),
    [("legs.1.seat", None)],
)

# 3. Flight, boarding-pass screenshot
golden(
    "flight-mobile",
    {
        "type": "flight", "confirmation": "HX93LM", "passenger": "Jordan Demo",
        "legs": [leg("Northwind Airlines", "NW", "NW 1207", airport("SEA", "Seattle", "United States"),
                     airport("SFO", "San Francisco", "United States"), when("2026-08-21", "06:10"),
                     when("2026-08-21", "08:15"), gate="C14", seat="3B", cabin="First")],
        "price": None,
    },
    lambda: png("flight-mobile", "NORTHWIND AIRLINES", (24, 70, 120), [
        ("big", "SEA  →  SFO", "Seattle to San Francisco"),
        ("grid", [[("FLIGHT", "NW 1207"), ("DATE", "21 AUG 2026"), ("CABIN", "First")],
                  [("DEPARTS", "06:10"), ("ARRIVES", "08:15"), ("GATE", "C14")],
                  [("PASSENGER", "Jordan Demo"), ("SEAT", "3B"), ("CONF", "HX93LM")]]),
        ("text", "Boarding pass. Not valid for travel."),
    ]),
    [("legs.0.arrives.time", "08:51")],
)

# 4. Hotel, email PDF
golden(
    "hotel-email",
    {
        "type": "hotel",
        "hotel": loc("Harbor Light Hotel", "410 Example Street, San Diego, CA 92101", "San Diego", "United States"),
        "checkIn": when("2026-06-14", "15:00"), "checkOut": when("2026-06-17", "11:00"),
        "confirmation": "HL-558201", "room": "Deluxe King", "phone": "+1 619 555 0142",
        "website": "harborlighthotel.example", "email": "stay@harborlighthotel.example",
        "price": price(612.75, "USD"),
    },
    lambda: pdf("hotel-email", "Harbor Light Hotel", "Reservation confirmed  ·  HL-558201", [
        ("Your stay", [("Hotel", "Harbor Light Hotel"), ("Address", "410 Example Street, San Diego, CA 92101"),
                       ("Country", "United States"), ("Check-in", "Sunday, June 14, 2026 from 3:00 PM"),
                       ("Check-out", "Wednesday, June 17, 2026 by 11:00 AM"), ("Room", "Deluxe King")]),
        ("Contact", [("Phone", "+1 619 555 0142"), ("Web", "harborlighthotel.example"),
                     ("Email", "stay@harborlighthotel.example")]),
        ("Charges", [("Total (3 nights, taxes incl.)", "$612.75")]),
    ]),
    [("~website", "https://www.harborlighthotel.example/"), ("~phone", "+1 (619) 555-0142")],
)

# 5. Hotel, guesthouse invoice PDF (Lisbon, euros)
golden(
    "hotel-guesthouse",
    {
        "type": "hotel",
        "hotel": loc("Pensão Azul", "Rua do Exemplo 12, 1100-001 Lisboa", "Lisbon", "Portugal"),
        "checkIn": when("2026-05-04", "14:00"), "checkOut": when("2026-05-10", "12:00"),
        "confirmation": "88231", "room": "Double Room, River View", "phone": None, "website": None,
        "email": None, "price": price(540.00, "EUR"),
    },
    lambda: pdf("hotel-guesthouse", "Pensão Azul", "Booking 88231  ·  Lisbon, Portugal", [
        ("Guest house", [("Name", "Pensão Azul"), ("Address", "Rua do Exemplo 12, 1100-001 Lisboa"),
                         ("City", "Lisbon, Portugal")]),
        ("Dates", [("Arrival", "04/05/2026, from 14:00"), ("Departure", "10/05/2026, until 12:00"),
                   ("Room", "Double Room, River View")]),
        ("Invoice", [("6 nights", "€540,00"), ("Total", "€540,00 (EUR)")]),
    ], footer="Dates are day/month/year. Sample booking made for testing."),
    [("~hotel.city", "lisbon")],
)

# 6. Hotel, home-rental app screenshot (Airbnb-style)
golden(
    "hotel-homestay",
    {
        "type": "hotel",
        "hotel": loc("Sunny loft near Zilker Park", None, "Austin", "United States"),
        "checkIn": when("2026-09-04", "16:00"), "checkOut": when("2026-09-07", "11:00"),
        "confirmation": "HMX4QZ8PL2", "room": None, "phone": None, "website": None, "email": None,
        "price": price(486.20, "USD"),
    },
    lambda: png("hotel-homestay", "homestay", (226, 76, 92), [
        ("big", "Sunny loft near Zilker Park", "Entire loft in Austin, United States"),
        ("grid", [[("CHECK-IN", "Fri, Sep 4"), ("CHECKOUT", "Mon, Sep 7")],
                  [("", "4:00 PM"), ("", "11:00 AM")]]),
        ("text", "Your trip is in 2026. Host: Sam"),
        ("grid", [[("CONFIRMATION CODE", "HMX4QZ8PL2")], [("TOTAL COST", "$486.20 USD")]]),
    ]),
    [("hotel.city", "Austin, TX"), ("hotel.address", "Zilker Park")],
)

# 7. Car, airport pickup, email PDF (returned where picked up)
golden(
    "car-airport",
    {
        "type": "car", "company": "Roadrunner Rentals",
        "pickupLocation": loc("Las Vegas Airport (LAS) Rent-A-Car Center", "7135 Example Rd", "Las Vegas", "United States"),
        "returnLocation": None,
        "pickup": when("2026-11-12", "11:00"), "dropoff": when("2026-11-15", "09:00"),
        "confirmation": "RR-20931", "vehicle": "Toyota Corolla or similar", "price": price(198.33, "USD"),
    },
    lambda: pdf("car-airport", "Roadrunner Rentals", "Your car is reserved  ·  RR-20931", [
        ("Pick-up and return", [("Location", "Las Vegas Airport (LAS) Rent-A-Car Center"),
                                ("Address", "7135 Example Rd, Las Vegas, United States"),
                                ("Pick-up", "Nov 12, 2026  11:00 AM"), ("Return", "Nov 15, 2026  9:00 AM"),
                                ("", "Return to the same location")]),
        ("Vehicle", [("Car", "Toyota Corolla or similar")]),
        ("Price", [("Estimated total", "$198.33")]),
    ]),
)

# 8. Car, one-way rental app screenshot
golden(
    "car-oneway",
    {
        "type": "car", "company": "Coastal Drive",
        "pickupLocation": loc("San Francisco Downtown", "500 Sample Ave", "San Francisco", "United States"),
        "returnLocation": loc("Los Angeles Airport (LAX)", None, "Los Angeles", "United States"),
        "pickup": when("2026-08-22", "10:00"), "dropoff": when("2026-08-25", "18:00"),
        "confirmation": "CDC7781", "vehicle": "Ford Mustang Convertible", "price": price(401.00, "USD"),
    },
    lambda: png("car-oneway", "Coastal Drive", (18, 122, 110), [
        ("big", "Ford Mustang Convertible", "One-way rental  ·  Booking CDC7781"),
        ("grid", [[("PICK-UP", "Sat, Aug 22, 2026"), ("TIME", "10:00 AM")]]),
        ("text", "San Francisco Downtown"),
        ("text", "500 Sample Ave, San Francisco, United States"),
        ("grid", [[("DROP-OFF", "Tue, Aug 25, 2026"), ("TIME", "6:00 PM")]]),
        ("text", "Los Angeles Airport (LAX), Los Angeles, United States"),
        ("grid", [[("TOTAL", "$401.00")]]),
    ]),
    [("returnLocation.city", None)],
)

# 9. Event ticket, concert email PDF
golden(
    "ticket-concert",
    {
        "type": "ticket", "event": "The Lanterns: Live in Concert",
        "venue": loc("Desert Moon Arena", "3780 Example Blvd S", "Las Vegas", "United States"),
        "starts": when("2026-11-13", "20:00"), "section": "104", "row": "K", "seats": "11-12",
        "confirmation": "TKT-4410982", "price": price(238.50, "USD"),
    },
    lambda: pdf("ticket-concert", "Sample Tickets", "Order TKT-4410982  ·  2 tickets", [
        ("Event", [("Show", "The Lanterns: Live in Concert"), ("Venue", "Desert Moon Arena"),
                   ("Address", "3780 Example Blvd S, Las Vegas, United States"),
                   ("Date", "Friday, November 13, 2026"), ("Show starts", "8:00 PM")]),
        ("Seats", [("Section", "104"), ("Row", "K"), ("Seats", "11-12")]),
        ("Order total", [("Total incl. fees", "$238.50")]),
    ]),
)

# 10. Event ticket, football match app screenshot (euros)
golden(
    "ticket-match",
    {
        "type": "ticket", "event": "Lisboa Lions vs Porto Pilots",
        "venue": loc("Estádio do Exemplo", None, "Lisbon", "Portugal"),
        "starts": when("2026-05-08", "20:45"), "section": "N3", "row": "12", "seats": "7",
        "confirmation": "EX-99120", "price": price(90.00, "EUR"),
    },
    lambda: png("ticket-match", "MATCHDAY", (30, 30, 30), [
        ("big", "Lisboa Lions vs Porto Pilots", "Estádio do Exemplo  ·  Lisbon, Portugal"),
        ("grid", [[("DATE", "08.05.2026"), ("KICK-OFF", "20:45")],
                  [("SECTION", "N3"), ("ROW", "12"), ("SEAT", "7")]]),
        ("grid", [[("TICKET", "EX-99120"), ("PRICE", "€90.00")]]),
    ]),
    [("venue.country", "PT")],
)

# 11. Restaurant reservation, email PDF
golden(
    "restaurant-email",
    {
        "type": "reservation",
        "venue": loc("Ember & Oak", "221 Sample St", "San Diego", "United States"),
        "starts": when("2026-06-15", "19:30"), "partySize": 4, "confirmation": "R-55102", "price": None,
    },
    lambda: pdf("restaurant-email", "Ember & Oak", "Your table is booked", [
        ("Reservation", [("Restaurant", "Ember & Oak"), ("Address", "221 Sample St, San Diego, United States"),
                         ("When", "Monday, June 15, 2026 at 7:30 PM"), ("Party", "4 guests"),
                         ("Confirmation", "R-55102")]),
        ("Good to know", [("", "We hold tables for 15 minutes.")]),
    ]),
)

# 12. Restaurant reservation, booking app screenshot
golden(
    "restaurant-app",
    {
        "type": "reservation",
        "venue": loc("Tasca do Exemplo", "Rua da Amostra 5", "Lisbon", "Portugal"),
        "starts": when("2026-05-05", "21:00"), "partySize": 2, "confirmation": None, "price": None,
    },
    lambda: png("restaurant-app", "TableNow", (200, 120, 40), [
        ("big", "Tasca do Exemplo", "Rua da Amostra 5, Lisbon, Portugal"),
        ("grid", [[("DATE", "Tue 5 May 2026"), ("TIME", "21:00"), ("GUESTS", "2")]]),
        ("text", "Reservation confirmed. See you soon!"),
    ]),
    [("confirmation", "TASCA")],
)


def set_path(obj, path, value):
    keys = path.split(".")
    for key in keys[:-1]:
        obj = obj[int(key)] if isinstance(obj, list) else obj[key]
    last = keys[-1]
    if isinstance(obj, list):
        obj[int(last)] = value
    else:
        obj[last] = value


def write_json(path, value):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(value, f, indent=2, ensure_ascii=False)
        f.write("\n")


if __name__ == "__main__":
    os.makedirs(RECORDED, exist_ok=True)
    for name, booking, draw, slips in GOLDEN:
        draw()
        write_json(os.path.join(HERE, f"{name}.expected.json"), booking)
        answer = copy.deepcopy(booking)
        for path, value in slips:
            set_path(answer, path.lstrip("~"), value)
        write_json(os.path.join(RECORDED, f"{name}.json"), {"booking": answer, "uncertain": []})
    print(f"wrote {len(GOLDEN)} golden bookings to {HERE}")
