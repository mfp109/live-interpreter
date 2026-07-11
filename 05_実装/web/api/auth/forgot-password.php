<?php
declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';
require_once dirname(__DIR__) . '/lib/mail.php';
require_method('POST');
$email = strtolower(trim((string)(json_body()['email'] ?? '')));
$generic = ['ok'=>true,'message'=>'If the account exists, a reset email will be sent.'];
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) json_response($generic, 202);
$pdo = db($config);
$stmt = $pdo->prepare("SELECT id,locale FROM users WHERE email=? AND status='active' AND deleted_at IS NULL");
$stmt->execute([$email]);
$user = $stmt->fetch();
if (!$user) { usleep(200000); json_response($generic, 202); }
$token = bin2hex(random_bytes(32));
try {
    $pdo->beginTransaction();
    $pdo->prepare('UPDATE password_reset_tokens SET used_at=NOW() WHERE user_id=? AND used_at IS NULL')->execute([$user['id']]);
    $pdo->prepare('INSERT INTO password_reset_tokens (id,user_id,token_hash,expires_at) VALUES (?,?,?,DATE_ADD(NOW(),INTERVAL 1 HOUR))')->execute([uuid_v4(),$user['id'],hash('sha256',$token)]);
    $pdo->commit();
    if (!send_password_reset_email($config,$email,$user['locale'],$token)) error_log('password reset mail failed user='.$user['id']);
} catch (Throwable $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('password reset request failed: '.$error->getMessage());
}
json_response($generic, 202);
