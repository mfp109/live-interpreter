<?php
declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';
require_once dirname(__DIR__) . '/lib/mail.php';
require_method('POST');
$body = json_body();
$email = strtolower(trim((string)($body['email'] ?? '')));
$password = (string)($body['password'] ?? '');
$locale = in_array(($body['locale'] ?? 'ja'), ['ja', 'en', 'zh-CN'], true) ? $body['locale'] : 'ja';
$accepted = ($body['accept_terms'] ?? false) === true;

if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 254) json_error('VALIDATION_ERROR', 'Please enter a valid email address.');
if (strlen($password) < 12 || strlen($password) > 200) json_error('VALIDATION_ERROR', 'Password must be at least 12 characters.');
if (!$accepted) json_error('TERMS_REQUIRED', 'Terms acceptance is required.');

$pdo = db($config);
try {
    $pdo->beginTransaction();
    $stmt = $pdo->prepare('SELECT id, email_verified_at FROM users WHERE email = ? FOR UPDATE');
    $stmt->execute([$email]);
    $existing = $stmt->fetch();
    if ($existing && $existing['email_verified_at']) {
        $pdo->rollBack();
        json_response(['ok' => true, 'message' => 'If registration is available, a verification email will be sent.'], 202);
    }

    $userId = $existing['id'] ?? uuid_v4();
    if (!$existing) {
        $stmt = $pdo->prepare("INSERT INTO users (id,email,password_hash,locale,status,terms_version,terms_accepted_at) VALUES (?,?,?,?, 'pending', '2026-07-11', NOW())");
        $stmt->execute([$userId, $email, password_hash($password, PASSWORD_DEFAULT), $locale]);
        $pdo->prepare('INSERT INTO wallets (user_id) VALUES (?)')->execute([$userId]);
    } else {
        $pdo->prepare('UPDATE users SET password_hash=?, locale=?, terms_version=?, terms_accepted_at=NOW() WHERE id=?')
            ->execute([password_hash($password, PASSWORD_DEFAULT), $locale, '2026-07-11', $userId]);
        $pdo->prepare('UPDATE email_verification_tokens SET used_at=NOW() WHERE user_id=? AND used_at IS NULL')->execute([$userId]);
    }

    $token = bin2hex(random_bytes(32));
    $pdo->prepare('INSERT INTO email_verification_tokens (id,user_id,token_hash,expires_at) VALUES (?,?,?,DATE_ADD(NOW(), INTERVAL 24 HOUR))')
        ->execute([uuid_v4(), $userId, hash('sha256', $token)]);
    $pdo->commit();

    if (!send_verification_email($config, $email, $locale, $token)) {
        error_log('verification mail delivery failed user=' . $userId);
        json_error('MAIL_DELIVERY_FAILED', 'Verification email could not be sent. Please try again.', 502);
    }
    json_response(['ok' => true, 'message' => 'If registration is available, a verification email will be sent.'], 202);
} catch (Throwable $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('registration failed: ' . $error->getMessage());
    json_error('INTERNAL_ERROR', 'Registration could not be completed.', 500);
}
