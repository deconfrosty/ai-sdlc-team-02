import { expect, test } from "@playwright/test";
import { formatSingaporeDate } from "../lib/timezone";

test("formats instants in Singapore time", () => {
  expect(
    formatSingaporeDate(new Date("2026-11-13T04:30:00.000Z"), {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }),
  ).toBe("12:30");
});
