import type { ScheduleConfig } from "./types";

interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

function localParts(date: Date, timezone: string): LocalParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(part => part.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day"), hour: value("hour"), minute: value("minute") };
}

function zonedLocalToUtc(parts: LocalParts, timezone: string): Date {
  const targetAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0, 0);
  let candidate = targetAsUtc;
  for (let i = 0; i < 4; i++) {
    const observed = localParts(new Date(candidate), timezone);
    const observedAsUtc = Date.UTC(observed.year, observed.month - 1, observed.day, observed.hour, observed.minute, 0, 0);
    candidate += targetAsUtc - observedAsUtc;
  }
  return new Date(candidate);
}

function addCalendarDays(parts: LocalParts, days: number): LocalParts {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days, parts.hour, parts.minute));
  return {
    year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(),
    hour: parts.hour, minute: parts.minute,
  };
}

function parseTime(time: string): { hour: number; minute: number } {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) throw new Error(`Invalid time: ${time}`);
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) throw new Error(`Invalid time: ${time}`);
  return { hour, minute };
}

function localWeekday(parts: LocalParts): number {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
}

export function computeNextRun(now: Date, timezone: string, schedule: ScheduleConfig): Date {
  new Intl.DateTimeFormat("en", { timeZone: timezone }).format(now);
  const { hour, minute } = parseTime(schedule.time);
  const current = localParts(now, timezone);
  let target: LocalParts = { ...current, hour, minute };

  if (schedule.frequency === "weekly") {
    if (!Number.isInteger(schedule.weekday) || schedule.weekday! < 0 || schedule.weekday! > 6) {
      throw new Error("Weekly schedule requires weekday 0-6");
    }
    const delta = (schedule.weekday! - localWeekday(current) + 7) % 7;
    target = addCalendarDays(target, delta);
  }

  let candidate = zonedLocalToUtc(target, timezone);
  if (candidate.getTime() <= now.getTime()) {
    target = addCalendarDays(target, schedule.frequency === "weekly" ? 7 : 1);
    candidate = zonedLocalToUtc(target, timezone);
  }
  return candidate;
}
