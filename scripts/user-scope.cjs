const { createHash } = require("node:crypto");

function userBackupSegment(subject) {
  return createHash("sha256").update(subject).digest("hex");
}

function userStateId(subject, baseId = "main") {
  return `${baseId}:user:${userBackupSegment(subject)}`;
}

module.exports = { userStateId, userBackupSegment };
