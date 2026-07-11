<?php
declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';
require_method('POST');
$secret=(string)($config['cron_secret']??'');$supplied=preg_replace('/^Bearer\s+/i','',$_SERVER['HTTP_AUTHORIZATION']??'');
if($secret===''||$secret==='CHANGE_ME'||!hash_equals($secret,$supplied))json_error('AUTH_REQUIRED','Authentication required.',401);
$pdo=db($config);try{$pdo->beginTransaction();$expired=expire_credit_lots($pdo);$pdo->exec('DELETE FROM email_verification_tokens WHERE expires_at<DATE_SUB(NOW(),INTERVAL 7 DAY)');$pdo->exec('DELETE FROM password_reset_tokens WHERE expires_at<DATE_SUB(NOW(),INTERVAL 7 DAY)');$pdo->exec('DELETE FROM auth_attempts WHERE created_at<DATE_SUB(NOW(),INTERVAL 30 DAY)');$pdo->exec('DELETE FROM password_reset_attempts WHERE created_at<DATE_SUB(NOW(),INTERVAL 7 DAY)');$pdo->commit();json_response(['ok'=>true,'expired_seconds'=>$expired]);}catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();error_log('credit expiry failed: '.$error->getMessage());json_error('INTERNAL_ERROR','Expiry job failed.',500);}
