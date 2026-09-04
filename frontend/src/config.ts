const fallbackApiBaseUrl = "http://localhost:4000";

export function readApiBaseUrl(value = import.meta.env.VITE_API_BASE_URL, isDevelopment = import.meta.env.DEV) {
  if (!value?.trim() && !isDevelopment) {
    throw new Error("VITE_API_BASE_URL must be configured for production builds.");
  }
  const configuredValue = value?.trim() || fallbackApiBaseUrl;
  let url: URL;
  try {
    url = new URL(configuredValue);
  } catch {
    throw new Error("VITE_API_BASE_URL must be a valid absolute HTTP URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("VITE_API_BASE_URL must use HTTP or HTTPS.");
  }
  return url.toString().replace(/\/$/, "");
}

export const config = { apiBaseUrl: readApiBaseUrl() };
