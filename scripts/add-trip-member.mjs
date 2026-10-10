#!/usr/bin/env node
// Adds a second account to another account's trip, for two-phone QA before invite links exist
// (TR-54 live updates; TR-57 replaces this with invites). Both accounts must already be signed up
// in the app. Adds the member to every trip of the owner in that city; running it again changes
// nothing.
//
//   SUPABASE_ACCESS_TOKEN=… node scripts/add-trip-member.mjs <owner email> <member email> [city]
//
// City defaults to "Las Vegas" (Settings → Developer → Add the sample Las Vegas trip).

import { literal, sql } from './supabase-api.mjs';

const [ownerEmail, memberEmail, city = 'Las Vegas'] = process.argv.slice(2);
if (!ownerEmail || !memberEmail) {
  console.error('Usage: node scripts/add-trip-member.mjs <owner email> <member email> [city]');
  process.exit(1);
}

const rows = await sql(`
  with owner as (select id from auth.users where email = lower(${literal(ownerEmail)})),
       member as (select id from auth.users where email = lower(${literal(memberEmail)})),
       trips as (
         select t.id, t.city, t.start_date
           from public.trips t
           join public.trip_members m on m.trip_id = t.id and m.role = 'owner'
          where m.user_id = (select id from owner) and t.city ilike ${literal(city)}
       ),
       added as (
         insert into public.trip_members (trip_id, user_id, role)
         select id, (select id from member), 'member' from trips
          where (select id from member) is not null
         on conflict do nothing
         returning trip_id
       )
  select (select count(*) from owner)::int as owner_found,
         (select count(*) from member)::int as member_found,
         (select count(*) from trips)::int as trips_found,
         (select count(*) from added)::int as added,
         (select string_agg(city || ' ' || start_date, ', ') from trips) as trips`);

const [result] = rows;
if (!result.owner_found) console.error(`No account for ${ownerEmail}: sign up in the app first.`);
if (!result.member_found) console.error(`No account for ${memberEmail}: sign up in the app first.`);
if (result.owner_found && !result.trips_found) {
  console.error(`${ownerEmail} owns no trip in ${city}.`);
}
if (!result.owner_found || !result.member_found || !result.trips_found) process.exit(1);
console.log(
  `${memberEmail} is a member of ${result.trips} (${result.added} added now, the rest already).`,
);
