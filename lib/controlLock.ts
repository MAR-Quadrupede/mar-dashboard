import { AuthUser } from "./auth";

export type ControlLockState = {
  isHeld: boolean;
  holderUserId: string | null;
  holderUsername: string | null;
  holderIp: string | null;
  acquiredAt: number | null;
  lastHeartbeat: number | null;
  expiresInSeconds: number;
};

const LOCK_TIMEOUT_MS = 35 * 1000; // 35 seconds of inactivity releases lock

// In-memory singleton state
const globalLockState = globalThis as unknown as {
  __marControlLock: {
    holderUserId: string | null;
    holderUsername: string | null;
    holderIp: string | null;
    acquiredAt: number | null;
    lastHeartbeat: number | null;
  } | undefined;
};

if (!globalLockState.__marControlLock) {
  globalLockState.__marControlLock = {
    holderUserId: null,
    holderUsername: null,
    holderIp: null,
    acquiredAt: null,
    lastHeartbeat: null
  };
}

const lock = globalLockState.__marControlLock;

export function getControlLockStatus(callerUserId?: string | null): ControlLockState & { isHeldByCaller: boolean } {
  const now = Date.now();

  // Check expiration
  if (lock.holderUserId && lock.lastHeartbeat) {
    if (now - lock.lastHeartbeat > LOCK_TIMEOUT_MS) {
      // Inactivity timeout - release automatically
      lock.holderUserId = null;
      lock.holderUsername = null;
      lock.holderIp = null;
      lock.acquiredAt = null;
      lock.lastHeartbeat = null;
    }
  }

  const isHeld = Boolean(lock.holderUserId);
  const remainingMs = isHeld && lock.lastHeartbeat ? Math.max(0, LOCK_TIMEOUT_MS - (now - lock.lastHeartbeat)) : 0;
  const isHeldByCaller = Boolean(callerUserId && lock.holderUserId === callerUserId);

  return {
    isHeld,
    holderUserId: lock.holderUserId,
    holderUsername: lock.holderUsername,
    holderIp: lock.holderIp,
    acquiredAt: lock.acquiredAt,
    lastHeartbeat: lock.lastHeartbeat,
    expiresInSeconds: Math.round(remainingMs / 1000),
    isHeldByCaller
  };
}

export function acquireControlLock(
  user: AuthUser,
  ip?: string,
  force = false
): { success: boolean; state: ControlLockState & { isHeldByCaller: boolean }; message?: string } {
  const status = getControlLockStatus(user.id);
  const now = Date.now();

  // If already held by caller, refresh heartbeat
  if (status.isHeld && status.isHeldByCaller) {
    lock.lastHeartbeat = now;
    return {
      success: true,
      state: getControlLockStatus(user.id),
      message: "Control lock refreshed"
    };
  }

  // If held by someone else and not forced
  if (status.isHeld && !status.isHeldByCaller && !force) {
    return {
      success: false,
      state: status,
      message: `Control lock is currently held by ${status.holderUsername}`
    };
  }

  // Acquire lock
  lock.holderUserId = user.id;
  lock.holderUsername = user.username;
  lock.holderIp = ip || null;
  lock.acquiredAt = now;
  lock.lastHeartbeat = now;

  return {
    success: true,
    state: getControlLockStatus(user.id),
    message: force ? "Control lock forcibly acquired by admin" : "Control lock acquired successfully"
  };
}

export function heartbeatControlLock(userId: string): boolean {
  const status = getControlLockStatus(userId);
  if (status.isHeld && status.isHeldByCaller) {
    lock.lastHeartbeat = Date.now();
    return true;
  }
  return false;
}

export function releaseControlLock(userId: string, force = false): boolean {
  const status = getControlLockStatus(userId);
  if ((status.isHeld && status.isHeldByCaller) || force) {
    lock.holderUserId = null;
    lock.holderUsername = null;
    lock.holderIp = null;
    lock.acquiredAt = null;
    lock.lastHeartbeat = null;
    return true;
  }
  return false;
}

export function canUserControl(user: AuthUser): boolean {
  const status = getControlLockStatus(user.id);
  return status.isHeld && status.isHeldByCaller;
}
