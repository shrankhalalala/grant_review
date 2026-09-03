-- Preserve existing users during the credential rollout. The idempotent seed replaces this
-- temporary non-plaintext value with a bcrypt hash for every development account.
ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT NOT NULL DEFAULT '';

ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP DEFAULT;
