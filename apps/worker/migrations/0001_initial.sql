PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS profiles (
  profile_id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  config_json TEXT NOT NULL,
  timezone TEXT NOT NULL,
  schedule_json TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  last_run_at TEXT,
  next_run_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_profiles_due ON profiles(next_run_at, enabled);

CREATE TABLE IF NOT EXISTS runs (
  run_id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(profile_id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  source_counts_json TEXT,
  grade_counts_json TEXT,
  error_summary TEXT
);
CREATE INDEX IF NOT EXISTS idx_runs_profile_started ON runs(profile_id, started_at);

CREATE TABLE IF NOT EXISTS papers (
  paper_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  normalized_title TEXT NOT NULL,
  abstract TEXT NOT NULL DEFAULT '',
  doi TEXT,
  openalex_id TEXT,
  arxiv_id TEXT,
  authors_json TEXT NOT NULL DEFAULT '[]',
  venue TEXT,
  publication_date TEXT,
  url TEXT,
  sources_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS profile_papers (
  profile_id TEXT NOT NULL REFERENCES profiles(profile_id) ON DELETE CASCADE,
  paper_id TEXT NOT NULL REFERENCES papers(paper_id) ON DELETE CASCADE,
  grade TEXT NOT NULL CHECK (grade IN ('A', 'B', 'C', 'D')),
  score REAL NOT NULL,
  reasons_json TEXT NOT NULL DEFAULT '[]',
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  feedback_state TEXT,
  hidden INTEGER NOT NULL DEFAULT 0 CHECK (hidden IN (0, 1)),
  originating_run_id TEXT REFERENCES runs(run_id) ON DELETE SET NULL,
  PRIMARY KEY (profile_id, paper_id)
);
CREATE INDEX IF NOT EXISTS idx_profile_papers_grade_seen ON profile_papers(profile_id, grade, last_seen_at);
