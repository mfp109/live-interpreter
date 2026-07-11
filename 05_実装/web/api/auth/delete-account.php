<?php
declare(strict_types=1);

require dirname(__DIR__).'/bootstrap.php';require_method('POST');$user=require_user($config);require_csrf();$body=json_body();
if(($body['confirm']??'')!=='DELETE')json_error('CONFIRMATION_REQUIRED','Confirmation is required.');
$pdo=db($config);$pdo->prepare("UPDATE users SET status='disabled',deletion_requested_at=NOW() WHERE id=?")->execute([$user['id']]);$_SESSION=[];session_destroy();json_response(['ok'=>true]);
