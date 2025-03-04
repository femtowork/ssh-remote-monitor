# SSH Remote Monitor

## Features

- **Real-time Resource Monitoring:**

  - Monitor CPU usage, memory consumption, and load average in real-time.
  - User-configurable monitoring intervals (e.g., 1s, 3s, 5s, 10s, 30s, 60s), defaulting to 1 second.

- **Resource Information Display:**

  - Displays resource information in the status bar.

- **SSH Remote Integration:**

  - Seamlessly integrates with VS Code's Remote - SSH extension to fetch resource information from remote servers without additional configuration.

- **Customization:**
  - Users can configure which resource information to display and set monitoring intervals.

## Requirements

- **VS Code:** Version 1.75.0 or higher.
- **Remote - SSH Extension:** Must be installed and configured.
- **Linux-based Remote Servers:** The extension only supports Linux systems for resource monitoring.

## Extension Settings

This extension contributes the following settings:

- `ssh-remote-monitor.monitorIntervalSeconds`: Sets the interval for resource monitoring in seconds. Default is 1 second.

## Known Issues

- Does not support non-Linux remote servers.
- High-frequency monitoring intervals may cause performance overhead on the remote server.

## Release Notes

### 0.1.0

Initial release of SSH Remote Monitor with real-time CPU, memory, and load average monitoring.
