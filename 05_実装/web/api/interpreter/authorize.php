<?php
declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';
require_once dirname(__DIR__) . '/lib/gateway.php';
require_method('POST');
$user = require_user($config);
require_csrf();
$body = json_body();
$source = (string)($body['source_language'] ?? '');
$target = (string)($body['target_language'] ?? '');
$allowed = ['ar','bn','zh','nl','en','fr','de','hi','id','it','ja','ko','pt','ru','es','sv','th','tr','uk','vi'];
if (!in_array($source, $allowed, true) || !in_array($target, $allowed, true) || $source === $target) json_error('LANGUAGE_PAIR_INVALID', 'Language pair is not available.');

$pdo = db($config);
$pdo->beginTransaction();
expire_credit_lots($pdo,$user['id']);
$stmt = $pdo->prepare('SELECT trial_seconds,paid_seconds,reserved_seconds FROM wallets WHERE user_id=?');
$stmt->execute([$user['id']]);
$wallet = $stmt->fetch();
$available = $wallet ? (int)$wallet['trial_seconds'] + (int)$wallet['paid_seconds'] - (int)$wallet['reserved_seconds'] : 0;
if ($available <= 0){$pdo->commit();json_error('BALANCE_EMPTY', 'No interpretation time remains.', 402);}

$sessionId = uuid_v4();
$pdo->prepare('INSERT INTO translation_sessions (id,user_id,source_language,target_language,status) VALUES (?,?,?,?,\'authorized\')')
    ->execute([$sessionId, $user['id'], $source, $target]);
$pdo->commit();
$expires = time() + 120;
$token = create_gateway_token($config, ['sid'=>$sessionId,'uid'=>$user['id'],'src'=>$source,'dst'=>$target,'exp'=>$expires,'nonce'=>bin2hex(random_bytes(12))]);
json_response(['ok'=>true,'gateway_url'=>$config['gateway_url'],'access_token'=>$token,'expires_at'=>$expires,'session_id'=>$sessionId,'available_seconds'=>$available]);
