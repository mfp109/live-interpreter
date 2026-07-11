<?php
declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';
$admin=require_admin($config);$pdo=db($config);
$stats=[];
$stats['members']=(int)$pdo->query("SELECT COUNT(*) FROM users WHERE role='member' AND deleted_at IS NULL")->fetchColumn();
$stats['verified_members']=(int)$pdo->query("SELECT COUNT(*) FROM users WHERE role='member' AND email_verified_at IS NOT NULL AND deleted_at IS NULL")->fetchColumn();
$stats['revenue_jpy']=(int)$pdo->query("SELECT COALESCE(SUM(amount_minor-refunded_minor),0) FROM payments WHERE status IN ('paid','refunded') AND currency='JPY'")->fetchColumn();
$stats['paid_seconds_outstanding']=(int)$pdo->query('SELECT COALESCE(SUM(paid_seconds),0) FROM wallets')->fetchColumn();
$stats['trial_seconds_outstanding']=(int)$pdo->query('SELECT COALESCE(SUM(trial_seconds),0) FROM wallets')->fetchColumn();
$stats['seconds_used']=(int)$pdo->query('SELECT COALESCE(SUM(trial_seconds_used+paid_seconds_used),0) FROM translation_sessions')->fetchColumn();
$business=$config['business']??[];$stats['stripe_fee_estimate_jpy']=(int)round($stats['revenue_jpy']*(float)($business['stripe_fee_rate']??0.036));$stats['openai_cost_estimate_jpy']=(int)round(($stats['seconds_used']/60)*(float)($business['openai_usd_per_minute']??0.034)*(float)($business['usd_jpy_rate']??160));$stats['gross_profit_estimate_jpy']=$stats['revenue_jpy']-$stats['stripe_fee_estimate_jpy']-$stats['openai_cost_estimate_jpy'];
$stats['sessions_today']=(int)$pdo->query('SELECT COUNT(*) FROM translation_sessions WHERE created_at>=CURDATE()')->fetchColumn();
$payments=$pdo->query('SELECT p.id,u.email,pr.code,p.amount_minor,p.currency,p.status,p.created_at FROM payments p JOIN users u ON u.id=p.user_id JOIN products pr ON pr.id=p.product_id ORDER BY p.created_at DESC LIMIT 20')->fetchAll();
$sessions=$pdo->query('SELECT s.id,u.email,s.source_language,s.target_language,s.status,s.trial_seconds_used,s.paid_seconds_used,s.created_at FROM translation_sessions s JOIN users u ON u.id=s.user_id ORDER BY s.created_at DESC LIMIT 20')->fetchAll();
audit_admin($config,$admin['id'],'dashboard.view');
json_response(['ok'=>true,'stats'=>$stats,'payments'=>$payments,'sessions'=>$sessions]);
