<?php
declare(strict_types=1);

const API_ROOT = __DIR__;
$configPath = API_ROOT . '/config.php';
if (!is_file($configPath)) {
    http_response_code(503);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'error' => ['code' => 'NOT_CONFIGURED', 'message' => 'Service is not configured.']]);
    exit;
}

$config = require $configPath;
require_once API_ROOT . '/lib/http.php';
require_once API_ROOT . '/lib/db.php';
require_once API_ROOT . '/lib/auth.php';

start_secure_session($config);
