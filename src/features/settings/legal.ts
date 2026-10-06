/**
 * Terms and Privacy for the demo phase (TR-11): short and plain. Matthew reviews the wording at QA;
 * update `LEGAL_UPDATED` whenever the text changes. No em dashes in app copy (docs/design.md).
 */
export interface LegalSection {
  heading: string;
  body: string;
}

export interface LegalDocument {
  title: string;
  intro: string;
  sections: readonly LegalSection[];
}

export const LEGAL_UPDATED = 'October 6, 2026';

export const TERMS: LegalDocument = {
  title: 'Terms of Use',
  intro:
    'Trip is an early demo, shared with a small group of people to try out. By using it you agree to these terms.',
  sections: [
    {
      heading: 'A demo, as is',
      body: 'Features may change, break or disappear, and data may be lost. Trip is provided as is, without any warranty. Keep your own copies of tickets and bookings.',
    },
    {
      heading: 'Your account',
      body: 'You sign in with your email and a password. Keep the password to yourself. You are responsible for what you add to your account.',
    },
    {
      heading: 'Your content',
      body: 'Trips, bookings, documents, photos and links you add stay yours. You let us store and process them only to run Trip for you.',
    },
    {
      heading: 'Fair use',
      body: 'Do not use Trip to break the law, to upload things you have no right to share, or to try to reach other people’s data.',
    },
    {
      heading: 'Information from other services',
      body: 'Weather, events, photos and place details come from other services and can be wrong or out of date. Check times, gates and tickets with the airline, hotel or venue before you travel.',
    },
    {
      heading: 'Ending the demo',
      body: 'You can stop using Trip at any time. We may end the demo or remove access, and will try to tell you first.',
    },
  ],
};

export const PRIVACY: LegalDocument = {
  title: 'Privacy',
  intro:
    'Trip keeps only what it needs to plan your trips, never sells your data and shows no ads.',
  sections: [
    {
      heading: 'What Trip stores',
      body: 'Your email, your trips and plans, the bookings, documents and links you add, your expenses, and your settings (units and home currency). Only your account can read them.',
    },
    {
      heading: 'Supabase',
      body: 'Your account, data and files are stored with Supabase, our database and file storage provider.',
    },
    {
      heading: 'Google Gemini',
      body: 'When you import a booking or share a TikTok or Reels link, the file or link is sent to Google Gemini (free tier) to read the details. On the free tier Google may use what it receives to improve its products, so only import what you are comfortable sharing.',
    },
    {
      heading: 'Passports and visas',
      body: 'Images of passports and visas are stored in your account only. They are never sent to Gemini or any other AI.',
    },
    {
      heading: 'Events, weather, photos and places',
      body: 'Ticketmaster receives your destination and dates to find events. Open-Meteo receives your destination’s location and dates for the forecast. Unsplash receives the destination name to find a cover photo, and OpenStreetMap (Photon) receives what you type when you search for a city. None of them receive your name or email.',
    },
    {
      heading: 'Deleting your data',
      body: 'Deleting your account from the app comes later. Until then, ask the person who invited you to the demo and your account and files will be removed.',
    },
  ],
};
