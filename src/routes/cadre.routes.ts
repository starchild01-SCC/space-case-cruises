import { Router } from "express";
import { z } from "zod";
import { getUserBadges, listUsers } from "../data/repository.js";
import { requireAuth } from "../middleware/auth.js";
import { normalizeMediaUrl } from "./media-url.js";

const cadreQuerySchema = z.object({
  q: z.string().trim().optional(),
  sort: z.enum(["playa_name", "cadet_extension", "preferred_contact", "created_at"]).optional(),
  order: z.enum(["asc", "desc"]).optional(),
  page: z.coerce.number().int().positive().optional(),
  page_size: z.coerce.number().int().positive().max(200).optional(),
});

export const cadreRouter = Router();

cadreRouter.get("/cadre", requireAuth, async (request, response) => {
  const parsed = cadreQuerySchema.parse(request.query);
  const query = parsed.q?.toLowerCase();
  const sort = parsed.sort ?? "playa_name";
  const order = parsed.order ?? "asc";
  const page = parsed.page ?? 1;
  const pageSize = parsed.page_size ?? 25;

  const users = await listUsers();

  let filtered = users.filter((user) => {
    if (!query) {
      return true;
    }

    return (
      user.playaName.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query) ||
      (user.cadetExtension ?? "").toLowerCase().includes(query)
    );
  });

  filtered = filtered.sort((first, second) => {
    const firstValue =
      sort === "playa_name"
        ? first.playaName
        : sort === "cadet_extension"
          ? first.cadetExtension ?? ""
          : sort === "preferred_contact"
            ? first.preferredContact ?? ""
            : first.createdAt;

    const secondValue =
      sort === "playa_name"
        ? second.playaName
        : sort === "cadet_extension"
          ? second.cadetExtension ?? ""
          : sort === "preferred_contact"
            ? second.preferredContact ?? ""
            : second.createdAt;

    const comparison = firstValue.localeCompare(secondValue);
    return order === "asc" ? comparison : -comparison;
  });

  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const paged = filtered.slice(start, start + pageSize);
  const items = await Promise.all(paged.map(async (user) => ({
    id: user.id,
    email: user.email,
    avatar_url: normalizeMediaUrl(request, user.avatarUrl),
    playa_name: user.playaName,
    pronouns: user.pronouns,
    cadet_extension: user.cadetExtension,
    preferred_contact: user.preferredContact,
    phone_number: user.phoneNumber,
    badges: (await getUserBadges(user.id)).map((badge) => ({
      id: badge.id,
      icon_url: normalizeMediaUrl(request, badge.iconUrl),
      name: badge.name,
    })),
    role: user.role,
    is_disabled: user.isDisabled,
  })));

  response.json({
    items,
    page,
    page_size: pageSize,
    total,
  });
});
