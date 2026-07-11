CREATE TABLE refund_requests (
  id CHAR(36) PRIMARY KEY,
  payment_id CHAR(36) NOT NULL,
  admin_user_id CHAR(36) NOT NULL,
  amount_minor INT UNSIGNED NOT NULL,
  reason VARCHAR(200) NOT NULL,
  status ENUM('pending','submitted','processed','failed') NOT NULL DEFAULT 'pending',
  stripe_refund_id VARCHAR(255) NULL UNIQUE,
  error_code VARCHAR(100) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_refund_payment FOREIGN KEY (payment_id) REFERENCES payments(id),
  CONSTRAINT fk_refund_admin FOREIGN KEY (admin_user_id) REFERENCES users(id),
  INDEX idx_refund_payment_status (payment_id,status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
