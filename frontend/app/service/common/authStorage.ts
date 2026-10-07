import { User } from '@/app/interfaces/user.interface';

const USER_STORAGE_KEY = 'user';
const TAB_LOGGED_OUT_KEY = 'auth:tabLoggedOut';
export const AUTH_LOGOUT_EVENT = 'auth:logout';

let logoutEventDispatched = false;

const parseUser = (raw: string | null): User | undefined => {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as User;
    if (!parsed?.token || !parsed?.role) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
};

const readUser = (storage: Storage): User | undefined => {
  try {
    return parseUser(storage.getItem(USER_STORAGE_KEY));
  } catch {
    return undefined;
  }
};

const isSameStoredUser = (
  tabUser: Pick<User, 'id' | 'token'> | undefined | null,
  stored: User | undefined,
): boolean => {
  if (!tabUser || !stored) return false;
  if (tabUser.id != null && stored.id != null) {
    return Number(tabUser.id) === Number(stored.id);
  }
  return Boolean(tabUser.token && stored.token && tabUser.token === stored.token);
};

const isTabLoggedOut = (): boolean => {
  try {
    return sessionStorage.getItem(TAB_LOGGED_OUT_KEY) === '1';
  } catch {
    return false;
  }
};

const markTabLoggedOut = (): void => {
  try {
    sessionStorage.setItem(TAB_LOGGED_OUT_KEY, '1');
  } catch {
    // ignore
  }
};

const clearTabLoggedOut = (): void => {
  try {
    sessionStorage.removeItem(TAB_LOGGED_OUT_KEY);
  } catch {
    // ignore
  }
};

/** This tab's session first; localStorage is only last-login for a new tab. */
export const getStoredUser = (): User | undefined => {
  if (typeof window === 'undefined') return undefined;
  try {
    const sessionUser = readUser(sessionStorage);
    if (sessionUser) return sessionUser;

    // This tab logged out: do not claim another tab's last-login.
    if (isTabLoggedOut()) return undefined;

    const lastLogin = readUser(localStorage);
    if (!lastLogin) return undefined;

    try {
      sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(lastLogin));
    } catch {
      // Quota / private mode — still return last login for this load
    }
    return lastLogin;
  } catch {
    return undefined;
  }
};

export const setStoredUser = (user: User): void => {
  if (typeof window === 'undefined') return;
  const payload = JSON.stringify(user);
  clearTabLoggedOut();
  try {
    sessionStorage.setItem(USER_STORAGE_KEY, payload);
  } catch {
    // Quota / private mode — session stays in memory
  }
  try {
    localStorage.setItem(USER_STORAGE_KEY, payload);
  } catch {
    // Quota / private mode — ignore
  }
};

/**
 * Drops this tab's session. localStorage (last-login) is removed only when it
 * belongs to the same user — another tab's login is left intact.
 */
export const clearStoredUser = (tabUser?: User | null): void => {
  if (typeof window === 'undefined') return;

  const sessionUser = readUser(sessionStorage);
  const thisTabUser = tabUser ?? sessionUser;

  try {
    sessionStorage.removeItem(USER_STORAGE_KEY);
  } catch {
    // ignore
  }
  markTabLoggedOut();

  try {
    const lastLogin = readUser(localStorage);
    if (isSameStoredUser(thisTabUser, lastLogin)) {
      localStorage.removeItem(USER_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
};

/** Clears this tab's auth and notifies AppProvider (no hard page reload). */
export const clearAuthSession = (): void => {
  const sessionUser = typeof window === 'undefined' ? undefined : readUser(sessionStorage);
  clearStoredUser(sessionUser);
  if (typeof window === 'undefined') return;
  if (logoutEventDispatched) return;
  logoutEventDispatched = true;
  window.dispatchEvent(new Event(AUTH_LOGOUT_EVENT));
  window.setTimeout(() => {
    logoutEventDispatched = false;
  }, 1000);
};
