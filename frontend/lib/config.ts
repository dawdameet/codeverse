/**
 * Runtime configuration.
 *
 * On event day set NEXT_PUBLIC_CODEVERSE_API_URL to the LAN address of the
 * Codeverse backend (e.g. http://codeverse.local or http://192.168.x.x:8080)
 * and NEXT_PUBLIC_CODEVERSE_API=http. Nothing here points at localhost.
 */
export const config = {
  apiMode: (process.env.NEXT_PUBLIC_CODEVERSE_API ?? "mock") as "mock" | "http",
  apiBaseUrl: process.env.NEXT_PUBLIC_CODEVERSE_API_URL ?? "",
  pollIntervalMs: 10_000,
} as const;
