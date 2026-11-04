"use client";

import { apiOrigin } from "@/lib/api/client";

/**
 * Profile photo (or initials fallback) rendered as a circle.
 * `avatarUrl` can be either:
 *   - A full CDN URL (e.g. "https://res.cloudinary.com/...") — used directly.
 *   - A server-relative path (e.g. "/uploads/avatars/<id>.png") — prefixed with API origin.
 */
export function Avatar({
  name,
  avatarUrl,
  size = 36,
  className = "",
}: {
  name: string | null | undefined;
  avatarUrl: string | null | undefined;
  size?: number;
  className?: string;
}) {
  const initials = (name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  if (avatarUrl) {
    const src = avatarUrl.startsWith("http")
      ? avatarUrl
      : `${apiOrigin()}${avatarUrl}`;
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name ?? "Profile photo"}
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className={`shrink-0 rounded-full object-cover ring-1 ring-slate-200 ${className}`}
      />
    );
  }
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
      className={`flex shrink-0 items-center justify-center rounded-full bg-indigo-100 font-semibold text-indigo-700 ${className}`}
    >
      {initials || "?"}
    </span>
  );
}
