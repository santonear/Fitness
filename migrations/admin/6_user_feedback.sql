-- 用户留言：只保存用户在“我的 → 给我们留言”里主动填写并发送的内容。
-- 不保存训练、身体或聊天记录；不保存 IP，限流键是加密摘要，按小时/天分桶并定期清理。
CREATE TABLE IF NOT EXISTS user_feedback (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  subject_short_id TEXT,
  message TEXT NOT NULL,
  contact TEXT,
  locale TEXT NOT NULL DEFAULT 'zh',
  status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','handled')),
  handled_at INTEGER,
  handled_by TEXT
);
CREATE INDEX IF NOT EXISTS user_feedback_status_created ON user_feedback(status, created_at);
CREATE TABLE IF NOT EXISTS user_feedback_rate (
  key TEXT NOT NULL,
  bucket TEXT NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (key, bucket)
);
