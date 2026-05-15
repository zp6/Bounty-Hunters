/**
 * Cross-platform copy/paste keybindings for terminal component. Fixes #824.
 */
export type Platform = 'mac' | 'windows' | 'linux';

export function detectPlatform(): Platform {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('mac')) return 'mac';
  if (ua.includes('win')) return 'windows';
  return 'linux';
}

export interface Keybinding {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  label: string;
  action: string;
}

export function getKeybindings(platform: Platform): Keybinding[] {
  const isMac = platform === 'mac';
  return [
    { key: 'c', ctrlKey: !isMac, metaKey: isMac, label: isMac ? 'Cmd+C' : 'Ctrl+C', action: 'copy' },
    { key: 'v', ctrlKey: !isMac, metaKey: isMac, label: isMac ? 'Cmd+V' : 'Ctrl+V', action: 'paste' },
    { key: 'x', ctrlKey: !isMac, metaKey: isMac, label: isMac ? 'Cmd+X' : 'Ctrl+X', action: 'cut' },
    { key: 'a', ctrlKey: !isMac, metaKey: isMac, label: isMac ? 'Cmd+A' : 'Ctrl+A', action: 'selectAll' },
    { key: 'c', ctrlKey: true, shiftKey: true, label: 'Ctrl+Shift+C', action: 'copyTerminal' },
    { key: 'v', ctrlKey: true, shiftKey: true, label: 'Ctrl+Shift+V', action: 'pasteTerminal' },
  ];
}

export function matchesKeybinding(event: KeyboardEvent, binding: Keybinding): boolean {
  return event.key.toLowerCase() === binding.key.toLowerCase()
    && !!event.ctrlKey === !!binding.ctrlKey
    && !!event.metaKey === !!binding.metaKey
    && !!event.shiftKey === !!binding.shiftKey
    && !!event.altKey === !!binding.altKey;
}

export function findMatchingAction(event: KeyboardEvent, platform?: Platform): string | null {
  const kb = getKeybindings(platform || detectPlatform());
  for (const binding of kb) {
    if (matchesKeybinding(event, binding)) return binding.action;
  }
  return null;
}

// Tests
import assert from 'assert';

function testDetectPlatform() {
  // Just verify it returns a valid platform
  const p = detectPlatform();
  assert(['mac', 'windows', 'linux'].includes(p));
}

function testMacKeybindings() {
  const kb = getKeybindings('mac');
  const copy = kb.find(k => k.action === 'copy');
  assert.strictEqual(copy?.metaKey, true);
  assert.strictEqual(copy?.label, 'Cmd+C');
}

function testWindowsKeybindings() {
  const kb = getKeybindings('windows');
  const copy = kb.find(k => k.action === 'copy');
  assert.strictEqual(copy?.ctrlKey, true);
  assert.strictEqual(copy?.label, 'Ctrl+C');
}

function testMatchKeybinding() {
  const kb = getKeybindings('windows')[0]; // Ctrl+C copy
  const event = new KeyboardEvent('keydown', { key: 'c', ctrlKey: true });
  assert.strictEqual(matchesKeybinding(event, kb), true);
}

testDetectPlatform();
testMacKeybindings();
testWindowsKeybindings();
testMatchKeybinding();
console.log('CrossPlatformKeybindings: all tests passed');
