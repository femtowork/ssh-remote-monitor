import * as vscode from "vscode";
import ResourceMonitor from "./monitor/monitor.js";

export function activate(context: vscode.ExtensionContext) {
  console.log('"ssh-remote-monitor" is now active.');

  if (vscode.env.remoteName) {
    // Get monitoring interval from settings
    const config = vscode.workspace.getConfiguration("ssh-remote-monitor");
    const intervalSeconds = config.get<number>("monitorIntervalSeconds", 1);

    const monitor = new ResourceMonitor(intervalSeconds);
    monitor.start();

    // Watch for configuration changes
    context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (
          e.affectsConfiguration("ssh-remote-monitor.monitorIntervalSeconds")
        ) {
          const newConfig =
            vscode.workspace.getConfiguration("ssh-remote-monitor");
          const newIntervalSeconds = newConfig.get<number>(
            "monitorIntervalSeconds",
            1
          );

          // Restart monitor if interval changes
          if (monitor && newIntervalSeconds !== intervalSeconds) {
            monitor.updateInterval(newIntervalSeconds);
          }
        }
      })
    );

    context.subscriptions.push({
      dispose: () => {
        // Stop when the extension is deactivated
        if (monitor) {
          monitor.stop();
        }
      },
    });
  } else {
    console.log("Skip start resource monitor because it's not remote.");
  }
}

// This method is called when your extension is deactivated
export function deactivate() {}
