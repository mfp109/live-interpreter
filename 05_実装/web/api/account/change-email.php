<?php
declare(strict_types=1);

require dirname(__DIR__).'/bootstrap.php';require_once dirname(__DIR__).'/lib/mail.php';require_method('POST');$user=require_user($config);require_csrf();$email=strtolower(trim((string)(json_body()['email']??'')));
if(!filter_var($email,FILTER_VALIDATE_EMAIL)||strlen($email)>254)json_error('VALIDATION_ERROR','Email address is invalid.');
$pdo=db($config);$stmt=$pdo->prepare('SELECT COUNT(*) FROM users WHERE email=? AND id<>?');$stmt->execute([$email,$user['id']]);if((int)$stmt->fetchColumn()>0)json_error('EMAIL_IN_USE','Email address is already in use.',409);
$token=bin2hex(random_bytes(32));$pdo->prepare('UPDATE email_verification_tokens SET used_at=NOW() WHERE user_id=? AND used_at IS NULL')->execute([$user['id']]);$pdo->prepare('INSERT INTO email_verification_tokens (id,user_id,new_email,token_hash,expires_at) VALUES (?,?,?,?,DATE_ADD(NOW(),INTERVAL 24 HOUR))')->execute([uuid_v4(),$user['id'],$email,hash('sha256',$token)]);
if(!send_verification_email($config,$email,$user['locale'],$token))json_error('MAIL_DELIVERY_FAILED','Verification email could not be sent.',502);json_response(['ok'=>true]);
