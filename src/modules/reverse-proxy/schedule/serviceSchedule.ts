import {
  ServiceSchedule,
  ServiceScheduleDay,
  ServiceScheduleDays,
} from "@/interfaces/ReverseProxy";

export const DAY_LABELS: Record<ServiceScheduleDay, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

export const WORKDAYS: ServiceScheduleDay[] = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
];

/** A window as edited in the form. The id only exists to key React rows. */
export type WindowDraft = {
  id: string;
  days: ServiceScheduleDay[];
  start: string;
  end: string;
};

export type ScheduleDraft = {
  timezone: string;
  windows: WindowDraft[];
  startDate: string;
  endDate: string;
};

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const END_OF_DAY = "24:00";

const nextId = () => crypto.randomUUID();

export function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function newWindow(): WindowDraft {
  return { id: nextId(), days: [...WORKDAYS], start: "08:00", end: "17:00" };
}

export function newScheduleDraft(
  timezone: string = browserTimezone(),
): ScheduleDraft {
  return { timezone, windows: [newWindow()], startDate: "", endDate: "" };
}

export function scheduleToDraft(schedule: ServiceSchedule): ScheduleDraft {
  return {
    timezone: schedule.timezone,
    windows: (schedule.windows ?? []).map((w) => ({
      id: nextId(),
      days: sortDays(w.days),
      start: w.start,
      end: w.end === END_OF_DAY ? "00:00" : w.end,
    })),
    startDate: schedule.start_date ?? "",
    endDate: schedule.end_date ?? "",
  };
}

/**
 * Converts the form state to the API shape. A window ending at 00:00 means
 * "until midnight", which the API spells 24:00 because windows never wrap.
 */
export function draftToSchedule(draft: ScheduleDraft): ServiceSchedule {
  return {
    timezone: draft.timezone,
    ...(draft.windows.length > 0 && {
      windows: draft.windows.map((w) => ({
        days: sortDays(w.days),
        start: w.start,
        end: w.end === "00:00" ? END_OF_DAY : w.end,
      })),
    }),
    ...(draft.startDate && { start_date: draft.startDate }),
    ...(draft.endDate && { end_date: draft.endDate }),
  };
}

export function sortDays(days: ServiceScheduleDay[]): ServiceScheduleDay[] {
  return ServiceScheduleDays.filter((d) => days.includes(d));
}

export function toggleDay(
  days: ServiceScheduleDay[],
  day: ServiceScheduleDay,
): ServiceScheduleDay[] {
  return days.includes(day)
    ? days.filter((d) => d !== day)
    : sortDays([...days, day]);
}

/** Returns an error message for a window, or "" when it is valid. */
export function validateWindow(window: WindowDraft): string {
  if (window.days.length === 0) return "Select at least one day.";
  if (!TIME_PATTERN.test(window.start) || !TIME_PATTERN.test(window.end)) {
    return "Enter a start and end time.";
  }
  const end = window.end === "00:00" ? END_OF_DAY : window.end;
  if (window.start >= end) {
    return "The end time must be after the start time. To cover the night, add a second window.";
  }
  return "";
}

/** Returns an error message for the date range, or "" when it is valid. */
export function validateDates(startDate: string, endDate: string): string {
  if (startDate && !DATE_PATTERN.test(startDate))
    return "Enter a valid start date.";
  if (endDate && !DATE_PATTERN.test(endDate)) return "Enter a valid end date.";
  if (startDate && endDate && endDate < startDate) {
    return "The end date must not be before the start date.";
  }
  return "";
}

export function validateSchedule(draft: ScheduleDraft): string {
  if (!draft.timezone) return "Select a timezone.";
  const windowError = draft.windows.map(validateWindow).find((e) => e !== "");
  if (windowError) return windowError;
  return validateDates(draft.startDate, draft.endDate);
}

/** Every IANA timezone the browser knows, with UTC always available. */
export function listTimezones(selected?: string): string[] {
  const supported =
    (
      Intl as { supportedValuesOf?: (key: string) => string[] }
    ).supportedValuesOf?.("timeZone") ?? [];
  const zones = new Set<string>(["UTC", ...supported]);
  zones.add(browserTimezone());
  if (selected) zones.add(selected);
  return [...zones].sort();
}
