const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const test = require("node:test");

const rootDir = path.resolve(__dirname, "..");
const runner = path.join(rootDir, "database/migrations/apply.mjs");

test("migration runner requires an explicitly named development or test database", () => {
  const baseEnv = { ...process.env };
  delete baseEnv.PGDATABASE;
  delete baseEnv.PGHOST;
  delete baseEnv.PGUSER;
  delete baseEnv.PGPASSWORD;
  for (const database of ["", "progress_tracker_electron", "front_identity", "student_bike_rental_test2"]) {
    const env = { ...baseEnv, ...(database ? { PGDATABASE: database } : {}) };
    const result = spawnSync(process.execPath, [runner], { cwd: rootDir, env, encoding: "utf8" });
    assert.notEqual(result.status, 0, `must refuse database name: ${database || "<empty>"}`);
    assert.match(result.stderr, /Refusing migration|PGHOST, PGUSER, and PGPASSWORD/);
  }
});

test("migration runner reaches connection only with explicit isolated DB credentials", () => {
  const result = spawnSync(process.execPath, [runner], {
    cwd: rootDir,
    env: {
      ...process.env,
      PGHOST: "127.0.0.1",
      PGPORT: "1",
      PGDATABASE: "progress_tracker_guard_test",
      PGUSER: "test-only-role",
      PGPASSWORD: "test-only-value",
    },
    encoding: "utf8",
    timeout: 3000,
  });
  assert.notEqual(result.status, 0);
  assert.doesNotMatch(result.stderr, /Refusing migration|PGHOST, PGUSER, and PGPASSWORD/);
});
