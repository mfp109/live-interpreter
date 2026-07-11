<?php
declare(strict_types=1);

require dirname(__DIR__) . '/api/lib/stripe.php';

$payload = '{"id":"evt_test","type":"checkout.session.completed"}';
$secret = 'whsec_test_value';
$timestamp = time();
$valid = hash_hmac('sha256', $timestamp . '.' . $payload, $secret);
verify_stripe_signature($payload, 't=' . $timestamp . ',v1=' . $valid, $secret);

$rejected = false;
try {
    verify_stripe_signature($payload . 'x', 't=' . $timestamp . ',v1=' . $valid, $secret);
} catch (RuntimeException) {
    $rejected = true;
}
if (!$rejected) throw new RuntimeException('Tampered payload was accepted.');

$expiredRejected = false;
try {
    $old = $timestamp - 1000;
    verify_stripe_signature($payload, 't=' . $old . ',v1=' . hash_hmac('sha256', $old . '.' . $payload, $secret), $secret);
} catch (RuntimeException) {
    $expiredRejected = true;
}
if (!$expiredRejected) throw new RuntimeException('Expired signature was accepted.');

echo "Stripe signature tests passed.\n";
