import {
  combineZonedDateAndTime,
  formatZonedYmd,
  getZonedParts,
  zonedDateTimeToMs,
} from "./appTime";
import {
  isDocumentDateBanned,
  toCalendarDateKey,
} from "../documents/helper/dateBanEditing.helper";

describe("appTime Asia/Tashkent", () => {
  it("treats 2026-09-08T18:30:00.000Z as 8th 23:30 in Tashkent", () => {
    const ms = Date.parse("2026-09-08T18:30:00.000Z");
    const parts = getZonedParts(ms);
    expect(parts?.year).toBe(2026);
    expect(parts?.month).toBe(9);
    expect(parts?.day).toBe(8);
    expect(parts?.hours).toBe(23);
    expect(parts?.minutes).toBe(30);
    expect(formatZonedYmd(ms)).toBe("2026-09-08");
  });

  it("does not return the previous UTC day for Tashkent midnight", () => {
    const midnight = zonedDateTimeToMs(2026, 9, 8, 0, 0, 0, 0);
    expect(formatZonedYmd(midnight)).toBe("2026-09-08");
    expect(new Date(midnight).toISOString().split("T")[0]).toBe("2026-09-07");
  });

  it("keeps afternoon time when combining a new calendar day", () => {
    const from = zonedDateTimeToMs(2026, 9, 8, 14, 32, 0, 0);
    const nextDayStart = zonedDateTimeToMs(2026, 9, 9, 0, 0, 0, 0);
    const combined = combineZonedDateAndTime(nextDayStart, 14, 32, 0, 0);
    const parts = getZonedParts(combined ?? 0);
    expect(parts?.day).toBe(9);
    expect(parts?.hours).toBe(14);
    expect(parts?.minutes).toBe(32);
    expect(from).not.toBe(combined);
  });
});

describe("date_ban_editing vs UTC+5:30 midnight", () => {
  const ban8 = "2026-09-08";

  it("wrong PC midnight of the 9th (UTC+5:30) looks like the 8th in Tashkent and is banned", () => {
    const indiaMidnightSept9 = Date.UTC(2026, 8, 8, 18, 30, 0, 0);
    expect(toCalendarDateKey(indiaMidnightSept9)).toBe("2026-09-08");
    expect(isDocumentDateBanned(indiaMidnightSept9, ban8)).toBe(true);
  });

  it("Tashkent 9th afternoon is not banned when ban is through the 8th", () => {
    const tashkentSept9Afternoon = zonedDateTimeToMs(2026, 9, 9, 14, 32, 0, 0);
    expect(toCalendarDateKey(tashkentSept9Afternoon)).toBe("2026-09-09");
    expect(isDocumentDateBanned(tashkentSept9Afternoon, ban8)).toBe(false);
  });
});
