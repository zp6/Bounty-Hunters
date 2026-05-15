import { nativeTheme, BrowserWindow } from "electron";
import Store from "electron-store";

type ThemeMode = "light" | "dark" | "system";

interface ThemeStore {
  themeMode: ThemeMode;
}

const store = new Store<ThemeStore>({
  defaults: {
    themeMode: "system",
  },
});

let currentMode: ThemeMode = store.get("themeMode", "system");

// Get the effective theme (resolves 'system' to actual OS theme)
function getEffectiveTheme(): "light" | "dark" {
  if (currentMode === "system") {
    return nativeTheme.shouldUseDarkColors ? "dark" : "light";
  }
  return currentMode;
}

// Apply theme to all windows
function applyTheme(windows: BrowserWindow[]) {
  const effective = getEffectiveTheme();

  // Set Electron theme source
  if (currentMode === "system") {
    nativeTheme.themeSource = "system";
  } else {
    nativeTheme.themeSource = currentMode;
  }

  // Notify all renderer processes
  for (const win of windows) {
    win.webContents.send("theme-changed", {
      mode: currentMode,
      effective,
    });
  }
}

// Initialize theme system
export function initThemeSystem(windows: BrowserWindow[]) {
  // Apply persisted theme on startup
  applyTheme(windows);

  // Listen for OS theme changes (for system mode)
  nativeTheme.on("updated", () => {
    if (currentMode === "system") {
      applyTheme(windows);
    }
  });

  // Listen for theme change requests from renderer
  const { ipcMain } = require("electron");
  ipcMain.handle("theme:set", (_event, mode: ThemeMode) => {
    currentMode = mode;
    store.set("themeMode", mode);
    applyTheme(windows);
    return { mode, effective: getEffectiveTheme() };
  });

  ipcMain.handle("theme:get", () => ({
    mode: currentMode,
    effective: getEffectiveTheme(),
  }));

  ipcMain.handle("theme:options", () => ["light", "dark", "system"]);
}

export { getEffectiveTheme, initThemeSystem };
