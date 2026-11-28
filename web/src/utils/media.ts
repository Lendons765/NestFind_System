import { API_BASE } from "../config";

export function getMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url) || /^data:/i.test(url) || /^blob:/i.test(url)) {
    return url;
  }

  const path = url.startsWith("/") ? url : `/${url}`;
 if (path.startsWith("/uploads/")) {
    return `${API_BASE.replace(/\/$/, "")}${path}`;
  }

  return path;
}
