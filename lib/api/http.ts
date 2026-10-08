import { config } from "../config";
import { getToken } from "../session";
import { ApiError, type CodeverseApi } from "./client";

/**
 * HTTP implementation for the Codeverse LAN backend.
 * Endpoint paths are a proposal — adjust to match the backend contract.
 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${config.apiBaseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      cache: "no-store",
    });
  } catch {
    throw new ApiError("UNREACHABLE", "Codeverse server unreachable on LAN");
  }
  if (res.status === 401) throw new ApiError("UNAUTHORIZED", "Not authorised");
  if (res.status === 404) throw new ApiError("NOT_FOUND", "Not found");
  if (!res.ok) throw new ApiError("SERVER_ERROR", `Server error ${res.status}`);
  return res.json() as Promise<T>;
}

export const httpApi: CodeverseApi = {
  login: (teamId, accessCode) =>
    request("/api/login", {
      method: "POST",
      body: JSON.stringify({ teamId, accessCode }),
    }),
  getParticipant: () => request("/api/me"),
  getStatus: () => request("/api/status"),
  getPhases: () => request("/api/phases"),
  getChallenges: () => request("/api/challenges"),
  getChallenge: (id) => request(`/api/challenges/${encodeURIComponent(id)}`),
  getBonusChallenge: () => request("/api/bonus"),
  getLeaderboard: () => request("/api/leaderboard"),
};
