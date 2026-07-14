<?php
declare(strict_types=1);

function base64url_encode(string $value): string
{
    return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
}

function create_gateway_token(array $config, array $claims): string
{
    $secret = (string)($config['gateway_shared_secret'] ?? '');
    if ($secret === '' || $secret === 'CHANGE_ME') throw new RuntimeException('Gateway is not configured.');
    $payload = base64url_encode(json_encode($claims, JSON_UNESCAPED_SLASHES));
    return $payload . '.' . base64url_encode(hash_hmac('sha256', $payload, $secret, true));
}

function sign_gateway_payload(array $config, string $payload, ?int $timestamp = null): array
{
    $secret = (string)($config['gateway_shared_secret'] ?? '');
    if ($secret === '' || $secret === 'CHANGE_ME') throw new RuntimeException('Gateway is not configured.');
    $value = (string)($timestamp ?? time());
    return [
        'timestamp' => $value,
        'signature' => hash_hmac('sha256', $value . '.' . $payload, $secret),
    ];
}

function verify_gateway_request(array $config, string $payload, string $timestamp, string $signature): void
{
    $secret = (string)($config['gateway_shared_secret'] ?? '');
    if ($secret === '' || $secret === 'CHANGE_ME' || !ctype_digit($timestamp) || abs(time() - (int)$timestamp) > 60) {
        throw new RuntimeException('Gateway request expired.');
    }
    $expected = hash_hmac('sha256', $timestamp . '.' . $payload, $secret);
    if (!preg_match('/^[a-f0-9]{64}$/', $signature) || !hash_equals($expected, $signature)) throw new RuntimeException('Invalid gateway signature.');
}
