-- Preserve historical alerts while making each assignment due-date occurrence unique.
CREATE UNIQUE INDEX "OverdueAlert_assignmentId_dueAtSnapshot_key"
ON "OverdueAlert"("assignmentId", "dueAtSnapshot");
