import { mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { isDatabaseEnabled, pool } from "./db.js";
import {
  applyMemoryStoreSnapshot,
  createMemoryStoreSnapshot,
  type MemoryStoreSnapshot,
} from "./store.js";

const backupsRootDir = resolve(process.cwd(), "backups");
const snapshotsDir = resolve(backupsRootDir, "snapshots");
const latestMemorySnapshotPath = resolve(backupsRootDir, "latest-memory.json");
const latestDatabaseSnapshotPath = resolve(backupsRootDir, "latest-database.json");
const maxSnapshots = 100;

const ensureBackupDirs = (): void => {
  mkdirSync(backupsRootDir, { recursive: true });
  mkdirSync(snapshotsDir, { recursive: true });
};

const timestampPart = (): string => new Date().toISOString().replace(/[:.]/g, "-");

const pruneSnapshotFiles = (): void => {
  let files: string[] = [];
  try {
    files = readdirSync(snapshotsDir)
      .filter((name) => name.endsWith(".json"))
      .sort();
  } catch {
    return;
  }

  if (files.length <= maxSnapshots) {
    return;
  }

  const toDelete = files.slice(0, files.length - maxSnapshots);
  for (const name of toDelete) {
    try {
      unlinkSync(resolve(snapshotsDir, name));
    } catch {
      // no-op
    }
  }
};

const writeJsonSync = (filePath: string, data: unknown): void => {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
};

const queryAllDatabaseTables = async (): Promise<Record<string, unknown[]>> => {
  if (!pool) {
    return {};
  }

  const tableNames = [
    "users",
    "cruises",
    "subgroups",
    "cruise_subgroups",
    "badges",
    "cadet_badges",
    "commitments",
  ];

  const data: Record<string, unknown[]> = {};
  for (const table of tableNames) {
    const result = await pool.query(`select * from ${table}`);
    data[table] = result.rows;
  }

  return data;
};

export const writeBackupSnapshot = async (reason: string): Promise<void> => {
  ensureBackupDirs();

  try {
    const timestamp = timestampPart();

    if (!isDatabaseEnabled || !pool) {
      const snapshot: MemoryStoreSnapshot = createMemoryStoreSnapshot();
      const payload = {
        mode: "memory",
        reason,
        timestamp: new Date().toISOString(),
        snapshot,
      } as const;

      writeJsonSync(resolve(snapshotsDir, `${timestamp}--memory.json`), payload);
      writeJsonSync(latestMemorySnapshotPath, payload);
      pruneSnapshotFiles();
      return;
    }

    const tables = await queryAllDatabaseTables();
    const payload = {
      mode: "postgres",
      reason,
      timestamp: new Date().toISOString(),
      tables,
    } as const;

    writeJsonSync(resolve(snapshotsDir, `${timestamp}--database.json`), payload);
    writeJsonSync(latestDatabaseSnapshotPath, payload);
    pruneSnapshotFiles();
  } catch (error) {
    console.error("[backup] Failed to write snapshot", error);
  }
};

export const restoreLatestMemoryBackupIfPresent = (): void => {
  if (isDatabaseEnabled) {
    return;
  }

  ensureBackupDirs();

  try {
    const raw = readFileSync(latestMemorySnapshotPath, "utf8");
    const parsed = JSON.parse(raw) as {
      snapshot?: MemoryStoreSnapshot;
      mode?: string;
    };

    if (parsed.mode !== "memory" || !parsed.snapshot) {
      return;
    }

    applyMemoryStoreSnapshot(parsed.snapshot);
  } catch {
    // no existing backup yet
  }
};
