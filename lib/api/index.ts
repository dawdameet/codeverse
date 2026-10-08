import { config } from "../config";
import { httpApi } from "./http";
import { mockApi } from "./mock";

export { ApiError } from "./client";
export const api = config.apiMode === "http" ? httpApi : mockApi;
