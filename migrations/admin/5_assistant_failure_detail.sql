-- Diagnostic paths and error categories only. Never store user text or model output.
ALTER TABLE assistant_usage ADD COLUMN failure_detail TEXT;
