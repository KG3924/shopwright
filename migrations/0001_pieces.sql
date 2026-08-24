-- Unowned shop pieces. Auth is deferred: a row is keyed by piece id, not a user.
-- Anyone with this local app can list and reopen local pieces.
create table if not exists pieces (
  id text primary key,
  name text not null,
  source_kind text not null,
  project jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);

create index if not exists pieces_updated_at_idx on pieces (updated_at desc);
