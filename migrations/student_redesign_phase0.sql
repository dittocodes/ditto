-- Student redesign Phase 0+ columns (run once on local MySQL)
ALTER TABLE students ADD COLUMN IF NOT EXISTS uid VARCHAR(64) NULL UNIQUE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS institution_id VARCHAR(64) NULL;
ALTER TABLE students ADD COLUMN IF NOT EXISTS programme_id VARCHAR(64) NULL;
ALTER TABLE students ADD COLUMN IF NOT EXISTS batch_id VARCHAR(64) NULL;
ALTER TABLE students ADD COLUMN IF NOT EXISTS verified_at DATETIME NULL;
CREATE INDEX IF NOT EXISTS idx_students_uid ON students(uid);
