<?php
declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';
$user = require_user($config);
$pdo=db($config);$pdo->beginTransaction();expire_credit_lots($pdo,$user['id']);
$stmt = $pdo->prepare('SELECT trial_seconds,paid_seconds,reserved_seconds FROM wallets WHERE user_id=?');
$stmt->execute([$user['id']]);
$wallet = $stmt->fetch() ?: ['trial_seconds'=>0,'paid_seconds'=>0,'reserved_seconds'=>0];
$pdo->commit();
unset($user['auth_version']);
json_response(['ok' => true, 'user' => $user, 'wallet' => $wallet, 'csrf_token' => issue_csrf_token()]);
