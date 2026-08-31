/** Client-side fetch wrapper that unwraps our `{ ok, data | error }` envelope. */
export async function apiFetch<T>(
  input: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.ok === false) {
    throw new Error(json?.error ?? `Request failed (${res.status})`);
  }
  return json.data as T;
}
