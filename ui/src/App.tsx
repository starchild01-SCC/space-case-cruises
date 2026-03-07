import { useEffect, useMemo, useRef, useState } from "react";
import {
  signInWithEmail,
  signUpWithEmail,
  signInWithGoogle,
  signOutUser,
  onAuthChange,
  getIdToken,
} from "./firebase";

// Used only for local development when the API is running in `header-sim` mode.
type Identity = "admin" | "cadet";

interface ApiState {
  authMode: string;
  session: unknown;
  profile: unknown;
  cadre: unknown;
  cruises: unknown;
  subgroups: unknown;
  cruiseSubgroups: unknown;
  error: string | null;
}

interface CruiseItem {
  id: string;
  name: string;
  year: number;
  location: string | null;
  starts_on: string | null;
  ends_on: string | null;
  map_image_url: string | null;
  special_page_image_url: string | null;
  special_page_image_source?: "saved" | "fallback" | "none";
  casting_cost: number | null;
  casting_cost_url: string | null;
  status: "active" | "archived";
  is_featured: boolean;
  sort_order: number;
}

interface SubgroupItem {
  id: string;
  name: string;
  slug: string;
  code: string;
  default_description: string | null;
  default_tile_image_url: string | null;
  extension: string | null;
  default_cost_level: number;
}

interface CruiseSubgroupItem {
  id: string;
  cruise_id: string;
  subgroup_id: string;
  subgroup: { id: string; name: string } | null;
  override_name: string | null;
  override_description: string | null;
  detail_image_url: string | null;
  cost_level_override: number | null;
  visibility_state: "invisible" | "inactive" | "active";
  dock_visible: boolean;
  map_x: number | null;
  map_y: number | null;
  map_scale: number;
}

interface CommittedCadetItem {
  id: string;
  playa_name: string;
  pronouns: "they_them" | "he_him" | "she_her" | "any_all" | null;
  cadet_extension: string | null;
  preferred_contact: "discord" | "text" | "phone" | "email" | null;
  phone_number: string | null;
}

interface CruiseSubgroupDetailItem {
  id: string;
  commitment_count: number;
  committed_cadets: CommittedCadetItem[];
}

interface ProfileCommitmentItem {
  cruise_subgroup_id: string;
  subgroup: {
    id: string;
    name: string;
    extension: string | null;
  } | null;
  status: "committed" | "withdrawn" | "completed";
}

interface ProfileCommitmentsByCruiseItem {
  cruise: {
    id: string;
    name: string;
    year: number;
    status: "active" | "archived";
  };
  items: ProfileCommitmentItem[];
}

interface EditableCruise {
  name: string;
  year: string;
  location: string;
  starts_on: string;
  ends_on: string;
  map_image_url: string;
  special_page_image_url: string;
  casting_cost: string;
  casting_cost_url: string;
  status: "active" | "archived";
  is_featured: boolean;
  sort_order: string;
}

interface EditableSubgroup {
  name: string;
  default_description: string;
  default_tile_image_url: string;
  extension: string;
  default_cost_level: string;
}

interface EditableCruiseSubgroup {
  override_name: string;
  override_description: string;
  detail_image_url: string;
  cost_level_override: string;
  visibility_state: "invisible" | "inactive" | "active";
  dock_visible: boolean;
  map_x: string;
  map_y: string;
  map_scale: string;
}

type UploadKind =
  | "subgroup-tile"
  | "subgroup-poster"
  | "cruise-map"
  | "cruise-special"
  | "cadet-avatar";

type GeneratedPageView =
  | { kind: "home" }
  | { kind: "cruise"; cruiseId: string }
  | { kind: "subgroup"; cruiseId: string; subgroupId: string };

type MainView = "home" | "profile" | "cadre" | "collectables" | "admin";

interface ProfileItem {
  id: string;
  email: string;
  avatar_url: string | null;
  phone_number: string | null;
  preferred_contact: "discord" | "text" | "phone" | "email" | null;
  pronouns: "they_them" | "he_him" | "she_her" | "any_all" | null;
  playa_name: string;
  role: "user" | "admin";
  cadet_extension: string | null;
}

interface CadreBadge {
  id: string;
  icon_url: string | null;
  name: string;
}

interface CadreItem {
  id: string;
  email: string;
  avatar_url: string | null;
  playa_name: string;
  pronouns: "they_them" | "he_him" | "she_her" | "any_all" | null;
  cadet_extension: string | null;
  preferred_contact: "discord" | "text" | "phone" | "email" | null;
  phone_number: string | null;
  badges: CadreBadge[];
  role: "user" | "admin";
  is_disabled: boolean;
}

interface EditableProfile {
  avatar_url: string;
  phone_number: string;
  preferred_contact: "discord" | "text" | "phone" | "email" | "";
  pronouns: "they_them" | "he_him" | "she_her" | "any_all" | "";
  playa_name: string;
}

interface EditableCadetAdmin {
  avatar_url: string;
  phone_number: string;
  preferred_contact: "discord" | "text" | "phone" | "email" | "";
  pronouns: "they_them" | "he_him" | "she_her" | "any_all" | "";
  playa_name: string;
  cadet_extension: string;
  is_disabled: boolean;
}

const RAW_API_BASE =
  import.meta.env.VITE_API_BASE_URL?.toString().trim() ||
  (typeof window !== "undefined" ? window.location.origin : "");

const normalizedApiBase = RAW_API_BASE.replace(/\/+$/, "");
const apiPrefix = (() => {
  if (normalizedApiBase.endsWith("/api/v1")) {
    return normalizedApiBase;
  }

  if (normalizedApiBase.endsWith("/api")) {
    return `${normalizedApiBase}/v1`;
  }

  return `${normalizedApiBase}/api/v1`;
})();

const basePath = (() => {
  if (normalizedApiBase.startsWith("/")) {
    return normalizedApiBase || "/";
  }

  if (/^https?:\/\//i.test(normalizedApiBase)) {
    try {
      const path = new URL(normalizedApiBase).pathname.replace(/\/+$/, "");
      return path || "/";
    } catch {
      return null;
    }
  }

  return null;
})();

const apiBaseWarning =
  basePath === null
    ? "VITE_API_BASE_URL must be an absolute URL (or start with /)."
    : basePath === "/" || basePath === "/api" || basePath === "/api/v1"
      ? null
      : `VITE_API_BASE_URL includes path '${basePath}'. Use host root or /api/v1.`;

const apiPath = (path: string): string => `${apiPrefix}${path.startsWith("/") ? path : `/${path}`}`;

const apiOrigin = (() => {
  if (/^https?:\/\//i.test(apiPrefix)) {
    try {
      return new URL(apiPrefix).origin;
    } catch {
      return "";
    }
  }

  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return "";
})();

const apiBridgePathPrefix = (() => {
  if (apiPrefix.startsWith("/")) {
    return apiPrefix.replace(/\/v1$/, "");
  }

  if (/^https?:\/\//i.test(apiPrefix)) {
    try {
      return new URL(apiPrefix).pathname.replace(/\/v1$/, "") || "/api";
    } catch {
      return "/api";
    }
  }

  return "/api";
})();

const resolveMediaUrl = (value: string | null | undefined): string => {
  if (!value || !value.trim()) {
    return "";
  }

  const raw = value.trim();
  if (/^https?:\/\//i.test(raw)) {
    try {
      const parsed = new URL(raw);
      const isLocalhostHost =
        parsed.hostname === "localhost" ||
        parsed.hostname === "127.0.0.1" ||
        parsed.hostname === "::1";
      const isPrivateHost =
        parsed.hostname.startsWith("192.168.") ||
        parsed.hostname.startsWith("10.") ||
        parsed.hostname.endsWith(".local");

      if (
        apiOrigin &&
        (isLocalhostHost || isPrivateHost) &&
        (parsed.pathname.startsWith("/uploads/") || parsed.pathname.startsWith("/api/uploads/"))
      ) {
        const path = parsed.pathname.startsWith("/api") ? parsed.pathname : `/api${parsed.pathname}`;
        return `${apiOrigin}${path}${parsed.search}`;
      }

      if (
        import.meta.env.DEV &&
        apiOrigin &&
        parsed.origin === apiOrigin &&
        parsed.pathname.startsWith("/uploads/")
      ) {
        return `${parsed.pathname}${parsed.search}`;
      }
      return raw;
    } catch {
      return raw;
    }
  }

  if (raw.startsWith("data:")) {
    return raw;
  }

  if (raw.startsWith("/")) {
    if (raw.startsWith("/uploads/")) {
      return apiOrigin ? `${apiOrigin}${apiBridgePathPrefix}${raw}` : `${apiBridgePathPrefix}${raw}`;
    }

    return apiOrigin ? `${apiOrigin}${raw}` : raw;
  }

  return apiOrigin ? `${apiOrigin}/${raw.replace(/^\/+/, "")}` : raw;
};

/**
 * Format a cruise date string to a human-readable format.
 * Uses only the date part (YYYY-MM-DD) and formats from the raw string so the
 * browser never applies timezone conversion. Shows the exact calendar date from the database.
 * @param dateString ISO date string, YYYY-MM-DD, or null
 * @returns Formatted date like 'Aug 24, 2026' or 'TBD' if null/invalid
 */
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const formatCruiseDate = (dateString: string | null): string => {
  if (!dateString) return "TBD";

  const raw = dateString.trim();
  const dateOnly = raw.includes("T") ? raw.split("T")[0] : raw;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOnly);
  if (!match) return "TBD";

  const [, y, m, d] = match;
  const year = parseInt(y!, 10);
  const month = parseInt(m!, 10);
  const day = parseInt(d!, 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return "TBD";

  return `${MONTH_NAMES[month - 1]} ${day}, ${year}`;
};

// Used only in header-sim auth mode during local development, to simulate different users.
const IDENTITY_EMAIL: Record<Identity, string> = {
  admin: "chancellor-dev@example.test",
  cadet: "cadet-dev@example.test",
};

const parseCruises = (payload: unknown): CruiseItem[] => {
  const items = (payload as { items?: unknown[] } | null)?.items;
  if (!Array.isArray(items)) {
    return [];
  }

  return items.filter((item): item is CruiseItem => {
    const cruise = item as Partial<CruiseItem>;
    return typeof cruise?.id === "string" && typeof cruise?.name === "string";
  });
};

const parseSubgroups = (payload: unknown): SubgroupItem[] => {
  const items = (payload as { items?: unknown[] } | null)?.items;
  if (!Array.isArray(items)) {
    return [];
  }

  return items.filter((item): item is SubgroupItem => {
    const subgroup = item as Partial<SubgroupItem>;
    return typeof subgroup?.id === "string" && typeof subgroup?.name === "string";
  });
};

const parseCruiseSubgroups = (payload: unknown): CruiseSubgroupItem[] => {
  const items = (payload as { items?: unknown[] } | null)?.items;
  if (!Array.isArray(items)) {
    return [];
  }

  return items.filter((item): item is CruiseSubgroupItem => {
    const cruiseSubgroup = item as Partial<CruiseSubgroupItem>;
    return typeof cruiseSubgroup?.id === "string" && typeof cruiseSubgroup?.cruise_id === "string";
  });
};

const parseCruiseSubgroupDetail = (payload: unknown): CruiseSubgroupDetailItem | null => {
  const detail = payload as Partial<CruiseSubgroupDetailItem> | null;
  if (!detail || typeof detail.id !== "string") {
    return null;
  }

  const committedCadetsRaw = (detail as { committed_cadets?: unknown[] }).committed_cadets;
  const committedCadets = Array.isArray(committedCadetsRaw)
    ? committedCadetsRaw.filter((item): item is CommittedCadetItem => {
        const cadet = item as Partial<CommittedCadetItem>;
        return typeof cadet?.id === "string" && typeof cadet?.playa_name === "string";
      })
    : [];

  return {
    id: detail.id,
    commitment_count:
      typeof detail.commitment_count === "number"
        ? detail.commitment_count
        : committedCadets.length,
    committed_cadets: committedCadets,
  };
};

const parseProfileCommitmentsByCruise = (payload: unknown): ProfileCommitmentsByCruiseItem[] => {
  const items = (payload as { commitments_by_cruise?: unknown[] } | null)?.commitments_by_cruise;
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((entry) => {
      const candidate = entry as {
        cruise?: {
          id?: unknown;
          name?: unknown;
          year?: unknown;
          status?: unknown;
        };
        items?: unknown[];
      };

      if (
        typeof candidate.cruise?.id !== "string" ||
        typeof candidate.cruise?.name !== "string" ||
        typeof candidate.cruise?.year !== "number" ||
        (candidate.cruise?.status !== "active" && candidate.cruise?.status !== "archived")
      ) {
        return null;
      }

      const commitmentItems = Array.isArray(candidate.items)
        ? candidate.items
            .map((item) => {
              const commitment = item as {
                cruise_subgroup_id?: unknown;
                subgroup?: {
                  id?: unknown;
                  name?: unknown;
                  extension?: unknown;
                } | null;
                status?: unknown;
              };

              if (
                typeof commitment.cruise_subgroup_id !== "string" ||
                (commitment.status !== "committed" &&
                  commitment.status !== "withdrawn" &&
                  commitment.status !== "completed")
              ) {
                return null;
              }

              const subgroup =
                commitment.subgroup &&
                typeof commitment.subgroup.id === "string" &&
                typeof commitment.subgroup.name === "string"
                  ? {
                      id: commitment.subgroup.id,
                      name: commitment.subgroup.name,
                      extension:
                        typeof commitment.subgroup.extension === "string"
                          ? commitment.subgroup.extension
                          : null,
                    }
                  : null;

              return {
                cruise_subgroup_id: commitment.cruise_subgroup_id,
                subgroup,
                status: commitment.status,
              } as ProfileCommitmentItem;
            })
            .filter((item): item is ProfileCommitmentItem => item !== null)
        : [];

      return {
        cruise: {
          id: candidate.cruise.id,
          name: candidate.cruise.name,
          year: candidate.cruise.year,
          status: candidate.cruise.status,
        },
        items: commitmentItems,
      } as ProfileCommitmentsByCruiseItem;
    })
    .filter((entry): entry is ProfileCommitmentsByCruiseItem => entry !== null);
};

const parseProfile = (payload: unknown): ProfileItem | null => {
  const profile = payload as Partial<ProfileItem> | null;
  if (!profile || typeof profile.id !== "string" || typeof profile.email !== "string") {
    return null;
  }
  return profile as ProfileItem;
};

const parseCadre = (payload: unknown): CadreItem[] => {
  const items = (payload as { items?: unknown[] } | null)?.items;
  if (!Array.isArray(items)) {
    return [];
  }

  return items.filter((item): item is CadreItem => {
    const cadet = item as Partial<CadreItem>;
    return (
      typeof cadet?.id === "string" &&
      typeof cadet?.playa_name === "string" &&
      typeof cadet?.email === "string"
    );
  });
};

const toEditableProfile = (profile: ProfileItem): EditableProfile => ({
  avatar_url: profile.avatar_url ?? "",
  phone_number: profile.phone_number ?? "",
  preferred_contact: profile.preferred_contact ?? "",
  pronouns: profile.pronouns ?? "",
  playa_name: profile.playa_name,
});

const toEditableCadetAdmin = (cadet: CadreItem): EditableCadetAdmin => ({
  avatar_url: cadet.avatar_url ?? "",
  phone_number: cadet.phone_number ?? "",
  preferred_contact: cadet.preferred_contact ?? "",
  pronouns: cadet.pronouns ?? "",
  playa_name: cadet.playa_name,
  cadet_extension: cadet.cadet_extension ?? "",
  is_disabled: cadet.is_disabled,
});

const labelPronouns = (value: CadreItem["pronouns"] | EditableProfile["pronouns"]): string => {
  if (value === "they_them") return "they/them";
  if (value === "he_him") return "he/him";
  if (value === "she_her") return "she/her";
  if (value === "any_all") return "any/all";
  return "n/a";
};

const toEditableCruise = (cruise: CruiseItem): EditableCruise => ({
  name: cruise.name,
  year: String(cruise.year),
  location: cruise.location ?? "",
  starts_on: cruise.starts_on ? cruise.starts_on.split("T")[0] : "",
  ends_on: cruise.ends_on ? cruise.ends_on.split("T")[0] : "",
  map_image_url: cruise.map_image_url ?? "",
  special_page_image_url: cruise.special_page_image_url ?? "",
  casting_cost: cruise.casting_cost === null ? "" : String(cruise.casting_cost),
  casting_cost_url: cruise.casting_cost_url ?? "",
  status: cruise.status,
  is_featured: cruise.is_featured,
  sort_order: String(cruise.sort_order),
});

const toEditableSubgroup = (subgroup: SubgroupItem): EditableSubgroup => ({
  name: subgroup.name,
  default_description: subgroup.default_description ?? "",
  default_tile_image_url: subgroup.default_tile_image_url ?? "",
  extension: subgroup.extension ?? "",
  default_cost_level: String(subgroup.default_cost_level),
});

const toEditableCruiseSubgroup = (item: CruiseSubgroupItem): EditableCruiseSubgroup => ({
  override_name: item.override_name ?? "",
  override_description: item.override_description ?? "",
  detail_image_url: item.detail_image_url ?? "",
  cost_level_override: item.cost_level_override === null ? "" : String(item.cost_level_override),
  visibility_state: item.visibility_state,
  dock_visible: item.dock_visible,
  map_x: item.map_x === null ? "" : String(item.map_x),
  map_y: item.map_y === null ? "" : String(item.map_y),
  map_scale: String(item.map_scale),
});

const emptyCruiseDraft = (): EditableCruise => ({
  name: "",
  year: "2026",
  location: "",
  starts_on: "",
  ends_on: "",
  map_image_url: "",
  special_page_image_url: "",
  casting_cost: "",
  casting_cost_url: "",
  status: "active",
  is_featured: false,
  sort_order: "0",
});

const emptySubgroupDraft = (): EditableSubgroup => ({
  name: "",
  default_description: "",
  default_tile_image_url: "",
  extension: "",
  default_cost_level: "0",
});

const emptyCruiseDependencyDraft = (): EditableCruiseSubgroup => ({
  override_name: "",
  override_description: "",
  detail_image_url: "",
  cost_level_override: "",
  visibility_state: "inactive",
  dock_visible: true,
  map_x: "",
  map_y: "",
  map_scale: "1",
});

const parseNullableNumber = (value: string): number | null => {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const dockVisibleForVisibilityState = (value: "invisible" | "inactive" | "active"): boolean =>
  value === "inactive";

const slugFromName = (name: string): string => {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return slug || "subgroup";
};

const uniqueSlugFromName = (name: string, existingSlugs: Set<string>): string => {
  const base = slugFromName(name);
  if (!existingSlugs.has(base)) {
    return base;
  }

  let index = 2;
  let candidate = `${base}-${index}`;
  while (existingSlugs.has(candidate)) {
    index += 1;
    candidate = `${base}-${index}`;
  }

  return candidate;
};

const codeFromName = (name: string): string => {
  const code = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");

  return code || "SUBGROUP";
};

const uniqueCodeFromName = (name: string, existingCodes: Set<string>): string => {
  const base = codeFromName(name);
  if (!existingCodes.has(base)) {
    return base;
  }

  let index = 2;
  let candidate = `${base}_${index}`;
  while (existingCodes.has(candidate)) {
    index += 1;
    candidate = `${base}_${index}`;
  }

  return candidate;
};

const validateCruiseDraft = (draft: EditableCruise): string | null => {
  if (!draft.name.trim()) {
    return "Name is required.";
  }

  const year = Number.parseInt(draft.year, 10);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return "Year must be 2000-2100.";
  }

  const sortOrder = Number.parseInt(draft.sort_order, 10);
  if (!Number.isInteger(sortOrder)) {
    return "Sort must be an integer.";
  }

  return null;
};

const validateSubgroupDraft = (draft: EditableSubgroup): string | null => {
  if (!draft.name.trim()) {
    return "Name is required.";
  }

  if (draft.extension.trim().length > 20) {
    return "Phone extension max length is 20.";
  }

  const difficulty = Number.parseInt(draft.default_cost_level, 10);
  if (!Number.isInteger(difficulty) || difficulty < 0 || difficulty > 8) {
    return "Challenge must be 0-8.";
  }

  return null;
};

const validateCruiseSubgroupDraft = (
  draft: EditableCruiseSubgroup,
  options?: { requireCruiseId?: boolean; requireSubgroupId?: boolean; cruiseId?: string; subgroupId?: string },
): string | null => {
  if (options?.requireCruiseId && !options.cruiseId) {
    return "Cruise is required.";
  }

  if (options?.requireSubgroupId && !options.subgroupId) {
    return "Subgroup is required.";
  }

  const difficultyOverride = parseNullableNumber(draft.cost_level_override);
  if (Number.isNaN(difficultyOverride)) {
    return "Challenge override must be a number.";
  }
  if (difficultyOverride !== null && (difficultyOverride < 0 || difficultyOverride > 8)) {
    return "Challenge override must be 0-8.";
  }

  const mapX = parseNullableNumber(draft.map_x);
  const mapY = parseNullableNumber(draft.map_y);
  const mapScale = parseNullableNumber(draft.map_scale);

  if (Number.isNaN(mapX) || (mapX !== null && (mapX < 0 || mapX > 100))) {
    return "Map X must be 0-100.";
  }

  if (Number.isNaN(mapY) || (mapY !== null && (mapY < 0 || mapY > 100))) {
    return "Map Y must be 0-100.";
  }

  if (Number.isNaN(mapScale) || mapScale === null || mapScale <= 0) {
    return "Map scale must be > 0.";
  }

  return null;
};

const buildAppHash = (mainView: MainView, generatedPage: GeneratedPageView): string => {
  if (mainView !== "home") {
    return `#${mainView}`;
  }

  if (generatedPage.kind === "cruise") {
    return `#cruise/${encodeURIComponent(generatedPage.cruiseId)}`;
  }

  if (generatedPage.kind === "subgroup") {
    return `#subgroup/${encodeURIComponent(generatedPage.cruiseId)}/${encodeURIComponent(
      generatedPage.subgroupId,
    )}`;
  }

  return "#home";
};

const parseAppHash = (hash: string): { mainView: MainView; generatedPage: GeneratedPageView } => {
  const normalized = hash.replace(/^#/, "").trim();

  if (!normalized || normalized === "home") {
    return { mainView: "home", generatedPage: { kind: "home" } };
  }

  if (
    normalized === "profile" ||
    normalized === "cadre" ||
    normalized === "collectables" ||
    normalized === "admin"
  ) {
    return {
      mainView: normalized,
      generatedPage: { kind: "home" },
    };
  }

  const cruiseMatch = normalized.match(/^cruise\/([^/]+)$/);
  if (cruiseMatch?.[1]) {
    return {
      mainView: "home",
      generatedPage: { kind: "cruise", cruiseId: decodeURIComponent(cruiseMatch[1]) },
    };
  }

  const subgroupMatch = normalized.match(/^subgroup\/([^/]+)\/([^/]+)$/);
  if (subgroupMatch?.[1] && subgroupMatch?.[2]) {
    return {
      mainView: "home",
      generatedPage: {
        kind: "subgroup",
        cruiseId: decodeURIComponent(subgroupMatch[1]),
        subgroupId: decodeURIComponent(subgroupMatch[2]),
      },
    };
  }

  return { mainView: "home", generatedPage: { kind: "home" } };
};

function App() {
  const [identity, setIdentity] = useState<Identity>("cadet");
  const [mainView, setMainView] = useState<MainView>("home");
  const [adminMessage, setAdminMessage] = useState<string | null>(null);
  const [creatingBackup, setCreatingBackup] = useState<boolean>(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState<boolean>(false);
  const [authEmail, setAuthEmail] = useState<string>("");
  const [authPassword, setAuthPassword] = useState<string>("");
  const [authActionMessage, setAuthActionMessage] = useState<string | null>(null);
  const [showRegistrationBox, setShowRegistrationBox] = useState<boolean>(false);
  const [firebaseToken, setFirebaseToken] = useState<string | null>(null);

  const [editingCruises, setEditingCruises] = useState<Record<string, EditableCruise>>({});
  const [savingCruiseId, setSavingCruiseId] = useState<string | null>(null);
  const [newCruise, setNewCruise] = useState<EditableCruise>(emptyCruiseDraft());
  const [creatingCruise, setCreatingCruise] = useState<boolean>(false);

  const [editingSubgroups, setEditingSubgroups] = useState<Record<string, EditableSubgroup>>({});
  const [savingSubgroupId, setSavingSubgroupId] = useState<string | null>(null);
  const [newSubgroup, setNewSubgroup] = useState<EditableSubgroup>(emptySubgroupDraft());
  const [newSubgroupCruiseId, setNewSubgroupCruiseId] = useState<string>("");
  const [newSubgroupPosterUrl, setNewSubgroupPosterUrl] = useState<string>("");
  const [creatingSubgroup, setCreatingSubgroup] = useState<boolean>(false);
  const [generatedPage, setGeneratedPage] = useState<GeneratedPageView>({ kind: "home" });
  const [selectedCruiseDependencyId, setSelectedCruiseDependencyId] = useState<string>("");
  const [showCruiseMapEditor, setShowCruiseMapEditor] = useState<boolean>(false);
  const [subgroupCruiseSelection, setSubgroupCruiseSelection] = useState<Record<string, string>>({});
  const [editingSubgroupCruiseDependencies, setEditingSubgroupCruiseDependencies] = useState<
    Record<string, EditableCruiseSubgroup>
  >({});
  const [editingCruiseDependencies, setEditingCruiseDependencies] = useState<
    Record<string, EditableCruiseSubgroup>
  >({});
  const [cruiseSubgroupDetails, setCruiseSubgroupDetails] = useState<
    Record<string, CruiseSubgroupDetailItem>
  >({});
  const [loadingCruiseSubgroupDetailId, setLoadingCruiseSubgroupDetailId] = useState<string | null>(
    null,
  );
  const [togglingCommitmentCruiseSubgroupId, setTogglingCommitmentCruiseSubgroupId] = useState<
    string | null
  >(null);
  const [subgroupCommitmentError, setSubgroupCommitmentError] = useState<string | null>(null);
  const [subgroupCommitmentMessage, setSubgroupCommitmentMessage] = useState<string | null>(null);
  const [profileCommitmentsByCruise, setProfileCommitmentsByCruise] = useState<
    ProfileCommitmentsByCruiseItem[]
  >([]);
  const [loadingProfileCommitments, setLoadingProfileCommitments] = useState<boolean>(false);
  const [profileCommitmentsError, setProfileCommitmentsError] = useState<string | null>(null);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const mapCanvasRef = useRef<HTMLDivElement | null>(null);
  const hasInitializedHistoryRef = useRef<boolean>(false);
  const isApplyingHistoryRef = useRef<boolean>(false);
  const [profileDraft, setProfileDraft] = useState<EditableProfile>({
    avatar_url: "",
    phone_number: "",
    preferred_contact: "",
    pronouns: "",
    playa_name: "",
  });
  const [editingCadets, setEditingCadets] = useState<Record<string, EditableCadetAdmin>>({});
  const [savingCadetId, setSavingCadetId] = useState<string | null>(null);
  const [removingCruiseSubgroupId, setRemovingCruiseSubgroupId] = useState<string | null>(null);
  const [savingCruiseSubgroupAssignmentId, setSavingCruiseSubgroupAssignmentId] = useState<string | null>(null);
  const [addingSubgroupToCruise, setAddingSubgroupToCruise] = useState<boolean>(false);
  const [addSubgroupToCruiseCatalogId, setAddSubgroupToCruiseCatalogId] = useState<string>("");

  const [state, setState] = useState<ApiState>({
    authMode: "unknown",
    session: null,
    profile: null,
    cadre: null,
    cruises: null,
    subgroups: null,
    cruiseSubgroups: null,
    error: null,
  });

  const authHeaders = useMemo(() => {
    // If Firebase is configured and user is signed in, use Bearer token.
    if (state.authMode === "firebase" && firebaseToken) {
      return {
        "Authorization": `Bearer ${firebaseToken}`,
      } as Record<string, string>;
    }

    // Fallback to header simulation (development only).
    if (state.authMode === "header-sim") {
      return {
        "x-user-email": IDENTITY_EMAIL[identity],
      } as Record<string, string>;
    }

    // Unregistered users (public browse endpoints).
    return {} as Record<string, string>;
  }, [identity, state.authMode, firebaseToken]);

  const jsonHeaders = useMemo(
    () => ({
      ...authHeaders,
      "content-type": "application/json",
    } as Record<string, string>),
    [authHeaders],
  );

  const cruises = useMemo(() => parseCruises(state.cruises), [state.cruises]);
  const profile = useMemo(() => parseProfile(state.profile), [state.profile]);
  const cadre = useMemo(() => parseCadre(state.cadre), [state.cadre]);
  const activeCruises = useMemo(
    () => cruises.filter((cruise) => cruise.status === "active"),
    [cruises],
  );
  const subgroups = useMemo(() => parseSubgroups(state.subgroups), [state.subgroups]);
  const subgroupById = useMemo(
    () => new Map(subgroups.map((subgroup) => [subgroup.id, subgroup] as const)),
    [subgroups],
  );
  const cadreById = useMemo(
    () => new Map(cadre.map((cadet) => [cadet.id, cadet] as const)),
    [cadre],
  );
  const cruiseSubgroups = useMemo(
    () => parseCruiseSubgroups(state.cruiseSubgroups),
    [state.cruiseSubgroups],
  );
  const newCruiseError = useMemo(() => validateCruiseDraft(newCruise), [newCruise]);
  const newSubgroupError = useMemo(() => validateSubgroupDraft(newSubgroup), [newSubgroup]);
  const selectedCruise = useMemo(
    () => cruises.find((cruise) => cruise.id === selectedCruiseDependencyId) ?? null,
    [cruises, selectedCruiseDependencyId],
  );
  const cruiseSubgroupsForSelectedCruise = useMemo(
    () => cruiseSubgroups.filter((item) => item.cruise_id === selectedCruiseDependencyId),
    [cruiseSubgroups, selectedCruiseDependencyId],
  );
  const cruiseSubgroupByPair = useMemo(() => {
    const entries = cruiseSubgroups.map((item) => [`${item.subgroup_id}:${item.cruise_id}`, item] as const);
    return new Map<string, CruiseSubgroupItem>(entries);
  }, [cruiseSubgroups]);
  const generatedCruise = useMemo(() => {
    if (generatedPage.kind !== "cruise" && generatedPage.kind !== "subgroup") {
      return null;
    }
    return cruises.find((cruise) => cruise.id === generatedPage.cruiseId) ?? null;
  }, [generatedPage, cruises]);
  const generatedCruiseMapSubgroups = useMemo(() => {
    if (generatedPage.kind !== "cruise") {
      return [] as CruiseSubgroupItem[];
    }

    return cruiseSubgroups.filter(
      (item) => item.cruise_id === generatedPage.cruiseId && item.visibility_state === "active",
    );
  }, [generatedPage, cruiseSubgroups]);

  const generatedCruiseDockSubgroups = useMemo(() => {
    if (generatedPage.kind !== "cruise") {
      return [] as CruiseSubgroupItem[];
    }

    return cruiseSubgroups.filter(
      (item) => item.cruise_id === generatedPage.cruiseId && item.visibility_state === "inactive",
    );
  }, [generatedPage, cruiseSubgroups]);

  const toCruiseDisplayName = (name: string): string =>
    name === "Space Case Cruise" ? "Burning Man" : name;

  const sortCommitmentItems = (items: ProfileCommitmentItem[]): ProfileCommitmentItem[] =>
    [...items].sort((left, right) => {
      const leftName = left.subgroup?.name ?? "";
      const rightName = right.subgroup?.name ?? "";
      return leftName.localeCompare(rightName);
    });

  const getDisplayCommitmentStatus = (
    item: ProfileCommitmentItem,
    cruiseStatus: "active" | "archived",
  ): "committed" | "completed" | "withdrawn" => {
    if (item.status === "completed") {
      return "completed";
    }

    if (item.status === "committed" && cruiseStatus !== "active") {
      return "completed";
    }

    return item.status;
  };

  const sortCommitmentCruises = (
    groups: ProfileCommitmentsByCruiseItem[],
  ): ProfileCommitmentsByCruiseItem[] =>
    [...groups].sort((left, right) => {
      const cruiseStatusRank = (status: "active" | "archived"): number =>
        status === "active" ? 0 : 1;

      const byCruiseStatus =
        cruiseStatusRank(left.cruise.status) - cruiseStatusRank(right.cruise.status);
      if (byCruiseStatus !== 0) {
        return byCruiseStatus;
      }

      if (left.cruise.year !== right.cruise.year) {
        return right.cruise.year - left.cruise.year;
      }

      return left.cruise.name.localeCompare(right.cruise.name);
    });

  const sortedProfileCommitmentsByCruise = useMemo(() => {
    const filtered = profileCommitmentsByCruise
      .filter((group) => group.cruise.status === "active")
      .map((group) => ({
        ...group,
        items: sortCommitmentItems(group.items.filter((item) => item.status === "committed")),
      }))
      .filter((group) => group.items.length > 0);

    return sortCommitmentCruises(filtered);
  }, [profileCommitmentsByCruise]);

  const completedProfileCommitmentsByCruise = useMemo(() => {
    const filtered = profileCommitmentsByCruise
      .map((group) => ({
        ...group,
        items: sortCommitmentItems(
          group.items.filter(
            (item) =>
              item.status === "completed" ||
              (item.status === "committed" && group.cruise.status !== "active"),
          ),
        ),
      }))
      .filter((group) => group.items.length > 0);

    return sortCommitmentCruises(filtered);
  }, [profileCommitmentsByCruise]);

  const visibleCadets = useMemo(() => cadre.filter((cadet) => !cadet.is_disabled), [cadre]);
  const sessionUserEmail = useMemo(() => {
    const email = (state.session as { user?: { email?: string } } | null)?.user?.email;
    return email ?? "";
  }, [state.session]);

  const isRegistered = Boolean((state.session as { user?: { id?: string } } | null)?.user?.id);
  const isChancellor = (state.session as { user?: { role?: string } } | null)?.user?.role === "admin";

  const load = async (options?: { bustCache?: boolean }): Promise<void> => {
    setState((current) => ({ ...current, error: null }));

    const cruisesUrl = options?.bustCache
      ? apiPath("/cruises") + "?_t=" + Date.now()
      : apiPath("/cruises");

    try {
      const [modeRes, cruisesRes, subgroupsRes] = await Promise.all([
        fetch(apiPath("/auth/mode"), { cache: "no-store" }),
        fetch(cruisesUrl, { headers: authHeaders, cache: "no-store" }),
        fetch(apiPath("/subgroups"), { headers: authHeaders, cache: "no-store" }),
      ]);

      const mode = await modeRes.json();
      const cruisesPayload = await cruisesRes.json();
      const subgroupsPayload = await subgroupsRes.json();

      if (!modeRes.ok || !cruisesRes.ok || !subgroupsRes.ok) {
        const errorBody = [mode, cruisesPayload, subgroupsPayload]
          .map((payload) => (payload as { error?: { message?: string } })?.error?.message)
          .find((message) => typeof message === "string");
        throw new Error(
          errorBody
            ? `${errorBody} (mode=${modeRes.status}, cruises=${cruisesRes.status}, subgroups=${subgroupsRes.status})`
            : `API request failed (mode=${modeRes.status}, cruises=${cruisesRes.status}, subgroups=${subgroupsRes.status})`,
        );
      }

      const authCandidate = Object.keys(authHeaders).length > 0;

      let session: unknown = null;
      let profile: unknown = null;
      let cadre: unknown = null;

      if (authCandidate) {
        const [sessionRes, profileRes, cadreRes] = await Promise.all([
          fetch(apiPath("/auth/session"), { headers: authHeaders, cache: "no-store" }),
          fetch(apiPath("/profile"), { headers: authHeaders, cache: "no-store" }),
          fetch(apiPath("/cadre"), { headers: authHeaders, cache: "no-store" }),
        ]);

        // If auth fails, we still want browsing to work; just treat the user as unregistered.
        session = sessionRes.ok ? await sessionRes.json() : null;
        profile = profileRes.ok ? await profileRes.json() : null;
        cadre = cadreRes.ok ? await cadreRes.json() : null;
      }

      const cruiseItems = parseCruises(cruisesPayload);

      // listCruiseSubgroups (cruise_subgroups bridge) is the single source; Admin and Cruise Map both use this.
      const cruiseSubgroupResults = await Promise.all(
        cruiseItems.map(async (cruise) => {
          const response = await fetch(apiPath(`/cruises/${cruise.id}/subgroups`), {
            headers: authHeaders,
            cache: "no-store",
          });
          const payload = await response.json();
          return { response, payload };
        }),
      );

      const failedCruiseSubgroup = cruiseSubgroupResults.find((result) => !result.response.ok);

      if (failedCruiseSubgroup) {
        const errorBody = [
          cruisesPayload,
          subgroupsPayload,
          failedCruiseSubgroup?.payload,
        ]
          .map((payload) => (payload as { error?: { message?: string } })?.error?.message)
          .find((message) => typeof message === "string");

        throw new Error(
          errorBody
            ? `${errorBody} (cruiseSubgroups=${failedCruiseSubgroup.response.status})`
            : `API request failed (cruiseSubgroups=${failedCruiseSubgroup.response.status})`,
        );
      }

      setState({
        authMode: mode.mode ?? "unknown",
        session,
        profile,
        cadre,
        cruises: cruisesPayload,
        subgroups: subgroupsPayload,
        cruiseSubgroups: {
          items: cruiseSubgroupResults.flatMap((result) =>
            parseCruiseSubgroups(result.payload),
          ),
        },
        error: null,
      });
    } catch (error) {
      setState((current) => ({
        ...current,
        error: (error as Error).message,
      }));
    }
  };

  useEffect(() => {
    void load();
  }, [identity, authHeaders]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const applyHash = (): void => {
      const next = parseAppHash(window.location.hash);
      isApplyingHistoryRef.current = true;
      setMainView(next.mainView);
      setGeneratedPage(next.generatedPage);
    };

    applyHash();
    const onPopState = (): void => applyHash();
    window.addEventListener("popstate", onPopState);

    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const targetHash = buildAppHash(mainView, generatedPage);
    const currentHash = window.location.hash || "#home";

    if (!hasInitializedHistoryRef.current) {
      if (currentHash !== targetHash) {
        window.history.replaceState(window.history.state, "", targetHash);
      }
      hasInitializedHistoryRef.current = true;
      isApplyingHistoryRef.current = false;
      return;
    }

    if (isApplyingHistoryRef.current) {
      isApplyingHistoryRef.current = false;
      return;
    }

    if (currentHash !== targetHash) {
      window.history.pushState(window.history.state, "", targetHash);
    }
  }, [mainView, generatedPage]);

  // Firebase auth state listener
  useEffect(() => {
    const unsubscribe = onAuthChange(async (user) => {
      if (user) {
        const token = await getIdToken(user);
        setFirebaseToken(token);
      } else {
        setFirebaseToken(null);
      }
    });

    return () => unsubscribe();
  }, []);

  const refreshProfileCommitments = async (userId: string): Promise<void> => {
    setLoadingProfileCommitments(true);
    setProfileCommitmentsError(null);

    try {
      const response = await fetch(apiPath(`/cadets/${userId}`), {
        headers: authHeaders,
        cache: "no-store",
      });
      const payload = await response.json();

      if (!response.ok) {
        const message = (payload as { error?: { message?: string } })?.error?.message;
        throw new Error(
          typeof message === "string"
            ? message
            : `Failed to load profile commitments (${response.status})`,
        );
      }

      setProfileCommitmentsByCruise(parseProfileCommitmentsByCruise(payload));
    } catch (error) {
      setProfileCommitmentsError((error as Error).message);
      setProfileCommitmentsByCruise([]);
    } finally {
      setLoadingProfileCommitments(false);
    }
  };

  const fetchCruiseSubgroupDetail = async (
    cruiseSubgroupId: string,
  ): Promise<CruiseSubgroupDetailItem> => {
    const includeCommittedCadets = isRegistered;
    const response = await fetch(
      apiPath(
        includeCommittedCadets
          ? `/cruise-subgroups/${cruiseSubgroupId}?include_committed_cadets=true`
          : `/cruise-subgroups/${cruiseSubgroupId}`,
      ),
      {
        headers: authHeaders,
        cache: "no-store",
      },
    );
    const payload = await response.json();

    if (!response.ok) {
      const message = (payload as { error?: { message?: string } })?.error?.message;
      throw new Error(
        typeof message === "string"
          ? message
          : `Failed to load commitment details (${response.status})`,
      );
    }

    const parsed = parseCruiseSubgroupDetail(payload);
    if (!parsed) {
      throw new Error("Invalid subgroup detail response.");
    }

    return parsed;
  };

  const toggleCommitmentForCruiseSubgroup = async (
    cruiseSubgroupId: string,
    currentUserCommitted: boolean,
  ): Promise<void> => {
    setSubgroupCommitmentError(null);
    setSubgroupCommitmentMessage(null);
    setTogglingCommitmentCruiseSubgroupId(cruiseSubgroupId);

    const postToggle = async (action: "commit" | "withdraw" | "recommit") => {
      const response = await fetch(apiPath("/commitments/toggle"), {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({
          cruise_subgroup_id: cruiseSubgroupId,
          action,
        }),
      });
      const payload = await response.json();
      return { response, payload };
    };

    try {
      let result = await postToggle(currentUserCommitted ? "withdraw" : "commit");

      if (!result.response.ok && !currentUserCommitted && result.response.status === 409) {
        const message = (result.payload as { error?: { message?: string } })?.error?.message;
        if (
          typeof message === "string" &&
          message.toLowerCase().includes("invalid commitment transition")
        ) {
          result = await postToggle("recommit");
        }
      }

      if (!result.response.ok) {
        const message = (result.payload as { error?: { message?: string } })?.error?.message;
        throw new Error(
          typeof message === "string"
            ? message
            : `Failed to update commitment (${result.response.status})`,
        );
      }

      const refreshed = await fetchCruiseSubgroupDetail(cruiseSubgroupId);
      setCruiseSubgroupDetails((current) => ({
        ...current,
        [cruiseSubgroupId]: refreshed,
      }));
      if (profile?.id) {
        await refreshProfileCommitments(profile.id);
      }
      setSubgroupCommitmentMessage(
        currentUserCommitted ? "Commitment withdrawn." : "Commitment saved.",
      );
    } catch (error) {
      setSubgroupCommitmentError((error as Error).message);
    } finally {
      setTogglingCommitmentCruiseSubgroupId(null);
    }
  };

  useEffect(() => {
    if (generatedPage.kind !== "subgroup") {
      return;
    }

    const assignment = cruiseSubgroupByPair.get(
      `${generatedPage.subgroupId}:${generatedPage.cruiseId}`,
    );

    if (!assignment) {
      return;
    }

    let active = true;
    setSubgroupCommitmentError(null);
    setSubgroupCommitmentMessage(null);
    setLoadingCruiseSubgroupDetailId(assignment.id);

    void (async () => {
      try {
        const detail = await fetchCruiseSubgroupDetail(assignment.id);
        if (!active) {
          return;
        }
        setCruiseSubgroupDetails((current) => ({
          ...current,
          [assignment.id]: detail,
        }));
      } catch (error) {
        if (!active) {
          return;
        }
        setSubgroupCommitmentError((error as Error).message);
      } finally {
        if (active) {
          setLoadingCruiseSubgroupDetailId((current) =>
            current === assignment.id ? null : current,
          );
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [generatedPage, cruiseSubgroupByPair, authHeaders]);

  useEffect(() => {
    if (!profile) {
      return;
    }
    setProfileDraft(toEditableProfile(profile));
  }, [profile]);

  useEffect(() => {
    if (!profile?.id) {
      setProfileCommitmentsByCruise([]);
      setProfileCommitmentsError(null);
      return;
    }

    void refreshProfileCommitments(profile.id);
  }, [profile, authHeaders]);

  useEffect(() => {
    if (!isChancellor) {
      return;
    }

    setEditingCadets(
      cadre.reduce<Record<string, EditableCadetAdmin>>((accumulator, cadet) => {
        accumulator[cadet.id] = toEditableCadetAdmin(cadet);
        return accumulator;
      }, {}),
    );
  }, [cadre, isChancellor]);

  const uploadImage = async (
    type: UploadKind,
    file: File,
    options?: { name?: string; ref?: string },
  ): Promise<string> => {
    const form = new FormData();
    form.append("image", file);

    const query = new URLSearchParams({ type });
    if (options?.name?.trim()) {
      query.set("name", options.name.trim());
    }
    if (options?.ref?.trim()) {
      query.set("ref", options.ref.trim());
    }

    const uploadEndpoint = type === "cadet-avatar" ? "/uploads/avatar" : "/admin/uploads";
    const response = await fetch(apiPath(`${uploadEndpoint}?${query.toString()}`), {
      method: "POST",
      headers: authHeaders,
      body: form,
    });

    const payload = (await response.json()) as {
      url?: string;
      error?: { message?: string };
    };

    if (!response.ok || !payload.url) {
      throw new Error(payload.error?.message || `Upload failed (${response.status})`);
    }

    const base = apiPrefix.endsWith("/api/v1") ? apiPrefix.slice(0, -7) : apiPrefix;
    return `${base}${payload.url}`;
  };

  const uploadSubgroupTile = async (subgroupId: string, file: File): Promise<void> => {
    const key = `subgroup-tile-${subgroupId}`;
    setUploadingKey(key);
    setAdminMessage(null);

    try {
      const subgroupName = subgroups.find((subgroup) => subgroup.id === subgroupId)?.name;
      const uploadedUrl = await uploadImage("subgroup-tile", file, {
        name: subgroupName,
        ref: subgroupId,
      });
      updateSubgroupDraft(subgroupId, "default_tile_image_url", uploadedUrl);
      setAdminMessage("Subgroup tile uploaded. Click Save to persist.");
    } catch (error) {
      setAdminMessage((error as Error).message);
    } finally {
      setUploadingKey(null);
    }
  };

  const uploadCruiseMap = async (cruiseId: string, file: File): Promise<void> => {
    const key = `cruise-map-${cruiseId}`;
    setUploadingKey(key);
    setAdminMessage(null);

    try {
      const cruiseName = cruises.find((cruise) => cruise.id === cruiseId)?.name;
      const uploadedUrl = await uploadImage("cruise-map", file, {
        name: cruiseName,
        ref: cruiseId,
      });
      updateCruiseDraft(cruiseId, "map_image_url", uploadedUrl);
      setAdminMessage("Cruise map icon uploaded. Click Save to persist.");
    } catch (error) {
      setAdminMessage((error as Error).message);
    } finally {
      setUploadingKey(null);
    }
  };

  const uploadNewCruiseMap = async (file: File): Promise<void> => {
    const key = "cruise-map-new";
    setUploadingKey(key);
    setAdminMessage(null);

    try {
      const uploadedUrl = await uploadImage("cruise-map", file, {
        name: newCruise.name,
      });
      setNewCruise((current) => ({ ...current, map_image_url: uploadedUrl }));
      setAdminMessage("New cruise map icon uploaded.");
    } catch (error) {
      setAdminMessage((error as Error).message);
    } finally {
      setUploadingKey(null);
    }
  };

  const uploadCruiseSpecialPage = async (cruiseId: string, file: File): Promise<void> => {
    const key = `cruise-special-${cruiseId}`;
    setUploadingKey(key);
    setAdminMessage(null);

    try {
      const cruiseName = cruises.find((cruise) => cruise.id === cruiseId)?.name;
      const uploadedUrl = await uploadImage("cruise-special", file, {
        name: cruiseName,
        ref: cruiseId,
      });
      updateCruiseDraft(cruiseId, "special_page_image_url", uploadedUrl);
      setAdminMessage("Special Cruises page image uploaded. Click Save to persist.");
    } catch (error) {
      setAdminMessage((error as Error).message);
    } finally {
      setUploadingKey(null);
    }
  };

  const uploadNewCruiseSpecialPage = async (file: File): Promise<void> => {
    const key = "cruise-special-new";
    setUploadingKey(key);
    setAdminMessage(null);

    try {
      const uploadedUrl = await uploadImage("cruise-special", file, {
        name: newCruise.name,
      });
      setNewCruise((current) => ({ ...current, special_page_image_url: uploadedUrl }));
      setAdminMessage("New cruise Special Cruises page image uploaded.");
    } catch (error) {
      setAdminMessage((error as Error).message);
    } finally {
      setUploadingKey(null);
    }
  };

  const uploadNewSubgroupTile = async (file: File): Promise<void> => {
    const key = "subgroup-tile-new";
    setUploadingKey(key);
    setAdminMessage(null);

    try {
      const uploadedUrl = await uploadImage("subgroup-tile", file, {
        name: newSubgroup.name,
      });
      setNewSubgroup((current) => ({ ...current, default_tile_image_url: uploadedUrl }));
      setAdminMessage("New subgroup tile uploaded.");
    } catch (error) {
      setAdminMessage((error as Error).message);
    } finally {
      setUploadingKey(null);
    }
  };

  const uploadNewSubgroupPoster = async (file: File): Promise<void> => {
    const key = "subgroup-poster-new-subgroup";
    setUploadingKey(key);
    setAdminMessage(null);

    try {
      const uploadedUrl = await uploadImage("subgroup-poster", file, {
        name: newSubgroup.name,
      });
      setNewSubgroupPosterUrl(uploadedUrl);
      setAdminMessage("New subgroup page poster uploaded.");
    } catch (error) {
      setAdminMessage((error as Error).message);
    } finally {
      setUploadingKey(null);
    }
  };

  const uploadSubgroupPosterForCruise = async (
    subgroupId: string,
    cruiseId: string,
    file: File,
  ): Promise<void> => {
    const key = `subgroup-poster-${subgroupId}-${cruiseId}`;
    setUploadingKey(key);
    setAdminMessage(null);

    try {
      const subgroupName = subgroups.find((subgroup) => subgroup.id === subgroupId)?.name;
      const cruiseName = cruises.find((cruise) => cruise.id === cruiseId)?.name;
      const uploadedUrl = await uploadImage("subgroup-poster", file, {
        name: `${subgroupName || "subgroup"} ${cruiseName || "cruise"}`,
        ref: `${subgroupId}-${cruiseId}`,
      });
      updateSubgroupCruiseDependencyDraft(subgroupId, cruiseId, "detail_image_url", uploadedUrl);
      setAdminMessage("Subgroup page poster uploaded. Click Save to persist.");
    } catch (error) {
      setAdminMessage((error as Error).message);
    } finally {
      setUploadingKey(null);
    }
  };

  const uploadProfileAvatar = async (file: File): Promise<void> => {
    const key = "profile-avatar";
    setUploadingKey(key);
    setProfileMessage(null);

    try {
      const uploadedUrl = await uploadImage("cadet-avatar", file, {
        name: profileDraft.playa_name || profile?.email || "cadet",
        ref: profile?.id,
      });
      setProfileDraft((current) => ({ ...current, avatar_url: uploadedUrl }));
      setProfileMessage("Avatar uploaded. Click Save Profile to persist.");
    } catch (error) {
      setProfileMessage((error as Error).message);
    } finally {
      setUploadingKey(null);
    }
  };

  useEffect(() => {
    if (!import.meta.env.DEV || !apiBaseWarning) {
      return;
    }

    console.warn("[Space Case Cruises] API base configuration warning", {
      warning: apiBaseWarning,
      rawBase: RAW_API_BASE,
      resolvedPrefix: apiPrefix,
    });
  }, []);

  useEffect(() => {
    if (!isChancellor) {
      return;
    }

    setEditingCruises(
      cruises.reduce<Record<string, EditableCruise>>((accumulator, cruise) => {
        accumulator[cruise.id] = toEditableCruise(cruise);
        return accumulator;
      }, {}),
    );

    setEditingSubgroups(
      subgroups.reduce<Record<string, EditableSubgroup>>((accumulator, subgroup) => {
        accumulator[subgroup.id] = toEditableSubgroup(subgroup);
        return accumulator;
      }, {}),
    );

  }, [cruises, subgroups, cruiseSubgroups, isChancellor]);

  useEffect(() => {
    if (!newSubgroupCruiseId && cruises[0]?.id) {
      setNewSubgroupCruiseId(cruises[0].id);
    }

    if (!selectedCruiseDependencyId && cruises[0]?.id) {
      setSelectedCruiseDependencyId(cruises[0].id);
    }
  }, [
    cruises,
    subgroups,
    newSubgroupCruiseId,
    selectedCruiseDependencyId,
  ]);

  useEffect(() => {
    if (!selectedCruiseDependencyId) {
      return;
    }

    const bySubgroupId = cruiseSubgroups
      .filter((item) => item.cruise_id === selectedCruiseDependencyId)
      .reduce<Record<string, EditableCruiseSubgroup>>((accumulator, item) => {
        accumulator[item.subgroup_id] = toEditableCruiseSubgroup(item);
        return accumulator;
      }, {});

    setEditingCruiseDependencies(bySubgroupId);
  }, [selectedCruiseDependencyId, cruiseSubgroups]);

  useEffect(() => {
    if (generatedPage.kind === "home") {
      return;
    }

    if (!cruises.length) {
      setGeneratedPage({ kind: "home" });
      return;
    }

    const cruiseId = generatedPage.cruiseId;
    const hasCruise = cruises.some((cruise) => cruise.id === cruiseId);
    if (!hasCruise) {
      setGeneratedPage({ kind: "home" });
      return;
    }

    if (generatedPage.kind === "subgroup") {
      const hasSubgroup = cruiseSubgroups.some(
        (item) => item.cruise_id === generatedPage.cruiseId && item.subgroup_id === generatedPage.subgroupId,
      );
      if (!hasSubgroup) {
        setGeneratedPage({ kind: "cruise", cruiseId: generatedPage.cruiseId });
      }
    }
  }, [generatedPage, cruises, cruiseSubgroups]);

  useEffect(() => {
    if (!subgroups.length) {
      return;
    }

    const activeCruiseIds = new Set(activeCruises.map((cruise) => cruise.id));
    const fallbackCruiseId = activeCruises[0]?.id ?? "";

    setSubgroupCruiseSelection((current) => {
      const next: Record<string, string> = {};

      for (const subgroup of subgroups) {
        const selectedCruiseId = current[subgroup.id];
        if (selectedCruiseId && activeCruiseIds.has(selectedCruiseId)) {
          next[subgroup.id] = selectedCruiseId;
          continue;
        }

        const existingActiveAssignment = cruiseSubgroups.find(
          (item) => item.subgroup_id === subgroup.id && activeCruiseIds.has(item.cruise_id),
        );
        next[subgroup.id] = existingActiveAssignment?.cruise_id ?? fallbackCruiseId;
      }

      return next;
    });
  }, [subgroups, activeCruises, cruiseSubgroups]);

  const getSubgroupCruiseDependencyDraft = (
    subgroupId: string,
    cruiseId: string,
  ): EditableCruiseSubgroup => {
    const key = `${subgroupId}:${cruiseId}`;
    const fromState = editingSubgroupCruiseDependencies[key];
    if (fromState) {
      return fromState;
    }

    const existingAssignment = cruiseSubgroupByPair.get(key);
    if (existingAssignment) {
      return toEditableCruiseSubgroup(existingAssignment);
    }

    return emptyCruiseDependencyDraft();
  };

  const updateSubgroupCruiseDependencyDraft = (
    subgroupId: string,
    cruiseId: string,
    field: keyof EditableCruiseSubgroup,
    value: string | boolean,
  ): void => {
    const key = `${subgroupId}:${cruiseId}`;
    setEditingSubgroupCruiseDependencies((current) => ({
      ...current,
      [key]: {
        ...(current[key] ?? getSubgroupCruiseDependencyDraft(subgroupId, cruiseId)),
        [field]: value,
        ...(field === "visibility_state"
          ? {
              dock_visible: dockVisibleForVisibilityState(
                value as "invisible" | "inactive" | "active",
              ),
            }
          : {}),
      },
    }));
  };

  const saveMapLayoutForSelectedCruise = async (): Promise<void> => {
    if (!selectedCruiseDependencyId) {
      setAdminMessage("Select a cruise before saving map layout.");
      return;
    }

    const assignmentBySubgroup = new Map(
      cruiseSubgroupsForSelectedCruise.map((item) => [item.subgroup_id, item]),
    );

    const items = Object.entries(editingCruiseDependencies)
      .map(([subgroupId, draft]) => {
        const assignment = assignmentBySubgroup.get(subgroupId);
        if (!assignment) {
          return null;
        }

        const mapX = parseNullableNumber(draft.map_x);
        const mapY = parseNullableNumber(draft.map_y);
        const mapScale = parseNullableNumber(draft.map_scale);
        if (Number.isNaN(mapX) || Number.isNaN(mapY) || Number.isNaN(mapScale) || mapScale === null) {
          return null;
        }

        return {
          cruise_subgroup_id: assignment.id,
          visibility_state: draft.visibility_state,
          dock_visible: dockVisibleForVisibilityState(draft.visibility_state),
          map_x: mapX,
          map_y: mapY,
          map_scale: mapScale,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    if (!items.length) {
      setAdminMessage("No mapped subgroup rows to save for this cruise.");
      return;
    }

    setAdminMessage(null);

    try {
      const response = await fetch(apiPath(`/admin/cruises/${selectedCruiseDependencyId}/map/batch`), {
        method: "PATCH",
        headers: jsonHeaders,
        body: JSON.stringify({ items }),
      });

      const payload = await response.json();
      if (!response.ok) {
        const message = (payload as { error?: { message?: string } })?.error?.message;
        throw new Error(message || `Failed to save map layout (${response.status})`);
      }

      setAdminMessage("Map layout saved.");
      await load();
    } catch (error) {
      setAdminMessage((error as Error).message);
    }
  };

  const removeCruiseSubgroupFromCruise = async (cruiseSubgroupId: string): Promise<void> => {
    setRemovingCruiseSubgroupId(cruiseSubgroupId);
    setAdminMessage(null);
    try {
      const response = await fetch(apiPath(`/admin/cruise-subgroups/${cruiseSubgroupId}`), {
        method: "DELETE",
        headers: authHeaders,
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const message = (payload as { error?: { message?: string } })?.error?.message;
        throw new Error(message || `Failed to remove (${response.status})`);
      }
      setAdminMessage("Subgroup removed from cruise.");
      await load();
    } catch (error) {
      setAdminMessage((error as Error).message);
    } finally {
      setRemovingCruiseSubgroupId(null);
    }
  };

  const addSubgroupToCruise = async (): Promise<void> => {
    if (!selectedCruiseDependencyId || !addSubgroupToCruiseCatalogId) {
      setAdminMessage("Select a cruise and a subgroup to add.");
      return;
    }
    setAddingSubgroupToCruise(true);
    setAdminMessage(null);
    try {
      const response = await fetch(
        apiPath(`/admin/cruises/${selectedCruiseDependencyId}/subgroups`),
        {
          method: "POST",
          headers: jsonHeaders,
          body: JSON.stringify({
            subgroup_id: addSubgroupToCruiseCatalogId,
            visibility_state: "inactive",
            dock_visible: true,
            map_scale: 1,
          }),
        },
      );
      const payload = await response.json();
      if (!response.ok) {
        const message = (payload as { error?: { message?: string } })?.error?.message;
        throw new Error(message || `Failed to add subgroup (${response.status})`);
      }
      setAddSubgroupToCruiseCatalogId("");
      setAdminMessage("Subgroup added to cruise.");
      await load();
    } catch (error) {
      setAdminMessage((error as Error).message);
    } finally {
      setAddingSubgroupToCruise(false);
    }
  };

  const saveCruiseSubgroupAssignment = async (assignmentId: string): Promise<void> => {
    const assignment = cruiseSubgroups.find((a) => a.id === assignmentId);
    if (!assignment || !selectedCruiseDependencyId || assignment.cruise_id !== selectedCruiseDependencyId) {
      setAdminMessage("Assignment not found for this cruise.");
      return;
    }
    const dependencyDraft = getSubgroupCruiseDependencyDraft(assignment.subgroup_id, selectedCruiseDependencyId);
    const costLevelOverride = parseNullableNumber(dependencyDraft.cost_level_override);
    const mapX = parseNullableNumber(dependencyDraft.map_x);
    const mapY = parseNullableNumber(dependencyDraft.map_y);
    const mapScale = parseNullableNumber(dependencyDraft.map_scale);
    if (
      Number.isNaN(costLevelOverride) ||
      Number.isNaN(mapX) ||
      Number.isNaN(mapY) ||
      Number.isNaN(mapScale) ||
      mapScale === null
    ) {
      setAdminMessage("Invalid map or challenge values.");
      return;
    }
    setSavingCruiseSubgroupAssignmentId(assignmentId);
    setAdminMessage(null);
    try {
      const response = await fetch(apiPath(`/admin/cruise-subgroups/${assignmentId}`), {
        method: "PATCH",
        headers: jsonHeaders,
        body: JSON.stringify({
          override_name: (dependencyDraft.override_name ?? "").trim() || null,
          override_description: (dependencyDraft.override_description ?? "").trim() || null,
          detail_image_url: (dependencyDraft.detail_image_url ?? "").trim() || null,
          cost_level_override: costLevelOverride,
          visibility_state: dependencyDraft.visibility_state,
          dock_visible: dockVisibleForVisibilityState(dependencyDraft.visibility_state),
          map_x: mapX,
          map_y: mapY,
          map_scale: mapScale,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        const message = (payload as { error?: { message?: string } })?.error?.message;
        throw new Error(message || `Failed to save (${response.status})`);
      }
      setAdminMessage("Assignment saved.");
      await load();
    } catch (error) {
      setAdminMessage((error as Error).message);
    } finally {
      setSavingCruiseSubgroupAssignmentId(null);
    }
  };

  const handleMapTileDragEnd = (subgroupId: string, clientX: number, clientY: number): void => {
    const canvas = mapCanvasRef.current;
    if (!canvas) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return;
    }

    const xPercent = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
    const yPercent = Math.min(100, Math.max(0, ((clientY - rect.top) / rect.height) * 100));

    setEditingCruiseDependencies((current) => ({
      ...current,
      [subgroupId]: {
        ...(current[subgroupId] ?? emptyCruiseDependencyDraft()),
        map_x: xPercent.toFixed(2),
        map_y: yPercent.toFixed(2),
        visibility_state: "active",
        dock_visible: false,
      },
    }));
  };

  const updateCruiseDraft = (
    cruiseId: string,
    field: keyof EditableCruise,
    value: string | boolean,
  ): void => {
    setEditingCruises((current) => ({
      ...current,
      [cruiseId]: {
        ...(current[cruiseId] ?? emptyCruiseDraft()),
        [field]: value,
      },
    }));
  };

  const updateSubgroupDraft = (
    subgroupId: string,
    field: keyof EditableSubgroup,
    value: string,
  ): void => {
    setEditingSubgroups((current) => ({
      ...current,
      [subgroupId]: {
        ...(current[subgroupId] ?? emptySubgroupDraft()),
        [field]: value,
      },
    }));
  };

  const saveCruise = async (cruiseId: string): Promise<void> => {
    const draft = editingCruises[cruiseId];
    if (!draft) {
      return;
    }

    const validationError = validateCruiseDraft(draft);
    if (validationError) {
      setAdminMessage(validationError);
      return;
    }

    const year = Number.parseInt(draft.year, 10);
    const sortOrder = Number.parseInt(draft.sort_order, 10);
    const castingCost = draft.casting_cost.trim() ? Number.parseInt(draft.casting_cost, 10) : null;
    if (!draft.name.trim() || Number.isNaN(year) || Number.isNaN(sortOrder)) {
      setAdminMessage("Cruise requires name, year, and sort order.");
      return;
    }

    setSavingCruiseId(cruiseId);
    setAdminMessage(null);

    try {
      const response = await fetch(apiPath(`/admin/cruises/${cruiseId}`), {
        method: "PATCH",
        headers: jsonHeaders,
        body: JSON.stringify({
          name: draft.name.trim(),
          year,
          location: draft.location.trim() ? draft.location.trim() : null,
          starts_on: draft.starts_on || null,
          ends_on: draft.ends_on || null,
          map_image_url: draft.map_image_url.trim() ? draft.map_image_url.trim() : null,
          special_page_image_url:
            draft.special_page_image_url.trim() ? draft.special_page_image_url.trim() : null,
          casting_cost: castingCost,
          casting_cost_url: draft.casting_cost_url.trim() ? draft.casting_cost_url.trim() : null,
          status: draft.status,
          is_featured: draft.is_featured,
          sort_order: sortOrder,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        const message = (payload as { error?: { message?: string } })?.error?.message;
        throw new Error(message || `Failed to save cruise (${response.status})`);
      }

      // Merge the updated cruise into state so the cadet cruise page and lists show new dates immediately
      // (avoids relying on cached GET /cruises in the subsequent load())
      const updatedCruise = payload as CruiseItem;
      if (typeof updatedCruise?.id === "string" && typeof updatedCruise?.name === "string") {
        setState((prev) => {
          const current = prev.cruises as { items?: unknown[] } | null;
          const items = Array.isArray(current?.items) ? [...current.items] : [];
          const index = items.findIndex((item: unknown) => (item as { id?: string }).id === cruiseId);
          if (index >= 0) {
            items[index] = updatedCruise;
            return { ...prev, cruises: { items } };
          }
          return prev;
        });
      }

      setAdminMessage("Cruise saved.");
      await load({ bustCache: true });
    } catch (error) {
      setAdminMessage((error as Error).message);
    } finally {
      setSavingCruiseId(null);
    }
  };

  const createCruise = async (): Promise<void> => {
    if (newCruiseError) {
      setAdminMessage(newCruiseError);
      return;
    }

    const year = Number.parseInt(newCruise.year, 10);
    const sortOrder = Number.parseInt(newCruise.sort_order, 10);
    const castingCost = newCruise.casting_cost.trim() ? Number.parseInt(newCruise.casting_cost, 10) : null;
    if (!newCruise.name.trim() || Number.isNaN(year) || Number.isNaN(sortOrder)) {
      setAdminMessage("New cruise needs name, year, and sort order.");
      return;
    }

    setCreatingCruise(true);
    setAdminMessage(null);

    try {
      const response = await fetch(apiPath("/admin/cruises"), {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({
          name: newCruise.name.trim(),
          year,
          location: newCruise.location.trim() ? newCruise.location.trim() : null,
          starts_on: newCruise.starts_on || null,
          ends_on: newCruise.ends_on || null,
          map_image_url: newCruise.map_image_url.trim() ? newCruise.map_image_url.trim() : null,
          special_page_image_url:
            newCruise.special_page_image_url.trim() ? newCruise.special_page_image_url.trim() : null,
          casting_cost: castingCost,
          casting_cost_url: newCruise.casting_cost_url.trim() ? newCruise.casting_cost_url.trim() : null,
          is_featured: newCruise.is_featured,
          sort_order: sortOrder,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        const message = (payload as { error?: { message?: string } })?.error?.message;
        throw new Error(message || `Failed to create cruise (${response.status})`);
      }

      setNewCruise(emptyCruiseDraft());
      setAdminMessage("Cruise created.");
      await load();
    } catch (error) {
      setAdminMessage((error as Error).message);
    } finally {
      setCreatingCruise(false);
    }
  };

  const saveSubgroup = async (subgroupId: string): Promise<void> => {
    const draft = editingSubgroups[subgroupId];
    if (!draft) {
      return;
    }

    const selectedCruiseIdForSubgroup = subgroupCruiseSelection[subgroupId] ?? "";
    const dependencyDraft = selectedCruiseIdForSubgroup
      ? getSubgroupCruiseDependencyDraft(subgroupId, selectedCruiseIdForSubgroup)
      : emptyCruiseDependencyDraft();

    const validationError = validateSubgroupDraft(draft);
    if (validationError) {
      setAdminMessage(validationError);
      return;
    }

    const dependencyError = validateCruiseSubgroupDraft(dependencyDraft, {
      requireCruiseId: true,
      cruiseId: selectedCruiseIdForSubgroup,
    });
    if (dependencyError) {
      setAdminMessage(dependencyError);
      return;
    }

    const defaultCostLevel = Number.parseInt(draft.default_cost_level, 10);
    if (!draft.name.trim() || Number.isNaN(defaultCostLevel)) {
      setAdminMessage("Subgroup requires name and challenge.");
      return;
    }

    if (!selectedCruiseIdForSubgroup) {
      setAdminMessage("Select a cruise dependency.");
      return;
    }

    const existingSubgroup = subgroups.find((item) => item.id === subgroupId);
    const previousName = (existingSubgroup?.name ?? "").trim();
    const nextName = draft.name.trim();
    const previousDefaultCostLevel = existingSubgroup?.default_cost_level ?? defaultCostLevel;
    const nextDefaultCostLevel = defaultCostLevel;
    const previousDefaultDescription = (existingSubgroup?.default_description ?? "").trim();
    const nextDefaultDescription = draft.default_description.trim();

    setSavingSubgroupId(subgroupId);
    setAdminMessage(null);

    try {
      const response = await fetch(apiPath(`/admin/subgroups/${subgroupId}`), {
        method: "PATCH",
        headers: jsonHeaders,
        body: JSON.stringify({
          name: draft.name.trim(),
          default_description: draft.default_description.trim() || null,
          default_tile_image_url: draft.default_tile_image_url.trim() || null,
          extension: draft.extension.trim() || null,
          default_cost_level: defaultCostLevel,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        const message = (payload as { error?: { message?: string } })?.error?.message;
        throw new Error(message || `Failed to save subgroup (${response.status})`);
      }

      const existingAssignment = cruiseSubgroupByPair.get(`${subgroupId}:${selectedCruiseIdForSubgroup}`);
      const assignmentToReassign =
        !existingAssignment &&
        cruiseSubgroups.find(
          (item) => item.subgroup_id === subgroupId && item.cruise_id !== selectedCruiseIdForSubgroup,
        );

      const costLevelOverride = parseNullableNumber(dependencyDraft.cost_level_override);
      const mapX = parseNullableNumber(dependencyDraft.map_x);
      const mapY = parseNullableNumber(dependencyDraft.map_y);
      const mapScale = parseNullableNumber(dependencyDraft.map_scale);

      if (
        Number.isNaN(costLevelOverride) ||
        Number.isNaN(mapX) ||
        Number.isNaN(mapY) ||
        Number.isNaN(mapScale) ||
        mapScale === null
      ) {
        throw new Error("Invalid map or challenge values for cruise dependency.");
      }

      if (existingAssignment) {
        const patchResponse = await fetch(apiPath(`/admin/cruise-subgroups/${existingAssignment.id}`), {
          method: "PATCH",
          headers: jsonHeaders,
          body: JSON.stringify({
            cruise_id: selectedCruiseIdForSubgroup,
            override_name: nextName || null,
            override_description: nextDefaultDescription || null,
            detail_image_url: dependencyDraft.detail_image_url.trim() || null,
            cost_level_override: costLevelOverride,
            visibility_state: dependencyDraft.visibility_state,
            dock_visible: dockVisibleForVisibilityState(dependencyDraft.visibility_state),
            map_x: mapX,
            map_y: mapY,
            map_scale: mapScale,
          }),
        });

        const patchPayload = await patchResponse.json();
        if (!patchResponse.ok) {
          const patchMessage = (patchPayload as { error?: { message?: string } })?.error?.message;
          throw new Error(patchMessage || `Failed to update subgroup page (${patchResponse.status})`);
        }
      } else {
        if (assignmentToReassign) {
          const patchResponse = await fetch(apiPath(`/admin/cruise-subgroups/${assignmentToReassign.id}`), {
            method: "PATCH",
            headers: jsonHeaders,
            body: JSON.stringify({
              cruise_id: selectedCruiseIdForSubgroup,
              override_name: nextName || null,
              override_description: nextDefaultDescription || null,
              detail_image_url: dependencyDraft.detail_image_url.trim() || null,
              cost_level_override: costLevelOverride,
              visibility_state: dependencyDraft.visibility_state,
              dock_visible: dockVisibleForVisibilityState(dependencyDraft.visibility_state),
              map_x: mapX,
              map_y: mapY,
              map_scale: mapScale,
            }),
          });

          const patchPayload = await patchResponse.json();
          if (!patchResponse.ok) {
            const patchMessage = (patchPayload as { error?: { message?: string } })?.error?.message;
            throw new Error(patchMessage || `Failed to reassign subgroup to cruise (${patchResponse.status})`);
          }
        } else {
          const createResponse = await fetch(
            apiPath(`/admin/cruises/${selectedCruiseIdForSubgroup}/subgroups`),
            {
              method: "POST",
              headers: jsonHeaders,
              body: JSON.stringify({
                subgroup_id: subgroupId,
                override_name: nextName || null,
                override_description: nextDefaultDescription || null,
                detail_image_url: dependencyDraft.detail_image_url.trim() || null,
                cost_level_override: costLevelOverride,
                visibility_state: dependencyDraft.visibility_state,
                dock_visible: dockVisibleForVisibilityState(dependencyDraft.visibility_state),
                map_x: mapX,
                map_y: mapY,
                map_scale: mapScale,
              }),
            },
          );

          const createPayload = await createResponse.json();
          if (!createResponse.ok) {
            const createMessage = (createPayload as { error?: { message?: string } })?.error?.message;
            throw new Error(createMessage || `Failed to create subgroup page (${createResponse.status})`);
          }
        }
      }

      const shouldSyncDescription = previousDefaultDescription !== nextDefaultDescription;
      const shouldSyncName = previousName !== nextName;
      const shouldSyncCostLevel = previousDefaultCostLevel !== nextDefaultCostLevel;

      if (shouldSyncDescription || shouldSyncName || shouldSyncCostLevel) {
        const updatedAssignmentId = existingAssignment?.id ?? assignmentToReassign?.id;
        const inheritedAssignments = cruiseSubgroups.filter((item) => {
          if (item.subgroup_id !== subgroupId) {
            return false;
          }

          if (updatedAssignmentId && item.id === updatedAssignmentId) {
            return false;
          }

          return true;
        });

        for (const assignment of inheritedAssignments) {
          const patchBody: {
            override_description?: string | null;
            override_name?: string | null;
            cost_level_override?: number | null;
          } = {};

          if (
            shouldSyncDescription &&
            (assignment.override_description ?? "").trim() === previousDefaultDescription
          ) {
            patchBody.override_description = nextDefaultDescription || null;
          }

          if (shouldSyncName && (assignment.override_name ?? "").trim() === previousName) {
            patchBody.override_name = nextName || null;
          }

          if (shouldSyncCostLevel && assignment.cost_level_override === previousDefaultCostLevel) {
            patchBody.cost_level_override = nextDefaultCostLevel;
          }

          if (!Object.keys(patchBody).length) {
            continue;
          }

          const syncResponse = await fetch(apiPath(`/admin/cruise-subgroups/${assignment.id}`), {
            method: "PATCH",
            headers: jsonHeaders,
            body: JSON.stringify(patchBody),
          });

          if (!syncResponse.ok) {
            const syncPayload = await syncResponse.json().catch(() => ({}));
            const syncMessage = (syncPayload as { error?: { message?: string } })?.error?.message;
            throw new Error(syncMessage || `Failed to sync subgroup assignments (${syncResponse.status})`);
          }
        }
      }

      setAdminMessage("Subgroup saved.");
      await load();
    } catch (error) {
      setAdminMessage((error as Error).message);
    } finally {
      setSavingSubgroupId(null);
    }
  };

  const createSubgroup = async (): Promise<void> => {
    if (newSubgroupError) {
      setAdminMessage(newSubgroupError);
      return;
    }

    const defaultCostLevel = Number.parseInt(newSubgroup.default_cost_level, 10);
    if (!newSubgroup.name.trim() || Number.isNaN(defaultCostLevel)) {
      setAdminMessage("New subgroup needs name and challenge.");
      return;
    }

    if (!newSubgroupCruiseId) {
      setAdminMessage("Select which cruise this subgroup depends on.");
      return;
    }

    const existingSlugs = new Set(subgroups.map((subgroup) => subgroup.slug));
    const existingCodes = new Set(subgroups.map((subgroup) => subgroup.code));
    const slug = uniqueSlugFromName(newSubgroup.name, existingSlugs);
    const code = uniqueCodeFromName(newSubgroup.name, existingCodes);

    setCreatingSubgroup(true);
    setAdminMessage(null);

    try {
      const response = await fetch(apiPath("/admin/subgroups"), {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({
          name: newSubgroup.name.trim(),
          slug,
          code,
          default_description: newSubgroup.default_description.trim() || null,
          default_tile_image_url: newSubgroup.default_tile_image_url.trim() || null,
          extension: newSubgroup.extension.trim() || null,
          default_cost_level: defaultCostLevel,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        const message = (payload as { error?: { message?: string } })?.error?.message;
        throw new Error(message || `Failed to create subgroup (${response.status})`);
      }

      const createdSubgroup = payload as { id: string; name?: string; default_description?: string | null };
      const assignmentResponse = await fetch(apiPath(`/admin/cruises/${newSubgroupCruiseId}/subgroups`), {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({
          subgroup_id: createdSubgroup.id,
          override_name: createdSubgroup.name ?? null,
          override_description: createdSubgroup.default_description ?? null,
          detail_image_url: newSubgroupPosterUrl || null,
          visibility_state: "inactive",
          dock_visible: true,
          map_scale: 1,
        }),
      });

      const assignmentPayload = await assignmentResponse.json();
      if (!assignmentResponse.ok) {
        const assignmentMessage = (assignmentPayload as { error?: { message?: string } })?.error?.message;
        throw new Error(
          assignmentMessage ||
            `Subgroup created but auto-assignment failed (${assignmentResponse.status})`,
        );
      }

      setNewSubgroup(emptySubgroupDraft());
      setNewSubgroupPosterUrl("");
      setAdminMessage("Subgroup created with auto-generated page + map tile setup.");
      await load();
    } catch (error) {
      setAdminMessage((error as Error).message);
    } finally {
      setCreatingSubgroup(false);
    }
  };

  const saveProfile = async (): Promise<void> => {
    if (!profile) {
      return;
    }

    setSavingProfile(true);
    setProfileMessage(null);

    try {
      const response = await fetch(apiPath("/profile"), {
        method: "PATCH",
        headers: jsonHeaders,
        body: JSON.stringify({
          avatar_url: profileDraft.avatar_url.trim() || null,
          phone_number: profileDraft.phone_number.trim() || null,
          preferred_contact: profileDraft.preferred_contact || null,
          pronouns: profileDraft.pronouns || null,
          playa_name: profileDraft.playa_name.trim(),
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        const message = (payload as { error?: { message?: string } })?.error?.message;
        throw new Error(message || `Failed to save profile (${response.status})`);
      }

      setProfileMessage("Profile saved.");
      await load();
    } catch (error) {
      setProfileMessage((error as Error).message);
    } finally {
      setSavingProfile(false);
    }
  };

  const updateCadetDraft = (
    cadetId: string,
    field: keyof EditableCadetAdmin,
    value: string | boolean,
  ): void => {
    setEditingCadets((current) => ({
      ...current,
      [cadetId]: {
        ...(current[cadetId] ?? {
          avatar_url: "",
          phone_number: "",
          preferred_contact: "",
          pronouns: "",
          playa_name: "",
          cadet_extension: "",
          is_disabled: false,
        }),
        [field]: value,
      },
    }));
  };

  const saveCadet = async (cadetId: string): Promise<void> => {
    const draft = editingCadets[cadetId];
    if (!draft) {
      return;
    }

    setSavingCadetId(cadetId);
    setAdminMessage(null);

    try {
      const response = await fetch(apiPath(`/admin/cadets/${cadetId}`), {
        method: "PATCH",
        headers: jsonHeaders,
        body: JSON.stringify({
          avatar_url: draft.avatar_url.trim() || null,
          phone_number: draft.phone_number.trim() || null,
          preferred_contact: draft.preferred_contact || null,
          pronouns: draft.pronouns || null,
          playa_name: draft.playa_name.trim(),
          cadet_extension: draft.cadet_extension.trim(),
          is_disabled: draft.is_disabled,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        const message = (payload as { error?: { message?: string } })?.error?.message;
        throw new Error(message || `Failed to save cadet (${response.status})`);
      }

      setAdminMessage("Cadet saved.");
      await load();
    } catch (error) {
      setAdminMessage((error as Error).message);
    } finally {
      setSavingCadetId(null);
    }
  };

  const deleteCadet = async (cadetId: string, displayName: string): Promise<void> => {
    const label = displayName?.trim() || "this cadet";
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete ${label}? This action cannot be undone.`,
    );
    if (!confirmed) {
      return;
    }

    setAdminMessage(null);

    try {
      const response = await fetch(apiPath(`/admin/cadets/${cadetId}`), {
        method: "DELETE",
        headers: authHeaders,
      });

      if (!response.ok && response.status !== 204) {
        let message: string | undefined;
        try {
          const payload = (await response.json()) as { error?: { message?: string } };
          message = payload.error?.message;
        } catch {
          // ignore parse errors for empty responses
        }
        throw new Error(message || `Failed to delete cadet (${response.status})`);
      }

      setAdminMessage("Cadet deleted.");
      await load();
    } catch (error) {
      setAdminMessage((error as Error).message);
    }
  };

  const createBackupSnapshot = async (): Promise<void> => {
    setCreatingBackup(true);
    setAdminMessage(null);

    try {
      const response = await fetch(apiPath("/admin/backups/snapshot"), {
        method: "POST",
        headers: authHeaders,
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: { message?: string };
      };

      if (!response.ok) {
        throw new Error(payload.error?.message || `Backup failed (${response.status})`);
      }

      setAdminMessage("Backup snapshot created.");
    } catch (error) {
      setAdminMessage((error as Error).message);
    } finally {
      setCreatingBackup(false);
    }
  };

  const openRegistrationBox = (): void => {
    setShowRegistrationBox(true);
    setAuthActionMessage(null);
  };

  const handleAuthAction = async (mode: "signin" | "signup"): Promise<void> => {
    if (!authEmail.trim() || !authPassword.trim()) {
      setAuthActionMessage("Enter email and password.");
      return;
    }

    try {
      setAuthActionMessage("Processing...");
      
      let user;
      if (mode === "signin") {
        user = await signInWithEmail(authEmail, authPassword);
      } else {
        user = await signUpWithEmail(authEmail, authPassword);
      }

      const token = await getIdToken(user);
      setFirebaseToken(token);
      setShowRegistrationBox(false);
      setAuthActionMessage(null);
      
      // Reload data with new auth
      void load();
    } catch (error) {
      const errorMessage = (error as Error).message || "Authentication failed";
      setAuthActionMessage(errorMessage);
      console.error("Auth error:", error);
    }
  };

  const handleGoogleSignIn = async (): Promise<void> => {
    try {
      setAuthActionMessage("Opening Google sign-in...");
      const user = await signInWithGoogle();
      const token = await getIdToken(user);
      setFirebaseToken(token);
      setShowRegistrationBox(false);
      setAuthActionMessage(null);
      
      // Reload data with new auth
      void load();
    } catch (error) {
      const errorMessage = (error as Error).message || "Google sign-in failed";
      setAuthActionMessage(errorMessage);
      console.error("Google sign-in error:", error);
    }
  };

  const handleSignOut = async (): Promise<void> => {
    try {
      await signOutUser();
      setFirebaseToken(null);
      setShowRegistrationBox(false);
      setAuthPassword("");
      setAuthActionMessage("Signed out.");
    } catch (error) {
      console.error("Sign out error:", error);
      setAuthActionMessage("Sign out failed");
    }
  };

  const goToLanding = (): void => {
    setMainView("home");
    setGeneratedPage({ kind: "home" });
  };

  console.log("Current View:", mainView, "Is Chancellor:", isChancellor);

  return (
    <main className="app-shell">
      <header className="topbar">
        {/* Matrix-style ticker - scrolling with mechanical character flips */}
        <div className="alien-ticker">
          <div className="ticker-content">
            <span>⊥<span className="flip-section">ヲ⇂ㄣ</span>又 ⇂ア ᄅ⇂ン フ • <span className="flip-section">△⊥シ</span>⊥㈜ㄒⅰ⊥ • ヲ刀ㄣ又 ᄅ⇂ア<span className="flip-section">刀ㄣ</span> • ⊥ヲ⇂ㄣ又 ⇂ア</span>
            <span>⊥<span className="flip-section">ヲ⇂ㄣ</span>又 ⇂ア ᄅ⇂ン フ • <span className="flip-section">△⊥シ</span>⊥㈜ㄒⅰ⊥ • ヲ刀ㄣ又 ᄅ⇂ア<span className="flip-section">刀ㄣ</span> • ⊥ヲ⇂ㄣ又 ⇂ア</span>
            <span>⊥<span className="flip-section">ヲ⇂ㄣ</span>又 ⇂ア ᄅ⇂ン フ • <span className="flip-section">△⊥シ</span>⊥㈜ㄒⅰ⊥ • ヲ刀ㄣ又 ᄅ⇂ア<span className="flip-section">刀ㄣ</span> • ⊥ヲ⇂ㄣ又 ⇂ア</span>
          </div>
        </div>

        <div className="toolbar">
          {!isRegistered ? (
            <button onClick={openRegistrationBox}>Sign In</button>
          ) : (
            <>
              <div className="user-chip">
                {profileDraft.avatar_url ? (
                  <img
                    className="header-avatar"
                    src={resolveMediaUrl(profileDraft.avatar_url)}
                    alt="Signed in avatar"
                  />
                ) : (
                  <span className="user-dot">◆</span>
                )}
                <span>Signed In</span>
              </div>
              <button onClick={handleSignOut}>Sign Out</button>
            </>
          )}

          {isRegistered ? (
            <>
              <div className="user-chip">
                <span className="user-dot">◆</span>
                <span>{sessionUserEmail}</span>
              </div>

              <select
                value={mainView === "admin" && isChancellor ? "chancellor" : "cadet"}
                onChange={(event) => {
                  const value = event.target.value;
                  if (value === "cadet") {
                    // Cadet view always lands on Cruises.
                    setMainView("home");
                    setGeneratedPage({ kind: "home" });
                  }
                  if (value === "chancellor" && isChancellor) {
                    setMainView("admin");
                  }
                }}
                aria-label="Role selection"
              >
                <option value="cadet">Cadet</option>
                <option value="chancellor" disabled={!isChancellor}>
                  Chancellor
                </option>
              </select>
            </>
          ) : null}

          {state.authMode === "header-sim" && import.meta.env.DEV ? (
            <select value={identity} onChange={(event) => setIdentity(event.target.value as Identity)}>
              <option value="admin">Chancellor (dev)</option>
              <option value="cadet">Cadet (dev)</option>
            </select>
          ) : null}
        </div>
      </header>

      {showRegistrationBox ? (
        <section className="panel auth-card" style={{ marginBottom: 12 }}>
          <strong>Registration Box</strong>
          <label>
            Email
            <input
              className="table-input"
              value={authEmail}
              onChange={(event) => setAuthEmail(event.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <label>
            Password
            <input
              className="table-input"
              type="password"
              value={authPassword}
              onChange={(event) => setAuthPassword(event.target.value)}
              placeholder="••••••••"
            />
          </label>
          <div className="profile-actions">
            <button onClick={() => handleAuthAction("signin")}>Sign In</button>
            <button onClick={() => handleAuthAction("signup")}>Sign Up</button>
            <button onClick={handleGoogleSignIn} disabled={state.authMode === "header-sim"}>Continue with Google</button>
            <button onClick={() => setShowRegistrationBox(false)}>Close</button>
          </div>
          {state.authMode === "header-sim" ? (
            <p className="small muted">OAuth is disabled in header-sim mode.</p>
          ) : null}
          {authActionMessage ? <p className="small muted">{authActionMessage}</p> : null}
        </section>
      ) : null}

      {mainView === "admin" && isChancellor ? (
        <section className="meta-grid">
          <div className="panel">
            <h2>Status</h2>
            {apiBaseWarning ? <p className="error">{apiBaseWarning}</p> : null}
            {state.error ? <p className="error">{state.error}</p> : <p className="ok">Connected</p>}
            {adminMessage ? <p className="ok">{adminMessage}</p> : null}
            <div className="toolbar-row" style={{ marginTop: 10 }}>
              <button onClick={() => void createBackupSnapshot()} disabled={creatingBackup}>
                {creatingBackup ? "Backing up..." : "Backup Now"}
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {mainView === "profile" ? (
        <section className="panel">
          <div className="toolbar-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <h2 className="title-artistic" style={{ margin: 0, flex: 1 }}>
              {profileDraft.playa_name?.trim() || "Your Profile"}
            </h2>
            <button onClick={goToLanding}>Back to Landing</button>
          </div>
          <div className="profile-layout">
            <div className="profile-avatar-col">
              {profileDraft.avatar_url ? (
                <img className="cadet-avatar profile-avatar" src={resolveMediaUrl(profileDraft.avatar_url)} alt="Avatar" />
              ) : (
                <div className="generated-placeholder profile-avatar">No avatar</div>
              )}
              <label className="file-input-label">
                Choose Avatar
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) {
                      return;
                    }
                    void uploadProfileAvatar(file);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
              <p className="small muted">
                {uploadingKey === "profile-avatar" ? "Uploading avatar..." : "Upload avatar image"}
              </p>
              <p className="small muted">{profile?.email || "n/a"}</p>
              <p className="small muted">Role: {profile?.role || "n/a"}</p>
            </div>
            <div className="profile-form-grid">
              <label>
                Burner Name
                <input
                  className="table-input"
                  value={profileDraft.playa_name}
                  onChange={(event) =>
                    setProfileDraft((current) => ({ ...current, playa_name: event.target.value }))
                  }
                />
              </label>
              <label>
                Pronouns
                <select
                  className="table-input"
                  value={profileDraft.pronouns}
                  onChange={(event) =>
                    setProfileDraft((current) => ({
                      ...current,
                      pronouns: event.target.value as EditableProfile["pronouns"],
                    }))
                  }
                >
                  <option value="">n/a</option>
                  <option value="they_them">they/them</option>
                  <option value="he_him">he/him</option>
                  <option value="she_her">she/her</option>
                  <option value="any_all">any/all</option>
                </select>
              </label>
              <label>
                Preferred Contact
                <select
                  className="table-input"
                  value={profileDraft.preferred_contact}
                  onChange={(event) =>
                    setProfileDraft((current) => ({
                      ...current,
                      preferred_contact: event.target.value as EditableProfile["preferred_contact"],
                    }))
                  }
                >
                  <option value="">n/a</option>
                  <option value="discord">discord</option>
                  <option value="text">text</option>
                  <option value="phone">phone</option>
                  <option value="email">email</option>
                </select>
              </label>
              <label>
                Phone
                <input
                  className="table-input"
                  value={profileDraft.phone_number}
                  onChange={(event) =>
                    setProfileDraft((current) => ({ ...current, phone_number: event.target.value }))
                  }
                />
              </label>
              <div className="profile-full profile-actions">
                <button onClick={() => void saveProfile()} disabled={savingProfile || !profileDraft.playa_name.trim()}>
                  {savingProfile ? "Saving..." : "SAVE CREDENTIALS"}
                </button>
                {profileMessage ? <div className="success-container">{profileMessage}</div> : null}
              </div>
            </div>
          </div>
          <div className="profile-commitments">
            <h3>Current Commitments</h3>
            {loadingProfileCommitments ? (
              <div className="loading-container">
                <div className="spinner" />
                <p className="small">Loading commitments...</p>
              </div>
            ) : profileCommitmentsError ? (
              <div className="error-container">{profileCommitmentsError}</div>
            ) : sortedProfileCommitmentsByCruise.length ? (
              sortedProfileCommitmentsByCruise.map((group) => {
                const cruiseDisplayName = toCruiseDisplayName(group.cruise.name);

                return (
                  <article key={`profile-commitments-${group.cruise.id}`} className="cadet-card">
                    <h3>{cruiseDisplayName}</h3>
                    <p className="small muted">{group.cruise.year} • {group.cruise.status}</p>
                    <ul className="profile-commitment-list">
                      {group.items.map((item) => {
                        const subgroup = item.subgroup;
                        const tileImage = subgroup
                          ? subgroupById.get(subgroup.id)?.default_tile_image_url
                          : null;

                        return (
                          <button
                            key={item.cruise_subgroup_id}
                            className="profile-commitment-item"
                            onClick={() => {
                              setMainView("home");
                              setGeneratedPage({
                                kind: "subgroup",
                                cruiseId: group.cruise.id,
                                subgroupId: subgroup?.id || "",
                              });
                            }}
                            style={{ border: "none", background: "transparent", cursor: "pointer", padding: "inherit", width: "100%", textAlign: "left" }}
                          >
                            {tileImage ? (
                              <img
                                className="thumb"
                                src={resolveMediaUrl(tileImage)}
                                alt={`${subgroup?.name || "Subgroup"} tile`}
                                loading="lazy"
                              />
                            ) : (
                              <div className="thumb profile-commitment-thumb-fallback">?</div>
                            )}
                            <div>
                              <p className="small">
                                {subgroup?.name || "Unknown subgroup"}
                                {subgroup?.extension ? ` • ext ${subgroup.extension}` : ""}
                              </p>
                              <p className="small muted">Status: {item.status}</p>
                            </div>
                          </button>
                        );
                      })}
                    </ul>
                  </article>
                );
              })
            ) : (
              <p className="small muted">No commitments yet. Subscribe from a subgroup page to see them here.</p>
            )}

            <h3>Completed Commitments</h3>
            {loadingProfileCommitments ? (
              <div className="loading-container">
                <div className="spinner" />
                <p className="small">Loading commitments...</p>
              </div>
            ) : profileCommitmentsError ? (
              <div className="error-container">{profileCommitmentsError}</div>
            ) : completedProfileCommitmentsByCruise.length ? (
              completedProfileCommitmentsByCruise.map((group) => {
                const cruiseDisplayName = toCruiseDisplayName(group.cruise.name);

                return (
                  <article key={`profile-completed-${group.cruise.id}`} className="cadet-card">
                    <h3>{cruiseDisplayName}</h3>
                    <p className="small muted">{group.cruise.year} • {group.cruise.status}</p>
                    <ul className="profile-commitment-list">
                      {group.items.map((item) => {
                        const subgroup = item.subgroup;
                        const tileImage = subgroup
                          ? subgroupById.get(subgroup.id)?.default_tile_image_url
                          : null;

                        return (
                          <li key={item.cruise_subgroup_id} className="profile-commitment-item">
                            {tileImage ? (
                              <img
                                className="thumb"
                                src={resolveMediaUrl(tileImage)}
                                alt={`${subgroup?.name || "Subgroup"} tile`}
                                loading="lazy"
                              />
                            ) : (
                              <div className="thumb profile-commitment-thumb-fallback">?</div>
                            )}
                            <div>
                              <p className="small">
                                {subgroup?.name || "Unknown subgroup"}
                                {subgroup?.extension ? ` • ext ${subgroup.extension}` : ""}
                              </p>
                              <p className="small muted">
                                Status: {getDisplayCommitmentStatus(item, group.cruise.status)}
                              </p>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </article>
                );
              })
            ) : (
              <p className="small muted">No completed commitments yet.</p>
            )}
          </div>
        </section>
      ) : null}

      {mainView === "cadre" ? (
        <section className="panel">
          <div className="toolbar-row">
            <h2>Cadre</h2>
            <button onClick={goToLanding}>Back to Landing</button>
          </div>
          <div className="cadre-grid collapsible-menu-grid">
            {visibleCadets.map((cadet) => (
              <article key={cadet.id} className="cadet-card">
                <div className="cadet-head">
                  {cadet.avatar_url ? (
                    <img
                      className="cadet-avatar"
                      src={resolveMediaUrl(cadet.avatar_url)}
                      alt={cadet.playa_name}
                    />
                  ) : (
                    <div className="cadet-avatar cadet-avatar-fallback">?</div>
                  )}
                  <div>
                    <h3>{cadet.playa_name}</h3>
                    <p className="small muted">Pronouns: {labelPronouns(cadet.pronouns)}</p>
                  </div>
                </div>
                <p className="small">Burner Name: {cadet.playa_name}</p>
                <p className="small">Email: {cadet.email || "n/a"}</p>
                <p className="small">Phone: {cadet.phone_number || "n/a"}</p>
                <p className="small">Preferred Contact: {cadet.preferred_contact || "n/a"}</p>
                <p className="small">Extension: {cadet.cadet_extension || "n/a"}</p>
                <div className="badge-row">
                  {cadet.badges.map((badge) => (
                    <span key={badge.id} className="badge-chip">
                      {badge.icon_url ? (
                        <img
                          className="badge-icon"
                          src={resolveMediaUrl(badge.icon_url)}
                          alt={badge.name}
                        />
                      ) : null}
                      {badge.name}
                    </span>
                  ))}
                  {!cadet.badges.length ? <span className="small muted">No badges</span> : null}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {mainView === "collectables" ? (
        <section className="panel">
          <div className="toolbar-row">
            <h2>Collectables</h2>
            <button onClick={goToLanding}>Back to Landing</button>
          </div>
          <p>Future gift shop launch bay.</p>
          <p className="muted">This section is reserved for merch drops, collectable unlocks, and redemptions.</p>
        </section>
      ) : null}

      {mainView === "admin" && isChancellor ? (
        <>
          <section className="panel admin-table-panel">
            <h2>Admin Cadet Editor</h2>
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Avatar</th>
                    <th>Burner Name</th>
                    <th>Email</th>
                    <th>Pronouns</th>
                    <th>Phone</th>
                    <th>Preferred Contact</th>
                    <th>Extension</th>
                    <th>Disabled</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {cadre.map((cadet) => {
                    const draft = editingCadets[cadet.id] ?? toEditableCadetAdmin(cadet);
                    return (
                      <tr key={cadet.id}>
                        <td>
                          <div className="cadet-admin-avatar-wrap">
                            {draft.avatar_url ? (
                              <img
                                className="cadet-avatar"
                                src={resolveMediaUrl(draft.avatar_url)}
                                alt={draft.playa_name}
                              />
                            ) : (
                              <span className="muted">none</span>
                            )}
                            <input
                              className="table-input"
                              value={draft.avatar_url}
                              onChange={(event) =>
                                updateCadetDraft(cadet.id, "avatar_url", event.target.value)
                              }
                              placeholder="Avatar URL"
                            />
                          </div>
                        </td>
                        <td>
                          <input
                            className="table-input"
                            value={draft.playa_name}
                            onChange={(event) =>
                              updateCadetDraft(cadet.id, "playa_name", event.target.value)
                            }
                          />
                        </td>
                        <td>{cadet.email}</td>
                        <td>
                          <select
                            className="table-input"
                            value={draft.pronouns}
                            onChange={(event) =>
                              updateCadetDraft(cadet.id, "pronouns", event.target.value)
                            }
                          >
                            <option value="">n/a</option>
                            <option value="they_them">they/them</option>
                            <option value="he_him">he/him</option>
                            <option value="she_her">she/her</option>
                            <option value="any_all">any/all</option>
                          </select>
                        </td>
                        <td>
                          <input
                            className="table-input"
                            value={draft.phone_number}
                            onChange={(event) =>
                              updateCadetDraft(cadet.id, "phone_number", event.target.value)
                            }
                          />
                        </td>
                        <td>
                          <select
                            className="table-input"
                            value={draft.preferred_contact}
                            onChange={(event) =>
                              updateCadetDraft(cadet.id, "preferred_contact", event.target.value)
                            }
                          >
                            <option value="">n/a</option>
                            <option value="discord">discord</option>
                            <option value="text">text</option>
                            <option value="phone">phone</option>
                            <option value="email">email</option>
                          </select>
                        </td>
                        <td>
                          <input
                            className="table-input"
                            value={draft.cadet_extension}
                            onChange={(event) =>
                              updateCadetDraft(cadet.id, "cadet_extension", event.target.value)
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="checkbox"
                            checked={draft.is_disabled}
                            onChange={(event) =>
                              updateCadetDraft(cadet.id, "is_disabled", event.target.checked)
                            }
                          />
                        </td>
                        <td>
                          <button onClick={() => void saveCadet(cadet.id)} disabled={savingCadetId === cadet.id}>
                            {savingCadetId === cadet.id ? "Saving..." : "Save"}
                          </button>
                          <button
                            style={{ marginLeft: 8, color: "#c0392b" }}
                            onClick={() => void deleteCadet(cadet.id, cadet.playa_name)}
                          >
                            🗑️ Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel admin-table-panel">
            <h2>Admin Cruise Editor</h2>
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Year</th>
                    <th>Location</th>
                    <th>Starts</th>
                    <th>Ends</th>
                    <th>Cruise Map Icon</th>
                    <th>Special Cruises Image</th>
                    <th>Casting Cost</th>
                    <th>Casting Cost URL</th>
                    <th>Upload Cruise Map</th>
                    <th>Upload Special</th>
                    <th>Map Preview</th>
                    <th>Special Preview</th>
                    <th>Status</th>
                    <th>Featured</th>
                    <th>Sort</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {cruises.map((cruise) => {
                    const draft = editingCruises[cruise.id] ?? toEditableCruise(cruise);
                    const rowError = validateCruiseDraft(draft);

                    return (
                      <tr key={cruise.id}>
                        <td>
                          <input
                            className="table-input"
                            value={draft.name}
                            onChange={(event) =>
                              updateCruiseDraft(cruise.id, "name", event.target.value)
                            }
                          />
                        </td>
                        <td>
                          <input
                            className="table-input"
                            value={draft.year}
                            onChange={(event) =>
                              updateCruiseDraft(cruise.id, "year", event.target.value)
                            }
                          />
                        </td>
                        <td>
                          <input
                            className="table-input"
                            value={draft.location}
                            onChange={(event) =>
                              updateCruiseDraft(cruise.id, "location", event.target.value)
                            }
                          />
                        </td>
                        <td>
                          <input
                            className="table-input"
                            type="date"
                            value={draft.starts_on}
                            onChange={(event) =>
                              updateCruiseDraft(cruise.id, "starts_on", event.target.value)
                            }
                          />
                        </td>
                        <td>
                          <input
                            className="table-input"
                            type="date"
                            value={draft.ends_on}
                            onChange={(event) =>
                              updateCruiseDraft(cruise.id, "ends_on", event.target.value)
                            }
                          />
                        </td>
                        <td>{draft.map_image_url ? <span className="muted small">uploaded</span> : <span className="muted">none</span>}</td>
                        <td>{draft.special_page_image_url ? <span className="muted small">uploaded</span> : <span className="muted">none</span>}</td>
                        <td>
                          <input
                            className="table-input"
                            type="number"
                            min="0"
                            max="10"
                            value={draft.casting_cost}
                            onChange={(event) =>
                              updateCruiseDraft(cruise.id, "casting_cost", event.target.value)
                            }
                            placeholder="0-10"
                          />
                        </td>
                        <td>
                          <input
                            className="table-input"
                            type="url"
                            value={draft.casting_cost_url}
                            onChange={(event) =>
                              updateCruiseDraft(cruise.id, "casting_cost_url", event.target.value)
                            }
                            placeholder="https://..."
                          />
                        </td>
                        <td>
                          <label className="upload-label">
                            <input
                              className="table-input"
                              type="file"
                              accept="image/*"
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (!file) {
                                  return;
                                }
                                void uploadCruiseMap(cruise.id, file);
                                event.currentTarget.value = "";
                              }}
                            />
                          </label>
                          <div className="muted small">
                            {uploadingKey === `cruise-map-${cruise.id}` ? "Uploading..." : ""}
                          </div>
                        </td>
                        <td>
                          <label className="upload-label">
                            <input
                              className="table-input"
                              type="file"
                              accept="image/*"
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (!file) {
                                  return;
                                }
                                void uploadCruiseSpecialPage(cruise.id, file);
                                event.currentTarget.value = "";
                              }}
                            />
                          </label>
                          <div className="muted small">
                            {uploadingKey === `cruise-special-${cruise.id}` ? "Uploading..." : ""}
                          </div>
                        </td>
                        <td>
                          {draft.map_image_url ? (
                            <img className="thumb" src={resolveMediaUrl(draft.map_image_url)} alt="Cruise map" />
                          ) : (
                            <span className="muted">none</span>
                          )}
                        </td>
                        <td>
                          {draft.special_page_image_url ? (
                            <img
                              className="thumb"
                              src={resolveMediaUrl(draft.special_page_image_url)}
                              alt="Special Cruises"
                            />
                          ) : (
                            <span className="muted">none</span>
                          )}
                        </td>
                        <td>
                          <select
                            className="table-input"
                            value={draft.status}
                            onChange={(event) =>
                              updateCruiseDraft(
                                cruise.id,
                                "status",
                                event.target.value as "active" | "archived",
                              )
                            }
                          >
                            <option value="active">active</option>
                            <option value="archived">archived</option>
                          </select>
                        </td>
                        <td>
                          <input
                            type="checkbox"
                            checked={draft.is_featured}
                            onChange={(event) =>
                              updateCruiseDraft(cruise.id, "is_featured", event.target.checked)
                            }
                          />
                        </td>
                        <td>
                          <input
                            className="table-input"
                            value={draft.sort_order}
                            onChange={(event) =>
                              updateCruiseDraft(cruise.id, "sort_order", event.target.value)
                            }
                          />
                        </td>
                        <td>
                          <button
                            onClick={() => void saveCruise(cruise.id)}
                            disabled={savingCruiseId === cruise.id || !!rowError}
                          >
                            {savingCruiseId === cruise.id ? "Saving..." : "Save"}
                          </button>
                          {rowError ? <div className="error-inline small">{rowError}</div> : null}
                        </td>
                      </tr>
                    );
                  })}

                  <tr>
                    <td>
                      <input
                        className="table-input"
                        value={newCruise.name}
                        onChange={(event) =>
                          setNewCruise((current) => ({ ...current, name: event.target.value }))
                        }
                        placeholder="New cruise"
                      />
                    </td>
                    <td>
                      <input
                        className="table-input"
                        value={newCruise.year}
                        onChange={(event) =>
                          setNewCruise((current) => ({ ...current, year: event.target.value }))
                        }
                      />
                    </td>
                    <td>
                      <input
                        className="table-input"
                        value={newCruise.location}
                        onChange={(event) =>
                          setNewCruise((current) => ({ ...current, location: event.target.value }))
                        }
                      />
                    </td>
                    <td>
                      <input
                        className="table-input"
                        type="date"
                        value={newCruise.starts_on}
                        onChange={(event) =>
                          setNewCruise((current) => ({ ...current, starts_on: event.target.value }))
                        }
                      />
                    </td>
                    <td>
                      <input
                        className="table-input"
                        type="date"
                        value={newCruise.ends_on}
                        onChange={(event) =>
                          setNewCruise((current) => ({ ...current, ends_on: event.target.value }))
                        }
                      />
                    </td>
                    <td>{newCruise.map_image_url ? <span className="muted small">uploaded</span> : <span className="muted">new</span>}</td>
                    <td>{newCruise.special_page_image_url ? <span className="muted small">uploaded</span> : <span className="muted">new</span>}</td>
                    <td>
                      <input
                        className="table-input"
                        type="number"
                        min="0"
                        max="10"
                        value={newCruise.casting_cost}
                        onChange={(event) =>
                          setNewCruise((current) => ({ ...current, casting_cost: event.target.value }))
                        }
                        placeholder="0-10"
                      />
                    </td>
                    <td>
                      <input
                        className="table-input"
                        type="url"
                        value={newCruise.casting_cost_url}
                        onChange={(event) =>
                          setNewCruise((current) => ({ ...current, casting_cost_url: event.target.value }))
                        }
                        placeholder="https://..."
                      />
                    </td>
                    <td>
                      <label className="upload-label">
                        <input
                          className="table-input"
                          type="file"
                          accept="image/*"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (!file) {
                              return;
                            }
                            void uploadNewCruiseMap(file);
                            event.currentTarget.value = "";
                          }}
                        />
                      </label>
                      <div className="muted small">
                        {uploadingKey === "cruise-map-new" ? "Uploading..." : ""}
                      </div>
                    </td>
                    <td>
                      <label className="upload-label">
                        <input
                          className="table-input"
                          type="file"
                          accept="image/*"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (!file) {
                              return;
                            }
                            void uploadNewCruiseSpecialPage(file);
                            event.currentTarget.value = "";
                          }}
                        />
                      </label>
                      <div className="muted small">
                        {uploadingKey === "cruise-special-new" ? "Uploading..." : ""}
                      </div>
                    </td>
                    <td>
                      {newCruise.map_image_url ? (
                        <img className="thumb" src={resolveMediaUrl(newCruise.map_image_url)} alt="New cruise map" />
                      ) : (
                        <span className="muted">new</span>
                      )}
                    </td>
                    <td>
                      {newCruise.special_page_image_url ? (
                        <img
                          className="thumb"
                          src={resolveMediaUrl(newCruise.special_page_image_url)}
                          alt="New Special Cruises"
                        />
                      ) : (
                        <span className="muted">new</span>
                      )}
                    </td>
                    <td>
                      <select
                        className="table-input"
                        value={newCruise.status}
                        onChange={(event) =>
                          setNewCruise((current) => ({
                            ...current,
                            status: event.target.value as "active" | "archived",
                          }))
                        }
                      >
                        <option value="active">active</option>
                        <option value="archived">archived</option>
                      </select>
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={newCruise.is_featured}
                        onChange={(event) =>
                          setNewCruise((current) => ({ ...current, is_featured: event.target.checked }))
                        }
                      />
                    </td>
                    <td>
                      <input
                        className="table-input"
                        value={newCruise.sort_order}
                        onChange={(event) =>
                          setNewCruise((current) => ({ ...current, sort_order: event.target.value }))
                        }
                      />
                    </td>
                    <td>
                      <button
                        onClick={() => void createCruise()}
                        disabled={creatingCruise || !!newCruiseError}
                      >
                        {creatingCruise ? "Creating..." : "Create"}
                      </button>
                      {newCruiseError ? <div className="error-inline small">{newCruiseError}</div> : null}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel admin-table-panel">
            <h2>Unified Subgroup Editor</h2>
            <div className="toolbar-row">
              <label>
                Cruise
                <select
                  className="table-input"
                  value={selectedCruiseDependencyId}
                  onChange={(e) => setSelectedCruiseDependencyId(e.target.value)}
                >
                  {cruises.map((cruise) => (
                    <option key={cruise.id} value={cruise.id}>
                      {cruise.name}
                    </option>
                  ))}
                </select>
              </label>
              <span className="muted small">Same data as Cruise Map. All edits save to cruise_subgroups (bridge).</span>
            </div>
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Subgroup</th>
                    <th>Override name</th>
                    <th>Override description</th>
                    <th>Poster</th>
                    <th>Challenge</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {cruiseSubgroupsForSelectedCruise.map((assignment) => {
                    const subgroup = subgroupById.get(assignment.subgroup_id);
                    const catalogName = subgroup?.name ?? assignment.subgroup_id;
                    const dependencyDraft = getSubgroupCruiseDependencyDraft(
                      assignment.subgroup_id,
                      selectedCruiseDependencyId,
                    );
                    const rowError = validateCruiseSubgroupDraft(dependencyDraft, {
                      requireCruiseId: true,
                      cruiseId: selectedCruiseDependencyId,
                    });
                    return (
                      <tr key={assignment.id}>
                        <td className="muted small">{catalogName}</td>
                        <td>
                          <input
                            className="table-input"
                            value={dependencyDraft.override_name ?? ""}
                            onChange={(e) =>
                              updateSubgroupCruiseDependencyDraft(
                                assignment.subgroup_id,
                                selectedCruiseDependencyId,
                                "override_name",
                                e.target.value,
                              )
                            }
                            placeholder="Override name"
                          />
                        </td>
                        <td>
                          <input
                            className="table-input"
                            value={dependencyDraft.override_description ?? ""}
                            onChange={(e) =>
                              updateSubgroupCruiseDependencyDraft(
                                assignment.subgroup_id,
                                selectedCruiseDependencyId,
                                "override_description",
                                e.target.value,
                              )
                            }
                            placeholder="Override description"
                          />
                        </td>
                        <td>
                          {dependencyDraft.detail_image_url ? (
                            <img
                              className="thumb"
                              src={resolveMediaUrl(dependencyDraft.detail_image_url)}
                              alt="Poster"
                            />
                          ) : (
                            <span className="muted">none</span>
                          )}
                          <label className="upload-label">
                            <input
                              className="table-input"
                              type="file"
                              accept="image/*"
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (!file) return;
                                void uploadSubgroupPosterForCruise(
                                  assignment.subgroup_id,
                                  selectedCruiseDependencyId,
                                  file,
                                );
                                event.currentTarget.value = "";
                              }}
                            />
                          </label>
                          {uploadingKey === `subgroup-poster-${assignment.subgroup_id}-${selectedCruiseDependencyId}` ? (
                            <span className="muted small">Uploading...</span>
                          ) : null}
                        </td>
                        <td>
                          <input
                            className="table-input"
                            type="number"
                            min={0}
                            max={8}
                            value={dependencyDraft.cost_level_override ?? ""}
                            onChange={(e) =>
                              updateSubgroupCruiseDependencyDraft(
                                assignment.subgroup_id,
                                selectedCruiseDependencyId,
                                "cost_level_override",
                                e.target.value,
                              )
                            }
                            placeholder="0–8"
                          />
                        </td>
                        <td>
                          <select
                            className="table-input"
                            value={dependencyDraft.visibility_state}
                            onChange={(e) =>
                              updateSubgroupCruiseDependencyDraft(
                                assignment.subgroup_id,
                                selectedCruiseDependencyId,
                                "visibility_state",
                                e.target.value as "invisible" | "inactive" | "active",
                              )
                            }
                          >
                            <option value="active">active</option>
                            <option value="inactive">inactive</option>
                            <option value="invisible">hidden</option>
                          </select>
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() => void saveCruiseSubgroupAssignment(assignment.id)}
                            disabled={savingCruiseSubgroupAssignmentId === assignment.id || !!rowError}
                          >
                            {savingCruiseSubgroupAssignmentId === assignment.id ? "Saving..." : "Save"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void removeCruiseSubgroupFromCruise(assignment.id)}
                            disabled={removingCruiseSubgroupId === assignment.id}
                          >
                            {removingCruiseSubgroupId === assignment.id ? "Removing..." : "Remove"}
                          </button>
                          {rowError ? <div className="error-inline small">{rowError}</div> : null}
                        </td>
                      </tr>
                    );
                  })}

                  <tr>
                    <td colSpan={2}>
                      <select
                        className="table-input"
                        value={addSubgroupToCruiseCatalogId}
                        onChange={(e) => setAddSubgroupToCruiseCatalogId(e.target.value)}
                      >
                        <option value="">— Add subgroup to cruise —</option>
                        {subgroups
                          .filter(
                            (s) =>
                              !cruiseSubgroupsForSelectedCruise.some(
                                (a) => a.subgroup_id === s.id,
                              ),
                          )
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                      </select>
                    </td>
                    <td colSpan={3} />
                    <td>
                      <button
                        type="button"
                        onClick={() => void addSubgroupToCruise()}
                        disabled={
                          addingSubgroupToCruise ||
                          !addSubgroupToCruiseCatalogId ||
                          !selectedCruiseDependencyId
                        }
                      >
                        {addingSubgroupToCruise ? "Adding..." : "Add to cruise"}
                      </button>
                    </td>
                  </tr>

                  <tr>
                    <td>
                      <div className="small muted">Depends on cruise</div>
                      <select
                        className="table-input"
                        value={newSubgroupCruiseId}
                        onChange={(event) => setNewSubgroupCruiseId(event.target.value)}
                      >
                        {cruises.map((cruise) => (
                          <option key={cruise.id} value={cruise.id}>
                            {cruise.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        className="table-input"
                        value={newSubgroup.name}
                        onChange={(event) =>
                          setNewSubgroup((current) => ({ ...current, name: event.target.value }))
                        }
                        placeholder="New subgroup"
                      />
                    </td>
                    <td>
                      <input
                        className="table-input"
                        value={newSubgroup.default_description}
                        onChange={(event) =>
                          setNewSubgroup((current) => ({
                            ...current,
                            default_description: event.target.value,
                          }))
                        }
                      />
                    </td>
                    <td>
                      {newSubgroup.default_tile_image_url ? <span className="muted small">uploaded</span> : <span className="muted">new</span>}
                    </td>
                    <td>
                      <label className="upload-label">
                        <input
                          className="table-input"
                          type="file"
                          accept="image/*"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (!file) {
                              return;
                            }
                            void uploadNewSubgroupTile(file);
                            event.currentTarget.value = "";
                          }}
                        />
                      </label>
                    </td>
                    <td>
                      {newSubgroup.default_tile_image_url ? (
                        <img className="thumb" src={resolveMediaUrl(newSubgroup.default_tile_image_url)} alt="New subgroup icon" />
                      ) : (
                        <span className="muted">new</span>
                      )}
                    </td>
                    <td>{newSubgroupPosterUrl ? <span className="muted small">uploaded</span> : <span className="muted">new</span>}</td>
                    <td>
                      <label className="upload-label">
                        <input
                          className="table-input"
                          type="file"
                          accept="image/*"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (!file) {
                              return;
                            }
                            void uploadNewSubgroupPoster(file);
                            event.currentTarget.value = "";
                          }}
                        />
                      </label>
                    </td>
                    <td>
                      {newSubgroupPosterUrl ? (
                        <img className="thumb" src={resolveMediaUrl(newSubgroupPosterUrl)} alt="New subgroup poster" />
                      ) : (
                        <span className="muted">new</span>
                      )}
                    </td>
                    <td>
                      <input
                        className="table-input"
                        value={newSubgroup.extension}
                        onChange={(event) =>
                          setNewSubgroup((current) => ({ ...current, extension: event.target.value }))
                        }
                      />
                    </td>
                    <td>
                      <input
                        className="table-input"
                        value={newSubgroup.default_cost_level}
                        onChange={(event) =>
                          setNewSubgroup((current) => ({
                            ...current,
                            default_cost_level: event.target.value,
                          }))
                        }
                      />
                    </td>
                    <td>
                      <span className="muted">inactive</span>
                    </td>
                    <td>
                      <button
                        onClick={() => void createSubgroup()}
                        disabled={creatingSubgroup || !!newSubgroupError}
                      >
                        {creatingSubgroup ? "Creating..." : "Create"}
                      </button>
                      {newSubgroupError ? <div className="error-inline small">{newSubgroupError}</div> : null}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel admin-table-panel">
            <h2>Cruise Map Page</h2>
            <div className="toolbar-row">
              <label>
                Cruise
                <select
                  className="table-input"
                  value={selectedCruiseDependencyId}
                  onChange={(event) => setSelectedCruiseDependencyId(event.target.value)}
                >
                  {cruises.map((cruise) => (
                    <option key={cruise.id} value={cruise.id}>
                      {cruise.name}
                    </option>
                  ))}
                </select>
              </label>
              <button onClick={() => setShowCruiseMapEditor((current) => !current)}>
                {showCruiseMapEditor ? "Hide Graphical Editor" : "Show Graphical Editor"}
              </button>
            </div>

            {showCruiseMapEditor ? (
              <>
                <h3 className="map-editor-title">Graphical Map Editor</h3>
                <div className="map-editor-grid">
                  <div
                    ref={mapCanvasRef}
                    className="map-canvas"
                    style={selectedCruise?.map_image_url ? { backgroundImage: `url(${resolveMediaUrl(selectedCruise.map_image_url)})` } : undefined}
                  >
                    {cruiseSubgroupsForSelectedCruise
                      .filter((assignment) => {
                        const dependencyDraft =
                          editingCruiseDependencies[assignment.subgroup_id] ??
                          toEditableCruiseSubgroup(assignment);
                        return dependencyDraft.visibility_state === "active";
                      })
                      .map((assignment) => {
                        const subgroup = subgroupById.get(assignment.subgroup_id);
                        if (!subgroup) return null;
                        const dependencyDraft =
                          editingCruiseDependencies[assignment.subgroup_id] ??
                          toEditableCruiseSubgroup(assignment);
                        const iconUrl =
                          editingSubgroups[subgroup.id]?.default_tile_image_url || subgroup.default_tile_image_url;
                        if (!iconUrl) return null;
                        const x = Number.parseFloat(dependencyDraft.map_x || "0");
                        const y = Number.parseFloat(dependencyDraft.map_y || "0");
                        const scale = Number.parseFloat(dependencyDraft.map_scale || "1") || 1;
                        return (
                          <img
                            key={`map-${assignment.id}`}
                            className="map-tile"
                            src={resolveMediaUrl(iconUrl)}
                            alt={subgroup.name}
                            draggable
                            onDragEnd={(event) =>
                              handleMapTileDragEnd(assignment.subgroup_id, event.clientX, event.clientY)
                            }
                            style={{
                              left: `${x}%`,
                              top: `${y}%`,
                              transform: `translate(-50%, -50%) scale(${scale})`,
                            }}
                          />
                        );
                      })}
                  </div>
                </div>
                <button onClick={() => void saveMapLayoutForSelectedCruise()}>Save Map Layout</button>
                <div className="map-dock-panel">
                  <h4>Dock (Inactive)</h4>
                  <div className="generated-tile-dock">
                    {cruiseSubgroupsForSelectedCruise
                      .filter((assignment) => {
                        const dependencyDraft =
                          editingCruiseDependencies[assignment.subgroup_id] ??
                          toEditableCruiseSubgroup(assignment);
                        return dependencyDraft.visibility_state === "inactive";
                      })
                      .map((assignment) => {
                        const subgroup = subgroupById.get(assignment.subgroup_id);
                        if (!subgroup) {
                          return null;
                        }

                        const iconUrl =
                          editingSubgroups[subgroup.id]?.default_tile_image_url || subgroup.default_tile_image_url;
                        return (
                          <div key={`dock-${subgroup.id}`} className="generated-tile">
                            {iconUrl ? (
                              <img
                                src={resolveMediaUrl(iconUrl)}
                                alt={subgroup.name}
                                className="generated-tile-icon"
                              />
                            ) : (
                              <div className="generated-tile-placeholder">?</div>
                            )}
                            <span className="generated-tile-label">{subgroup.name}</span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </>
            ) : (
              <p className="muted">Toggle on Graphical Editor to place subgroup tiles on the map.</p>
            )}
          </section>


        </>
      ) : null}

      {mainView === "home" ? (
      <section className="panel home-hero">
        <h2 className="title-artistic">Space Case Cruises</h2>
      </section>
      ) : null}

      {mainView === "home" ? (
      <section className="home-links-grid collapsible-menu-grid">
        <button className="panel home-link-card" onClick={() => setGeneratedPage({ kind: "home" })}>
          <h3>Special Cruises</h3>
        </button>
        <button className="panel home-link-card" onClick={() => setMainView("cadre")}>
          <h3>Cadre</h3>
        </button>
        <button className="panel home-link-card" onClick={() => setMainView("collectables")}>
          <h3>Collectables</h3>
        </button>
        <button className="panel home-link-card" onClick={() => setMainView("profile")}>
          <h3>Stats</h3>
        </button>
      </section>
      ) : null}

      {mainView === "home" ? (
      <section className="panel generated-panel">

        {generatedPage.kind === "home" ? (
          <>
            <div className="generated-grid special-cruises-grid">
              {activeCruises.map((cruise) => (
                <article key={`home-${cruise.id}`} className="generated-card">
                  <h3 className="generated-card-title">{cruise.name}</h3>
                  <p className="muted small generated-card-dates">
                    Start: {formatCruiseDate(cruise.starts_on)} • Concludes: {formatCruiseDate(cruise.ends_on)}
                  </p>
                  {cruise.location ? (
                    <p className="muted small generated-card-location">{cruise.location}</p>
                  ) : null}
                  {cruise.special_page_image_url ? (
                    <button
                      className="generated-media-button generated-media-frame"
                      onClick={() => setGeneratedPage({ kind: "cruise", cruiseId: cruise.id })}
                      aria-label={`Open ${cruise.name} cruise page`}
                    >
                      <img
                        src={resolveMediaUrl(cruise.special_page_image_url)}
                        alt={cruise.name}
                        className="generated-media"
                      />
                    </button>
                  ) : (
                    <div className="generated-placeholder generated-media-placeholder">No Special Cruises image yet</div>
                  )}
                  <button
                    className="generated-cta"
                    onClick={() => setGeneratedPage({ kind: "cruise", cruiseId: cruise.id })}
                  >
                    Schedule Cruise!!
                  </button>
                </article>
              ))}
            </div>
            {!activeCruises.length ? <p className="error">No active cruises available yet.</p> : null}
          </>
        ) : null}

        {generatedPage.kind === "cruise" && generatedCruise ? (
          <>
            <div className="generated-header">
              <h3>{generatedCruise.name}</h3>
              <p className="muted small">
                {generatedCruise.year}
                {generatedCruise.location ? ` • ${generatedCruise.location}` : ""}
              </p>
              {(generatedCruise.starts_on || generatedCruise.ends_on) ? (
                <p className="muted small">
                  {generatedCruise.starts_on ? `Start: ${formatCruiseDate(generatedCruise.starts_on)}` : ""}
                  {generatedCruise.starts_on && generatedCruise.ends_on ? " • " : ""}
                  {generatedCruise.ends_on ? `Concludes: ${formatCruiseDate(generatedCruise.ends_on)}` : ""}
                </p>
              ) : null}
              {generatedCruise.casting_cost !== null && generatedCruise.casting_cost > 0 ? (
                <div className="casting-cost-display">
                  <span className="casting-cost-label">Casting Cost: </span>
                  {generatedCruise.casting_cost_url ? (
                    <a 
                      href={generatedCruise.casting_cost_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="casting-cost-symbols"
                    >
                      {"❀".repeat(generatedCruise.casting_cost)}
                    </a>
                  ) : (
                    <span className="casting-cost-symbols">
                      {"❀".repeat(generatedCruise.casting_cost)}
                    </span>
                  )}
                </div>
              ) : null}
            </div>
            {generatedCruise.map_image_url ? (
              <div className="generated-map-canvas">
                <img
                  src={resolveMediaUrl(generatedCruise.map_image_url)}
                  alt={`${generatedCruise.name} map`}
                  className="generated-hero"
                />
                {generatedCruiseMapSubgroups.map((item) => {
                  const subgroup = subgroupById.get(item.subgroup_id);
                  if (!subgroup) {
                    return null;
                  }

                  const iconUrl = subgroup.default_tile_image_url;
                  if (!iconUrl || item.map_x === null || item.map_y === null) {
                    return null;
                  }

                  return (
                    <button
                      key={`generated-map-${item.id}`}
                      className="generated-map-tile-container"
                      onClick={() =>
                        setGeneratedPage({
                          kind: "subgroup",
                          cruiseId: generatedCruise.id,
                          subgroupId: subgroup.id,
                        })
                      }
                      style={{
                        left: `${item.map_x}%`,
                        top: `${item.map_y}%`,
                        transform: `translate(-50%, -50%) scale(${item.map_scale || 1})`,
                      }}
                    >
                      <img
                        className="generated-map-tile-icon"
                        src={resolveMediaUrl(iconUrl)}
                        alt={item.override_name?.trim() || subgroup.name}
                        loading="lazy"
                      />
                      <span className="generated-map-label">
                        {item.override_name?.trim() || subgroup.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="generated-placeholder">No cruise map image uploaded.</div>
            )}

            <div className="generated-tile-dock">
              {generatedCruiseDockSubgroups.map((item) => {
                const subgroup = subgroupById.get(item.subgroup_id);
                if (!subgroup) {
                  return null;
                }

                const subgroupName = item.override_name?.trim() || subgroup.name;
                const tileImage = subgroup.default_tile_image_url;

                return (
                  <button
                    key={`cruise-subgroup-${item.id}`}
                    className="generated-tile"
                    onClick={() =>
                      setGeneratedPage({
                        kind: "subgroup",
                        cruiseId: generatedCruise.id,
                        subgroupId: subgroup.id,
                      })
                    }
                  >
                    {tileImage ? (
                      <img
                        src={resolveMediaUrl(tileImage)}
                        alt={subgroupName}
                        className="generated-tile-icon"
                        loading="lazy"
                      />
                    ) : (
                      <div className="generated-tile-placeholder">?</div>
                    )}
                    <span className="generated-tile-label">{subgroupName}</span>
                  </button>
                );
              })}
            </div>
            {!generatedCruiseDockSubgroups.length ? (
              <p className="muted">No inactive subgroup tiles in dock for this cruise.</p>
            ) : null}
          </>
        ) : null}

        {generatedPage.kind === "subgroup" ? (
          (() => {
            const subgroup = subgroupById.get(generatedPage.subgroupId);
            const assignment = cruiseSubgroupByPair.get(
              `${generatedPage.subgroupId}:${generatedPage.cruiseId}`,
            );

            if (!subgroup || !assignment || !generatedCruise) {
              return (
                <div>
                  <p className="error">Subgroup page preview is unavailable for this selection.</p>
                  <button onClick={() => setGeneratedPage({ kind: "home" })}>Back to Home</button>
                </div>
              );
            }

            const subgroupName = assignment.override_name?.trim() || subgroup.name;
            const subgroupDescription =
              assignment.override_description?.trim() ||
              subgroup.default_description ||
              "No description yet.";
            const subgroupDifficulty =
              assignment.cost_level_override === null
                ? subgroup.default_cost_level
                : assignment.cost_level_override;
            const commitmentDetail = cruiseSubgroupDetails[assignment.id];
            const committedCadets = commitmentDetail?.committed_cadets ?? [];
            const currentUserCommitted = Boolean(
              profile?.id && committedCadets.some((cadet) => cadet.id === profile.id),
            );
            const committedOthers = committedCadets.filter((cadet) => cadet.id !== profile?.id);
            const commitmentCount = commitmentDetail?.commitment_count ?? committedCadets.length;
            const loadingCommitments = loadingCruiseSubgroupDetailId === assignment.id;
            const togglingCommitment = togglingCommitmentCruiseSubgroupId === assignment.id;

            return (
              <div className="generated-subgroup-page">
                <div className="generated-header">
                  <h3>{subgroupName}</h3>
                  <p className="muted small">Cruise: {generatedCruise.name}</p>
                </div>
                {assignment.detail_image_url ? (
                  <img
                    src={resolveMediaUrl(assignment.detail_image_url)}
                    alt={`${subgroupName} poster`}
                    className="generated-hero"
                    loading="lazy"
                  />
                ) : (
                  <div className="generated-placeholder">No subgroup poster uploaded.</div>
                )}
                <p className="subgroup-description">{subgroupDescription}</p>
                <p className="small">Challenge: <span className="difficulty-symbols">{"꩜".repeat(subgroupDifficulty)}</span></p>
                <p className="small">Phone extension: {subgroup.extension || "n/a"}</p>
                <p className="small">Committed cadets: {commitmentCount}</p>
                <div className="generated-actions">
                  <button
                    onClick={() =>
                      void toggleCommitmentForCruiseSubgroup(assignment.id, currentUserCommitted)
                    }
                    disabled={loadingCommitments || togglingCommitment}
                  >
                    {togglingCommitment
                      ? "Saving..."
                      : currentUserCommitted
                        ? "Withdraw Commitment"
                        : "Subscribe / Commit"}
                  </button>
                </div>
                {subgroupCommitmentMessage ? (
                  <p className="small">{subgroupCommitmentMessage}</p>
                ) : null}
                {subgroupCommitmentError ? <p className="error">{subgroupCommitmentError}</p> : null}
                <p className="small">Others who subscribed/committed:</p>
                {loadingCommitments ? (
                  <p className="muted small">Loading committed cadets...</p>
                ) : committedOthers.length ? (
                  <ul>
                    {committedOthers.map((cadet) => {
                      const cadreCadet = cadreById.get(cadet.id);
                      const avatarUrl = cadreCadet?.avatar_url;

                      return (
                        <li key={cadet.id}>
                          <div className="cadet-head">
                            {avatarUrl ? (
                              <img
                                className="cadet-avatar"
                                src={resolveMediaUrl(avatarUrl)}
                                alt={`${cadet.playa_name} avatar`}
                              />
                            ) : (
                              <div className="cadet-avatar cadet-avatar-fallback">?</div>
                            )}
                            <span>
                              {cadet.playa_name}
                              {cadet.pronouns ? ` (${labelPronouns(cadet.pronouns)})` : ""}
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="muted small">No other cadets committed yet.</p>
                )}
                <div className="generated-actions">
                  <button
                    onClick={() =>
                      setGeneratedPage({ kind: "cruise", cruiseId: generatedCruise.id })
                    }
                  >
                    Back to Cruise
                  </button>
                  <button onClick={() => setGeneratedPage({ kind: "home" })}>Back to Home</button>
                </div>
              </div>
            );
          })()
        ) : null}
      </section>
      ) : null}

    </main>
  );
}

export default App;
