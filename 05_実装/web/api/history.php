<?php
declare(strict_types=1);

require __DIR__.'/bootstrap.php';$user=require_user($config);$pdo=db($config);
$stmt=$pdo->prepare('SELECT p.id,pr.code,p.amount_minor,p.currency,p.status,p.paid_at,p.created_at FROM payments p JOIN products pr ON pr.id=p.product_id WHERE p.user_id=? ORDER BY p.created_at DESC LIMIT 100');$stmt->execute([$user['id']]);$payments=$stmt->fetchAll();
$stmt=$pdo->prepare('SELECT id,source_language,target_language,status,trial_seconds_used,paid_seconds_used,started_at,ended_at,created_at FROM translation_sessions WHERE user_id=? ORDER BY created_at DESC LIMIT 100');$stmt->execute([$user['id']]);$sessions=$stmt->fetchAll();
json_response(['ok'=>true,'payments'=>$payments,'sessions'=>$sessions]);
