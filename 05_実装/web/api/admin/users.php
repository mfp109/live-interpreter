<?php
declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';
$admin=require_admin($config);$query=trim((string)($_GET['q']??''));$pdo=db($config);
if($query!==''){$stmt=$pdo->prepare("SELECT u.id,u.email,u.display_name,u.locale,u.status,u.email_verified_at,u.trial_granted_at,u.created_at,w.trial_seconds,w.paid_seconds FROM users u JOIN wallets w ON w.user_id=u.id WHERE u.role='member' AND u.email LIKE ? ORDER BY u.created_at DESC LIMIT 100");$stmt->execute(['%'.str_replace(['%','_'],['\\%','\\_'],$query).'%']);}
else{$stmt=$pdo->query("SELECT u.id,u.email,u.display_name,u.locale,u.status,u.email_verified_at,u.trial_granted_at,u.created_at,w.trial_seconds,w.paid_seconds FROM users u JOIN wallets w ON w.user_id=u.id WHERE u.role='member' ORDER BY u.created_at DESC LIMIT 100");}
audit_admin($config,$admin['id'],'users.list');json_response(['ok'=>true,'users'=>$stmt->fetchAll()]);
