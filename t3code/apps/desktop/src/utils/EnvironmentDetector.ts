/**
 * Environment detection for container, CI, and WSL environments. Fixes #836.
 */
export type EnvironmentType = 'native' | 'docker' | 'wsl' | 'ci' | 'devcontainer';

export interface EnvironmentInfo {
  type: EnvironmentType;
  isContainer: boolean;
  isCI: boolean;
  isWSL: boolean;
  isDevContainer: boolean;
  details: Record<string, string>;
}

export class EnvironmentDetector {
  private cached: EnvironmentInfo | null = null;

  detect(): EnvironmentInfo {
    if (this.cached) return this.cached;

    const info: EnvironmentInfo = {
      type: 'native',
      isContainer: false,
      isCI: false,
      isWSL: false,
      isDevContainer: false,
      details: {},
    };

    // Check CI environments
    if (process.env.CI === 'true' || process.env.GITHUB_ACTIONS || process.env.JENKINS_URL || process.env.CIRCLECI) {
      info.isCI = true;
      info.type = 'ci';
      info.details.ci_provider = process.env.GITHUB_ACTIONS ? 'github' : process.env.JENKINS_URL ? 'jenkins' : 'other';
    }

    // Check Docker/container
    if (process.env.container === 'docker' || process.env.KUBERNETES_SERVICE_HOST) {
      info.isContainer = true;
      info.type = 'docker';
    }

    // Check devcontainer
    if (process.env.REMOTE_CONTAINERS || process.env.LOCAL_DEVCONTAINER) {
      info.isDevContainer = true;
      info.type = 'devcontainer';
    }

    // Check WSL
    if (process.platform === 'linux') {
      try {
        const fs = require('fs');
        const release = fs.readFileSync('/proc/version', 'utf8');
        if (release.toLowerCase().includes('microsoft')) {
          info.isWSL = true;
          info.type = 'wsl';
          info.details.wsl_version = release.includes('WSL2') ? '2' : '1';
        }
      } catch {}
    }

    info.details.platform = process.platform;
    info.details.arch = process.arch;
    info.details.node_version = process.version;

    this.cached = info;
    return info;
  }

  reset(): void {
    this.cached = null;
  }
}

// Tests
import assert from 'assert';

function testNativeEnv() {
  const det = new EnvironmentDetector();
  // Remove env vars for clean test
  const backup: Record<string, string|undefined> = {};
  for (const key of ['CI', 'GITHUB_ACTIONS', 'container', 'REMOTE_CONTAINERS']) {
    backup[key] = process.env[key];
    delete process.env[key];
  }
  const info = det.detect();
  assert.strictEqual(info.isCI, false);
  assert.strictEqual(info.isContainer, false);
  // Restore
  Object.assign(process.env, backup);
}

function testCIEnv() {
  const det = new EnvironmentDetector();
  det.reset();
  process.env.CI = 'true';
  const info = det.detect();
  assert.strictEqual(info.isCI, true);
  assert.strictEqual(info.type, 'ci');
  delete process.env.CI;
}

function testDockerEnv() {
  const det = new EnvironmentDetector();
  det.reset();
  process.env.container = 'docker';
  const info = det.detect();
  assert.strictEqual(info.isContainer, true);
  delete process.env.container;
}

testNativeEnv();
testCIEnv();
testDockerEnv();
console.log('EnvironmentDetector: all tests passed');
