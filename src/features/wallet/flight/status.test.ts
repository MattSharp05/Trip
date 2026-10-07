import { vegasSnapshot } from '@/scenarios/fixtures/vegas';
import type { FlightData } from '@/services/data/types';
import type { FlightStatus } from '@/services/flightStatus';

import { delayLabel, gateChanged, liveFacts, statusPill } from './status';

const booking = vegasSnapshot.bookings.find((b) => b.id === 'booking-flight-out');
if (booking?.type !== 'flight') throw new Error('fixture flight missing');
const flight: FlightData = booking.data;

const status = (over: Partial<FlightStatus> = {}): FlightStatus => ({
  state: 'active',
  delayMinutes: 0,
  departure: { terminal: null, gate: null, revisedAt: null },
  arrival: { terminal: null, gate: null, revisedAt: null },
  updatedAt: '2026-11-12T12:41:00.000Z',
  ...over,
});
const gate = (g: string | null, terminal: string | null = null) =>
  status({ departure: { terminal, gate: g, revisedAt: null } });

describe('status pill', () => {
  it('shows nothing without a live status', () => {
    expect(statusPill(flight, null)).toBeNull();
  });

  it('reads On time in green, including small delays under 15 minutes', () => {
    expect(statusPill(flight, status())).toEqual({ label: 'On time', tone: 'ok' });
    expect(statusPill(flight, status({ delayMinutes: 14 }))?.label).toBe('On time');
  });

  it('reads Delayed with the minutes from 15 on', () => {
    expect(statusPill(flight, status({ delayMinutes: 25 }))).toEqual({
      label: 'Delayed 25 min',
      tone: 'accent',
    });
    expect(statusPill(flight, status({ delayMinutes: 100 }))?.label).toBe('Delayed 1 h 40 min');
  });

  it('reads Gate change when the gate or terminal moved (a delay wins)', () => {
    expect(statusPill(flight, gate('E79'))).toEqual({ label: 'Gate change', tone: 'accent' });
    expect(statusPill(flight, gate('e75', 'F'))?.label).toBe('Gate change');
    expect(statusPill(flight, gate('e75'))?.label).toBe('On time');
    expect(statusPill(flight, { ...gate('E79'), delayMinutes: 30 })?.label).toBe('Delayed 30 min');
  });

  it('reads Cancelled, Diverted and Landed whatever the delay', () => {
    expect(statusPill(flight, status({ state: 'cancelled', delayMinutes: 40 }))).toEqual({
      label: 'Cancelled',
      tone: 'accent',
    });
    expect(statusPill(flight, status({ state: 'diverted' }))?.label).toBe('Diverted');
    expect(statusPill(flight, status({ state: 'landed', delayMinutes: 20 }))).toEqual({
      label: 'Landed',
      tone: 'secondary',
    });
  });

  it('a gate where the booking had none is new information, not a change', () => {
    expect(gateChanged({ ...flight, gate: null }, gate('E79'))).toBe(false);
  });

  it('formats delays', () => {
    expect(delayLabel(25)).toBe('25 min');
    expect(delayLabel(60)).toBe('1 h');
    expect(delayLabel(135)).toBe('2 h 15 min');
  });
});

describe('live facts', () => {
  it('are the booked facts without a status', () => {
    expect(liveFacts(flight, null)).toEqual([
      { label: 'Terminal', value: 'E', updated: false },
      { label: 'Gate', value: 'E75', updated: false },
      { label: 'Seat', value: '14A', updated: false },
      { label: 'Class', value: 'Main', updated: false },
    ]);
  });

  it('replace the booked gate with the live one, marked updated', () => {
    expect(liveFacts(flight, gate('E79')).slice(0, 2)).toEqual([
      { label: 'Terminal', value: 'E', updated: false },
      { label: 'Gate', value: 'E79', updated: true },
    ]);
  });

  it('fill in a gate the booking did not have', () => {
    const facts = liveFacts({ ...flight, gate: null, terminal: null }, gate('E79', 'E'));
    expect(facts.slice(0, 2)).toEqual([
      { label: 'Terminal', value: 'E', updated: true },
      { label: 'Gate', value: 'E79', updated: true },
    ]);
  });

  it('keep the booked value when the live one only differs in case', () => {
    expect(liveFacts(flight, gate('e75'))[1]).toEqual({
      label: 'Gate',
      value: 'E75',
      updated: false,
    });
  });
});
