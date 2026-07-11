<?php
declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';
require_once dirname(__DIR__) . '/lib/totp.php';
require_method('POST');
require_csrf();
$pending = $_SESSION['pending_admin_user_id'] ?? null;
$code = (string)(json_body()['code'] ?? '');
$secret = (string)($config['admin_totp_secret'] ?? '');
if (!is_string($pending) || $secret === '' || $secret === 'CHANGE_ME' || !verify_totp($secret, $code)) {
    usleep(350000);
    json_error('TWO_FACTOR_FAILED', 'Verification code is incorrect.', 401);
}
session_regenerate_id(true);
    $_SESSION['user_id'] = $pending;
    $_SESSION['auth_version'] = (int)($_SESSION['pending_admin_auth_version'] ?? -1);
$_SESSION['admin_2fa_verified'] = true;
    unset($_SESSION['pending_admin_user_id'], $_SESSION['pending_admin_auth_version']);
json_response(['ok'=>true,'csrf_token'=>issue_csrf_token()]);
