CREATE TABLE usage_events (
  id CHAR(36) PRIMARY KEY,
  session_id CHAR(36) NOT NULL,
  sequence INT UNSIGNED NOT NULL,
  requested_seconds TINYINT UNSIGNED NOT NULL,
  consumed_seconds TINYINT UNSIGNED NOT NULL DEFAULT 0,
  trial_seconds TINYINT UNSIGNED NOT NULL DEFAULT 0,
  paid_seconds TINYINT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_usage_session FOREIGN KEY (session_id) REFERENCES translation_sessions(id),
  UNIQUE KEY uq_usage_session_sequence (session_id, sequence)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
