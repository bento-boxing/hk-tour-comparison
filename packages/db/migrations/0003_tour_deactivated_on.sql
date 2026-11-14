-- Data retention, owner decision 2026-11-13: a tour inactive for more than 30 days is deleted, with its stops,
-- departures and price snapshots (packages/db/src/save-run.ts). This column is the night it went inactive: the
-- nightly save sets it to the run's Hong Kong date when it marks a tour inactive and clears it when the tour
-- comes back. last_seen cannot stand in for it: after weeks of failed runs, a tour missing from the next good
-- run would already look weeks old on the night it first went missing.
alter table tours add column deactivated_on date;

-- Tours already inactive: when they went inactive is not recorded, so their clock starts now (the Hong Kong
-- date of this migration), never earlier on a guess.
update tours set deactivated_on = (now() at time zone 'Asia/Hong_Kong')::date where not active;

alter table tours add constraint tours_deactivated_on_check check (active = (deactivated_on is null));
