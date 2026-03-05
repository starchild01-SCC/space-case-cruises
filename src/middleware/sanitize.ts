import type { NextFunction, Request, Response } from "express";

/** Max length for any string value in body/query to prevent abuse. */
const MAX_STRING_LENGTH = 64 * 1024;

/**
 * Strip HTML tags and control characters from a string.
 * Reduces XSS and log injection risk from user-supplied input.
 */
function sanitizeString(value: string, maxLength: number = MAX_STRING_LENGTH): string {
  if (typeof value !== "string") {
    return value;
  }
  let out = value
    .replace(/\0/g, "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/<[^>]*>/g, "");
  if (out.length > maxLength) {
    out = out.slice(0, maxLength);
  }
  return out;
}

function sanitizeValue(value: unknown, maxLength: number): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === "string") {
    return sanitizeString(value, maxLength);
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, maxLength));
  }
  if (typeof value === "object" && value !== null) {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      result[sanitizeString(String(k), 256)] = sanitizeValue(v, maxLength);
    }
    return result;
  }
  return value;
}

/**
 * Middleware that recursively sanitizes string values in req.body and req.query
 * (strip control chars and HTML tags, cap length). Use after express.json().
 */
export const sanitizeInputs = (request: Request, _response: Response, next: NextFunction): void => {
  if (request.body && typeof request.body === "object") {
    request.body = sanitizeValue(request.body, MAX_STRING_LENGTH) as typeof request.body;
  }
  if (request.query && typeof request.query === "object" && Object.keys(request.query).length > 0) {
    request.query = sanitizeValue(request.query, 2048) as typeof request.query;
  }
  next();
};
