import type { Request } from "express";

const localhostHosts = new Set(["localhost", "127.0.0.1", "::1"]);

const isPrivateOrLocalHost = (hostname: string): boolean =>
  localhostHosts.has(hostname) ||
  hostname.startsWith("192.168.") ||
  hostname.startsWith("10.") ||
  hostname.endsWith(".local");

const firstHeaderValue = (value: string | string[] | undefined): string | null => {
  if (!value) {
    return null;
  }

  const first = Array.isArray(value) ? value[0] : value.split(",")[0];
  const trimmed = first?.trim();
  return trimmed || null;
};

const requestOrigin = (request: Request): string | null => {
  const host = request.get("host")?.trim();
  if (!host) {
    return null;
  }

  const forwardedProto = firstHeaderValue(request.headers["x-forwarded-proto"]);
  const protocol = forwardedProto || request.protocol || "http";
  return `${protocol}://${host}`;
};

export const normalizeMediaUrl = (request: Request, value: string | null | undefined): string | null => {
  const bridged = normalizeApiUploadsBridgeUrl(value);
  if (bridged !== value) {
    return bridged;
  }

  if (!value) {
    return value ?? null;
  }

  const raw = value.trim();
  if (!raw) {
    return null;
  }

  if (!/^https?:\/\//i.test(raw)) {
    return raw;
  }

  try {
    const parsed = new URL(raw);
    const isLocalOrPrivate =
      isPrivateOrLocalHost(parsed.hostname) && parsed.pathname.startsWith("/uploads/");
    if (!isLocalOrPrivate) {
      return raw;
    }

    const origin = requestOrigin(request);
    if (!origin) {
      return raw;
    }

    return `${origin}${parsed.pathname}${parsed.search}`;
  } catch {
    return raw;
  }
};

export const normalizeApiUploadsBridgeUrl = (value: string | null | undefined): string | null => {
  if (!value) {
    return value ?? null;
  }

  const raw = value.trim();
  if (!raw) {
    return null;
  }

  if (raw.startsWith("/uploads/")) {
    return `/api${raw}`;
  }

  if (!/^https?:\/\//i.test(raw)) {
    return raw;
  }

  try {
    const parsed = new URL(raw);
    if (!parsed.pathname.startsWith("/uploads/") && !parsed.pathname.startsWith("/api/uploads/")) {
      return raw;
    }
    const path = parsed.pathname.startsWith("/api") ? parsed.pathname : `/api${parsed.pathname}`;
    return `${path}${parsed.search}`;
  } catch {
    return raw;
  }
};
