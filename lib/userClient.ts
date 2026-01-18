import { nanoid } from "nanoid";

export function getOrCreateUserId(): string {
  const key = "cv_user_id";
  const existing = localStorage.getItem(key);
  if (existing) return existing;

  const id = nanoid(12);
  localStorage.setItem(key, id);
  return id;
}
