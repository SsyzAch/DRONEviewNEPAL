import { DSLRule } from "../types";

/**
 * Checks if a given flight date-time matches the temporal restriction criteria.
 * Returns true if the restriction is active at the given time, false otherwise.
 * Timestamps must be in ISO-8601 UTC format.
 */
export function isRestrictionActive(dateTimeIso: string, temporalConfig?: DSLRule["temporal"]): boolean {
  if (!temporalConfig) {
    return true; // No temporal constraints means the rule is active indefinitely.
  }

  const flightDate = new Date(dateTimeIso);
  if (isNaN(flightDate.getTime())) {
    throw new Error(`Invalid flight date-time format: ${dateTimeIso}`);
  }

  // Parse start and end times
  const ruleStart = new Date(temporalConfig.start);
  const ruleEnd = temporalConfig.end ? new Date(temporalConfig.end) : null;

  // 1. If it's a one-shot window (not recurring)
  if (!temporalConfig.recurring) {
    if (flightDate < ruleStart) {
      return false; // Flight is before the restriction starts
    }
    if (ruleEnd && flightDate > ruleEnd) {
      return false; // Flight is after the restriction ends
    }
    return true;
  }

  // 2. Recurring schedules (daily, weekly, monthly, yearly)
  // Check if we are past the overall starting bound
  if (flightDate < ruleStart) {
    return false;
  }
  // Check if we are past the overall ending bound
  if (ruleEnd && flightDate > ruleEnd) {
    return false;
  }

  const startHour = ruleStart.getUTCHours();
  const startMinute = ruleStart.getUTCMinutes();
  const endHour = ruleEnd ? ruleEnd.getUTCHours() : 23;
  const endMinute = ruleEnd ? ruleEnd.getUTCMinutes() : 59;

  const flightHour = flightDate.getUTCHours();
  const flightMinute = flightDate.getUTCMinutes();

  const flightTimeMins = flightHour * 60 + flightMinute;
  const startTimeMins = startHour * 60 + startMinute;
  const endTimeMins = endHour * 60 + endMinute;

  // Daily recurrence
  if (temporalConfig.recurring === "daily") {
    // Check if flight time falls within the active hours of the day (supporting overnight windows)
    if (startTimeMins <= endTimeMins) {
      return flightTimeMins >= startTimeMins && flightTimeMins <= endTimeMins;
    } else {
      // Overnight window (e.g. 22:00 to 04:00)
      return flightTimeMins >= startTimeMins || flightTimeMins <= endTimeMins;
    }
  }

  // Weekly recurrence
  if (temporalConfig.recurring === "weekly") {
    // Check if the weekday matches
    if (flightDate.getUTCDay() !== ruleStart.getUTCDay()) {
      return false;
    }
    return flightTimeMins >= startTimeMins && flightTimeMins <= endTimeMins;
  }

  // Monthly recurrence
  if (temporalConfig.recurring === "monthly") {
    if (flightDate.getUTCDate() !== ruleStart.getUTCDate()) {
      return false;
    }
    return flightTimeMins >= startTimeMins && flightTimeMins <= endTimeMins;
  }

  // Yearly recurrence (e.g., specific festival days)
  if (temporalConfig.recurring === "yearly") {
    if (
      flightDate.getUTCMonth() !== ruleStart.getUTCMonth() ||
      flightDate.getUTCDate() !== ruleStart.getUTCDate()
    ) {
      return false;
    }
    return flightTimeMins >= startTimeMins && flightTimeMins <= endTimeMins;
  }

  return false;
}

/**
 * Checks if the flight falls outside daylight hours (standard daylight rule: 6:00 AM to 6:00 PM local time).
 * For Nepal (UTC+5:45), local 06:00 to 18:00 converts to:
 * UTC 00:15 to UTC 12:15.
 */
export function isNightTime(dateTimeIso: string, timezoneOffsetMinutes = 345): boolean {
  const flightDate = new Date(dateTimeIso);
  const utcMins = flightDate.getUTCHours() * 60 + flightDate.getUTCMinutes();
  
  // Calculate local minutes past midnight
  let localMins = utcMins + timezoneOffsetMinutes;
  if (localMins < 0) localMins += 24 * 60;
  localMins = localMins % (24 * 60);

  const localDayStart = 6 * 60; // 06:00 AM
  const localDayEnd = 18 * 60; // 06:00 PM

  return localMins < localDayStart || localMins > localDayEnd;
}
