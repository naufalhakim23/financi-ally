export type HealthStatus = {
  status: string;
  db: "up" | "down";
};

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8080";

export async function getHealth(signal?: AbortSignal): Promise<HealthStatus> {
  const res = await fetch(`${BASE_URL}/healthz`, { signal });
  if (!res.ok) throw new Error(`healthz ${res.status}`);
  return (await res.json()) as HealthStatus;
}
