<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';
$user = require_user($config);
$pdo = db($config);
$stmt = $pdo->prepare('SELECT trial_seconds,paid_seconds,reserved_seconds,updated_at FROM wallets WHERE user_id=?');
$stmt->execute([$user['id']]);
$wallet = $stmt->fetch();
$stmt = $pdo->prepare('SELECT entry_type,trial_delta,paid_delta,reference_type,reference_id,note,created_at FROM credit_ledger WHERE user_id=? ORDER BY created_at DESC LIMIT 50');
$stmt->execute([$user['id']]);
json_response(['ok' => true, 'wallet' => $wallet, 'ledger' => $stmt->fetchAll()]);
