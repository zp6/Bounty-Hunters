import { Tray, Menu, nativeImage, BrowserWindow, app } from "electron";
import * as path from "path";

let tray: Tray | null = null;

interface TrayConfig {
  iconPath: string;
  windows: BrowserWindow[];
  recentProjects: string[];
  onNewChat: () => void;
  onOpenProject: (projectPath: string) => void;
}

export function createSystemTray(config: TrayConfig) {
  const icon = nativeImage.createFromPath(config.iconPath);
  tray = new Tray(icon.resize({ width: 16, height: 16 }));

  const buildContextMenu = () =>
    Menu.buildFromTemplate([
      {
        label: "Show Window",
        click: () => {
          const win = config.windows[0];
          if (win) {
            win.show();
            win.focus();
          }
        },
      },
      { type: "separator" },
      {
        label: "New Chat",
        click: () => config.onNewChat(),
      },
      { type: "separator" },
      {
        label: "Open Recent Project",
        submenu: config.recentProjects.slice(0, 5).map((p) => ({
          label: path.basename(p),
          sublabel: p,
          click: () => config.onOpenProject(p),
        })),
      },
      { type: "separator" },
      {
        label: "Quit",
        click: () => {
          app.quit();
        },
      },
    ]);

  tray.setContextMenu(buildContextMenu());
  tray.setToolTip("t3code - Ready");

  // Platform-specific behavior
  if (process.platform === "darwin") {
    // macOS: click tray to toggle window
    tray.on("click", () => {
      const win = config.windows[0];
      if (win) {
        if (win.isVisible()) {
          win.hide();
        } else {
          win.show();
          win.focus();
        }
      }
    });
  } else {
    // Windows/Linux: left click shows window, right click shows menu
    tray.on("click", () => {
      const win = config.windows[0];
      if (win) {
        win.show();
        win.focus();
      }
    });
  }

  return {
    updateStatus: (status: "connected" | "disconnected" | "error", project?: string) => {
      if (!tray) return;
      const statusText =
        status === "connected" ? "Connected" :
        status === "error" ? "Error" : "Disconnected";
      tray.setToolTip(`t3code - ${statusText}${project ? ` - ${project}` : ""}`);
    },
    updateRecentProjects: (projects: string[]) => {
      config.recentProjects = projects;
      tray?.setContextMenu(buildContextMenu());
    },
    destroy: () => {
      tray?.destroy();
      tray = null;
    },
  };
}

export { tray };
