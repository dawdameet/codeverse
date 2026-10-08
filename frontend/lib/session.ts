const KEY = "codeverse.session";

export interface StoredSession {
  token: string;
  participantId: string;
}

export function getSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

export function getToken() {
  return getSession()?.token ?? null;
}

export function saveSession(s: StoredSession) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {}
}

export function clearSession() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}
