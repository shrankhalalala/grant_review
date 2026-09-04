import { config } from "../config";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface ApiRequestOptions extends Omit<RequestInit, "body" | "headers"> {
  body?: unknown;
  headers?: HeadersInit;
  token?: string | null;
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { body, headers, token, ...requestOptions } = options;
  const requestHeaders = new Headers(headers);
  requestHeaders.set("Accept", "application/json");
  if (body !== undefined) requestHeaders.set("Content-Type", "application/json");
  if (token) requestHeaders.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${config.apiBaseUrl}${path.startsWith("/") ? path : `/${path}`}`, {
    ...requestOptions,
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const contentType = response.headers.get("content-type") ?? "";
  const text = response.status === 204 ? "" : await response.text();
  const payload: unknown = text && contentType.includes("application/json")
    ? (() => { try { return JSON.parse(text); } catch { return undefined; } })()
    : undefined;

  if (!response.ok) {
    const message = payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string"
      ? payload.message
      : text || `Request failed with status ${response.status}.`;
    throw new ApiError(response.status, message);
  }
  return payload as T;
}

export async function apiBlobRequest(path: string, options: Omit<ApiRequestOptions, "body"> = {}) {
  const { headers, token, ...requestOptions } = options;
  const requestHeaders = new Headers(headers);
  if (token) requestHeaders.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${config.apiBaseUrl}${path.startsWith("/") ? path : `/${path}`}`, { ...requestOptions, headers: requestHeaders });
  if (!response.ok) {
    const text = await response.text();
    try { const payload = JSON.parse(text) as { message?: string }; throw new ApiError(response.status, payload.message ?? text); }
    catch (error) { if (error instanceof ApiError) throw error; throw new ApiError(response.status, text || `Request failed with status ${response.status}.`); }
  }
  return { blob: await response.blob(), contentDisposition: response.headers.get("content-disposition") };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = url; link.download = filename; link.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}
