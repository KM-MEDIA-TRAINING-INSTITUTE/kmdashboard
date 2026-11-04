"use client";

/**
 * Access/refresh token persistence.
 *
 * Access tokens are short-lived (15 min server-side) and kept in
 * sessionStorage so they do not survive the browser session. Refresh tokens
 * are kept in localStorage so silent renewal works across tabs/reloads;
 * the backend rotates them on every use and revokes the family on reuse,
 * which contains the risk of long-lived storage.
 */

const ACCESS_KEY = "km.access_token";
const REFRESH_KEY = "km.refresh_token";

export const tokenStore = {
  getAccess(): string | null {
    if (typeof window === "undefined") return null;
    return window.sessionStorage.getItem(ACCESS_KEY);
  },

  getRefresh(): string | null {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(REFRESH_KEY);
  },

  set(pair: { access_token: string; refresh_token: string }) {
    window.sessionStorage.setItem(ACCESS_KEY, pair.access_token);
    window.localStorage.setItem(REFRESH_KEY, pair.refresh_token);
  },

  clear() {
    window.sessionStorage.removeItem(ACCESS_KEY);
    window.localStorage.removeItem(REFRESH_KEY);
  },
};
