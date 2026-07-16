<?php
declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';
require_once dirname(__DIR__) . '/lib/stripe.php';
require_once dirname(__DIR__) . '/lib/products.php';
require_method('POST');
$user = require_user($config);
require_csrf();
if (!$user['email_verified_at']) json_error('EMAIL_NOT_VERIFIED', 'Please verify your email address.', 403);
$productId = (string)(json_body()['product_id'] ?? '');
$pdo = db($config);
$stmt = $pdo->prepare('SELECT id,code,name_key,product_type,billing_interval,seconds_granted,price_minor,currency FROM products WHERE id=? AND active=1');
$stmt->execute([$productId]);
$product = $stmt->fetch();
if (!$product) json_error('PRODUCT_NOT_FOUND', 'Product is not available.', 404);

$paymentId = uuid_v4();
try {
    $pdo->beginTransaction();
    $lock = $pdo->prepare('SELECT id FROM users WHERE id=? FOR UPDATE');
    $lock->execute([$user['id']]);
    if (!$lock->fetchColumn()) throw new RuntimeException('USER_NOT_FOUND');
    if ((string)$product['id'] === INTRODUCTORY_PRODUCT_ID && !introductory_offer_available($pdo, (string)$user['id'])) {
        $pdo->rollBack();
        json_error('INTRO_OFFER_NOT_AVAILABLE', 'The introductory offer is available only for your first purchase.', 409);
    }
    $subscription = active_subscription($pdo, (string)$user['id']);
    if ($product['product_type'] === 'subscription' && $subscription !== null) {
        $pdo->rollBack();
        json_error('SUBSCRIPTION_ALREADY_ACTIVE', 'Manage your current subscription before choosing another plan.', 409);
    }
    if ($product['product_type'] === 'topup' && !topup_available($pdo, (string)$user['id'])) {
        $pdo->rollBack();
        json_error('SUBSCRIPTION_REQUIRED', 'Credit packs are available with an active subscription.', 409);
    }
    $pdo->prepare("INSERT INTO payments (id,user_id,product_id,amount_minor,currency,status) VALUES (?,?,?,?,?,'created')")
        ->execute([$paymentId, $user['id'], $product['id'], $product['price_minor'], $product['currency']]);
    $pdo->commit();
} catch (Throwable $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    if ($error instanceof RuntimeException && $error->getMessage() === 'USER_NOT_FOUND') {
        json_error('AUTH_REQUIRED', 'Authentication required.', 401);
    }
    throw $error;
}

try {
    $isSubscription = $product['product_type'] === 'subscription';
    $fields = [
        'mode' => $isSubscription ? 'subscription' : 'payment',
        'customer_email' => $user['email'],
        'client_reference_id' => $user['id'],
        'success_url' => rtrim($config['app_url'], '/') . '/account?checkout=success&session_id={CHECKOUT_SESSION_ID}',
        'cancel_url' => rtrim($config['app_url'], '/') . '/pricing?checkout=cancelled',
        'locale' => $user['locale'] === 'zh-CN' ? 'zh' : $user['locale'],
        'line_items[0][quantity]' => 1,
        'line_items[0][price_data][currency]' => strtolower($product['currency']),
        'line_items[0][price_data][unit_amount]' => $product['price_minor'],
        'line_items[0][price_data][product_data][name]' => $product['code'] . ' - ' . number_format((int)$product['seconds_granted']) . ' LI Credits',
        'metadata[payment_id]' => $paymentId,
        'metadata[user_id]' => $user['id'],
        'metadata[product_id]' => $product['id'],
    ];
    if ($isSubscription) {
        $fields['line_items[0][price_data][recurring][interval]'] = 'month';
        $fields['subscription_data[metadata][payment_id]'] = $paymentId;
        $fields['subscription_data[metadata][user_id]'] = $user['id'];
        $fields['subscription_data[metadata][product_id]'] = $product['id'];
    } else {
        $fields['payment_intent_data[metadata][payment_id]'] = $paymentId;
    }
    $session = stripe_request($config, 'POST', '/v1/checkout/sessions', $fields, 'checkout:' . $paymentId);
    $pdo->prepare('UPDATE payments SET stripe_checkout_session_id=? WHERE id=?')->execute([$session['id'], $paymentId]);
    json_response(['ok' => true, 'checkout_url' => $session['url']]);
} catch (Throwable $error) {
    error_log('checkout creation failed payment=' . $paymentId . ' error=' . $error->getMessage());
    $pdo->prepare("UPDATE payments SET status='failed' WHERE id=?")->execute([$paymentId]);
    json_error('PAYMENT_PROVIDER_ERROR', 'Payment could not be started.', 502);
}
