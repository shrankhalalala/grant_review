-- Reviews are unique per assignment. Historical soft-removed assignments retain
-- their review while a later reassignment can receive its own review.
DROP INDEX "Review_applicationId_reviewerId_key";
