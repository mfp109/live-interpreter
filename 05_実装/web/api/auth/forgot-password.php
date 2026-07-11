<?php
declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';
require_once dirname(__DIR__) . '/lib/mail.php';
require_method('POST');
$requestStarted = microtime(true);
$email = strtolower(trim((string)(json_body()['email'] ?? '')));
$generic = ['ok'=>true,'message'=>'If the account exists, a reset email will be sent.'];
function finish_reset_request(array $payload, float $started): never {
    $remaining = 0.6 - (microtime(true) - $started);
    if ($remaining > 0) usleep((int)($remaining * 1000000));
    json_response($payload, 202);
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) finish_reset_request($generic, $requestStarted);
$pdo = db($config);
$emailHash=security_hash($config,$email);$ipHash=security_hash($config,$_SERVER['REMOTE_ADDR']??'');
$stmt=$pdo->prepare('SELECT SUM(email_hash=?) email_count,SUM(ip_hash=?) ip_count FROM password_reset_attempts WHERE created_at>DATE_SUB(NOW(),INTERVAL 1 HOUR)');$stmt->execute([$emailHash,$ipHash]);$limits=$stmt->fetch();
if((int)($limits['email_count']??0)>=3||(int)($limits['ip_count']??0)>=10)finish_reset_request($generic,$requestStarted);
$pdo->prepare('INSERT INTO password_reset_attempts (email_hash,ip_hash) VALUES (?,?)')->execute([$emailHash,$ipHash]);
$stmt = $pdo->prepare("SELECT id,locale FROM users WHERE email=? AND status='active' AND deleted_at IS NULL");
$stmt->execute([$email]);
$user = $stmt->fetch();
if (!$user) finish_reset_request($generic, $requestStarted);
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
finish_reset_request($generic, $requestStarted);
