import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import ResourceMonitor from "../monitor/monitor";
import * as fs from "fs/promises";

vi.mock("vscode");
vi.mock("fs/promises");

describe("ResourceMonitor", () => {
  let monitor: ResourceMonitor;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(global, "setInterval").mockImplementation(() => {
      return setTimeout(() => {}, 0) as unknown as NodeJS.Timeout;
    });
    vi.spyOn(global, "clearInterval").mockImplementation(() => {});
    monitor = new ResourceMonitor(1);
  });

  afterEach(() => {
    monitor.stop();
  });

  it("should start and stop monitoring correctly", () => {
    monitor.start();
    expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 1000);
    monitor.stop();
    expect(clearInterval).toHaveBeenCalled();
  });

  it("should update interval and restart monitoring if active", () => {
    // Start monitoring
    monitor.start();
    expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 1000);

    // Update interval
    monitor.updateInterval(5);

    // Should stop and restart with new interval
    expect(clearInterval).toHaveBeenCalled();
    expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 5000);
  });

  it("should update interval without starting if not active", () => {
    // Update interval without starting first
    monitor.updateInterval(10);

    // Should not start monitoring
    expect(setInterval).not.toHaveBeenCalled();

    // Start monitoring after update
    monitor.start();

    // Should use the updated interval
    expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 10000);
  });

  it("should update status bar with resource data", async () => {
    vi.spyOn(fs, "readFile")
      .mockResolvedValueOnce("cpu data")
      .mockResolvedValueOnce("mem data")
      .mockResolvedValueOnce("load data");

    vi.spyOn(monitor as any, "parseCPUUsage").mockReturnValue(50);
    vi.spyOn(monitor as any, "parseMemoryUsage").mockReturnValue(30);
    vi.spyOn(monitor as any, "parseLoadAverages").mockReturnValue([
      1.0, 0.75, 0.5,
    ]);

    await (monitor as any).collectAndUpdate();

    expect((monitor as any).statusBarItem.text).toBe(
      "CPU: 50% | MEM: 30% | Load: 1, 0.75, 0.5"
    );
  });

  describe("parseCPUUsage", () => {
    it("should correctly parse CPU usage from /proc/stat data", () => {
      const cpuData = `cpu  1000 200 300 4000 500 600 700 800
cpu0 100 20 30 400 50 60 70 80
cpu1 100 20 30 400 50 60 70 80
intr 123456789
ctxt 123456789
btime 1234567890
processes 12345
procs_running 1
procs_blocked 0`;

      const result = monitor.parseCPUUsage(cpuData);

      //  (total - idle) / total * 100
      // total = 1000 + 200 + 300 + 4000 + 500 + 600 + 700 + 800 = 8100
      // idle = 4000
      // (8100 - 4000) / 8100 * 100 = 50.62%
      expect(result).toBeCloseTo(50.62, 1);
    });

    it("should return 0 if CPU data is invalid", () => {
      const invalidData = "invalid data";
      const result = monitor.parseCPUUsage(invalidData);
      expect(result).toBe(0);
    });
  });

  describe("parseMemoryUsage", () => {
    it("should correctly parse memory usage from /proc/meminfo data", () => {
      const memData = `MemTotal:       16384000 kB
MemFree:         8192000 kB
MemAvailable:    6553600 kB
Buffers:          819200 kB
Cached:          1638400 kB
SwapCached:            0 kB
Active:          4915200 kB
Inactive:        2457600 kB`;

      const result = monitor.parseMemoryUsage(memData);

      // (MemTotal - MemAvailable) / MemTotal * 100
      // MemTotal = 16384000
      // MemAvailable = 6553600
      // (16384000 - 6553600) / 16384000 * 100 = 60%
      expect(result).toBeCloseTo(60, 1);
    });

    it("should handle missing memory data gracefully", () => {
      const invalidData = "invalid data";
      const result = monitor.parseMemoryUsage(invalidData);
      expect(isNaN(result)).toBe(true);
    });
  });

  describe("parseLoadAverages", () => {
    it("should correctly parse load averages from /proc/loadavg data", () => {
      const loadData = "1.25 0.75 0.50 2/123 12345";
      const result = monitor.parseLoadAverages(loadData);

      expect(result).toEqual([1.25, 0.75, 0.5]);
    });

    it("should handle invalid load data gracefully", () => {
      const invalidData = "invalid";
      const result = monitor.parseLoadAverages(invalidData);

      expect(result.length).toBe(1);
      expect(isNaN(result[0])).toBe(true);
    });
  });
});
