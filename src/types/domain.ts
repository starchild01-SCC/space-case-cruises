export type Role = "user" | "admin";

export type PronounsType = "they_them" | "he_him" | "she_her" | "any_all";

export type PreferredContactType = "discord" | "text" | "phone" | "email";

export type CommitmentStatus = "committed" | "withdrawn" | "completed";

export type CruiseStatus = "active" | "archived";

export type TileVisibilityState = "invisible" | "inactive" | "active";

export interface User {
  id: string;
  email: string;
  playaName: string;
  phoneNumber: string | null;
  preferredContact: PreferredContactType | null;
  pronouns: PronounsType | null;
  avatarUrl: string | null;
  cadetExtension: string | null;
  role: Role;
  isDisabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Badge {
  id: string;
  name: string;
  description: string | null;
  iconUrl: string | null;
  cruiseId: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BadgeAssignment {
  id: string;
  userId: string;
  badgeId: string;
  assignedBy: string | null;
  reason: string | null;
  assignedAt: string;
  revokedAt: string | null;
}

export interface Commitment {
  id: string;
  userId: string;
  cruiseSubgroupId: string;
  cruiseId: string;
  cruiseName: string;
  cruiseYear: number;
  subgroupId: string;
  subgroupName: string;
  subgroupExtension: string | null;
  status: CommitmentStatus;
  committedAt: string;
  withdrawnAt: string | null;
  completedAt: string | null;
  updatedAt: string;
}

export interface Cruise {
  id: string;
  name: string;
  year: number;
  location: string | null;
  startsOn: string | null;
  endsOn: string | null;
  mapImageUrl: string | null;
  specialPageImageUrl: string | null;
  castingCost: number | null;
  castingCostUrl: string | null;
  status: CruiseStatus;
  isFeatured: boolean;
  sortOrder: number;
  forceAllSubgroupsToDock: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Subgroup {
  id: string;
  name: string;
  slug: string;
  code: string;
  defaultDescription: string | null;
  defaultTileImageUrl: string | null;
  extension: string | null;
  defaultCostLevel: number;
  createdAt: string;
  updatedAt: string;
}

export interface CruiseSubgroup {
  id: string;
  cruiseId: string;
  subgroupId: string;
  overrideName: string | null;
  overrideDescription: string | null;
  detailImageUrl: string | null;
  costLevelOverride: number | null;
  visibilityState: TileVisibilityState;
  dockVisible: boolean;
  mapX: number | null;
  mapY: number | null;
  mapScale: number;
  createdAt: string;
  updatedAt: string;
}
