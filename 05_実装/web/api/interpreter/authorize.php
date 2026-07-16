<?php
declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';
require_once dirname(__DIR__) . '/lib/gateway.php';
require_method('POST');
$user = require_user($config);
require_csrf();
$body = json_body();

$allowed = ['ar','bn','zh','nl','en','fr','de','hi','id','it','ja','ko','pt','ru','es','sv','th','tr','uk','vi'];
$mode = (string)($body['mode'] ?? 'audio');
if ($mode === 'interpretation') $mode = 'audio';
if ($mode === 'caption') $mode = 'captions';
if (!in_array($mode, ['audio','both','captions'], true)) {
    json_error('MODE_INVALID', 'Mode is not available.');
}

$source = (string)($body['source_language'] ?? '');
if (!in_array($source, $allowed, true)) {
    json_error('LANGUAGE_PAIR_INVALID', 'Input language is not available.');
}

$audioTarget = null;
if ($mode === 'audio' || $mode === 'both') {
    $audioTarget = (string)($body['target_language'] ?? '');
    if (!in_array($audioTarget, $allowed, true) || $audioTarget === $source) {
        json_error('LANGUAGE_PAIR_INVALID', 'Interpretation language is not available.');
    }
}

$captions = [];
if ($mode === 'both' || $mode === 'captions') {
    $rawCaptions = $body['caption_languages'] ?? [];
    if (!is_array($rawCaptions) || count($rawCaptions) > 2) {
        json_error('CAPTIONS_INVALID', 'Caption languages are not valid.');
    }
    foreach ($rawCaptions as $caption) {
        $language = (string)$caption;
        if ($language === '' || $language === 'none') continue;
        if ($language === $source) $language = 'source';
        if ($language !== 'source' && !in_array($language, $allowed, true)) {
            json_error('CAPTIONS_INVALID', 'Caption language is not available.');
        }
        if (!in_array($language, $captions, true)) $captions[] = $language;
    }
    if (count($captions) === 0) {
        json_error('CAPTIONS_REQUIRED', 'Choose at least one caption language.');
    }
}

$translationTargets = [];
if ($audioTarget !== null) $translationTargets[] = $audioTarget;
foreach ($captions as $caption) {
    if ($caption !== 'source' && !in_array($caption, $translationTargets, true)) {
        $translationTargets[] = $caption;
    }
}
$transcribeSource = in_array('source', $captions, true);
$creditsPerSecond = count($translationTargets) * 12 + ($transcribeSource ? 1 : 0);
if ($creditsPerSecond < 1 || $creditsPerSecond > 37) {
    json_error('SESSION_CONFIGURATION_INVALID', 'Session configuration is not available.');
}

$pdo = db($config);
$pdo->beginTransaction();
expire_credit_lots($pdo, $user['id']);
$stmt = $pdo->prepare('SELECT trial_seconds,paid_seconds,reserved_seconds FROM wallets WHERE user_id=?');
$stmt->execute([$user['id']]);
$wallet = $stmt->fetch();
$available = $wallet ? (int)$wallet['trial_seconds'] + (int)$wallet['paid_seconds'] - (int)$wallet['reserved_seconds'] : 0;
if ($available < $creditsPerSecond) {
    $pdo->commit();
    json_error('BALANCE_EMPTY', 'No interpretation time remains.', 402);
}

$sessionId = uuid_v4();
$storedTarget = $audioTarget ?? ($translationTargets[0] ?? $source);
$pdo->prepare('INSERT INTO translation_sessions (id,user_id,source_language,target_language,status) VALUES (?,?,?,?,\'authorized\')')
    ->execute([$sessionId, $user['id'], $source, $storedTarget]);
$pdo->commit();
$expires = time() + 120;
$token = create_gateway_token($config, [
    'sid' => $sessionId,
    'uid' => $user['id'],
    'src' => $source,
    'dst' => $storedTarget,
    'mode' => $mode,
    'audio_target' => $audioTarget,
    'captions' => $captions,
    'translation_targets' => $translationTargets,
    'transcribe_source' => $transcribeSource,
    'rate' => $creditsPerSecond,
    'exp' => $expires,
    'nonce' => bin2hex(random_bytes(12)),
]);
json_response([
    'ok' => true,
    'gateway_url' => $config['gateway_url'],
    'access_token' => $token,
    'expires_at' => $expires,
    'session_id' => $sessionId,
    'mode' => $mode,
    'credits_per_second' => $creditsPerSecond,
    'available_credits' => $available,
]);
