import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  scenarios: {
    concurrent_reservations: {
      executor: "per-vu-iterations",
      vus: 50,
      iterations: 1,
      maxDuration: "30s",
    },
  },
};

export default function () {
  const url = __ENV.TARGET_URL || "http://localhost:3000/api/ai/chat";
  const token = __ENV.AUTH_BEARER_TOKEN || "mock-token";

  const payload = JSON.stringify({
    prompt: "Gera um sumário executivo da reunião de direção.",
    taskType: "general_chat",
    selectionMode: "auto",
  });

  const params = {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    timeout: "20s",
  };

  const res = http.post(url, payload, params);

  check(res, {
    "status is 200 or 429": (r) => r.status === 200 || r.status === 429,
    "no 500 server errors": (r) => r.status !== 500,
  });
}
