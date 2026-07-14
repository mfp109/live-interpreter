<?php
declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';
require_method('POST');
$user = require_user($config);
require_csrf();
$body = json_body();

$source = trim((string)($body['source_language'] ?? ''));
$target = trim((string)($body['target_language'] ?? ''));
$situation = trim((string)($body['situation'] ?? ''));
$purpose = trim((string)($body['purpose'] ?? ''));
$terms = trim((string)($body['key_terms'] ?? ''));
$locale = (string)($body['locale'] ?? $user['locale'] ?? 'ja');
$allowedLanguages = ['ja','en','zh','ko','es','fr','de','pt','it','ru','ar','hi','th','vi'];
$allowedLocales = ['ja','en','zh-CN'];

if (!in_array($source, $allowedLanguages, true) || !in_array($target, $allowedLanguages, true) || $source === $target) {
    json_error('VALIDATION_ERROR', 'Choose two different supported languages.');
}
if (!in_array($locale, $allowedLocales, true)) $locale = 'ja';
$length = function_exists('mb_strlen')
    ? mb_strlen($situation . $purpose . $terms, 'UTF-8')
    : strlen($situation . $purpose . $terms);
if ($situation === '' || $length > 2000) {
    json_error('VALIDATION_ERROR', 'Situation is required and the total input must be 2,000 characters or fewer.');
}

$pdo = db($config);
$pdo->beginTransaction();
try {
    $pdo->prepare('INSERT IGNORE INTO ai_preparation_usage (user_id,usage_date,generation_count) VALUES (?,CURRENT_DATE,0)')->execute([$user['id']]);
    $stmt = $pdo->prepare('SELECT generation_count FROM ai_preparation_usage WHERE user_id=? AND usage_date=CURRENT_DATE FOR UPDATE');
    $stmt->execute([$user['id']]);
    $used = (int)$stmt->fetchColumn();
    if ($used >= 5) {
        $pdo->rollBack();
        json_error('DAILY_LIMIT_REACHED', 'Daily generation limit reached.', 429);
    }
    $pdo->prepare('UPDATE ai_preparation_usage SET generation_count=generation_count+1 WHERE user_id=? AND usage_date=CURRENT_DATE')->execute([$user['id']]);
    $pdo->commit();
} catch (Throwable $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('preparation quota failed: ' . $error->getMessage());
    json_error('SERVICE_UNAVAILABLE', 'Service is temporarily unavailable.', 503);
}

$payload = json_encode([
    'user_id' => $user['id'],
    'source_language' => $source,
    'target_language' => $target,
    'situation' => $situation,
    'purpose' => $purpose,
    'key_terms' => $terms,
    'locale' => $locale,
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

try {
    if (!is_string($payload)) throw new RuntimeException('Payload encoding failed.');
    $signed = sign_gateway_payload($config, $payload);
    $url = rtrim((string)$config['gateway_url'], '/') . '/prepare';
    $context = stream_context_create(['http' => [
        'method' => 'POST',
        'header' => implode("\r\n", [
            'Content-Type: application/json',
            'X-Gateway-Timestamp: ' . $signed['timestamp'],
            'X-Gateway-Signature: ' . $signed['signature'],
            'Connection: close',
        ]),
        'content' => $payload,
        'timeout' => 45,
        'ignore_errors' => true,
    ]]);
    $raw = file_get_contents($url, false, $context);
    $statusLine = $http_response_header[0] ?? '';
    preg_match('/\s(\d{3})\s/', $statusLine, $matches);
    $status = (int)($matches[1] ?? 0);
    $result = json_decode(is_string($raw) ? $raw : '', true);
    if ($status !== 200 || !is_array($result) || ($result['ok'] ?? false) !== true) {
        throw new RuntimeException('Gateway preparation request failed with status ' . $status);
    }
    json_response([
        'ok' => true,
        'brief' => $result['brief'],
        'remaining_generations' => max(0, 4 - $used),
    ]);
} catch (Throwable $error) {
    error_log('preparation generation failed: ' . $error->getMessage());
    try {
        $pdo->prepare('UPDATE ai_preparation_usage SET generation_count=GREATEST(0,generation_count-1) WHERE user_id=? AND usage_date=CURRENT_DATE')->execute([$user['id']]);
    } catch (Throwable $rollbackError) {
        error_log('preparation quota rollback failed: ' . $rollbackError->getMessage());
    }
    json_error('AI_PREPARATION_UNAVAILABLE', 'AI preparation is temporarily unavailable.', 503);
}
