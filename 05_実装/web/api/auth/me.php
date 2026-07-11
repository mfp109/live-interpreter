<?php
declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';
$user = require_user($config);
$stmt = db($config)->prepare('SELECT trial_seconds,paid_seconds,reserved_seconds FROM wallets WHERE user_id=?');
$stmt->execute([$user['id']]);
$wallet = $stmt->fetch() ?: ['trial_seconds'=>0,'paid_seconds'=>0,'reserved_seconds'=>0];
json_response(['ok' => true, 'user' => $user, 'wallet' => $wallet, 'csrf_token' => issue_csrf_token()]);
