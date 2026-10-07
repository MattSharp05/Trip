/**
 * "Popular with travellers" on Discover (TR-31): a short curated list of restaurants and bars per
 * city. Photon (OpenStreetMap) has no ratings, so nothing can rank places by how good they are yet;
 * see the ticket's Decision. Cities without a list show no row.
 */

/** A curated place, ready to save to the Bucket List. */
export interface PopularPlace {
  id: string;
  name: string;
  category: 'food' | 'nightlife';
  /** The app's place kind (pin symbol, visit length): food, bar, nightlife. */
  kind: string;
  /** The neighbourhood line on the card. */
  area: string;
  address: string;
  lat: number;
  lng: number;
  photoUrl: string | null;
}

/** Wikimedia Commons image at a phone-friendly width. */
const commons = (file: string) =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=640`;

const POPULAR: Record<string, readonly PopularPlace[]> = {
  'las vegas': [
    {
      id: 'popular-hells-kitchen',
      name: "Hell's Kitchen",
      category: 'food',
      kind: 'food',
      area: 'Caesars Palace',
      address: 'Caesars Palace, 3570 Las Vegas Blvd S, Las Vegas, NV',
      lat: 36.1162,
      lng: -115.1745,
      photoUrl: commons("Hell's Kitchen Las Vegas 2019.jpg"),
    },
    {
      id: 'popular-omnia',
      name: 'Omnia Nightclub',
      category: 'nightlife',
      kind: 'nightlife',
      area: 'Caesars Palace',
      address: 'Caesars Palace, 3570 Las Vegas Blvd S, Las Vegas, NV',
      lat: 36.117,
      lng: -115.175,
      photoUrl: commons('Omnia Nightclub Las Vegas 2026-05-15 3.jpg'),
    },
    {
      id: 'popular-lotus-of-siam',
      name: 'Lotus of Siam',
      category: 'food',
      kind: 'food',
      area: 'East Flamingo',
      address: '620 E Flamingo Rd, Las Vegas, NV',
      lat: 36.1149,
      lng: -115.149,
      photoUrl: commons('Lotus of siam facade.jpg'),
    },
    {
      id: 'popular-golden-tiki',
      name: 'Golden Tiki',
      category: 'nightlife',
      kind: 'bar',
      area: 'Chinatown',
      address: '3939 Spring Mountain Rd, Las Vegas, NV',
      lat: 36.1257,
      lng: -115.1966,
      photoUrl: commons('Golden Tiki Las Vegas.jpg'),
    },
    {
      id: 'popular-peppermill',
      name: 'Peppermill Restaurant',
      category: 'food',
      kind: 'food',
      area: 'The Strip',
      address: '2985 Las Vegas Blvd S, Las Vegas, NV',
      lat: 36.1336,
      lng: -115.163,
      photoUrl: commons('Peppermill Fabulousness.jpg'),
    },
    {
      id: 'popular-mon-ami-gabi',
      name: 'Mon Ami Gabi',
      category: 'food',
      kind: 'food',
      area: 'Paris Las Vegas',
      address: 'Paris Las Vegas, 3655 Las Vegas Blvd S',
      lat: 36.1125,
      lng: -115.172,
      photoUrl: commons('Mon Ami Gabi Paris Las Vegas.jpg'),
    },
  ],
  'new york': [
    {
      id: 'popular-katz',
      name: "Katz's Delicatessen",
      category: 'food',
      kind: 'food',
      area: 'Lower East Side',
      address: '205 E Houston St, New York, NY',
      lat: 40.7223,
      lng: -73.9874,
      photoUrl: null,
    },
    {
      id: 'popular-joes-pizza',
      name: "Joe's Pizza",
      category: 'food',
      kind: 'food',
      area: 'Greenwich Village',
      address: '7 Carmine St, New York, NY',
      lat: 40.7306,
      lng: -74.0022,
      photoUrl: null,
    },
    {
      id: 'popular-pdt',
      name: "Please Don't Tell",
      category: 'nightlife',
      kind: 'bar',
      area: 'East Village',
      address: '113 St Marks Pl, New York, NY',
      lat: 40.7271,
      lng: -73.9837,
      photoUrl: null,
    },
    {
      id: 'popular-le-bain',
      name: 'Le Bain',
      category: 'nightlife',
      kind: 'nightlife',
      area: 'Meatpacking District',
      address: 'The Standard, High Line, 848 Washington St, New York, NY',
      lat: 40.7409,
      lng: -74.0081,
      photoUrl: null,
    },
  ],
  'cape town': [
    {
      id: 'popular-kloof-street-house',
      name: 'Kloof Street House',
      category: 'food',
      kind: 'food',
      area: 'Gardens',
      address: '30 Kloof St, Gardens, Cape Town',
      lat: -33.9284,
      lng: 18.4108,
      photoUrl: null,
    },
    {
      id: 'popular-truth-coffee',
      name: 'Truth Coffee Roasting',
      category: 'food',
      kind: 'food',
      area: 'City Centre',
      address: '36 Buitenkant St, Cape Town',
      lat: -33.9286,
      lng: 18.4234,
      photoUrl: null,
    },
    {
      id: 'popular-gin-bar',
      name: 'The Gin Bar',
      category: 'nightlife',
      kind: 'bar',
      area: 'City Centre',
      address: '64A Wale St, Cape Town',
      lat: -33.9227,
      lng: 18.4155,
      photoUrl: null,
    },
  ],
  tokyo: [
    {
      id: 'popular-tsukiji',
      name: 'Tsukiji Outer Market',
      category: 'food',
      kind: 'food',
      area: 'Tsukiji',
      address: '4 Chome-16-2 Tsukiji, Chuo City, Tokyo',
      lat: 35.6655,
      lng: 139.7707,
      photoUrl: null,
    },
    {
      id: 'popular-ichiran-shibuya',
      name: 'Ichiran Shibuya',
      category: 'food',
      kind: 'food',
      area: 'Shibuya',
      address: '1-22-7 Jinnan, Shibuya City, Tokyo',
      lat: 35.6614,
      lng: 139.701,
      photoUrl: null,
    },
    {
      id: 'popular-golden-gai',
      name: 'Golden Gai',
      category: 'nightlife',
      kind: 'bar',
      area: 'Shinjuku',
      address: '1 Chome Kabukicho, Shinjuku City, Tokyo',
      lat: 35.694,
      lng: 139.7046,
      photoUrl: null,
    },
  ],
};

/** The curated places for a trip's city; empty when the city has no list. */
export function popularPlaces(city: string): readonly PopularPlace[] {
  return POPULAR[city.trim().toLowerCase()] ?? [];
}
