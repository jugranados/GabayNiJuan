-- Gabay ni Juan — Milestone 5, part 1 of 2: audit entity type for election offices.
--
-- A new enum value cannot be used in the transaction that adds it, and the next migration
-- writes revisions for `election_offices` while it backfills. So the value is added here,
-- in its own migration, and committed first.

alter type public.revision_entity_type add value if not exists 'ELECTION_OFFICE';
