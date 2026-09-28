interface RateLimitEntry {
  failedAttempts: number;
  blockedUntil: number;
  windowStartedAt: number;
}

const EMAIL_MAX_ATTEMPTS = 5;
const IP_MAX_ATTEMPTS = 20;

const WINDOW_MS = 15 * 60 * 1000;
const BLOCK_MS = 15 * 60 * 1000;

const emailAttempts =
  new Map<string, RateLimitEntry>();

const ipAttempts =
  new Map<string, RateLimitEntry>();

function normalizeKey(
  value: string
): string {
  return value.trim().toLowerCase();
}

function getEntry(
  store: Map<string, RateLimitEntry>,
  key: string
): RateLimitEntry {
  const now = Date.now();

  const existing =
    store.get(key);

  if (!existing) {
    const entry: RateLimitEntry = {
      failedAttempts: 0,
      blockedUntil: 0,
      windowStartedAt: now,
    };

    store.set(key, entry);

    return entry;
  }

  if (
    now - existing.windowStartedAt >=
    WINDOW_MS
  ) {
    existing.failedAttempts = 0;
    existing.blockedUntil = 0;
    existing.windowStartedAt = now;
  }

  return existing;
}

function isBlocked(
  entry: RateLimitEntry
): boolean {
  return (
    entry.blockedUntil >
    Date.now()
  );
}

function recordFailure(
  store: Map<string, RateLimitEntry>,
  key: string,
  maxAttempts: number
): void {
  const entry =
    getEntry(store, key);

  entry.failedAttempts++;

  if (
    entry.failedAttempts >=
    maxAttempts
  ) {
    entry.blockedUntil =
      Date.now() +
      BLOCK_MS;
  }
}

function clearEntry(
  store: Map<string, RateLimitEntry>,
  key: string
): void {
  store.delete(key);
}

export interface LoginRateLimitStatus {
  blocked: boolean;
  retryAfterSeconds: number;
}

export function checkLoginRateLimit(
  email: string,
  ipAddress: string
): LoginRateLimitStatus {
  const normalizedEmail =
    normalizeKey(email);

  const normalizedIp =
    normalizeKey(ipAddress);

  const emailEntry =
    getEntry(
      emailAttempts,
      normalizedEmail
    );

  const ipEntry =
    getEntry(
      ipAttempts,
      normalizedIp
    );

  const now = Date.now();

  const emailBlocked =
    isBlocked(emailEntry);

  const ipBlocked =
    isBlocked(ipEntry);

  if (
    !emailBlocked &&
    !ipBlocked
  ) {
    return {
      blocked: false,
      retryAfterSeconds: 0,
    };
  }

  const blockedUntil =
    Math.max(
      emailEntry.blockedUntil,
      ipEntry.blockedUntil
    );

  return {
    blocked: true,
    retryAfterSeconds:
      Math.max(
        1,
        Math.ceil(
          (blockedUntil - now) /
            1000
        )
      ),
  };
}

export function recordLoginFailure(
  email: string,
  ipAddress: string
): void {
  const normalizedEmail =
    normalizeKey(email);

  const normalizedIp =
    normalizeKey(ipAddress);

  recordFailure(
    emailAttempts,
    normalizedEmail,
    EMAIL_MAX_ATTEMPTS
  );

  recordFailure(
    ipAttempts,
    normalizedIp,
    IP_MAX_ATTEMPTS
  );
}

export function clearLoginFailures(
  email: string,
  ipAddress: string
): void {
  const normalizedEmail =
    normalizeKey(email);

  const normalizedIp =
    normalizeKey(ipAddress);

  clearEntry(
    emailAttempts,
    normalizedEmail
  );

  clearEntry(
    ipAttempts,
    normalizedIp
  );
}