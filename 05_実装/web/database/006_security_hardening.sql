ALTER TABLE users
  ADD COLUMN auth_version INT UNSIGNED NOT NULL DEFAULT 1 AFTER password_hash;

ALTER TABLE payments
  ADD COLUMN refunded_minor INT UNSIGNED NOT NULL DEFAULT 0 AFTER amount_minor,
  ADD COLUMN revoked_seconds INT UNSIGNED NOT NULL DEFAULT 0 AFTER refunded_minor;

CREATE TABLE password_reset_attempts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email_hash CHAR(64) NOT NULL,
  ip_hash CHAR(64) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_reset_email_created (email_hash,created_at),
  INDEX idx_reset_ip_created (ip_hash,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
