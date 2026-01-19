export async function ensureSession() {
  const res = await fetch("/api/session", {
    method: "POST",
    credentials: "include", // ✅ ensure cookie is sent/received
    cache: "no-store", // ✅ avoid any weird caching
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || "Failed to start session");
  }

  return res.json().catch(() => ({}));
}
