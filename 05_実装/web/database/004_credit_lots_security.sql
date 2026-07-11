CREATE TABLE credit_lots (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  balance_type ENUM('trial','paid') NOT NULL,
  source_type ENUM('trial','payment','admin') NOT NULL,
  source_id VARCHAR(255) NOT NULL,
  seconds_granted INT UNSIGNED NOT NULL,
  seconds_remaining INT UNSIGNED NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_credit_lot_user FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE KEY uq_credit_lot_source (source_type, source_id),
  INDEX idx_credit_lot_consumption (user_id,balance_type,expires_at,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE auth_attempts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email_hash CHAR(64) NOT NULL,
  ip_hash CHAR(64) NOT NULL,
  succeeded TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_auth_email_time (email_hash,created_at),
  INDEX idx_auth_ip_time (ip_hash,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE trial_claims (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id CHAR(36) NOT NULL UNIQUE,
  ip_hash CHAR(64) NOT NULL,
  device_hash CHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_trial_claim_user FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_trial_ip_time (ip_hash,created_at),
  INDEX idx_trial_device (device_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE users ADD COLUMN deletion_requested_at DATETIME NULL AFTER deleted_at;
