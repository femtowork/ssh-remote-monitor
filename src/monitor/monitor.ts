import * as vscode from "vscode";
import * as fs from "fs/promises";

/**
 * Display options for the status bar
 */
interface DisplayOptions {
  showCpu: boolean;
  showMemory: boolean;
  showLoad: boolean;
}

/**
 * Class to collect resource information from a remote server
 */
class ResourceMonitor {
  private intervalId: NodeJS.Timeout | null;
  private intervalSeconds: number;
  private statusBarItem: vscode.StatusBarItem;
  private displayOptions: DisplayOptions;
  private lastCpuIdle: number | null = null;
  private lastCpuTotal: number | null = null;

  constructor(intervalSeconds: number = 1) {
    this.intervalSeconds = intervalSeconds;
    this.intervalId = null;
    this.displayOptions = {
      showCpu: true,
      showMemory: true,
      showLoad: true,
    };

    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.statusBarItem.command = "ssh-remote-monitor.toggleDisplayOptions";
    this.statusBarItem.show();

    // Register command to show display options menu
    vscode.commands.registerCommand(
      "ssh-remote-monitor.toggleDisplayOptions",
      () => {
        this.showDisplayOptionsMenu();
      }
    );
  }

  /**
   * Updates the monitoring interval and restarts monitoring if active
   * @param newIntervalSeconds New interval in seconds
   */
  updateInterval(newIntervalSeconds: number): void {
    const wasRunning = this.intervalId !== null;

    // Stop current monitoring if running
    if (wasRunning) {
      this.stop();
    }

    // Update interval
    this.intervalSeconds = newIntervalSeconds;

    // Restart if it was running
    if (wasRunning) {
      this.start();
    }
  }

  /**
   * Shows a menu to select which metrics to display
   */
  private async showDisplayOptionsMenu() {
    const options: vscode.QuickPickItem[] = [
      {
        label: `CPU ${this.displayOptions.showCpu ? "$(check)" : ""}`,
        picked: this.displayOptions.showCpu,
        description: "Show CPU usage",
      },
      {
        label: `Memory ${this.displayOptions.showMemory ? "$(check)" : ""}`,
        picked: this.displayOptions.showMemory,
        description: "Show memory usage",
      },
      {
        label: `Load Average ${this.displayOptions.showLoad ? "$(check)" : ""}`,
        picked: this.displayOptions.showLoad,
        description: "Show load averages",
      },
    ];

    const selectedOptions = await vscode.window.showQuickPick(options, {
      canPickMany: true,
      placeHolder: "Select metrics to display in status bar",
    });

    if (selectedOptions) {
      this.displayOptions = {
        showCpu: selectedOptions.some((option) =>
          option.label.startsWith("CPU")
        ),
        showMemory: selectedOptions.some((option) =>
          option.label.startsWith("Memory")
        ),
        showLoad: selectedOptions.some((option) =>
          option.label.startsWith("Load")
        ),
      };

      // Update status bar immediately with new settings
      this.collectAndUpdate();
    }
  }

  start() {
    if (this.intervalId) {
      this.stop();
    }
    this.intervalId = setInterval(
      () => this.collectAndUpdate(),
      this.intervalSeconds * 1000
    );
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.statusBarItem.text = "";
    }
  }

  async collectAndUpdate() {
    try {
      const cpuData = await fs.readFile("/proc/stat", "utf-8");
      const memData = await fs.readFile("/proc/meminfo", "utf-8");
      const loadData = await fs.readFile("/proc/loadavg", "utf-8");

      const cpuUsage = this.parseCPUUsage(cpuData);
      const memoryUsage = this.parseMemoryUsage(memData);
      const loadAverages = this.parseLoadAverages(loadData);

      this.updateStatusBar(cpuUsage, memoryUsage, loadAverages);
    } catch (error) {
      vscode.window.showErrorMessage(
        `Resource collection error: ${
          error instanceof Error ? error.message : error
        }`
      );
    }
  }

  /**
   * Parses CPU usage
   * @param data Content of /proc/stat
   * @returns Percentage of CPU usage based on the difference since last measurement
   */
  public parseCPUUsage(data: string): number {
    const lines = data.split("\n");
    const cpuLine = lines.find((line) => line.startsWith("cpu "));
    if (!cpuLine) {
      return 0;
    }

    const parts = cpuLine.split(/\s+/).slice(1).map(Number);
    const idle = parts[3];
    const total = parts.reduce((a, b) => a + b, 0);

    // First measurement, store values and return 0
    if (this.lastCpuIdle === null || this.lastCpuTotal === null) {
      this.lastCpuIdle = idle;
      this.lastCpuTotal = total;
      return 0;
    }

    // Calculate difference between current and last measurement
    const idleDiff = idle - this.lastCpuIdle;
    const totalDiff = total - this.lastCpuTotal;

    // Store current values for next measurement
    this.lastCpuIdle = idle;
    this.lastCpuTotal = total;

    // Avoid division by zero
    if (totalDiff === 0) {
      return 0;
    }

    // Calculate usage based on the difference
    const usage = ((totalDiff - idleDiff) / totalDiff) * 100;
    return parseFloat(usage.toFixed(2));
  }

  /**
   * Parses memory usage
   * @param data Content of /proc/meminfo
   * @returns Percentage of used memory
   */
  public parseMemoryUsage(data: string): number {
    const lines = data.split("\n");
    const memTotal = parseInt(
      this.extractValue(
        lines.find((line) => line.startsWith("MemTotal:")) || "MemTotal: 0 kB"
      )
    );
    const memAvailable = parseInt(
      this.extractValue(
        lines.find((line) => line.startsWith("MemAvailable:")) ||
          "MemAvailable: 0 kB"
      )
    );
    const used = memTotal - memAvailable;
    const usage = (used / memTotal) * 100;
    return parseFloat(usage.toFixed(2));
  }

  /**
   * Parses load averages
   * @param data Content of /proc/loadavg
   * @returns Array of load averages
   */
  public parseLoadAverages(data: string): number[] {
    const parts = data.split(" ");
    return parts.slice(0, 3).map((avg) => parseFloat(avg));
  }

  /**
   * Displays resource information on the status bar
   * @param cpu CPU usage
   * @param memory Memory usage
   * @param load Load averages
   */
  private updateStatusBar(cpu: number, memory: number, load: number[]) {
    const parts: string[] = [];

    if (this.displayOptions.showCpu) {
      parts.push(`CPU: ${cpu}%`);
    }

    if (this.displayOptions.showMemory) {
      parts.push(`MEM: ${memory}%`);
    }

    if (this.displayOptions.showLoad) {
      parts.push(`Load: ${load.join(", ")}`);
    }

    // If nothing is selected, show a message
    if (parts.length === 0) {
      this.statusBarItem.text = "$(gear) Configure Monitor";
    } else {
      this.statusBarItem.text = parts.join(" | ");
    }

    // Update tooltip to show all values and instructions
    this.statusBarItem.tooltip =
      `Resource information of the remote server\n` +
      `CPU: ${cpu}%\n` +
      `Memory: ${memory}%\n` +
      `Load: ${load.join(", ")}\n\n` +
      `Click to configure displayed metrics`;
  }

  /**
   * Extracts the numeric part from a line
   * @param line Line string
   * @returns Numeric part of the string
   */
  private extractValue(line: string): string {
    const match = line.match(/:\s+(\d+)/);
    return match ? match[1] : "0";
  }
}

export default ResourceMonitor;
