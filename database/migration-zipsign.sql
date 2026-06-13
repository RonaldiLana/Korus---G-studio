-- Zipsign Integration Migration
-- Execute this script in your PostgreSQL database

-- Add zipsign_config column to agencies table
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS zipsign_config TEXT;

-- Contract Templates table (Master manages templates per agency)
CREATE TABLE IF NOT EXISTS contract_templates (
  id SERIAL PRIMARY KEY,
  agency_id INTEGER NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(agency_id, name)
);

-- Process Contracts table (Links processes to contract documents)
CREATE TABLE IF NOT EXISTS process_contracts (
  id SERIAL PRIMARY KEY,
  agency_id INTEGER NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  process_id INTEGER NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
  contract_template_id INTEGER REFERENCES contract_templates(id) ON DELETE SET NULL,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, signed, expired, rejected
  zipsign_document_id TEXT UNIQUE,
  zipsign_sign_url TEXT,
  signer_email TEXT NOT NULL,
  signer_name TEXT NOT NULL,
  signed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Contract Audit/Signature Logs (For tracking signature events)
CREATE TABLE IF NOT EXISTS contract_signature_logs (
  id SERIAL PRIMARY KEY,
  process_contract_id INTEGER NOT NULL REFERENCES process_contracts(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- created, signed, rejected, expired, error
  event_data TEXT, -- JSON with additional details
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_contract_templates_agency_id ON contract_templates(agency_id);
CREATE INDEX IF NOT EXISTS idx_process_contracts_agency_id ON process_contracts(agency_id);
CREATE INDEX IF NOT EXISTS idx_process_contracts_process_id ON process_contracts(process_id);
CREATE INDEX IF NOT EXISTS idx_process_contracts_status ON process_contracts(status);
CREATE INDEX IF NOT EXISTS idx_contract_signature_logs_contract_id ON contract_signature_logs(process_contract_id);

-- Audit trigger for contract updates
CREATE OR REPLACE FUNCTION update_contract_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER process_contracts_update_timestamp
BEFORE UPDATE ON process_contracts
FOR EACH ROW
EXECUTE FUNCTION update_contract_timestamp();

CREATE TRIGGER contract_templates_update_timestamp
BEFORE UPDATE ON contract_templates
FOR EACH ROW
EXECUTE FUNCTION update_contract_timestamp();
