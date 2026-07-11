<?php
declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';
require_method('POST');
$body = json_body();
$email = strtolower(trim((string)($body['email'] ?? '')));
$password = (string)($body['password'] ?? '');
enforce_login_rate_limit($config,$email);
$stmt = db($config)->prepare('SELECT id,password_hash,status,email_verified_at,role,auth_version FROM users WHERE email=? AND deleted_at IS NULL');
$stmt->execute([$email]);
$user = $stmt->fetch();
if (!$user || !password_verify($password, $user['password_hash'])) {
    record_login_attempt($config,$email,false);
    usleep(350000);
    json_error('LOGIN_FAILED', 'Email or password is incorrect.', 401);
}
if (!$user['email_verified_at']) json_error('EMAIL_NOT_VERIFIED', 'Please verify your email address.', 403);
if ($user['status'] !== 'active') json_error('ACCOUNT_DISABLED', 'This account cannot sign in.', 403);
record_login_attempt($config,$email,true);
session_regenerate_id(true);
if ($user['role'] === 'admin') {
    $_SESSION['pending_admin_user_id'] = $user['id'];
    $_SESSION['pending_admin_auth_version'] = (int)$user['auth_version'];
    unset($_SESSION['user_id'], $_SESSION['admin_2fa_verified']);
    json_response(['ok' => true, 'requires_2fa' => true, 'csrf_token' => issue_csrf_token()]);
}
$_SESSION['user_id'] = $user['id'];
$_SESSION['auth_version'] = (int)$user['auth_version'];
$_SESSION['signed_in_at'] = time();
json_response(['ok' => true, 'requires_2fa' => false, 'csrf_token' => issue_csrf_token()]);
