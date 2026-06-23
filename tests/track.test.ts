import { describe, it, expect } from "vitest";
import { findAnomalies } from "../dist/pipeline/track.js";

const series = (values: number[]) =>
  values.map((value, i) => ({ index: i, timeSec: i, value }));

describe("findAnomalies", () => {
  it("flags a jump-back blip against the trend", () => {
    const a = findAnomalies(series([100, 80, 48, 80, 80, 45]));
    expect(a.length).toBe(1);
    expect(a[0].value).toBe(48);
    expect(a[0].from).toBe(80);
    expect(a[0].to).toBe(80);
  });

  it("ignores a monotonic series", () => {
    expect(findAnomalies(series([100, 80, 60, 40, 20]))).toEqual([]);
  });

  it("ignores small OCR jitter below minDelta", () => {
    expect(findAnomalies(series([50, 52, 50, 48]))).toEqual([]);
  });

  it("catches an upward spike too", () => {
    const a = findAnomalies(series([20, 40, 90, 45, 50]));
    expect(a.some((x) => x.value === 90)).toBe(true);
  });
});
