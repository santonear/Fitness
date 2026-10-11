CREATE TABLE IF NOT EXISTS admin_quality_errors (type TEXT NOT NULL, route TEXT NOT NULL, version TEXT NOT NULL, browser TEXT NOT NULL, os TEXT NOT NULL, time INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS admin_quality_errors_time ON admin_quality_errors(time, type);
CREATE TABLE IF NOT EXISTS admin_quality_blocks (day TEXT NOT NULL, category TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(day, category));
CREATE TABLE IF NOT EXISTS admin_quality_evaluations (id TEXT PRIMARY KEY, time INTEGER NOT NULL, report TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS admin_quality_settings (id INTEGER PRIMARY KEY CHECK(id=1), value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS admin_quality_subscriptions (id TEXT PRIMARY KEY, endpoint TEXT NOT NULL UNIQUE, keys TEXT NOT NULL DEFAULT '{}', created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS admin_quality_notifications (id TEXT PRIMARY KEY, category TEXT NOT NULL, count INTEGER NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS admin_quality_deliveries (notification_id TEXT NOT NULL, subscription_id TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0, retry_at INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(notification_id, subscription_id));
CREATE TABLE IF NOT EXISTS admin_quality_daily_claims (subscription_id TEXT NOT NULL, day TEXT NOT NULL, notification_id TEXT NOT NULL, PRIMARY KEY(subscription_id, day));
