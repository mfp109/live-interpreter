export type User = {
  id: string;
  email: string;
  display_name: string | null;
  locale: string;
  role: string;
  email_verified_at: string;
};
export type Wallet = {
  trial_seconds: number;
  paid_seconds: number;
  reserved_seconds: number;
};
export type Product = {
  id: string;
  code: string;
  name_key: string;
  seconds_granted: number;
  price_minor: number;
  currency: string;
};

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
  csrf?: string,
): Promise<T> {
  const headers = new Headers(options.headers);
  let deviceId = localStorage.getItem("swli.device");
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem("swli.device", deviceId);
  }
  headers.set("X-Device-ID", deviceId);
  if (options.body) headers.set("Content-Type", "application/json");
  if (csrf) headers.set("X-CSRF-Token", csrf);
  const response = await fetch(`/api/${path}`, {
    ...options,
    headers,
    credentials: "same-origin",
  });
  const data = await response.json().catch(() => ({
    ok: false,
    error: { code: "INVALID_RESPONSE", message: "Invalid server response." },
  }));
  if (!response.ok || data.ok === false)
    throw new ApiError(
      data.error?.code || "REQUEST_FAILED",
      data.error?.message || "Request failed.",
      response.status,
    );
  return data as T;
}

export const formatTime = (seconds: number) =>
  `${Math.floor(seconds / 60).toLocaleString()}:${String(Math.max(0, seconds % 60)).padStart(2, "0")}`;
