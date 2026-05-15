import { safeStorage } from "electron";
import Store from "electron-store";

interface StoredCredential {
  id: string;
  encrypted: string;
  keyVersion: number;
  updatedAt: number;
}

interface RotationLog {
  timestamp: number;
  credentialsRotated: number;
  oldKeyVersion: number;
  newKeyVersion: number;
}

interface SafeStorageData {
  credentials: Record<string, StoredCredential>;
  currentKeyVersion: number;
  rotationLog: RotationLog[];
}

const store = new Store<SafeStorageData>({
  defaults: {
    credentials: {},
    currentKeyVersion: 1,
    rotationLog: [],
  },
  encryptionKey: "t3code-safe-storage", // Electron-store encryption
});

export class SafeStorageManager {
  private keyVersion: number;

  constructor() {
    this.keyVersion = store.get("currentKeyVersion", 1);
  }

  // Store a credential
  setCredential(id: string, value: string): void {
    const encrypted = safeStorage.encryptString(value).toString("base64");
    const credentials = store.get("credentials", {});

    credentials[id] = {
      id,
      encrypted,
      keyVersion: this.keyVersion,
      updatedAt: Date.now(),
    };

    store.set("credentials", credentials);
  }

  // Retrieve a credential
  getCredential(id: string): string | null {
    const credentials = store.get("credentials", {});
    const entry = credentials[id];

    if (!entry) return null;

    try {
      const buffer = Buffer.from(entry.encrypted, "base64");
      return safeStorage.decryptString(buffer);
    } catch {
      console.error(`Failed to decrypt credential: ${id}`);
      return null;
    }
  }

  // Delete a credential
  deleteCredential(id: string): boolean {
    const credentials = store.get("credentials", {});
    if (!credentials[id]) return false;

    delete credentials[id];
    store.set("credentials", credentials);
    return true;
  }

  // Rotate encryption keys
  rotateKeys(): RotationLog {
    const credentials = store.get("credentials", {});
    const oldVersion = this.keyVersion;
    const newVersion = oldVersion + 1;
    let rotatedCount = 0;

    for (const [id, entry] of Object.entries(credentials)) {
      try {
        // Decrypt with current key
        const buffer = Buffer.from(entry.encrypted, "base64");
        const plaintext = safeStorage.decryptString(buffer);

        // Re-encrypt (safeStorage uses OS keychain which handles key derivation)
        const newEncrypted = safeStorage.encryptString(plaintext).toString("base64");

        credentials[id] = {
          ...entry,
          encrypted: newEncrypted,
          keyVersion: newVersion,
          updatedAt: Date.now(),
        };
        rotatedCount++;
      } catch (e) {
        console.error(`Failed to rotate credential ${id}:`, e);
      }
    }

    store.set("credentials", credentials);
    store.set("currentKeyVersion", newVersion);
    this.keyVersion = newVersion;

    const logEntry: RotationLog = {
      timestamp: Date.now(),
      credentialsRotated: rotatedCount,
      oldKeyVersion: oldVersion,
      newKeyVersion: newVersion,
    };

    const logs = store.get("rotationLog", []);
    logs.push(logEntry);
    store.set("rotationLog", logs.slice(-100)); // Keep last 100 logs

    console.log(
      `Key rotation complete: ${rotatedCount} credentials rotated from v${oldVersion} to v${newVersion}`
    );

    return logEntry;
  }

  // List credential IDs
  listCredentials(): string[] {
    return Object.keys(store.get("credentials", {}));
  }

  // Get rotation history
  getRotationLog(): RotationLog[] {
    return store.get("rotationLog", []);
  }

  get currentVersion(): number {
    return this.keyVersion;
  }
}

export default SafeStorageManager;
