import { describe, expect, it } from "vitest";
import {
  draftToSchedule,
  listTimezones,
  newScheduleDraft,
  scheduleToDraft,
  sortDays,
  toggleDay,
  validateDates,
  validateSchedule,
  validateWindow,
  WindowDraft,
} from "@/modules/reverse-proxy/schedule/serviceSchedule";

const window = (patch: Partial<WindowDraft> = {}): WindowDraft => ({
  id: "w1",
  days: ["mon"],
  start: "08:00",
  end: "17:00",
  ...patch,
});

describe("toggleDay", () => {
  it("adds a day and keeps the week order", () => {
    expect(toggleDay(["mon", "fri"], "wed")).toEqual(["mon", "wed", "fri"]);
  });

  it("removes a day that is already selected", () => {
    expect(toggleDay(["mon", "wed"], "mon")).toEqual(["wed"]);
  });

  it("does not mutate its input", () => {
    const days: ("mon" | "tue")[] = ["mon"];
    toggleDay(days, "tue");
    expect(days).toEqual(["mon"]);
  });
});

describe("sortDays", () => {
  it("orders days Monday first", () => {
    expect(sortDays(["sun", "wed", "mon"])).toEqual(["mon", "wed", "sun"]);
  });
});

describe("validateWindow", () => {
  it("accepts a normal window", () => {
    expect(validateWindow(window())).toBe("");
  });

  it("requires at least one day", () => {
    expect(validateWindow(window({ days: [] }))).toMatch(/at least one day/i);
  });

  it("requires both times", () => {
    expect(validateWindow(window({ start: "" }))).toMatch(/start and end/i);
    expect(validateWindow(window({ end: "" }))).toMatch(/start and end/i);
  });

  it("rejects an end that is not after the start", () => {
    expect(validateWindow(window({ start: "18:00", end: "09:00" }))).toMatch(
      /after the start/i,
    );
    expect(validateWindow(window({ start: "09:00", end: "09:00" }))).toMatch(
      /after the start/i,
    );
  });

  it("treats an end of 00:00 as midnight", () => {
    expect(validateWindow(window({ start: "20:00", end: "00:00" }))).toBe("");
  });
});

describe("validateDates", () => {
  it("accepts empty and ordered dates", () => {
    expect(validateDates("", "")).toBe("");
    expect(validateDates("2026-12-01", "")).toBe("");
    expect(validateDates("", "2026-12-31")).toBe("");
    expect(validateDates("2026-12-01", "2026-12-01")).toBe("");
  });

  it("rejects an end date before the start date", () => {
    expect(validateDates("2026-12-31", "2026-12-01")).toMatch(/before/i);
  });

  it("rejects malformed dates", () => {
    expect(validateDates("01/12/2026", "")).toMatch(/start date/i);
    expect(validateDates("", "tomorrow")).toMatch(/end date/i);
  });
});

describe("validateSchedule", () => {
  it("requires a timezone", () => {
    const draft = { ...newScheduleDraft("Europe/Madrid"), timezone: "" };
    expect(validateSchedule(draft)).toMatch(/timezone/i);
  });

  it("reports the first invalid window", () => {
    const draft = newScheduleDraft("Europe/Madrid");
    draft.windows.push(window({ id: "bad", days: [] }));
    expect(validateSchedule(draft)).toMatch(/at least one day/i);
  });

  it("accepts the default draft", () => {
    expect(validateSchedule(newScheduleDraft("Europe/Madrid"))).toBe("");
  });
});

describe("draftToSchedule", () => {
  it("builds the API payload and omits empty optional fields", () => {
    const schedule = draftToSchedule({
      timezone: "Europe/Madrid",
      windows: [window({ days: ["fri", "mon"] })],
      startDate: "",
      endDate: "",
    });
    expect(schedule).toEqual({
      timezone: "Europe/Madrid",
      windows: [{ days: ["mon", "fri"], start: "08:00", end: "17:00" }],
    });
    expect(schedule).not.toHaveProperty("start_date");
    expect(schedule).not.toHaveProperty("end_date");
  });

  it("omits windows when there are none so the service is active all day", () => {
    const schedule = draftToSchedule({
      timezone: "UTC",
      windows: [],
      startDate: "2026-12-01",
      endDate: "2026-12-31",
    });
    expect(schedule).toEqual({
      timezone: "UTC",
      start_date: "2026-12-01",
      end_date: "2026-12-31",
    });
  });

  it("sends 24:00 for a window that ends at midnight", () => {
    const schedule = draftToSchedule({
      timezone: "UTC",
      windows: [window({ start: "20:00", end: "00:00" })],
      startDate: "",
      endDate: "",
    });
    expect(schedule.windows?.[0].end).toBe("24:00");
  });
});

describe("scheduleToDraft", () => {
  it("round-trips through draftToSchedule", () => {
    const schedule = {
      timezone: "Asia/Tokyo",
      windows: [
        {
          days: ["mon" as const, "tue" as const],
          start: "06:00",
          end: "24:00",
        },
      ],
      start_date: "2026-12-01",
      end_date: "2027-01-31",
    };
    expect(draftToSchedule(scheduleToDraft(schedule))).toEqual(schedule);
  });

  it("shows 24:00 as 00:00 because time inputs cannot hold 24:00", () => {
    const draft = scheduleToDraft({
      timezone: "UTC",
      windows: [{ days: ["mon"], start: "20:00", end: "24:00" }],
    });
    expect(draft.windows[0].end).toBe("00:00");
  });

  it("copes with a schedule that has no windows", () => {
    expect(scheduleToDraft({ timezone: "UTC" }).windows).toEqual([]);
  });
});

describe("listTimezones", () => {
  it("always offers UTC and the selected zone, sorted without duplicates", () => {
    const zones = listTimezones("Mars/Olympus_Mons");
    expect(zones).toContain("UTC");
    expect(zones).toContain("Mars/Olympus_Mons");
    expect(new Set(zones).size).toBe(zones.length);
    expect(zones).toEqual([...zones].sort());
  });
});
