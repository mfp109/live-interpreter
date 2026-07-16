<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

try {
    $pdo=db($config);$pdo->query('SELECT 1');
    $stmt=$pdo->prepare('SELECT COUNT(*) FROM schema_migrations WHERE version=?');$stmt->execute(['010_subscription_credits.sql']);
    if((int)$stmt->fetchColumn()!==1)json_error('MIGRATION_REQUIRED','Service database is not ready.',503);
    json_response(['ok' => true, 'status' => 'healthy','database'=>'ready']);
} catch (Throwable $error) {
    error_log('health check failed: ' . $error->getMessage());
    json_error('SERVICE_UNAVAILABLE', 'Service is temporarily unavailable.', 503);
}
