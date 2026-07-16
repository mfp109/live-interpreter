<?php
declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';
require_once dirname(__DIR__) . '/lib/gateway.php';
require_method('POST');
$user = require_user($config);
require_csrf();
$body = json_body();
$mode = (string)($body['mode'] ?? 'interpretation');
if (!in_array($mode, ['interpretation','caption'], true)) json_error('MODE_INVALID', 'Mode is not available.');
$source = (string)($body['source_language'] ?? '');
$target = (string)($body['target_language'] ?? '');
$allowed = ['ar','bn','zh','nl','en','fr','de','hi','id','it','ja','ko','pt','ru','es','sv','th','tr','uk','vi'];
if ($mode === 'caption') {
    $source = 'ja';
    $target = 'ja';
} elseif (!in_array($source, $allowed, true) || !in_array($target, $allowed, true) || $source === $target) {
    json_error('LANGUAGE_PAIR_INVALID', 'Language pair is not available.');
}

$useTerminologyMode = $mode === 'interpretation' && ($body['use_terminology_mode'] ?? false) === true;
$glossary = [];
$rawGlossary = $useTerminologyMode ? ($body['glossary'] ?? []) : [];
if (!is_array($rawGlossary) || count($rawGlossary) > 20) {
    json_error('GLOSSARY_INVALID', 'Glossary is not valid.');
}
foreach ($rawGlossary as $entry) {
    if (!is_array($entry)) json_error('GLOSSARY_INVALID', 'Glossary is not valid.');
    $term = trim((string)($entry['source'] ?? ''));
    $translation = trim((string)($entry['translation'] ?? ''));
    if ($term === '' || $translation === '' || mb_strlen($term) > 80 || mb_strlen($translation) > 80 || preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', $term . $translation)) {
        json_error('GLOSSARY_INVALID', 'Glossary is not valid.');
    }
    $glossary[] = ['source' => $term, 'translation' => $translation];
}
if ($useTerminologyMode && count($glossary) === 0) {
    json_error('GLOSSARY_REQUIRED', 'At least one glossary entry is required.');
}

$pdo = db($config);
$pdo->beginTransaction();
expire_credit_lots($pdo,$user['id']);
$stmt = $pdo->prepare('SELECT trial_seconds,paid_seconds,reserved_seconds FROM wallets WHERE user_id=?');
$stmt->execute([$user['id']]);
$wallet = $stmt->fetch();
$available = $wallet ? (int)$wallet['trial_seconds'] + (int)$wallet['paid_seconds'] - (int)$wallet['reserved_seconds'] : 0;
if ($available <= 0){$pdo->commit();json_error('BALANCE_EMPTY', 'No interpretation time remains.', 402);}

$sessionId = uuid_v4();
$pdo->prepare('INSERT INTO translation_sessions (id,user_id,source_language,target_language,status) VALUES (?,?,?,?,\'authorized\')')
    ->execute([$sessionId, $user['id'], $source, $target]);
$pdo->commit();
$expires = time() + 120;
$token = create_gateway_token($config, ['sid'=>$sessionId,'uid'=>$user['id'],'src'=>$source,'dst'=>$target,'mode'=>$mode,'terminology_mode'=>$useTerminologyMode,'glossary'=>$glossary,'exp'=>$expires,'nonce'=>bin2hex(random_bytes(12))]);
json_response(['ok'=>true,'gateway_url'=>$config['gateway_url'],'access_token'=>$token,'expires_at'=>$expires,'session_id'=>$sessionId,'mode'=>$mode,'available_credits'=>$available]);
