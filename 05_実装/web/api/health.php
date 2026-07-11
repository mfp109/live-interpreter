<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

try {
    db($config)->query('SELECT 1');
    json_response(['ok' => true, 'status' => 'healthy']);
} catch (Throwable $error) {
    error_log('health check failed: ' . $error->getMessage());
    json_error('SERVICE_UNAVAILABLE', 'Service is temporarily unavailable.', 503);
}
