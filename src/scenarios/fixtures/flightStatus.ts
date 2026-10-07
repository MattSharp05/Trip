import { fixtureFlightStatus } from '../../../supabase/functions/_shared/flightStatus/fixtures';
import type {
  FlightStatus,
  FlightStatusRequest,
} from '../../../supabase/functions/_shared/flightStatus/schema';

/** The scenario where AA 2410 runs 25 minutes late from gate E79 (booked: E75). */
export const DELAYED_SCENARIO = 'vegas-flight-delayed';

/**
 * A demo session's live status: every flight in its window is on time with the booked gate,
 * except in `vegas-flight-delayed`, where AA 2410 is late (what the function's fixture mode answers).
 */
export function demoFlightStatus(scenario: string, request: FlightStatusRequest): FlightStatus {
  return fixtureFlightStatus(request, scenario === DELAYED_SCENARIO);
}
