<?php
declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';
require_method('POST');$admin=require_admin($config);require_csrf();$body=json_body();$userId=(string)($body['user_id']??'');$status=(string)($body['status']??'');
if(!preg_match('/^[a-f0-9-]{36}$/',$userId)||!in_array($status,['active','disabled'],true))json_error('VALIDATION_ERROR','Status change is invalid.');
$stmt=db($config)->prepare("UPDATE users SET status=? WHERE id=? AND role='member' AND deleted_at IS NULL");$stmt->execute([$status,$userId]);if($stmt->rowCount()!==1)json_error('USER_NOT_FOUND','User not found.',404);audit_admin($config,$admin['id'],'user.status.'.$status,'user',$userId);json_response(['ok'=>true]);
