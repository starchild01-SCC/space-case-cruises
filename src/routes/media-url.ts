import type { Request } from "express";

const localhostHosts = new Set(["localhost", "127.0.0.1", "::1"]);

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
    if (!localhostHosts.has(parsed.hostname) || !parsed.pathname.startsWith("/uploads/")) {
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
    if (!parsed.pathname.startsWith("/uploads/")) {
      return raw;
    }

    return `/api${parsed.pathname}${parsed.search}`;
  } catch {
    return raw;
  }
};
