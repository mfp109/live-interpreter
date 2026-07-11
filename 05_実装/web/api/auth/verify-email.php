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
    $trialSeconds=0;
    if (!$record['trial_granted_at']) {
        $ipHash=security_hash($config,$_SERVER['REMOTE_ADDR']??'');$device=(string)($_SERVER['HTTP_X_DEVICE_ID']??'');$deviceHash=$device!==''?security_hash($config,$device):null;
        $stmt=$pdo->prepare('SELECT SUM(ip_hash=? AND created_at>DATE_SUB(NOW(),INTERVAL 30 DAY)) ip_claims,SUM(device_hash IS NOT NULL AND device_hash=?) device_claims FROM trial_claims');$stmt->execute([$ipHash,$deviceHash]);$claims=$stmt->fetch();
        if((int)($claims['ip_claims']??0)<3&&(int)($claims['device_claims']??0)<1){
            $key = 'trial:' . $record['user_id'];
            $grant = $pdo->prepare("INSERT IGNORE INTO credit_ledger (id,user_id,entry_type,trial_delta,idempotency_key,note) VALUES (?,?,'trial_grant',900,?,'Initial 15-minute trial')");
            $grant->execute([uuid_v4(), $record['user_id'], $key]);
            if ($grant->rowCount() === 1 && grant_credit_lot($pdo,$record['user_id'],'trial','trial',$record['user_id'],900,30)) $trialSeconds=900;
            $pdo->prepare('INSERT IGNORE INTO trial_claims (user_id,ip_hash,device_hash) VALUES (?,?,?)')->execute([$record['user_id'],$ipHash,$deviceHash]);
        }
        $pdo->prepare('UPDATE users SET trial_granted_at=COALESCE(trial_granted_at,NOW()) WHERE id=?')->execute([$record['user_id']]);
    }
    $pdo->prepare('UPDATE email_verification_tokens SET used_at=NOW() WHERE id=?')->execute([$record['token_id']]);
    $pdo->commit();
    json_response(['ok' => true, 'trial_seconds' => $trialSeconds]);
} catch (Throwable $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('verification failed: ' . $error->getMessage());
    json_error('INTERNAL_ERROR', 'Email verification could not be completed.', 500);
}
