<?php
declare(strict_types=1);

function stripe_request(array $config, string $method, string $path, array $fields = [], ?string $idempotencyKey = null): array
{
    $secret = (string)($config['stripe_secret_key'] ?? '');
    if ($secret === '' || $secret === 'CHANGE_ME') throw new RuntimeException('Stripe is not configured.');
    $query = http_build_query($fields);
    $url = 'https://api.stripe.com' . $path;
    if (strtoupper($method) === 'GET' && $query !== '') $url .= '?' . $query;
    $curl = curl_init($url);
    $headers = ['Authorization: Bearer ' . $secret, 'Content-Type: application/x-www-form-urlencoded'];
    if ($idempotencyKey) $headers[] = 'Idempotency-Key: ' . $idempotencyKey;
    curl_setopt_array($curl, [
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 20,
    ]);
    if (strtoupper($method) !== 'GET') curl_setopt($curl, CURLOPT_POSTFIELDS, $query);
    $body = curl_exec($curl);
    $status = (int)curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    $curlError = curl_error($curl);
    curl_close($curl);
    if ($body === false || $curlError !== '') throw new RuntimeException('Stripe network error.');
    $decoded = json_decode($body, true);
    if (!is_array($decoded) || $status < 200 || $status >= 300) {
        $stripeError = is_array($decoded) && is_array($decoded['error'] ?? null) ? $decoded['error'] : [];
        $details = array_filter([
            $stripeError['type'] ?? 'invalid_response',
            $stripeError['code'] ?? null,
            $stripeError['param'] ?? null,
            $stripeError['message'] ?? null,
        ]);
        throw new RuntimeException('Stripe request failed: ' . implode(' | ', array_map('strval', $details)));
    }
    return $decoded;
}

function verify_stripe_signature(string $payload, string $header, string $secret, int $tolerance = 300): void
{
    if ($secret === '' || $secret === 'CHANGE_ME') throw new RuntimeException('Webhook is not configured.');
    $timestamp = null;
    $signatures = [];
    foreach (explode(',', $header) as $part) {
        [$key, $value] = array_pad(explode('=', trim($part), 2), 2, '');
        if ($key === 't') $timestamp = ctype_digit($value) ? (int)$value : null;
        if ($key === 'v1' && preg_match('/^[a-f0-9]{64}$/', $value)) $signatures[] = $value;
    }
    if (!$timestamp || abs(time() - $timestamp) > $tolerance || !$signatures) throw new RuntimeException('Invalid webhook timestamp.');
    $expected = hash_hmac('sha256', $timestamp . '.' . $payload, $secret);
    foreach ($signatures as $signature) if (hash_equals($expected, $signature)) return;
    throw new RuntimeException('Invalid webhook signature.');
}
