import { createHash, randomInt } from 'crypto';

/** Unambiguous alphabet — no O/0, I/1, so codes are easy to read aloud. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Human-friendly one-time code, e.g. `TC-4K7M-92QD`. */
export function generateCode(): string {
  const pick = () => ALPHABET[randomInt(ALPHABET.length)];
  const block = () => Array.from({ length: 4 }, pick).join('');
  return `TC-${block()}-${block()}`;
}

/** Uppercase and strip separators so `tc 4k7m92qd` matches `TC-4K7M-92QD`. */
export function normalizeCode(raw: string): string {
  return (raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function hashCode(raw: string): string {
  return createHash('sha256').update(normalizeCode(raw)).digest('hex');
}

export function lastFour(code: string): string {
  const n = normalizeCode(code);
  return n.slice(-4);
}

/** SHA-256 of a device token — tokens are never stored in the clear. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Best-effort, human-readable device label from a User-Agent string. */
export function describeDevice(ua: string | undefined): string {
  if (!ua) return 'Unknown device';
  const browser =
    /Edg\//.test(ua) ? 'Edge'
    : /OPR\/|Opera/.test(ua) ? 'Opera'
    : /Chrome\//.test(ua) && !/Chromium/.test(ua) ? 'Chrome'
    : /Firefox\//.test(ua) ? 'Firefox'
    : /Safari\//.test(ua) ? 'Safari'
    : 'Browser';
  const os =
    /Android/.test(ua) ? 'Android'
    : /iPhone|iPad|iPod/.test(ua) ? 'iOS'
    : /Windows/.test(ua) ? 'Windows'
    : /Mac OS X/.test(ua) ? 'macOS'
    : /Linux/.test(ua) ? 'Linux'
    : 'Unknown OS';
  return `${browser} on ${os}`;
}
