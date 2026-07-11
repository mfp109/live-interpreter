<?php
declare(strict_types=1);
require dirname(__DIR__).'/bootstrap.php';
$admin=require_admin($config);$pdo=db($config);
$stmt=$pdo->query('SELECT l.id,l.action,l.target_type,l.target_id,l.request_id,l.created_at,u.email admin_email FROM admin_audit_logs l JOIN users u ON u.id=l.admin_user_id ORDER BY l.created_at DESC LIMIT 100');
audit_admin($config,$admin['id'],'audit.list');
json_response(['ok'=>true,'logs'=>$stmt->fetchAll()]);
