<?php
declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';
require_once dirname(__DIR__) . '/lib/stripe.php';
require_once dirname(__DIR__) . '/lib/refunds.php';
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
        if (!in_array(($session['payment_status'] ?? ''), ['paid','no_payment_required'], true) || $paymentId === '') throw new RuntimeException('CHECKOUT_NOT_PAID');
        $stmt = $pdo->prepare('SELECT p.id,p.user_id,p.amount_minor,p.currency,p.status,pr.seconds_granted,pr.id product_id,pr.product_type FROM payments p JOIN products pr ON pr.id=p.product_id WHERE p.id=? FOR UPDATE');
        $stmt->execute([$paymentId]);
        $payment = $stmt->fetch();
        if (!$payment) throw new RuntimeException('PAYMENT_NOT_FOUND');
        if ((int)($session['amount_total'] ?? -1) !== (int)$payment['amount_minor'] || strtoupper((string)($session['currency'] ?? '')) !== strtoupper($payment['currency'])) throw new RuntimeException('PAYMENT_AMOUNT_MISMATCH');
        if (($session['metadata']['user_id'] ?? '') !== $payment['user_id'] || ($session['metadata']['product_id'] ?? '') !== $payment['product_id']) throw new RuntimeException('PAYMENT_METADATA_MISMATCH');
        if ($payment['status'] !== 'paid') {
            $stripeSubscriptionId = $payment['product_type'] === 'subscription' ? (string)($session['subscription'] ?? '') : '';
            $pdo->prepare("UPDATE payments SET status='paid',stripe_checkout_session_id=?,stripe_payment_intent_id=?,stripe_subscription_id=?,paid_at=NOW() WHERE id=?")
                ->execute([$session['id'], $session['payment_intent'] ?? null, $stripeSubscriptionId ?: null, $paymentId]);
            if ($payment['product_type'] === 'subscription') {
                $customerId=(string)($session['customer']??'');
                if($stripeSubscriptionId===''||$customerId==='')throw new RuntimeException('SUBSCRIPTION_METADATA_MISSING');
                $pdo->prepare("INSERT INTO subscriptions (id,user_id,product_id,stripe_subscription_id,stripe_customer_id,status) VALUES (?,?,?,?,?,'active') ON DUPLICATE KEY UPDATE product_id=VALUES(product_id),stripe_subscription_id=VALUES(stripe_subscription_id),stripe_customer_id=VALUES(stripe_customer_id),status='active',cancel_at_period_end=0")
                    ->execute([uuid_v4(),$payment['user_id'],$payment['product_id'],$stripeSubscriptionId,$customerId]);
                reset_subscription_credit_lots($pdo,$payment['user_id'],$session['id']);
                $ledger = $pdo->prepare("INSERT IGNORE INTO credit_ledger (id,user_id,entry_type,paid_delta,reference_type,reference_id,idempotency_key,note) VALUES (?,?,'subscription_grant',?,'subscription',?,?,'Monthly subscription credits')");
                $ledger->execute([uuid_v4(),$payment['user_id'],$payment['seconds_granted'],$stripeSubscriptionId,'subscription-checkout:'.$session['id']]);
                if($ledger->rowCount()===1&&!grant_credit_lot($pdo,$payment['user_id'],'paid','subscription',$paymentId,(int)$payment['seconds_granted'],32))throw new RuntimeException('CREDIT_LOT_FAILED');
            } else {
                $ledger = $pdo->prepare("INSERT IGNORE INTO credit_ledger (id,user_id,entry_type,paid_delta,reference_type,reference_id,idempotency_key,note) VALUES (?,?,'purchase',?,'payment',?,?,'Stripe purchase')");
                $ledger->execute([uuid_v4(), $payment['user_id'], $payment['seconds_granted'], $paymentId, 'purchase:' . $paymentId]);
                if ($ledger->rowCount() === 1 && !grant_credit_lot($pdo,$payment['user_id'],'paid','payment',$paymentId,(int)$payment['seconds_granted'],180)) throw new RuntimeException('CREDIT_LOT_FAILED');
            }
        }
    }

    if ($event['type'] === 'invoice.paid') {
        $invoice=$event['data']['object']??[];
        $reason=(string)($invoice['billing_reason']??'');
        if($reason==='subscription_create'){
            $metadata=$invoice['parent']['subscription_details']['metadata']??[];
            $paymentId=(string)($metadata['payment_id']??'');
            if($paymentId!==''){
                $pdo->prepare('UPDATE payments SET stripe_invoice_id=?,stripe_payment_intent_id=COALESCE(stripe_payment_intent_id,?) WHERE id=?')
                    ->execute([$invoice['id']??null,$invoice['payment_intent']??null,$paymentId]);
            }
        } else {
            $stripeSubscriptionId=(string)($invoice['subscription']??($invoice['parent']['subscription_details']['subscription']??''));
            if($stripeSubscriptionId==='')throw new RuntimeException('SUBSCRIPTION_ID_MISSING');
            $stmt=$pdo->prepare("SELECT s.user_id,s.product_id,p.seconds_granted,p.currency FROM subscriptions s JOIN products p ON p.id=s.product_id WHERE s.stripe_subscription_id=? FOR UPDATE");
            $stmt->execute([$stripeSubscriptionId]);$subscription=$stmt->fetch();
            if(!$subscription)throw new RuntimeException('SUBSCRIPTION_NOT_FOUND');
            $invoiceId=(string)($invoice['id']??'');
            if($invoiceId==='')throw new RuntimeException('INVOICE_ID_MISSING');
            $paymentId=uuid_v4();
            $insert=$pdo->prepare("INSERT IGNORE INTO payments (id,user_id,product_id,stripe_payment_intent_id,stripe_invoice_id,stripe_subscription_id,amount_minor,currency,status,paid_at) VALUES (?,?,?,?,?,?,?,?,'paid',NOW())");
            $insert->execute([$paymentId,$subscription['user_id'],$subscription['product_id'],$invoice['payment_intent']??null,$invoiceId,$stripeSubscriptionId,max(0,(int)($invoice['amount_paid']??0)),strtoupper((string)($invoice['currency']??$subscription['currency']))]);
            if($insert->rowCount()===1){
                reset_subscription_credit_lots($pdo,$subscription['user_id'],$invoiceId);
                $ledger=$pdo->prepare("INSERT IGNORE INTO credit_ledger (id,user_id,entry_type,paid_delta,reference_type,reference_id,idempotency_key,note) VALUES (?,?,'subscription_grant',?,'subscription',?,?,'Monthly subscription renewal credits')");
                $ledger->execute([uuid_v4(),$subscription['user_id'],$subscription['seconds_granted'],$stripeSubscriptionId,'subscription-invoice:'.$invoiceId]);
                if($ledger->rowCount()===1&&!grant_credit_lot($pdo,$subscription['user_id'],'paid','subscription',$paymentId,(int)$subscription['seconds_granted'],32))throw new RuntimeException('CREDIT_LOT_FAILED');
            }
            $periodEnd=(int)($invoice['lines']['data'][0]['period']['end']??0);
            $pdo->prepare("UPDATE subscriptions SET status='active',current_period_end=IF(? > 0,FROM_UNIXTIME(?),current_period_end) WHERE stripe_subscription_id=?")
                ->execute([$periodEnd,$periodEnd,$stripeSubscriptionId]);
        }
    }

    if (in_array($event['type'], ['customer.subscription.updated','customer.subscription.deleted'], true)) {
        $subscription=$event['data']['object']??[];
        $stripeSubscriptionId=(string)($subscription['id']??'');
        if($stripeSubscriptionId==='')throw new RuntimeException('SUBSCRIPTION_ID_MISSING');
        $allowed=['incomplete','incomplete_expired','trialing','active','past_due','canceled','unpaid','paused'];
        $status=(string)($subscription['status']??'incomplete');
        if(!in_array($status,$allowed,true))$status='incomplete';
        $periodEnd=(int)($subscription['current_period_end']??0);
        $pdo->prepare('UPDATE subscriptions SET status=?,cancel_at_period_end=?,current_period_end=IF(? > 0,FROM_UNIXTIME(?),current_period_end) WHERE stripe_subscription_id=?')
            ->execute([$status,!empty($subscription['cancel_at_period_end'])?1:0,$periodEnd,$periodEnd,$stripeSubscriptionId]);
    }

    if ($event['type'] === 'invoice.payment_failed') {
        $invoice=$event['data']['object']??[];
        $stripeSubscriptionId=(string)($invoice['subscription']??($invoice['parent']['subscription_details']['subscription']??''));
        if($stripeSubscriptionId!=='')$pdo->prepare("UPDATE subscriptions SET status='past_due' WHERE stripe_subscription_id=?")->execute([$stripeSubscriptionId]);
    }

    if(in_array($event['type'],['charge.refunded','charge.dispute.created'],true)){
        $charge=$event['data']['object']??[];$intent=(string)($charge['payment_intent']??'');
        if($intent==='')throw new RuntimeException('PAYMENT_INTENT_MISSING');
        $stmt=$pdo->prepare('SELECT p.id,p.user_id,p.amount_minor,p.refunded_minor,p.revoked_seconds,p.status,p.stripe_checkout_session_id,p.stripe_invoice_id,pr.seconds_granted,pr.product_type FROM payments p JOIN products pr ON pr.id=p.product_id WHERE p.stripe_payment_intent_id=? FOR UPDATE');$stmt->execute([$intent]);$payment=$stmt->fetch();
        if(!$payment)throw new RuntimeException('PAYMENT_NOT_FOUND');
        $isDispute=$event['type']==='charge.dispute.created';$refunded=$isDispute?(int)$payment['amount_minor']:min((int)$payment['amount_minor'],max(0,(int)($charge['amount_refunded']??0)));$target=refund_target_seconds((int)$payment['seconds_granted'],(int)$payment['amount_minor'],$refunded);$delta=refund_delta_seconds($target,(int)$payment['revoked_seconds']);
        $sourceType=$payment['product_type']==='subscription'?'subscription':'payment';
        $sourceId=(string)$payment['id'];
        $removed=revoke_paid_lot($pdo,$payment['user_id'],$sourceType,$sourceId,$delta);
        if($removed>0){$type=$isDispute?'chargeback':'refund';$pdo->prepare("INSERT INTO credit_ledger (id,user_id,entry_type,paid_delta,reference_type,reference_id,idempotency_key,note) VALUES (?,?,? ,?,'payment',?,?,?)")->execute([uuid_v4(),$payment['user_id'],$type,-$removed,$payment['id'],$type.':'.$event['id'],$isDispute?'Stripe dispute':'Stripe refund']);}
        $pdo->prepare('UPDATE payments SET status=?,refunded_minor=GREATEST(refunded_minor,?),revoked_seconds=revoked_seconds+? WHERE id=?')->execute([$isDispute?'disputed':'refunded',$refunded,$removed,$payment['id']]);
        if(!$isDispute){$mark=$pdo->prepare("UPDATE refund_requests SET status='processed' WHERE payment_id=? AND stripe_refund_id=? AND status='submitted'");foreach(($charge['refunds']['data']??[]) as $refund){$refundId=(string)($refund['id']??'');if($refundId!=='')$mark->execute([$payment['id'],$refundId]);}}
    }
    if(in_array($event['type'],['refund.updated','refund.failed'],true)){
        $refund=$event['data']['object']??[];$requestId=(string)($refund['metadata']['refund_request_id']??'');
        if($requestId!==''){$status=(($refund['status']??'')==='failed'||$event['type']==='refund.failed')?'failed':((($refund['status']??'')==='succeeded')?'processed':'submitted');$pdo->prepare('UPDATE refund_requests SET status=?,error_code=? WHERE id=?')->execute([$status,$status==='failed'?'STRIPE_REFUND_FAILED':null,$requestId]);}
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
