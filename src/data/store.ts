import { randomUUID } from "node:crypto";
import type {
  Badge,
  BadgeAssignment,
  Commitment,
  Cruise,
  CruiseStatus,
  CruiseSubgroup,
  Subgroup,
  TileVisibilityState,
  User,
} from "../types/domain.js";

const nowIso = () => new Date().toISOString();

const adminId = randomUUID();
const cadetId = randomUUID();
const starchildId = randomUUID();
const cruiseId = randomUUID();
const subgroupCommsId = randomUUID();
const subgroupBuildId = randomUUID();
const cruiseSubgroupCommsId = randomUUID();
const badgeBuilderId = randomUUID();

export const users: User[] = [
  {
    id: adminId,
    email: "admin@spacecase.local",
    playaName: "Captain",
    phoneNumber: "+15550000001",
    preferredContact: "phone",
    pronouns: "they_them",
    avatarUrl: null,
    cadetExtension: "100",
    role: "admin",
    isDisabled: false,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
  {
    id: cadetId,
    email: "cadet@spacecase.local",
    playaName: "Nova",
    phoneNumber: "+15550000002",
    preferredContact: "discord",
    pronouns: "she_her",
    avatarUrl: null,
    cadetExtension: "101",
    role: "user",
    isDisabled: false,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
  {
    id: starchildId,
    email: "starchild01@gmail.com",
    playaName: "Starchild",
    phoneNumber: null,
    preferredContact: null,
    pronouns: null,
    avatarUrl: null,
    cadetExtension: null,
    role: "admin",
    isDisabled: false,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
];

export const badges: Badge[] = [
  {
    id: badgeBuilderId,
    name: "Builder",
    description: "Helped build infrastructure",
    iconUrl: null,
    cruiseId: null,
    createdBy: adminId,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
];

export const badgeAssignments: BadgeAssignment[] = [
  {
    id: randomUUID(),
    userId: cadetId,
    badgeId: badgeBuilderId,
    assignedBy: adminId,
    reason: "Seed recognition",
    assignedAt: nowIso(),
    revokedAt: null,
  },
];

export const commitmentsByUser = new Map<string, Commitment[]>([
  [
    cadetId,
    [
      {
        id: randomUUID(),
        userId: cadetId,
        cruiseSubgroupId: cruiseSubgroupCommsId,
        cruiseId,
        cruiseName: "Space Case Cruise",
        cruiseYear: 2026,
        subgroupId: subgroupCommsId,
        subgroupName: "Comms",
        subgroupExtension: "800",
        status: "committed",
        committedAt: nowIso(),
        withdrawnAt: null,
        completedAt: null,
        updatedAt: nowIso(),
      },
    ],
  ],
]);

export const cruises: Cruise[] = [
  {
    id: cruiseId,
    name: "Space Case Cruise",
    year: 2026,
    location: "Black Rock City",
    startsOn: "2026-08-24",
    endsOn: "2026-09-01",
    mapImageUrl: null,
    specialPageImageUrl: null,
    castingCost: null,
    castingCostUrl: null,
    status: "active",
    isFeatured: true,
    sortOrder: 1,
    forceAllSubgroupsToDock: false,
    createdBy: adminId,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
];

export const subgroups: Subgroup[] = [
  {
    id: subgroupCommsId,
    name: "Comms",
    slug: "comms",
    code: "COMMS",
    defaultDescription: "Communications systems",
    defaultTileImageUrl: null,
    extension: "800",
    defaultCostLevel: 3,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
  {
    id: subgroupBuildId,
    name: "Build",
    slug: "build",
    code: "BUILD",
    defaultDescription: "Build and fabrication",
    defaultTileImageUrl: null,
    extension: "801",
    defaultCostLevel: 2,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
];

export const cruiseSubgroups: CruiseSubgroup[] = [
  {
    id: cruiseSubgroupCommsId,
    cruiseId,
    subgroupId: subgroupCommsId,
    overrideName: null,
    overrideDescription: null,
    detailImageUrl: null,
    costLevelOverride: null,
    visibilityState: "inactive",
    dockVisible: true,
    mapX: null,
    mapY: null,
    mapScale: 1,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
];

export const findUserById = (id: string): User | undefined => users.find((user) => user.id === id);

export const findUserByEmail = (email: string): User | undefined =>
  users.find((user) => user.email.toLowerCase() === email.toLowerCase());

export const userHasCadetExtension = (cadetExtension: string, exceptUserId?: string): boolean =>
  users.some(
    (user) =>
      user.cadetExtension !== null &&
      user.cadetExtension === cadetExtension &&
      (exceptUserId === undefined || user.id !== exceptUserId),
  );

export const updateUser = (userId: string, updater: (existing: User) => User): User | undefined => {
  const index = users.findIndex((user) => user.id === userId);
  if (index === -1) {
    return undefined;
  }

  const existing = users[index];
  if (!existing) {
    return undefined;
  }

  const updated = updater(existing);
  users[index] = { ...updated, updatedAt: nowIso() };
  return users[index];
};

export const deleteUser = (userId: string): boolean => {
  const index = users.findIndex((user) => user.id === userId);
  if (index === -1) {
    return false;
  }

  const [removed] = users.splice(index, 1);

  if (!removed) {
    return false;
  }

  // Clean up any in-memory commitments and badge assignments for this user.
  commitmentsByUser.delete(userId);

  for (let i = badgeAssignments.length - 1; i >= 0; i -= 1) {
    if (badgeAssignments[i]?.userId === userId) {
      badgeAssignments.splice(i, 1);
    }
  }

  // Also remove as creator from cruises/badges if needed (non-destructive to records).
  for (const cruise of cruises) {
    if (cruise.createdBy === removed.id) {
      cruise.createdBy = null;
    }
  }
  for (const badge of badges) {
    if (badge.createdBy === removed.id) {
      badge.createdBy = null;
    }
  }

  return true;
};

export const listBadges = (): Badge[] => badges;

export const findBadgeById = (id: string): Badge | undefined => badges.find((badge) => badge.id === id);

export const createBadge = (input: Omit<Badge, "id" | "createdAt" | "updatedAt">): Badge => {
  const created: Badge = {
    ...input,
    id: randomUUID(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  badges.push(created);
  return created;
};

export const updateBadge = (
  badgeIdValue: string,
  updater: (existing: Badge) => Badge,
): Badge | undefined => {
  const index = badges.findIndex((badge) => badge.id === badgeIdValue);
  if (index === -1) {
    return undefined;
  }

  const existing = badges[index];
  if (!existing) {
    return undefined;
  }

  const updated = updater(existing);
  badges[index] = { ...updated, updatedAt: nowIso() };
  return badges[index];
};

export const listBadgeAssignments = (): BadgeAssignment[] => badgeAssignments;

export const findBadgeAssignmentById = (id: string): BadgeAssignment | undefined =>
  badgeAssignments.find((assignment) => assignment.id === id);

export const findActiveBadgeAssignment = (
  userId: string,
  badgeId: string,
): BadgeAssignment | undefined =>
  badgeAssignments.find(
    (assignment) => assignment.userId === userId && assignment.badgeId === badgeId && assignment.revokedAt === null,
  );

export const createBadgeAssignment = (
  input: Omit<BadgeAssignment, "id" | "assignedAt" | "revokedAt">,
): BadgeAssignment => {
  const created: BadgeAssignment = {
    ...input,
    id: randomUUID(),
    assignedAt: nowIso(),
    revokedAt: null,
  };

  badgeAssignments.push(created);
  return created;
};

export const revokeBadgeAssignment = (assignmentId: string): BadgeAssignment | undefined => {
  const index = badgeAssignments.findIndex((assignment) => assignment.id === assignmentId);
  if (index === -1) {
    return undefined;
  }

  const existing = badgeAssignments[index];
  if (!existing) {
    return undefined;
  }

  const revoked: BadgeAssignment = {
    ...existing,
    revokedAt: existing.revokedAt ?? nowIso(),
  };
  badgeAssignments[index] = revoked;
  return revoked;
};

export const getUserBadges = (userId: string): Badge[] => {
  const activeBadgeIds = badgeAssignments
    .filter((assignment) => assignment.userId === userId && assignment.revokedAt === null)
    .map((assignment) => assignment.badgeId);

  return badges.filter((badge) => activeBadgeIds.includes(badge.id));
};

export const getUserCommitments = (userId: string): Commitment[] => commitmentsByUser.get(userId) ?? [];

export const getAllCommitments = (): Commitment[] =>
  Array.from(commitmentsByUser.values()).flat();

export const findCommitment = (
  userId: string,
  cruiseSubgroupId: string,
): Commitment | undefined =>
  (commitmentsByUser.get(userId) ?? []).find(
    (commitment) => commitment.cruiseSubgroupId === cruiseSubgroupId,
  );

export const listCommitmentsForCruiseSubgroup = (
  cruiseSubgroupId: string,
  statusFilter?: Array<"committed" | "withdrawn" | "completed">,
): Commitment[] =>
  getAllCommitments().filter(
    (commitment) =>
      commitment.cruiseSubgroupId === cruiseSubgroupId &&
      (statusFilter === undefined || statusFilter.includes(commitment.status)),
  );

const ensureCommitmentCollection = (userId: string): Commitment[] => {
  const existing = commitmentsByUser.get(userId);
  if (existing) {
    return existing;
  }

  const created: Commitment[] = [];
  commitmentsByUser.set(userId, created);
  return created;
};

const updateCommitmentInCollection = (
  collection: Commitment[],
  commitmentId: string,
  updater: (existing: Commitment) => Commitment,
): Commitment | undefined => {
  const index = collection.findIndex((entry) => entry.id === commitmentId);
  if (index === -1) {
    return undefined;
  }

  const existing = collection[index];
  if (!existing) {
    return undefined;
  }

  const updated = updater(existing);
  collection[index] = { ...updated, updatedAt: nowIso() };
  return collection[index];
};

export const createCommitment = (
  userId: string,
  cruiseSubgroupIdValue: string,
): Commitment | undefined => {
  const assignment = findCruiseSubgroupById(cruiseSubgroupIdValue);
  if (!assignment) {
    return undefined;
  }

  const cruise = findCruiseById(assignment.cruiseId);
  const subgroup = findSubgroupById(assignment.subgroupId);
  if (!cruise || !subgroup) {
    return undefined;
  }

  const collection = ensureCommitmentCollection(userId);
  const timestamp = nowIso();
  const created: Commitment = {
    id: randomUUID(),
    userId,
    cruiseSubgroupId: assignment.id,
    cruiseId: cruise.id,
    cruiseName: cruise.name,
    cruiseYear: cruise.year,
    subgroupId: subgroup.id,
    subgroupName: assignment.overrideName ?? subgroup.name,
    subgroupExtension: subgroup.extension,
    status: "committed",
    committedAt: timestamp,
    withdrawnAt: null,
    completedAt: null,
    updatedAt: timestamp,
  };

  collection.push(created);
  return created;
};

export const transitionCommitment = (
  userId: string,
  cruiseSubgroupIdValue: string,
  action: "commit" | "withdraw" | "recommit",
): { commitment?: Commitment; errorCode?: "NOT_FOUND" | "INVALID_TRANSITION" | "CONFLICT" } => {
  const existing = findCommitment(userId, cruiseSubgroupIdValue);

  if (!existing) {
    if (action !== "commit") {
      return { errorCode: "INVALID_TRANSITION" };
    }

    const created = createCommitment(userId, cruiseSubgroupIdValue);
    if (!created) {
      return { errorCode: "NOT_FOUND" };
    }

    return { commitment: created };
  }

  if (existing.status === "completed") {
    return { errorCode: "CONFLICT" };
  }

  const collection = commitmentsByUser.get(userId);
  if (!collection) {
    return { errorCode: "NOT_FOUND" };
  }

  if (existing.status === "committed" && action === "withdraw") {
    const timestamp = nowIso();
    const updated = updateCommitmentInCollection(collection, existing.id, (current) => ({
      ...current,
      status: "withdrawn",
      withdrawnAt: timestamp,
      completedAt: null,
    }));

    return { commitment: updated };
  }

  if (existing.status === "withdrawn" && action === "recommit") {
    const updated = updateCommitmentInCollection(collection, existing.id, (current) => ({
      ...current,
      status: "committed",
      withdrawnAt: null,
      completedAt: null,
    }));

    return { commitment: updated };
  }

  return { errorCode: "INVALID_TRANSITION" };
};

export const listCruises = (includeArchived: boolean): Cruise[] =>
  includeArchived ? cruises : cruises.filter((cruise) => cruise.status !== "archived");

export const findCruiseById = (id: string): Cruise | undefined =>
  cruises.find((cruise) => cruise.id === id);

export const createCruise = (input: Omit<Cruise, "id" | "createdAt" | "updatedAt">): Cruise => {
  const created: Cruise = {
    ...input,
    id: randomUUID(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  cruises.push(created);
  return created;
};

export const updateCruise = (
  cruiseIdValue: string,
  updater: (existing: Cruise) => Cruise,
): Cruise | undefined => {
  const index = cruises.findIndex((cruise) => cruise.id === cruiseIdValue);
  if (index === -1) {
    return undefined;
  }

  const existing = cruises[index];
  if (!existing) {
    return undefined;
  }

  const updated = updater(existing);
  cruises[index] = { ...updated, updatedAt: nowIso() };
  return cruises[index];
};

export const listSubgroups = (): Subgroup[] => subgroups;

export const findSubgroupById = (id: string): Subgroup | undefined =>
  subgroups.find((subgroup) => subgroup.id === id);

export const subgroupSlugExists = (slug: string, exceptSubgroupId?: string): boolean =>
  subgroups.some(
    (subgroup) => subgroup.slug === slug && (exceptSubgroupId === undefined || subgroup.id !== exceptSubgroupId),
  );

export const subgroupCodeExists = (code: string, exceptSubgroupId?: string): boolean =>
  subgroups.some(
    (subgroup) => subgroup.code === code && (exceptSubgroupId === undefined || subgroup.id !== exceptSubgroupId),
  );

export const subgroupExtensionExists = (extension: string, exceptSubgroupId?: string): boolean =>
  subgroups.some(
    (subgroup) =>
      subgroup.extension !== null &&
      subgroup.extension === extension &&
      (exceptSubgroupId === undefined || subgroup.id !== exceptSubgroupId),
  );

export const createSubgroup = (
  input: Omit<Subgroup, "id" | "createdAt" | "updatedAt">,
): Subgroup => {
  const created: Subgroup = {
    ...input,
    id: randomUUID(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  subgroups.push(created);
  return created;
};

export const updateSubgroup = (
  subgroupIdValue: string,
  updater: (existing: Subgroup) => Subgroup,
): Subgroup | undefined => {
  const index = subgroups.findIndex((subgroup) => subgroup.id === subgroupIdValue);
  if (index === -1) {
    return undefined;
  }

  const existing = subgroups[index];
  if (!existing) {
    return undefined;
  }

  const updated = updater(existing);
  subgroups[index] = { ...updated, updatedAt: nowIso() };
  return subgroups[index];
};

export const listCruiseSubgroups = (cruiseIdValue: string): CruiseSubgroup[] =>
  cruiseSubgroups.filter((assignment) => assignment.cruiseId === cruiseIdValue);

export const findCruiseSubgroupById = (id: string): CruiseSubgroup | undefined =>
  cruiseSubgroups.find((assignment) => assignment.id === id);

export const findCruiseSubgroupBySubgroupId = (subgroupIdValue: string): CruiseSubgroup | undefined =>
  cruiseSubgroups.find((assignment) => assignment.subgroupId === subgroupIdValue);

export const cruiseSubgroupPairExists = (cruiseIdValue: string, subgroupIdValue: string): boolean =>
  cruiseSubgroups.some(
    (assignment) => assignment.cruiseId === cruiseIdValue && assignment.subgroupId === subgroupIdValue,
  );

export const createCruiseSubgroup = (
  input: Omit<CruiseSubgroup, "id" | "createdAt" | "updatedAt">,
): CruiseSubgroup => {
  const created: CruiseSubgroup = {
    ...input,
    id: randomUUID(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  cruiseSubgroups.push(created);
  return created;
};

export const updateCruiseSubgroup = (
  cruiseSubgroupId: string,
  updater: (existing: CruiseSubgroup) => CruiseSubgroup,
): CruiseSubgroup | undefined => {
  const index = cruiseSubgroups.findIndex((assignment) => assignment.id === cruiseSubgroupId);
  if (index === -1) {
    return undefined;
  }

  const existing = cruiseSubgroups[index];
  if (!existing) {
    return undefined;
  }

  const updated = updater(existing);
  cruiseSubgroups[index] = { ...updated, updatedAt: nowIso() };
  return cruiseSubgroups[index];
};

export const deleteCruiseSubgroup = (cruiseSubgroupId: string): boolean => {
  const index = cruiseSubgroups.findIndex((a) => a.id === cruiseSubgroupId);
  if (index === -1) return false;
  cruiseSubgroups.splice(index, 1);
  return true;
};

export const resolveCruiseSubgroupVisibility = (
  cruise: Cruise,
  desiredState: TileVisibilityState,
): TileVisibilityState => {
  if (!cruise.forceAllSubgroupsToDock) {
    return desiredState;
  }

  return desiredState === "active" ? "inactive" : desiredState;
};

export const resolveCruiseStatus = (status: CruiseStatus): CruiseStatus => status;

export interface MemoryStoreSnapshot {
  users: User[];
  cruises: Cruise[];
  subgroups: Subgroup[];
  cruiseSubgroups: CruiseSubgroup[];
  badges: Badge[];
  badgeAssignments: BadgeAssignment[];
  commitments: Commitment[];
}

export const createMemoryStoreSnapshot = (): MemoryStoreSnapshot => ({
  users: users.map((item) => ({ ...item })),
  cruises: cruises.map((item) => ({ ...item })),
  subgroups: subgroups.map((item) => ({ ...item })),
  cruiseSubgroups: cruiseSubgroups.map((item) => ({ ...item })),
  badges: badges.map((item) => ({ ...item })),
  badgeAssignments: badgeAssignments.map((item) => ({ ...item })),
  commitments: getAllCommitments().map((item) => ({ ...item })),
});

export const applyMemoryStoreSnapshot = (snapshot: MemoryStoreSnapshot): void => {
  users.splice(0, users.length, ...snapshot.users.map((item) => ({ ...item })));
  cruises.splice(0, cruises.length, ...snapshot.cruises.map((item) => ({ ...item })));
  subgroups.splice(0, subgroups.length, ...snapshot.subgroups.map((item) => ({ ...item })));
  cruiseSubgroups.splice(
    0,
    cruiseSubgroups.length,
    ...snapshot.cruiseSubgroups.map((item) => ({ ...item })),
  );
  badges.splice(0, badges.length, ...snapshot.badges.map((item) => ({ ...item })));
  badgeAssignments.splice(
    0,
    badgeAssignments.length,
    ...snapshot.badgeAssignments.map((item) => ({ ...item })),
  );

  commitmentsByUser.clear();
  for (const commitment of snapshot.commitments) {
    const existing = commitmentsByUser.get(commitment.userId);
    if (existing) {
      existing.push({ ...commitment });
    } else {
      commitmentsByUser.set(commitment.userId, [{ ...commitment }]);
    }
  }
};
