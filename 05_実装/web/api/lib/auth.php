<?php
declare(strict_types=1);

function start_secure_session(array $config): void
{
    if (session_status() === PHP_SESSION_ACTIVE) return;
    session_name($config['session_name'] ?? 'swli_session');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => ($config['app_env'] ?? 'production') !== 'local',
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

function current_user(array $config): ?array
{
    $userId = $_SESSION['user_id'] ?? null;
    if (!is_string($userId)) return null;
    $stmt = db($config)->prepare('SELECT id, email, display_name, locale, role, status, email_verified_at FROM users WHERE id = ? AND deleted_at IS NULL');
    $stmt->execute([$userId]);
    $user = $stmt->fetch();
    if (!$user || $user['status'] !== 'active') return null;
    return $user;
}

function require_user(array $config): array
{
    $user = current_user($config);
    if (!$user) json_error('AUTH_REQUIRED', 'Authentication required.', 401);
    return $user;
}

function issue_csrf_token(): string
{
    if (!isset($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(32));
    return $_SESSION['csrf'];
}

function require_csrf(): void
{
    $supplied = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    $expected = $_SESSION['csrf'] ?? '';
    if (!is_string($supplied) || !is_string($expected) || $expected === '' || !hash_equals($expected, $supplied)) {
        json_error('CSRF_INVALID', 'Invalid request token.', 403);
    }
}
