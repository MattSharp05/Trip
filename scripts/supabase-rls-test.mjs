#!/usr/bin/env node
// Proves row-level security against the live project: two throwaway users, user A writes a row
// in every table and a file in every bucket, and user B (and an anonymous client) can't read,
// change or delete them, or point at them. The users and their data are deleted afterwards.
//
//   SUPABASE_ACCESS_TOKEN=… node scripts/supabase-rls-test.mjs
//
// Runs in CI on main after scripts/supabase-apply.mjs.

import { randomUUID } from 'node:crypto';

import { createClient } from '@supabase/supabase-js';

import { apiKeys, projectUrl } from './supabase-api.mjs';

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

async function insertOne(client, table, row) {
  const { data, error } = await client.from(table).insert(row).select().single();
  if (error) throw new Error(`insert ${table}: ${error.message}`);
  return data;
}

try {
  const a = await newUser();
  const b = await newUser();
  const anonymous = createClient(url, anon, options);

  // User A: one row in every table.
  const trip = await insertOne(a.client, 'trips', {
    city: 'Las Vegas',
    timezone: 'America/Los_Angeles',
    start_date: '2026-11-01',
    end_date: '2026-11-04',
  });
  const place = await insertOne(a.client, 'places', { name: 'Bellagio Fountains' });
  const booking = await insertOne(a.client, 'bookings', { trip_id: trip.id, type: 'hotel' });
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
      image_paths: [`${a.id}/documents/rls-test.jpg`],
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

  for (const [table, row] of Object.entries(rows)) {
    const own = await a.client.from(table).select('id').eq('id', row.id);
    check(`${table}: owner reads own row`, own.data?.length === 1, own.error?.message);

    const read = await b.client.from(table).select('id').eq('id', row.id);
    check(`${table}: other user can't read`, !read.error && read.data.length === 0);

    const update = await b.client
      .from(table)
      .update({ updated_at: new Date().toISOString() })
      .eq('id', row.id)
      .select('id');
    check(`${table}: other user can't update`, !update.data?.length);

    const del = await b.client.from(table).delete().eq('id', row.id).select('id');
    check(`${table}: other user can't delete`, !del.data?.length);

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

  // TR-20: a passport's number and photo paths stay with their owner.
  const passport = await b.client
    .from('documents')
    .select('number, image_paths')
    .eq('id', rows.documents.id);
  check("documents: other user can't read number or photos", !passport.data?.length);

  const still = await a.client.from('trips').select('id').eq('id', trip.id);
  check('trips: row survives the other user', still.data?.length === 1);

  const spoof = await b.client.from('trips').insert({
    user_id: a.id,
    city: 'X',
    timezone: 'UTC',
    start_date: '2026-01-01',
    end_date: '2026-01-02',
  });
  check("other user can't insert rows as the owner", Boolean(spoof.error));

  const attach = await b.client.from('expenses').insert({
    trip_id: trip.id,
    amount_minor: 1,
    currency: 'USD',
  });
  check("other user can't attach rows to the owner's trip", Boolean(attach.error));

  for (const [bucket, path] of [
    ['originals', `${a.id}/rls-test.txt`],
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

    const down = await b.client.storage.from(bucket).download(path);
    check(`${bucket} ${path.slice(a.id.length)}: other user can't download`, Boolean(down.error));

    const anonDown = await anonymous.storage.from(bucket).download(path);
    check(
      `${bucket} ${path.slice(a.id.length)}: anonymous can't download`,
      Boolean(anonDown.error),
    );

    const intrude = await b.client.storage
      .from(bucket)
      .upload(`${a.id}/intruder.txt`, 'x', { contentType: 'text/plain' });
    check(
      `${bucket} ${path.slice(a.id.length)}: other user can't upload into owner's folder`,
      Boolean(intrude.error),
    );
    if (!intrude.error) files.push({ bucket, path: `${a.id}/intruder.txt`, client: admin });

    const remove = await b.client.storage.from(bucket).remove([path]);
    const kept = await a.client.storage.from(bucket).download(path);
    check(
      `${bucket} ${path.slice(a.id.length)}: other user can't delete`,
      !remove.data?.length && !kept.error,
    );
  }
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
