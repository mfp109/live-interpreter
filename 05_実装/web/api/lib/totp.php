<?php
declare(strict_types=1);

function base32_decode_strict(string $value): string
{
    $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    $clean = strtoupper(str_replace([' ', '-'], '', $value));
    if ($clean === '' || strspn($clean, $alphabet) !== strlen($clean)) throw new RuntimeException('Invalid TOTP secret.');
    $bits = '';
    foreach (str_split($clean) as $char) $bits .= str_pad(decbin(strpos($alphabet, $char)), 5, '0', STR_PAD_LEFT);
    $result = '';
    foreach (str_split($bits, 8) as $byte) if (strlen($byte) === 8) $result .= chr(bindec($byte));
    return $result;
}

function verify_totp(string $secret, string $code, ?int $now = null): bool
{
    if (!preg_match('/^\d{6}$/', $code)) return false;
    $key = base32_decode_strict($secret);
    $counter = intdiv($now ?? time(), 30);
    for ($offset = -1; $offset <= 1; $offset++) {
        $value = $counter + $offset;
        $binary = pack('N2', intdiv($value, 4294967296), $value % 4294967296);
        $hash = hash_hmac('sha1', $binary, $key, true);
        $position = ord($hash[19]) & 0x0f;
        $number = ((ord($hash[$position]) & 0x7f) << 24) | ((ord($hash[$position + 1]) & 0xff) << 16) | ((ord($hash[$position + 2]) & 0xff) << 8) | (ord($hash[$position + 3]) & 0xff);
        if (hash_equals(str_pad((string)($number % 1000000), 6, '0', STR_PAD_LEFT), $code)) return true;
    }
    return false;
}
