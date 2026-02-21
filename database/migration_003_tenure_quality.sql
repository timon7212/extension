-- Migration 003: Add tenure_months and data_quality to leads
-- Run this on existing databases to add the new columns

-- Add tenure_months column (nullable integer)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS tenure_months INT;

-- Add data_quality column with default 'complete'
-- (existing leads are considered 'complete' since they were manually created)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'data_quality'
  ) THEN
    ALTER TABLE leads ADD COLUMN data_quality VARCHAR(20) NOT NULL DEFAULT 'complete';
    ALTER TABLE leads ADD CONSTRAINT leads_data_quality_check
      CHECK (data_quality IN ('complete', 'partial', 'needs_enrichment'));
  END IF;
END $$;

-- Create index for data_quality filtering
CREATE INDEX IF NOT EXISTS idx_leads_quality ON leads(data_quality);

-- Mark existing leads without title AND company as 'partial'
UPDATE leads SET data_quality = 'partial'
WHERE (title IS NULL OR title = '') AND (company IS NULL OR company = '')
  AND data_quality = 'complete';
