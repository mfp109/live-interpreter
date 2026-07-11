ALTER TABLE email_verification_tokens ADD COLUMN new_email VARCHAR(254) NULL AFTER user_id;
