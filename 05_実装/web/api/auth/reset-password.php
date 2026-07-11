<?php
declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';
require_method('POST');
$body=json_body();$token=(string)($body['token']??'');$password=(string)($body['password']??'');
if(!preg_match('/^[a-f0-9]{64}$/',$token)||strlen($password)<12||strlen($password)>200)json_error('VALIDATION_ERROR','Reset request is invalid.');
$pdo=db($config);
try{
    $pdo->beginTransaction();
    $stmt=$pdo->prepare('SELECT id,user_id FROM password_reset_tokens WHERE token_hash=? AND used_at IS NULL AND expires_at>NOW() FOR UPDATE');$stmt->execute([hash('sha256',$token)]);$record=$stmt->fetch();
    if(!$record){$pdo->rollBack();json_error('TOKEN_INVALID','Reset link is invalid or expired.',400);}
    $pdo->prepare('UPDATE users SET password_hash=?,auth_version=auth_version+1 WHERE id=?')->execute([password_hash($password,PASSWORD_DEFAULT),$record['user_id']]);
    $pdo->prepare('UPDATE password_reset_tokens SET used_at=NOW() WHERE user_id=? AND used_at IS NULL')->execute([$record['user_id']]);
    $pdo->commit();json_response(['ok'=>true]);
}catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();error_log('password reset failed: '.$error->getMessage());json_error('INTERNAL_ERROR','Password could not be reset.',500);}
