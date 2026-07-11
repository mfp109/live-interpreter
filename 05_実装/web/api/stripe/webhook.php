<?php
declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';
require_once dirname(__DIR__) . '/lib/stripe.php';
require_method('POST');
$payload = file_get_contents('php://input') ?: '';
try {
    verify_stripe_signature($payload, $_SERVER['HTTP_STRIPE_SIGNATURE'] ?? '', (string)($config['stripe_webhook_secret'] ?? ''));
} catch (Throwable $error) {
    error_log('stripe signature rejected: ' . $error->getMessage());
    json_error('SIGNATURE_INVALID', 'Invalid signature.', 400);
}
$event = json_decode($payload, true);
if (!is_array($event) || !isset($event['id'], $event['type'])) json_error('EVENT_INVALID', 'Invalid event.', 400);
$pdo = db($config);

try {
    $pdo->beginTransaction();
    $stmt = $pdo->prepare('SELECT status FROM stripe_events WHERE event_id=? FOR UPDATE');
    $stmt->execute([$event['id']]);
    $known = $stmt->fetch();
    if ($known && $known['status'] === 'processed') {
        $pdo->commit();
        json_response(['ok' => true, 'duplicate' => true]);
    }
    if ($known) {
        $pdo->prepare("UPDATE stripe_events SET status='processing',error_code=NULL WHERE event_id=?")->execute([$event['id']]);
    } else {
        $pdo->prepare("INSERT INTO stripe_events (event_id,event_type,status) VALUES (?,?,'processing')")->execute([$event['id'], $event['type']]);
    }

    if ($event['type'] === 'checkout.session.completed') {
        $session = $event['data']['object'] ?? [];
        $paymentId = (string)($session['metadata']['payment_id'] ?? '');
        if (($session['payment_status'] ?? '') !== 'paid' || $paymentId === '') throw new RuntimeException('CHECKOUT_NOT_PAID');
        $stmt = $pdo->prepare('SELECT p.id,p.user_id,p.amount_minor,p.currency,p.status,pr.seconds_granted,pr.id product_id FROM payments p JOIN products pr ON pr.id=p.product_id WHERE p.id=? FOR UPDATE');
        $stmt->execute([$paymentId]);
        $payment = $stmt->fetch();
        if (!$payment) throw new RuntimeException('PAYMENT_NOT_FOUND');
        if ((int)($session['amount_total'] ?? -1) !== (int)$payment['amount_minor'] || strtoupper((string)($session['currency'] ?? '')) !== strtoupper($payment['currency'])) throw new RuntimeException('PAYMENT_AMOUNT_MISMATCH');
        if (($session['metadata']['user_id'] ?? '') !== $payment['user_id'] || ($session['metadata']['product_id'] ?? '') !== $payment['product_id']) throw new RuntimeException('PAYMENT_METADATA_MISMATCH');
        if ($payment['status'] !== 'paid') {
            $pdo->prepare("UPDATE payments SET status='paid',stripe_checkout_session_id=?,stripe_payment_intent_id=?,paid_at=NOW() WHERE id=?")
                ->execute([$session['id'], $session['payment_intent'] ?? null, $paymentId]);
            $ledger = $pdo->prepare("INSERT IGNORE INTO credit_ledger (id,user_id,entry_type,paid_delta,reference_type,reference_id,idempotency_key,note) VALUES (?,?,'purchase',?,'payment',?,?,'Stripe purchase')");
            $ledger->execute([uuid_v4(), $payment['user_id'], $payment['seconds_granted'], $paymentId, 'purchase:' . $paymentId]);
            if ($ledger->rowCount() === 1) {
                $pdo->prepare('UPDATE wallets SET paid_seconds=paid_seconds+?,version=version+1 WHERE user_id=?')->execute([$payment['seconds_granted'], $payment['user_id']]);
            }
        }
    }

    $pdo->prepare("UPDATE stripe_events SET status='processed',processed_at=NOW() WHERE event_id=?")->execute([$event['id']]);
    $pdo->commit();
    json_response(['ok' => true]);
} catch (Throwable $error) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
        try {
            $pdo->prepare("INSERT INTO stripe_events (event_id,event_type,status,error_code) VALUES (?,?,'failed',?) ON DUPLICATE KEY UPDATE status='failed',error_code=VALUES(error_code)")
                ->execute([$event['id'], $event['type'], substr($error->getMessage(), 0, 100)]);
        } catch (Throwable) {}
    }
    error_log('stripe webhook failed event=' . $event['id'] . ' error=' . $error->getMessage());
    json_error('WEBHOOK_PROCESSING_FAILED', 'Event processing failed.', 500);
}
