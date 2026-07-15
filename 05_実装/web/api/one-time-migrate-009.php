<?php
declare(strict_types=1);

header('Cache-Control: no-store, max-age=0');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: no-referrer');

require __DIR__ . '/bootstrap.php';
require_method('POST');

const MIGRATION_TOKEN_HASH = '2b792bcce57510f03b82c7cf739aed825b1f3d9ccf5666664b89d56d8fe6ac7b';
const MIGRATION_VERSION = '009_trial_and_intro_offer.sql';

$body = json_body();
$token = trim((string)($body['token'] ?? ''));
if (!hash_equals(MIGRATION_TOKEN_HASH, hash('sha256', $token))) {
    json_error('MIGRATION_TOKEN_INVALID', 'Invalid migration token.', 403);
}

$pdo = db($config);
try {
    $pdo->beginTransaction();
    $stmt = $pdo->prepare('SELECT COUNT(*) FROM schema_migrations WHERE version=?');
    $stmt->execute([MIGRATION_VERSION]);
    if ((int)$stmt->fetchColumn() === 0) {
        $pdo->exec("INSERT INTO products (id,code,name_key,seconds_granted,price_minor,currency,active,sort_order)
            VALUES ('00000000-0000-4000-8000-000000000030','intro_30','product.intro',1800,500,'JPY',1,5)
            ON DUPLICATE KEY UPDATE name_key=VALUES(name_key),seconds_granted=VALUES(seconds_granted),price_minor=VALUES(price_minor),currency=VALUES(currency),active=1,sort_order=VALUES(sort_order)");
        $pdo->prepare('INSERT INTO schema_migrations (version) VALUES (?)')->execute([MIGRATION_VERSION]);
    }
    $pdo->commit();
    @unlink(__FILE__);
    json_response(['ok' => true, 'migration' => MIGRATION_VERSION]);
} catch (Throwable $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('One-time migration 009 failed: ' . $error->getMessage());
    json_error('MIGRATION_FAILED', 'Database migration failed.', 500);
}
