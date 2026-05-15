import { app, BrowserWindow, shell, ipcMain } from "electron";
import * as path from "path";
import * as url from "url";

interface DeepLinkRoute {
  action: string;
  params: Record<string, string>;
}

const VALID_ACTIONS = new Set(["open", "chat", "settings"]);
const ALLOWED_PATH_PREFIXES = ["/home", "/Users", "/tmp", "/projects"];

function parseDeepLink(deepLinkUrl: string): DeepLinkRoute | null {
  try {
    const parsed = new URL(deepLinkUrl);

    if (parsed.protocol !== "t3code:") return null;

    const action = parsed.hostname;
    if (!VALID_ACTIONS.has(action)) return null;

    const params: Record<string, string> = {};
    parsed.searchParams.forEach((value, key) => {
      params[key] = value;
    });

    // Validate path parameter to prevent traversal
    if (params.path) {
      const resolved = path.resolve(params.path);
      if (resolved.includes("..")) {
        console.error("Path traversal detected:", params.path);
        return null;
      }
    }

    return { action, params };
  } catch {
    return null;
  }
}

function routeToWindow(win: BrowserWindow, route: DeepLinkRoute) {
  switch (route.action) {
    case "open":
      if (route.params.path) {
        win.webContents.send("deep-link:open-project", {
          path: route.params.path,
        });
      }
      break;

    case "chat":
      if (route.params.id) {
        win.webContents.send("deep-link:open-thread", {
          id: route.params.id,
        });
      }
      break;

    case "settings":
      win.webContents.send("deep-link:navigate", { view: "settings" });
      break;
  }
}

export function registerDeepLinkProtocol(windows: BrowserWindow[]) {
  // Register protocol
  if (process.defaultApp) {
    app.setAsDefaultProtocolClient("t3code", process.execPath, [
      path.resolve(process.argv[1]),
    ]);
  } else {
    app.setAsDefaultProtocolClient("t3code");
  }

  // Handle deep link when app is already running
  const handleDeepLink = (deepLinkUrl: string) => {
    const route = parseDeepLink(deepLinkUrl);
    if (!route) {
      console.error("Invalid deep link:", deepLinkUrl);
      return;
    }

    const win = windows[0] || BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
      routeToWindow(win, route);
    }
  };

  // Windows/Linux: second-instance event
  app.on("second-instance", (_event, commandLine) => {
    const deepLink = commandLine.find((arg) => arg.startsWith("t3code://"));
    if (deepLink) handleDeepLink(deepLink);
  });

  // macOS: open-url event
  app.on("open-url", (_event, url) => {
    handleDeepLink(url);
  });

  // Handle deep link on app start
  const initialLink = process.argv.find((arg) => arg.startsWith("t3code://"));
  if (initialLink) {
    // Delay to let window initialize
    setTimeout(() => handleDeepLink(initialLink), 1000);
  }

  // IPC handler for renderer to get initial deep link
  ipcMain.handle("deep-link:get-initial", () => initialLink || null);
}

export { parseDeepLink };
