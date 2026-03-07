import { extname, resolve } from "node:path";
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import multer from "multer";
import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../middleware/errors.js";
import {
  isSupabaseStorageEnabled,
  uploadToSupabaseStorage,
} from "../storage/supabase-storage.js";

const uploadTypeSchema = z.object({
  type: z.enum(["subgroup-tile", "subgroup-poster", "cruise-map", "cruise-special", "cadet-avatar"]),
  name: z.string().trim().min(1).max(120).optional(),
  ref: z.string().trim().min(1).max(80).optional(),
});

export const uploadsRootDir = resolve(process.cwd(), "uploads");

export const uploadSubdirectoryByType: Record<z.infer<typeof uploadTypeSchema>["type"], string> = {
  "subgroup-tile": "subgroups/tiles",
  "subgroup-poster": "subgroups/posters",
  "cruise-map": "cruises/maps",
  "cruise-special": "cruises/special",
  "cadet-avatar": "cadets/avatars",
};

const extraUploadDirectories = [
  "badges/icons",
  "collectables/products",
  "collectables/banners",
];

const toSlug = (value: string): string => {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "image";
};

const safeRef = (value: string | undefined): string | null => {
  if (!value) {
    return null;
  }
  const cleaned = value.trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24);
  return cleaned || null;
};

const imageSuffixByType: Record<z.infer<typeof uploadTypeSchema>["type"], string> = {
  "subgroup-tile": "tile",
  "subgroup-poster": "poster",
  "cruise-map": "map",
  "cruise-special": "special",
  "cadet-avatar": "avatar",
};

const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"]);

for (const dir of Object.values(uploadSubdirectoryByType)) {
  mkdirSync(resolve(uploadsRootDir, dir), { recursive: true });
}
for (const dir of extraUploadDirectories) {
  mkdirSync(resolve(uploadsRootDir, dir), { recursive: true });
}

const normalized = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, "");

const scoreNameMatch = (target: string, candidate: string): number => {
  if (!target || !candidate) {
    return 0;
  }

  if (target === candidate) {
    return 10_000;
  }

  let score = 0;
  if (candidate.includes(target)) {
    score += 700;
  }
  if (target.includes(candidate)) {
    score += 400;
  }

  const prefixLength = [...target].findIndex((char, index) => candidate[index] !== char);
  if (prefixLength > 0) {
    score += prefixLength * 8;
  }

  const targetTokens = target.split(/(?=[0-9])|-/).filter(Boolean);
  const candidateTokens = candidate.split(/(?=[0-9])|-/).filter(Boolean);
  for (const token of targetTokens) {
    if (candidateTokens.includes(token)) {
      score += 25;
    }
  }

  return score;
};

export const findClosestUploadFileUrl = (
  type: z.infer<typeof uploadTypeSchema>["type"],
  name: string | null | undefined,
): string | null => {
  if (!name?.trim()) {
    return null;
  }

  const target = normalized(toSlug(name));
  if (!target) {
    return null;
  }

  const subdir = uploadSubdirectoryByType[type];
  const absoluteDir = resolve(uploadsRootDir, subdir);

  let files: string[] = [];
  try {
    files = readdirSync(absoluteDir);
  } catch {
    return null;
  }

  let best: { fileName: string; score: number } | null = null;
  for (const fileName of files) {
    const extension = extname(fileName).toLowerCase();
    if (!imageExtensions.has(extension)) {
      continue;
    }

    const base = normalized(fileName.replace(extension, ""));
    const score = scoreNameMatch(target, base);
    if (!best || score > best.score) {
      best = { fileName, score };
    }
  }

  if (!best || best.score <= 0) {
    return null;
  }

  return `/uploads/${subdir}/${best.fileName}`;
};

/** Generate storage path and filename for an upload (same shape as before for compatibility). */
function getRelativePathAndFilename(
  parsed: z.infer<typeof uploadTypeSchema>,
  originalName: string,
): { relativePath: string; filename: string } {
  const extension = extname(originalName).toLowerCase() || ".jpg";
  const nameSlug = toSlug(parsed.name ?? parsed.type);
  const suffix = imageSuffixByType[parsed.type];
  const ref = safeRef(parsed.ref);
  const timestamp = Date.now();
  const parts = [nameSlug, suffix, ref, String(timestamp)].filter(Boolean);
  const filename = `${parts.join("--")}${extension}`;
  const subdir = uploadSubdirectoryByType[parsed.type];
  return { relativePath: `${subdir}/${filename}`, filename };
}

const memoryStorage = multer.memoryStorage();
const upload = multer({
  storage: memoryStorage,
  limits: {
    fileSize: 8 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_request, file, callback) => {
    if (!file.mimetype.startsWith("image/")) {
      callback(new HttpError(415, "UNSUPPORTED_MEDIA_TYPE", "Only image uploads are supported"));
      return;
    }
    callback(null, true);
  },
});

export const uploadsRouter = Router();

// Self-service avatar uploads (authenticated users).
// Keeping this **out** of `/admin/*` allows us to restrict all `/admin` routes to admins.
uploadsRouter.post(
  "/uploads/avatar",
  requireAuth,
  (request, _response, next) => {
    const parsed = uploadTypeSchema.safeParse(request.query);
    if (!parsed.success) {
      throw new HttpError(422, "VALIDATION_ERROR", "Invalid upload type", []);
    }

    if (parsed.data.type !== "cadet-avatar") {
      throw new HttpError(403, "FORBIDDEN", "Only avatar uploads are allowed on this endpoint");
    }

    next();
  },
  upload.single("image"),
  async (request, response) => {
    const parsed = uploadTypeSchema.parse(request.query);

    if (!request.file || !request.file.buffer) {
      throw new HttpError(400, "VALIDATION_ERROR", "Missing image file");
    }

    const { relativePath, filename } = getRelativePathAndFilename(
      parsed,
      request.file.originalname || "image.jpg",
    );

    let url: string;
    if (isSupabaseStorageEnabled()) {
      const result = await uploadToSupabaseStorage(
        relativePath,
        request.file.buffer,
        request.file.mimetype,
      );
      url = result.publicUrl;
    } else {
      const absolutePath = resolve(uploadsRootDir, relativePath);
      mkdirSync(resolve(uploadsRootDir, uploadSubdirectoryByType[parsed.type]), { recursive: true });
      writeFileSync(absolutePath, request.file.buffer);
      url = `/api/uploads/${relativePath}`;
    }

    response.status(201).json({
      type: parsed.type,
      file_name: filename,
      relative_path: relativePath,
      url,
    });
  },
);

uploadsRouter.post(
  "/admin/uploads",
  requireAuth,
  (request, _response, next) => {
    const parsed = uploadTypeSchema.safeParse(request.query);
    if (!parsed.success) {
      throw new HttpError(422, "VALIDATION_ERROR", "Invalid upload type", []);
    }

    const isAdmin = request.authUser?.role === "admin";
    const isAllowedSelfServiceType = parsed.data.type === "cadet-avatar";
    if (!isAdmin && !isAllowedSelfServiceType) {
      throw new HttpError(403, "FORBIDDEN", "Only admins can upload this image type");
    }

    next();
  },
  upload.single("image"),
  async (request, response) => {
    const parsed = uploadTypeSchema.parse(request.query);

    if (!request.file || !request.file.buffer) {
      throw new HttpError(400, "VALIDATION_ERROR", "Missing image file");
    }

    const { relativePath, filename } = getRelativePathAndFilename(
      parsed,
      request.file.originalname || "image.jpg",
    );

    let url: string;
    if (isSupabaseStorageEnabled()) {
      const result = await uploadToSupabaseStorage(
        relativePath,
        request.file.buffer,
        request.file.mimetype,
      );
      url = result.publicUrl;
    } else {
      mkdirSync(resolve(uploadsRootDir, uploadSubdirectoryByType[parsed.type]), { recursive: true });
      writeFileSync(resolve(uploadsRootDir, relativePath), request.file.buffer);
      url = `/api/uploads/${relativePath}`;
    }

    response.status(201).json({
      type: parsed.type,
      file_name: filename,
      relative_path: relativePath,
      url,
    });
  },
);
