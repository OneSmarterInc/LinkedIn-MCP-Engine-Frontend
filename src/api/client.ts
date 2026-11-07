/**
 * How the browser talks to the backend: same-origin /api calls with an optional Bearer token.
 * In development Vite forwards /api to the backend (vite.config.ts). In production the backend serves this app.
 * The browser never holds a Google key.
 */

const TOKEN_KEY = "outreach-api-token";

export function getToken(): string {
  try { return localStorage.getItem(TOKEN_KEY) ?? ""; } catch { return ""; }
}

export function setToken(token: string): void {
  try { token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY); } catch { /* private window */ }
}

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

const BACKEND_DOWN = "Cannot reach the backend. Start it with `npm run api` in the backend folder.";

/** Fired on window when the backend answers 401 after start-up (token changed or removed). App.tsx listens and shows the sign-in box. */
export const UNAUTHORIZED_EVENT = "outreach:unauthorized";

export async function request<T>(method: "GET" | "POST" | "PUT" | "PATCH", path: string, body?: unknown): Promise<T> {
  // The backend refuses changes without this header: a form on another site cannot add it, the console always does.
  const headers: Record<string, string> = { Accept: "application/json", "X-Requested-With": "outreach-console" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(path, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  } catch {
    throw new ApiError(0, BACKEND_DOWN);
  }

  const text = await res.text();
  let data: unknown;
  try { data = text ? JSON.parse(text) : undefined; } catch { data = undefined; }

  // A 401 from the sign-in steps themselves is a wrong password or code, shown on that screen: not a "session ended".
  const signInStep = /^\/api\/auth\/(login|2fa\/|register|forgot|reset)/.test(path);
  if (res.status === 401 && !signInStep) {
    // The saved token is no longer accepted: forget it and send the app back to the sign-in box.
    setToken("");
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  }
  if (!res.ok) {
    const fromServer = (data as { error?: string } | undefined)?.error;
    const msg = fromServer ?? (res.status === 502 || res.status === 504 || res.status === 500 && !text ? BACKEND_DOWN : `Request failed (${res.status}).`);
    throw new ApiError(res.status, msg);
  }
  return data as T;
}
