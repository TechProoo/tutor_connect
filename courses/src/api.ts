// API client for the Tutor Connect guide portal.
// The device token is the student's only credential: it is issued once at
// redemption and replayed on every request from that browser.

// `||` rather than `??`: a blank VITE_API_URL has to fall back too, or every
// call goes same-origin and the SPA redirect answers it with index.html.
const API_URL: string =
  import.meta.env.VITE_API_URL?.trim() ||
  (import.meta.env.PROD
    ? "https://tutorconnect-production-3a39.up.railway.app"
    : "http://localhost:3001");

const TOKEN_KEY = "tc-device-token";

export function getToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* private mode — the HTTP-only cookie is the fallback */
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export interface Session {
  buyer: { name: string; phone: string };
  guide: {
    id: string;
    title: string;
    courseCode: string;
    subject: string | null;
    description: string | null;
    pageCount: number;
    version: number;
    ready: boolean;
  };
  redeemedAt: string | null;
  deviceLabel: string | null;
}

export interface CatalogItem {
  id: string;
  title: string;
  courseCode: string;
  subject: string | null;
  description: string | null;
  pageCount: number;
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) headers.set("x-device-token", token);
  if (init.body) headers.set("Content-Type", "application/json");

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers,
      credentials: "include",
    });
  } catch {
    throw new ApiError(
      "We couldn't reach the server. Check your connection and try again.",
      0,
    );
  }

  if (!res.ok) {
    let message = "Something went wrong. Please try again.";
    try {
      const body = await res.json();
      if (typeof body?.message === "string") message = body.message;
      else if (Array.isArray(body?.message)) message = body.message[0];
    } catch {
      /* keep the default */
    }
    throw new ApiError(message, res.status);
  }

  return res.json() as Promise<T>;
}

export function redeem(code: string) {
  return request<Session & { deviceToken?: string }>("/access/redeem", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

export function getSession() {
  return request<Session>("/access/session");
}

export function getCatalog() {
  return request<CatalogItem[]>("/access/catalog");
}

export function submitRecovery(input: {
  name: string;
  phone: string;
  email: string;
  codeHint?: string;
  reason?: string;
}) {
  return request<{ id: string; status: string }>("/recovery", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface OutlineEntry {
  title: string;
  page: number;
  children: OutlineEntry[];
}

export interface SearchHit {
  page: number;
  snippet: string;
  /** Offsets of the match within `snippet`, for highlighting. */
  from: number;
  to: number;
}

/** Pages and previews are authenticated, so they arrive as blobs, not URLs. */
async function fetchImage(
  path: string,
  signal?: AbortSignal,
): Promise<string> {
  const headers = new Headers();
  const token = getToken();
  if (token) headers.set("x-device-token", token);

  const res = await fetch(`${API_URL}${path}`, {
    headers,
    credentials: "include",
    signal,
  });
  if (!res.ok) throw new ApiError("Could not load this page.", res.status);
  return URL.createObjectURL(await res.blob());
}

/**
 * Fetch one watermarked page as a blob URL. Pages are authenticated, so they
 * can't be loaded through a plain <img src> pointing at the API.
 */
export function fetchPage(n: number, signal?: AbortSignal): Promise<string> {
  return fetchImage(`/access/page/${n}`, signal);
}

/**
 * Fetch a page-navigator preview — a fraction of the weight of a full page,
 * which matters when a guide runs to a hundred-odd pages.
 */
export function fetchThumb(n: number, signal?: AbortSignal): Promise<string> {
  return fetchImage(`/access/thumb/${n}`, signal);
}

/** The guide's table of contents; empty when the PDF carried no bookmarks. */
export function fetchOutline() {
  return request<OutlineEntry[]>("/access/outline");
}

/**
 * Search the guide's text. `searchable` is false for scanned guides, which
 * have no text layer to search at all.
 */
export function searchGuide(query: string, signal?: AbortSignal) {
  return requestSignal<{ searchable: boolean; hits: SearchHit[] }>(
    `/access/search?q=${encodeURIComponent(query)}`,
    signal,
  );
}

async function requestSignal<T>(path: string, signal?: AbortSignal): Promise<T> {
  const headers = new Headers();
  const token = getToken();
  if (token) headers.set("x-device-token", token);

  const res = await fetch(`${API_URL}${path}`, {
    headers,
    credentials: "include",
    signal,
  });
  if (!res.ok) throw new ApiError("Search is unavailable.", res.status);
  return res.json() as Promise<T>;
}
