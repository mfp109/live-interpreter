<?php
declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';
require_method('POST');
$token = (string)(json_body()['token'] ?? '');
if (!preg_match('/^[a-f0-9]{64}$/', $token)) json_error('TOKEN_INVALID', 'Verification link is invalid.');

$pdo = db($config);
try {
    $pdo->beginTransaction();
    $stmt = $pdo->prepare('SELECT t.id token_id,t.user_id,u.trial_granted_at FROM email_verification_tokens t JOIN users u ON u.id=t.user_id WHERE t.token_hash=? AND t.used_at IS NULL AND t.expires_at>NOW() FOR UPDATE');
    $stmt->execute([hash('sha256', $token)]);
    $record = $stmt->fetch();
    if (!$record) {
        $pdo->rollBack();
        json_error('TOKEN_INVALID', 'Verification link is invalid or expired.', 400);
    }
    $pdo->prepare("UPDATE users SET status='active', email_verified_at=COALESCE(email_verified_at,NOW()) WHERE id=?")->execute([$record['user_id']]);
    if (!$record['trial_granted_at']) {
        $key = 'trial:' . $record['user_id'];
        $grant = $pdo->prepare("INSERT IGNORE INTO credit_ledger (id,user_id,entry_type,trial_delta,idempotency_key,note) VALUES (?,?,'trial_grant',900,?,'Initial 15-minute trial')");
        $grant->execute([uuid_v4(), $record['user_id'], $key]);
        if ($grant->rowCount() === 1) {
            $pdo->prepare('UPDATE wallets SET trial_seconds=trial_seconds+900,version=version+1 WHERE user_id=?')->execute([$record['user_id']]);
        }
        $pdo->prepare('UPDATE users SET trial_granted_at=COALESCE(trial_granted_at,NOW()) WHERE id=?')->execute([$record['user_id']]);
    }
    $pdo->prepare('UPDATE email_verification_tokens SET used_at=NOW() WHERE id=?')->execute([$record['token_id']]);
    $pdo->commit();
    json_response(['ok' => true, 'trial_seconds' => 900]);
} catch (Throwable $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('verification failed: ' . $error->getMessage());
    json_error('INTERNAL_ERROR', 'Email verification could not be completed.', 500);
}
