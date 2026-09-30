import { parseReviewResult, type ReviewProvider, type ReviewRequest } from "./review";
import type { CandidateRevision, RevisionProvider, RevisionRequest } from "./revision";

async function postJson<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new Error("真实模式服务端不可达；请检查 /api 代理，或切回 Mock 模式继续演示");
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string" ? payload.error : `服务端返回 HTTP ${response.status}`;
    throw new Error(`${message}；原稿未被修改`);
  }
  return payload as T;
}

export const liveReviewProvider: ReviewProvider = {
  async review(request: ReviewRequest, signal) {
    return parseReviewResult(await postJson("/api/review", request, signal));
  },
};

export const liveRevisionProvider: RevisionProvider = {
  async generateRevision(request: RevisionRequest, signal) {
    const result = await postJson<CandidateRevision>("/api/revision", request, signal);
    if (!result || result.provider !== "live" || !Array.isArray(result.layers) || !Array.isArray(result.changes)) throw new Error("真实生成响应结构无效；原稿未被修改");
    return result;
  },
};
