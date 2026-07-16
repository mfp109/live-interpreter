<?php
declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';
require_once dirname(__DIR__) . '/lib/gateway.php';
require_method('POST');
$raw = file_get_contents('php://input') ?: '';
try {
    verify_gateway_request($config, $raw, $_SERVER['HTTP_X_GATEWAY_TIMESTAMP'] ?? '', $_SERVER['HTTP_X_GATEWAY_SIGNATURE'] ?? '');
} catch (Throwable $error) {
    json_error('GATEWAY_SIGNATURE_INVALID', 'Invalid gateway request.', 401);
}
$body = json_decode($raw, true);
$sessionId = (string)($body['session_id'] ?? '');
$sequence = filter_var($body['sequence'] ?? null, FILTER_VALIDATE_INT);
$seconds = filter_var($body['seconds'] ?? null, FILTER_VALIDATE_INT);
$final = ($body['final'] ?? false) === true;
if (!preg_match('/^[a-f0-9-]{36}$/', $sessionId) || $sequence === false || $sequence < 1 || $seconds === false || $seconds < 0 || $seconds > 30 || ($seconds === 0 && !$final)) json_error('VALIDATION_ERROR', 'Invalid settlement.');

$pdo = db($config);
try {
    $pdo->beginTransaction();
    $stmt = $pdo->prepare('SELECT user_id,status,source_language,target_language FROM translation_sessions WHERE id=? FOR UPDATE');
    $stmt->execute([$sessionId]);
    $session = $stmt->fetch();
    if (!$session || !in_array($session['status'], ['authorized','active'], true)) throw new RuntimeException('SESSION_NOT_ACTIVE');
    $creditsPerSecond = $session['source_language'] === 'ja' && $session['target_language'] === 'ja' ? 1 : 12;
    expire_credit_lots($pdo,$session['user_id']);
    $walletStmt=$pdo->prepare('SELECT trial_seconds,paid_seconds FROM wallets WHERE user_id=? FOR UPDATE');$walletStmt->execute([$session['user_id']]);$wallet=$walletStmt->fetch();$session['trial_seconds']=$wallet['trial_seconds'];$session['paid_seconds']=$wallet['paid_seconds'];
    $eventId = uuid_v4();
    $insert = $pdo->prepare('INSERT IGNORE INTO usage_events (id,session_id,sequence,requested_seconds,created_at) VALUES (?,?,?,?,NOW())');
    $insert->execute([$eventId,$sessionId,$sequence,$seconds]);
    if ($insert->rowCount() === 0) {
        $pdo->commit();
        json_response(['ok'=>true,'duplicate'=>true,'remaining_seconds'=>(int)$session['trial_seconds']+(int)$session['paid_seconds']]);
    }
    $requestedCredits=$seconds*$creditsPerSecond;
    $usage=consume_credit_lots($pdo,$session['user_id'],$requestedCredits);$trialCredits=$usage['trial'];$paidCredits=$usage['paid'];$consumedCredits=$usage['total'];
    $consumed=intdiv($consumedCredits,$creditsPerSecond);$trialUsed=min($consumed,intdiv($trialCredits,$creditsPerSecond));$paidUsed=$consumed-$trialUsed;
    if ($consumedCredits > 0) {
        $pdo->prepare("INSERT INTO credit_ledger (id,user_id,entry_type,trial_delta,paid_delta,reference_type,reference_id,idempotency_key,note) VALUES (?,?,'usage',?,?, 'translation_session',?,?, 'Realtime usage')")
            ->execute([uuid_v4(),$session['user_id'],-$trialCredits,-$paidCredits,$sessionId,'usage:'.$sessionId.':'.$sequence]);
        $pdo->prepare("UPDATE translation_sessions SET status='active',started_at=COALESCE(started_at,NOW()),trial_seconds_used=trial_seconds_used+?,paid_seconds_used=paid_seconds_used+? WHERE id=?")
            ->execute([$trialUsed,$paidUsed,$sessionId]);
    }
    $remaining = (int)$session['trial_seconds'] + (int)$session['paid_seconds'] - $consumedCredits;
    $stop = $remaining < $creditsPerSecond || $consumedCredits < $requestedCredits || $final;
    if ($stop) {
        $status = $remaining <= 0 ? 'stopped_balance' : 'completed';
        $pdo->prepare('UPDATE translation_sessions SET status=?,ended_at=NOW() WHERE id=?')->execute([$status,$sessionId]);
    }
    $pdo->prepare('UPDATE usage_events SET consumed_seconds=?,trial_seconds=?,paid_seconds=? WHERE id=?')->execute([$consumed,$trialUsed,$paidUsed,$eventId]);
    $pdo->commit();
    json_response(['ok'=>true,'consumed_seconds'=>$consumed,'consumed_credits'=>$consumedCredits,'credits_per_second'=>$creditsPerSecond,'remaining_seconds'=>$remaining,'remaining_credits'=>$remaining,'stop'=>$stop]);
} catch (Throwable $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('settlement failed session='.$sessionId.' error='.$error->getMessage());
    json_error('SETTLEMENT_FAILED', 'Usage could not be settled.', 409);
}
