#!/usr/bin/env node
// Proves row-level security against the live project with three throwaway users: A owns a trip
// and writes a row in every table and a file in every bucket; B is a member of A's trip (added
// with the service role, as the invite RPC will) and shares it; C (and an anonymous client) is on
// no trip of A's and can't read, change or delete anything, or point at it. Private bookings and
// passports stay A's until A shares them (TR-50, ADR 0027). Realtime follows the same rules: B
// hears A's changes live, C doesn't (TR-54, ADR 0028). Finally C joins through A's invite link,
// and a reset link stops working for a fourth user, D (TR-57, ADR 0029). The users and their data
// are deleted afterwards.
//
//   SUPABASE_ACCESS_TOKEN=… node scripts/supabase-rls-test.mjs
//
// Runs in CI on main after scripts/supabase-apply.mjs.

import { randomUUID } from 'node:crypto';

import { createClient } from '@supabase/supabase-js';

import { apiKeys, projectUrl, sql } from './supabase-api.mjs';

const url = projectUrl();
const { anon, service_role: serviceRole } = await apiKeys();
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, serviceRole, options);

const users = [];
const files = [];
let failures = 0;
function check(label, ok, detail = '') {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok || !detail ? '' : ` — ${detail}`}`);
  if (!ok) failures += 1;
}

async function newUser() {
  const email = `rls-test-${randomUUID()}@example.com`;
  const password = randomUUID();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  users.push({ id: data.user.id });
  const client = createClient(url, anon, options);
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  return { id: data.user.id, client };
}

/**
 * Listens on a trip's channel the way the app does (`useTripLiveUpdates`): changes to the trip's
 * rows, plus its `trips` row (which a delete on the trip touches, TR-54).
 */
async function listen(client, tripId) {
  const events = [];
  await client.realtime.setAuth();
  const channel = client.channel(`trip:${tripId}:${randomUUID()}`);
  for (const table of [
    'trip_members',
    'itinerary_items',
    'bucket_items',
    'bookings',
    'expenses',
    'places',
  ]) {
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table, filter: `trip_id=eq.${tripId}` },
      (change) => events.push(change),
    );
  }
  channel.on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'trips', filter: `id=eq.${tripId}` },
    (change) => events.push(change),
  );
  // Joined is not listening yet: Realtime confirms "Subscribed to PostgreSQL" a moment later.
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('realtime: subscribe timed out')), 15_000);
    channel.on('system', {}, (message) => {
      if (message.extension === 'postgres_changes' && message.status === 'ok') {
        clearTimeout(timer);
        resolve();
      }
    });
    channel.subscribe((status, err) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        clearTimeout(timer);
        reject(new Error(`realtime: ${status} ${err?.message ?? ''}`));
      }
    });
  });
  return { events, channel };
}

/** Waits up to `ms` for an event matching `match`; resolves with it, or undefined. */
async function waitFor(events, match, ms) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    const found = events.find(match);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return undefined;
}

async function insertOne(client, table, row) {
  const { data, error } = await client.from(table).insert(row).select().single();
  if (error) throw new Error(`insert ${table}: ${error.message}`);
  return data;
}

try {
  const a = await newUser();
  const b = await newUser();
  const c = await newUser();
  const anonymous = createClient(url, anon, options);

  // User A: one row in every table.
  const trip = await insertOne(a.client, 'trips', {
    city: 'Las Vegas',
    timezone: 'America/Los_Angeles',
    start_date: '2026-11-01',
    end_date: '2026-11-04',
  });
  const place = await insertOne(a.client, 'places', { name: 'Bellagio Fountains' });
  const booking = await insertOne(a.client, 'bookings', {
    trip_id: trip.id,
    type: 'hotel',
    original_path: `${a.id}/rls-test.txt`,
  });
  const rows = {
    trips: trip,
    places: place,
    bookings: booking,
    itinerary_items: await insertOne(a.client, 'itinerary_items', {
      trip_id: trip.id,
      day: '2026-11-02',
      kind: 'place',
      place_id: place.id,
    }),
    documents: await insertOne(a.client, 'documents', {
      type: 'passport',
      number: 'X1234567',
      image_paths: [`${a.id}/documents/rls-test.txt`],
    }),
    bucket_items: await insertOne(a.client, 'bucket_items', { trip_id: trip.id }),
    expenses: await insertOne(a.client, 'expenses', {
      trip_id: trip.id,
      amount_minor: 12345,
      currency: 'USD',
    }),
    saved_links: await insertOne(a.client, 'saved_links', { url: 'https://example.com/v/1' }),
  };
  check('user_id defaults to auth.uid()', trip.user_id === a.id);

  // TR-50: A's trip has A as its owner; B joins it the way an accepted invite will.
  const owners = await a.client.from('trip_members').select('user_id, role').eq('trip_id', trip.id);
  check(
    'trip_members: creator added as owner',
    owners.data?.length === 1 && owners.data[0].user_id === a.id && owners.data[0].role === 'owner',
    owners.error?.message ?? JSON.stringify(owners.data),
  );
  const join = await admin.from('trip_members').insert({ trip_id: trip.id, user_id: b.id });
  if (join.error) throw new Error(`add member: ${join.error.message}`);
  const placeOnTrip = await a.client.from('places').select('trip_id').eq('id', place.id).single();
  check(
    'places: a place joins the trip of the first item that uses it',
    placeOnTrip.data?.trip_id === trip.id,
    placeOnTrip.error?.message,
  );

  // TR-54: live updates. B (member) hears A's new stop within 5 s, and hears through the trip's
  // touched `trips` row what Realtime can't send B: a delete, a row moved to another trip, a
  // booking made private. C (non-member) hears nothing on the same filters.
  const bLive = await listen(b.client, trip.id);
  const cLive = await listen(c.client, trip.id);
  const tripTouched = (e) =>
    e.table === 'trips' && e.eventType === 'UPDATE' && e.new?.id === trip.id;
  const liveStop = await insertOne(a.client, 'itinerary_items', {
    trip_id: trip.id,
    day: '2026-11-04',
    kind: 'place',
    place_id: place.id,
  });
  const heard = await waitFor(
    bLive.events,
    (e) => e.eventType === 'INSERT' && e.new?.id === liveStop.id,
    5_000,
  );
  check('realtime: member receives an insert on the trip within 5 s', Boolean(heard));

  bLive.events.length = 0;
  await a.client.from('itinerary_items').delete().eq('id', liveStop.id);
  check(
    "realtime: member hears a delete through the trip's update",
    Boolean(await waitFor(bLive.events, tripTouched, 5_000)),
  );

  const otherTrip = await insertOne(a.client, 'trips', {
    city: 'Reno',
    timezone: 'America/Los_Angeles',
    start_date: '2026-12-01',
    end_date: '2026-12-02',
  });
  const movingItem = await insertOne(a.client, 'bucket_items', { trip_id: trip.id });
  bLive.events.length = 0;
  await a.client.from('bucket_items').update({ trip_id: otherTrip.id }).eq('id', movingItem.id);
  check(
    "realtime: member hears a row moved to another trip through the trip's update",
    Boolean(await waitFor(bLive.events, tripTouched, 5_000)),
  );

  const hiding = await insertOne(a.client, 'bookings', { trip_id: trip.id, type: 'ticket' });
  bLive.events.length = 0;
  await a.client.from('bookings').update({ visibility: 'private' }).eq('id', hiding.id);
  check(
    "realtime: member hears a booking made private through the trip's update",
    Boolean(await waitFor(bLive.events, tripTouched, 5_000)),
  );
  await a.client.from('bookings').delete().eq('id', hiding.id);
  await a.client.from('trips').delete().eq('id', otherTrip.id);

  // Give C's channel as long as B's had to receive anything that leaked.
  await new Promise((resolve) => setTimeout(resolve, 2_000));
  check(
    'realtime: non-member receives nothing',
    cLive.events.length === 0,
    JSON.stringify(cLive.events.map((e) => `${e.table} ${e.eventType}`)),
  );
  await b.client.removeChannel(bLive.channel);
  await c.client.removeChannel(cLive.channel);

  // Rows the trip's members share, and rows that stay A's alone.
  const shared = new Set([
    'trips',
    'places',
    'bookings',
    'itinerary_items',
    'bucket_items',
    'expenses',
  ]);
  for (const [table, row] of Object.entries(rows)) {
    const own = await a.client.from(table).select('id').eq('id', row.id);
    check(`${table}: owner reads own row`, own.data?.length === 1, own.error?.message);

    if (shared.has(table)) {
      const memberRead = await b.client.from(table).select('id').eq('id', row.id);
      check(`${table}: member reads`, memberRead.data?.length === 1, memberRead.error?.message);
      const memberUpdate = await b.client
        .from(table)
        .update({ updated_at: new Date().toISOString() })
        .eq('id', row.id)
        .select('id, user_id');
      check(
        `${table}: member edits, row stays A's`,
        memberUpdate.data?.length === 1 && memberUpdate.data[0].user_id === a.id,
        memberUpdate.error?.message,
      );
    } else {
      const memberRead = await b.client.from(table).select('id').eq('id', row.id);
      check(`${table}: member can't read A's own row`, !memberRead.data?.length);
    }

    const read = await c.client.from(table).select('id').eq('id', row.id);
    check(`${table}: non-member can't read`, !read.error && read.data.length === 0);

    const update = await c.client
      .from(table)
      .update({ updated_at: new Date().toISOString() })
      .eq('id', row.id)
      .select('id');
    check(`${table}: non-member can't update`, !update.data?.length);

    const del = await c.client.from(table).delete().eq('id', row.id).select('id');
    check(`${table}: non-member can't delete`, !del.data?.length);

    const anonRead = await anonymous.from(table).select('id').eq('id', row.id);
    check(`${table}: anonymous can't read`, !anonRead.data?.length);

    const anonUpdate = await anonymous
      .from(table)
      .update({ updated_at: new Date().toISOString() })
      .eq('id', row.id)
      .select('id');
    check(`${table}: anonymous can't update`, !anonUpdate.data?.length);

    const anonDelete = await anonymous.from(table).delete().eq('id', row.id).select('id');
    check(`${table}: anonymous can't delete`, !anonDelete.data?.length);

    // A copy of A's row claiming A's user_id: only RLS can stop it.
    const copy = Object.fromEntries(
      Object.entries(row).filter(([key]) => !['id', 'created_at', 'updated_at'].includes(key)),
    );
    const anonInsert = await anonymous.from(table).insert(copy);
    check(`${table}: anonymous can't insert`, Boolean(anonInsert.error));
  }

  // TR-50: what a member adds, edits and deletes on the trip; C sees none of it.
  const memberRows = {
    places: { trip_id: trip.id, name: 'High Roller' },
    itinerary_items: { trip_id: trip.id, day: '2026-11-03', kind: 'place', place_id: place.id },
    bucket_items: { trip_id: trip.id, place_id: place.id },
    bookings: { trip_id: trip.id, type: 'ticket' },
    expenses: { trip_id: trip.id, amount_minor: 2500, currency: 'USD' },
  };
  for (const [table, row] of Object.entries(memberRows)) {
    const added = await b.client.from(table).insert(row).select().single();
    check(
      `${table}: member adds`,
      !added.error && added.data.user_id === b.id,
      added.error?.message,
    );
    if (added.error) continue;
    const seen = await a.client.from(table).select('id').eq('id', added.data.id);
    check(`${table}: owner sees the member's row`, seen.data?.length === 1);
    const hidden = await c.client.from(table).select('id').eq('id', added.data.id);
    check(`${table}: non-member can't see the member's row`, !hidden.data?.length);
    const disposable = await insertOne(a.client, table, row);
    const del = await b.client.from(table).delete().eq('id', disposable.id).select('id');
    check(`${table}: member deletes the owner's row`, del.data?.length === 1, del.error?.message);
  }
  const planned = await b.client
    .from('itinerary_items')
    .select('added_by')
    .eq('trip_id', trip.id)
    .eq('user_id', b.id)
    .single();
  check('itinerary_items: added_by defaults to user_id', planned.data?.added_by === b.id);

  // Mine / Shared: flights default to private; a private booking is its owner's alone.
  const flight = await insertOne(a.client, 'bookings', {
    trip_id: trip.id,
    type: 'flight',
    original_path: `${a.id}/rls-test-flight.txt`,
  });
  check(
    'bookings: flights default to private, others to shared',
    flight.visibility === 'private' && booking.visibility === 'shared',
  );
  const privateRead = await b.client.from('bookings').select('id').eq('id', flight.id);
  check("bookings: member can't read a private booking", !privateRead.data?.length);
  const privateEdit = await b.client
    .from('bookings')
    .update({ data: { hacked: true } })
    .eq('id', flight.id)
    .select('id');
  check("bookings: member can't edit a private booking", !privateEdit.data?.length);
  const hide = await b.client
    .from('bookings')
    .update({ visibility: 'private' })
    .eq('id', booking.id)
    .select('id');
  check('bookings: only the owner changes visibility', Boolean(hide.error) || !hide.data?.length);

  // Pointing at other people's rows: never as someone else, never across trips.
  const asA = await b.client
    .from('expenses')
    .insert({ user_id: a.id, trip_id: trip.id, amount_minor: 1, currency: 'USD' });
  check("member can't insert a row as another user", Boolean(asA.error));
  const cTrip = await insertOne(c.client, 'trips', {
    city: 'Paris',
    timezone: 'Europe/Paris',
    start_date: '2026-12-01',
    end_date: '2026-12-03',
  });
  const cPlace = await insertOne(c.client, 'places', { trip_id: cTrip.id, name: 'Louvre' });
  const cross = await c.client.from('itinerary_items').insert({
    trip_id: cTrip.id,
    day: '2026-12-02',
    kind: 'place',
    place_id: place.id,
  });
  check("items can't point at a place on another trip", Boolean(cross.error));
  const crossBack = await b.client.from('bucket_items').insert({
    trip_id: trip.id,
    place_id: cPlace.id,
  });
  check("items can't point at another trip's place they can't see", Boolean(crossBack.error));

  // Review fixes: only a row's owner moves it to another trip; a member can't pull the owner's
  // off-trip place onto the trip through the owner's row, or link the owner's private booking.
  const bTrip = await insertOne(b.client, 'trips', {
    city: 'Reno',
    timezone: 'America/Los_Angeles',
    start_date: '2026-12-01',
    end_date: '2026-12-02',
  });
  const move = await b.client
    .from('bookings')
    .update({ trip_id: bTrip.id })
    .eq('id', booking.id)
    .select('id');
  check("member can't move the owner's row to another trip", !move.data?.length);
  const home = await insertOne(a.client, 'places', { name: 'Home' });
  const claim = await b.client
    .from('itinerary_items')
    .update({ place_id: home.id })
    .eq('id', rows.itinerary_items.id)
    .select('id');
  check("member can't pull the owner's off-trip place onto the trip", !claim.data?.length);
  const linkPrivate = await b.client.from('expenses').insert({
    trip_id: trip.id,
    amount_minor: 1,
    currency: 'USD',
    booking_id: flight.id,
  });
  check("member can't link an expense to a private booking", Boolean(linkPrivate.error));
  // C points a booking on C's own trip at A's file: that doesn't unlock it.
  await insertOne(c.client, 'bookings', {
    trip_id: cTrip.id,
    type: 'hotel',
    original_path: `${a.id}/rls-test-flight.txt`,
  });

  // Profiles: yourself and the people you share a trip with.
  const profiles = await b.client.from('profiles').select('id, display_name');
  const visible = new Set(profiles.data?.map((p) => p.id));
  check(
    'profiles: member sees self and co-members, not others',
    visible.has(a.id) && visible.has(b.id) && !visible.has(c.id),
    profiles.error?.message,
  );
  const rename = await b.client
    .from('profiles')
    .update({ display_name: 'Blake', venmo: 'blake-v' })
    .eq('id', b.id)
    .select('id');
  check('profiles: edit your own', rename.data?.length === 1, rename.error?.message);
  const renameA = await b.client
    .from('profiles')
    .update({ display_name: 'Hacked' })
    .eq('id', a.id)
    .select('id');
  check("profiles: can't edit someone else's", !renameA.data?.length);
  const anonProfiles = await anonymous.from('profiles').select('id').limit(1);
  check("profiles: anonymous can't read", !anonProfiles.data?.length);

  // TR-20: a passport's number and photo paths stay with their owner.
  const passport = await b.client
    .from('documents')
    .select('number, image_paths')
    .eq('id', rows.documents.id);
  check("documents: member can't read an unshared passport", !passport.data?.length);

  // TR-34: other travellers see A's saved Las Vegas video through city_links, and nothing about A.
  const video = await insertOne(a.client, 'saved_links', {
    trip_id: trip.id,
    url: `https://www.tiktok.com/@rls.test/video/${Date.now()}`,
    platform: 'tiktok',
    title: 'RLS test video',
    author: 'rls-secret-author',
    thumbnail_url: 'https://example.com/rls-thumb.jpg',
    place_ids: [place.id],
  });
  await insertOne(a.client, 'saved_links', {
    trip_id: trip.id,
    url: 'https://example.com/not-a-video',
    title: 'Not a video',
    place_ids: [place.id],
  });
  const pooled = await c.client.rpc('city_links', { p_city: ' las vegas ' });
  const mine = pooled.data?.find((row) => row.url === video.url);
  check('city_links: other user sees the saved video', Boolean(mine), pooled.error?.message);
  check(
    'city_links: answers only url, title, thumbnail_url and place_count',
    !!mine &&
      JSON.stringify(Object.keys(mine).sort()) ===
        JSON.stringify(['place_count', 'thumbnail_url', 'title', 'url']) &&
      mine.place_count === 1,
    JSON.stringify(mine),
  );
  const leaked = JSON.stringify(pooled.data ?? []);
  check(
    'city_links: no user id, author, trip or link id',
    ![a.id, c.id, 'rls-secret-author', trip.id, video.id].some((s) => leaked.includes(s)),
  );
  check(
    'city_links: only TikTok and Instagram links',
    !pooled.data?.some((row) => row.url === 'https://example.com/not-a-video'),
  );
  const elsewhere = await c.client.rpc('city_links', { p_city: 'Cape Town' });
  check(
    'city_links: other cities stay apart',
    !elsewhere.error && !elsewhere.data.some((row) => row.url === video.url),
  );
  const anonLinks = await anonymous.rpc('city_links', { p_city: 'Las Vegas' });
  check("city_links: anonymous can't call it", Boolean(anonLinks.error));
  const direct = await c.client.from('saved_links').select('id').eq('id', video.id);
  check("saved_links: still can't be read directly", !direct.error && direct.data.length === 0);

  const still = await a.client.from('trips').select('id').eq('id', trip.id);
  check('trips: row survives the other users', still.data?.length === 1);

  const spoof = await c.client.from('trips').insert({
    user_id: a.id,
    city: 'X',
    timezone: 'UTC',
    start_date: '2026-01-01',
    end_date: '2026-01-02',
  });
  check("other user can't insert rows as the owner", Boolean(spoof.error));

  const attach = await c.client.from('expenses').insert({
    trip_id: trip.id,
    amount_minor: 1,
    currency: 'USD',
  });
  check("non-member can't attach rows to the owner's trip", Boolean(attach.error));

  // TR-26: the flight-status cache and allowance counter belong to the Edge Function alone.
  for (const table of ['flight_status_cache', 'flight_status_usage']) {
    for (const [who, client] of [
      ['signed-in user', b.client],
      ['anonymous', anonymous],
    ]) {
      const read = await client.from(table).select('*').limit(1);
      check(`${table}: ${who} can't read`, Boolean(read.error) || read.data.length === 0);
      const row =
        table === 'flight_status_cache' ? { key: 'rls-test', status: null } : { month: '1999-01' };
      const write = await client.from(table).insert(row);
      check(`${table}: ${who} can't write`, Boolean(write.error));
    }
  }
  for (const [who, client] of [
    ['signed-in user', b.client],
    ['anonymous', anonymous],
  ]) {
    const bump = await client.rpc('reserve_flight_status_units', {
      p_month: '1999-01',
      p_units: 1,
      p_limit: 10,
    });
    check(`reserve_flight_status_units: ${who} can't call it`, Boolean(bump.error));
  }

  for (const [bucket, path] of [
    ['originals', `${a.id}/rls-test.txt`],
    ['originals', `${a.id}/rls-test-flight.txt`],
    ['originals', `${a.id}/documents/rls-test.txt`],
    ['photos', `${a.id}/rls-test.txt`],
  ]) {
    const up = await a.client.storage
      .from(bucket)
      .upload(path, 'secret', { contentType: 'text/plain' });
    check(
      `${bucket} ${path.slice(a.id.length)}: owner uploads under <uid>/`,
      !up.error,
      up.error?.message,
    );
    if (!up.error) files.push({ bucket, path, client: a.client });

    // The shared hotel's original is the trip's; the private flight's and the passport stay A's.
    const memberDown = await b.client.storage.from(bucket).download(path);
    const sharedFile = path === `${a.id}/rls-test.txt` && bucket === 'originals';
    check(
      `${bucket} ${path.slice(a.id.length)}: member ${sharedFile ? 'downloads' : "can't download"}`,
      sharedFile ? !memberDown.error : Boolean(memberDown.error),
      memberDown.error?.message,
    );

    const down = await c.client.storage.from(bucket).download(path);
    check(`${bucket} ${path.slice(a.id.length)}: non-member can't download`, Boolean(down.error));

    const anonDown = await anonymous.storage.from(bucket).download(path);
    check(
      `${bucket} ${path.slice(a.id.length)}: anonymous can't download`,
      Boolean(anonDown.error),
    );

    const intrude = await c.client.storage
      .from(bucket)
      .upload(`${a.id}/intruder.txt`, 'x', { contentType: 'text/plain' });
    check(
      `${bucket} ${path.slice(a.id.length)}: non-member can't upload into owner's folder`,
      Boolean(intrude.error),
    );
    if (!intrude.error) files.push({ bucket, path: `${a.id}/intruder.txt`, client: admin });

    for (const [who, client] of [
      ['member', b.client],
      ['non-member', c.client],
    ]) {
      const remove = await client.storage.from(bucket).remove([path]);
      const kept = await a.client.storage.from(bucket).download(path);
      check(
        `${bucket} ${path.slice(a.id.length)}: ${who} can't delete`,
        !remove.data?.length && !kept.error,
      );
    }
  }

  // Sharing a passport with the trip: B reads it and its photo; C still can't.
  const passportPhoto = `${a.id}/documents/rls-test.txt`;
  const cShare = await c.client
    .from('document_shares')
    .insert({ document_id: rows.documents.id, trip_id: cTrip.id });
  check("document_shares: only the document's owner shares it", Boolean(cShare.error));
  const share = await a.client
    .from('document_shares')
    .insert({ document_id: rows.documents.id, trip_id: trip.id });
  check(
    'document_shares: owner shares a passport with the trip',
    !share.error,
    share.error?.message,
  );
  const sharedPassport = await b.client
    .from('documents')
    .select('number')
    .eq('id', rows.documents.id);
  check('documents: member reads a shared passport', sharedPassport.data?.length === 1);
  const sharedPhoto = await b.client.storage.from('originals').download(passportPhoto);
  check("documents: member downloads a shared passport's photo", !sharedPhoto.error);
  const editShared = await b.client
    .from('documents')
    .update({ number: 'HACKED' })
    .eq('id', rows.documents.id)
    .select('id');
  check("documents: member can't edit a shared passport", !editShared.data?.length);
  const cPassport = await c.client.from('documents').select('id').eq('id', rows.documents.id);
  check("documents: non-member still can't read it", !cPassport.data?.length);
  const cPhoto = await c.client.storage.from('originals').download(passportPhoto);
  check("documents: non-member still can't download its photo", Boolean(cPhoto.error));

  // Membership: B can't delete the trip, remove A or add people; A removes B; B leaves.
  const bDeletesTrip = await b.client.from('trips').delete().eq('id', trip.id).select('id');
  check("trips: member can't delete the trip", !bDeletesTrip.data?.length);
  const bRemovesA = await b.client
    .from('trip_members')
    .delete()
    .eq('trip_id', trip.id)
    .eq('user_id', a.id)
    .select('user_id');
  check("trip_members: member can't remove the owner", !bRemovesA.data?.length);
  const bAddsC = await b.client.from('trip_members').insert({ trip_id: trip.id, user_id: c.id });
  check("trip_members: member can't add people", Boolean(bAddsC.error));
  const cJoins = await c.client.from('trip_members').insert({ trip_id: trip.id, user_id: c.id });
  check("trip_members: non-member can't join by insert", Boolean(cJoins.error));
  const aLeaves = await a.client
    .from('trip_members')
    .delete()
    .eq('trip_id', trip.id)
    .eq('user_id', a.id)
    .select('user_id');
  check("trip_members: the owner can't leave", !aLeaves.data?.length);
  const aRemovesB = await a.client
    .from('trip_members')
    .delete()
    .eq('trip_id', trip.id)
    .eq('user_id', b.id)
    .select('user_id');
  check(
    'trip_members: owner removes a member',
    aRemovesB.data?.length === 1,
    aRemovesB.error?.message,
  );
  const afterRemoval = await b.client.from('trips').select('id').eq('id', trip.id);
  check('trips: a removed member no longer sees the trip', !afterRemoval.data?.length);
  const rejoin = await admin.from('trip_members').insert({ trip_id: trip.id, user_id: b.id });
  if (rejoin.error) throw new Error(`re-add member: ${rejoin.error.message}`);
  const bPrivate = await insertOne(b.client, 'bookings', { trip_id: trip.id, type: 'flight' });
  const bLeaves = await b.client
    .from('trip_members')
    .delete()
    .eq('trip_id', trip.id)
    .eq('user_id', b.id)
    .select('user_id');
  check('trip_members: member leaves', bLeaves.data?.length === 1, bLeaves.error?.message);
  const leftovers = await admin.from('bookings').select('id').eq('id', bPrivate.id);
  check("leaving removes the member's private bookings", leftovers.data?.length === 0);
  const kept = await a.client
    .from('expenses')
    .select('id')
    .eq('trip_id', trip.id)
    .eq('user_id', b.id);
  check("leaving keeps the member's shared rows on the trip", kept.data?.length === 1);

  // TR-57 (ADR 0029): invite links. C (a non-member) previews A's active link, which shows only
  // the trip's summary, and joins with it; a reset link stops working.
  const inactive = (result) => result.error?.message === 'invite_inactive';
  const cCreates = await c.client.rpc('create_invite', { trip: trip.id });
  check("invites: non-member can't make a link", Boolean(cCreates.error));
  const made = await a.client.rpc('create_invite', { trip: trip.id });
  const token = made.data;
  check(
    'invites: member makes a 22-character link',
    typeof token === 'string' && /^[A-Za-z0-9_-]{22}$/.test(token),
    made.error?.message ?? JSON.stringify(made.data),
  );
  const again = await a.client.rpc('create_invite', { trip: trip.id });
  check('invites: the active link is reused', again.data === token, again.error?.message);
  const cTable = await c.client.from('trip_invites').select('token');
  check("invites: the table can't be read directly", !cTable.data?.length);
  const anonPreview = await anonymous.rpc('invite_preview', { invite: token });
  check("invites: signed-out clients can't preview", Boolean(anonPreview.error));
  const preview = await c.client.rpc('invite_preview', { invite: token }).single();
  const aName = await a.client.from('profiles').select('display_name').eq('id', a.id).single();
  check(
    'invites: non-member previews the trip summary and nothing else',
    preview.data?.trip_id === trip.id &&
      preview.data.city === 'Las Vegas' &&
      preview.data.start_date === '2026-11-01' &&
      preview.data.inviter_name === aName.data?.display_name &&
      preview.data.member_count === 1 &&
      preview.data.already_member === false &&
      Object.keys(preview.data).sort().join() ===
        'already_member,city,cover_photo_url,end_date,inviter_name,member_count,start_date,trip_id',
    preview.error?.message ?? JSON.stringify(preview.data),
  );
  const accepted = await c.client.rpc('accept_invite', { invite: token });
  check('invites: accepting returns the trip', accepted.data === trip.id, accepted.error?.message);
  const acceptedAgain = await c.client.rpc('accept_invite', { invite: token });
  const cRows = await admin
    .from('trip_members')
    .select('role')
    .eq('trip_id', trip.id)
    .eq('user_id', c.id);
  check(
    'invites: accepting twice keeps one member row',
    acceptedAgain.data === trip.id && cRows.data?.length === 1 && cRows.data[0].role === 'member',
    acceptedAgain.error?.message ?? JSON.stringify(cRows.data),
  );
  const cSees = await c.client.from('trips').select('id').eq('id', trip.id);
  check('invites: the new member sees the trip', cSees.data?.length === 1);
  const reset = await a.client.rpc('reset_invite', { trip: trip.id });
  check(
    'invites: reset makes a new link',
    typeof reset.data === 'string' && reset.data !== token,
    reset.error?.message,
  );
  const d = await newUser();
  check(
    'invites: a reset link no longer previews',
    inactive(await d.client.rpc('invite_preview', { invite: token })),
  );
  check(
    'invites: a reset link no longer joins',
    inactive(await d.client.rpc('accept_invite', { invite: token })),
  );
  check(
    'invites: an unknown link is inactive',
    inactive(await d.client.rpc('invite_preview', { invite: 'x'.repeat(22) })),
  );
  const dSees = await d.client.from('trips').select('id').eq('id', trip.id);
  check("invites: a refused join doesn't add the user", !dSees.data?.length);

  // v1 data: every trip has exactly one owner and every user a profile.
  const [integrity] = await sql(`
    select
      (select count(*) from public.trips t
       where (select count(*) from public.trip_members m
              where m.trip_id = t.id and m.role = 'owner') <> 1)::int as trips_without_one_owner,
      (select count(*) from auth.users u
       where not exists (select 1 from public.profiles p where p.id = u.id))::int
        as users_without_profile`);
  check(
    'every trip has one owner and every user a profile',
    integrity.trips_without_one_owner === 0 && integrity.users_without_profile === 0,
    JSON.stringify(integrity),
  );
} catch (error) {
  check('setup', false, error instanceof Error ? error.message : String(error));
} finally {
  for (const { bucket, path, client } of files) {
    await client.storage.from(bucket).remove([path]);
  }
  // Deleting the users cascades to their rows (user_id → auth.users on delete cascade).
  for (const { id } of users) {
    const { error } = await admin.auth.admin.deleteUser(id);
    check(`test user deleted`, !error, error?.message);
  }
}

console.log(failures ? `\n${failures} check(s) failed` : '\nRLS checks passed');
process.exit(failures ? 1 : 0);
