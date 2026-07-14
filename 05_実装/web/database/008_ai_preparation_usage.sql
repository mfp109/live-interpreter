CREATE TABLE ai_preparation_usage (
  user_id CHAR(36) NOT NULL,
  usage_date DATE NOT NULL,
  generation_count TINYINT UNSIGNED NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, usage_date),
  CONSTRAINT fk_ai_preparation_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
