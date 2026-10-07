import { formatTmzUserLabel } from "./writeoffReferenceLabel.helper";

describe("formatTmzUserLabel", () => {
  it("prefers article over name", () => {
    expect(
      formatTmzUserLabel({ article: "MB-0042", name: "ДСП 16мм" }, 123),
    ).toBe("MB-0042");
  });

  it("trims article whitespace", () => {
    expect(formatTmzUserLabel({ article: "  MB-0042  " }, 123)).toBe("MB-0042");
  });

  it("falls back to name when article is empty", () => {
    expect(formatTmzUserLabel({ article: "  ", name: "ДСП 16мм" }, 123)).toBe(
      "ДСП 16мм",
    );
    expect(formatTmzUserLabel({ name: "ДСП 16мм" }, 123)).toBe("ДСП 16мм");
  });

  it("falls back to #id when ref is missing or empty", () => {
    expect(formatTmzUserLabel(null, 123)).toBe("#123");
    expect(formatTmzUserLabel(undefined, 456)).toBe("#456");
    expect(formatTmzUserLabel({ article: "", name: "" }, 789)).toBe("#789");
  });
});
