<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "CLI only.\n");
    exit(1);
}

$outputPath = $argv[1] ?? dirname(__DIR__) . '/release/one-time-login-unlock.php';
$setupCode = bin2hex(random_bytes(16));
$setupHash = hash('sha256', $setupCode);

$template = <<<'PHP'
<?php
declare(strict_types=1);

header('Cache-Control: no-store, max-age=0');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: no-referrer');
require __DIR__ . '/api/bootstrap.php';

const SETUP_HASH = __SETUP_HASH__;
function h(string $value): string { return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }

$errors = [];
$success = false;
$removed = 0;
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
    $setupCode = trim((string)($_POST['setup_code'] ?? ''));
    $email = strtolower(trim((string)($_POST['email'] ?? '')));
    if (!hash_equals(SETUP_HASH, hash('sha256', $setupCode))) $errors[] = '解除コードが正しくありません。';
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) $errors[] = 'メールアドレスが正しくありません。';

    if ($errors === []) {
        try {
            $emailHash = security_hash($config, $email);
            $ipHash = security_hash($config, (string)($_SERVER['REMOTE_ADDR'] ?? ''));
            $stmt = db($config)->prepare(
                'DELETE FROM auth_attempts WHERE created_at > DATE_SUB(NOW(), INTERVAL 15 MINUTE) AND (email_hash=? OR ip_hash=?)'
            );
            $stmt->execute([$emailHash, $ipHash]);
            $removed = $stmt->rowCount();
            error_log('One-time login unlock completed attempts=' . $removed);
            $success = true;
            @unlink(__FILE__);
        } catch (Throwable $error) {
            error_log('One-time login unlock failed code=' . $error->getMessage());
            $errors[] = 'ログイン制限を解除できませんでした。設定は変更されていません。';
        }
    }
}
?>
<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ShalomWorks ログイン制限解除</title><style>
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f3f7f6;color:#15333a;margin:0;padding:28px 16px}.card{max-width:600px;margin:auto;background:#fff;padding:28px;border-radius:18px;box-shadow:0 12px 40px #16333a18}.hint{color:#5d6d70;line-height:1.65}.error{background:#fff0f0;color:#981f1f;padding:12px;border-radius:8px;margin:10px 0}.ok{background:#eaf8ef;color:#175c34;padding:16px;border-radius:9px;line-height:1.7}label{display:block;font-weight:700;margin:18px 0 7px}input{width:100%;box-sizing:border-box;padding:12px;border:1px solid #b9c8c5;border-radius:9px;font-size:16px}button{margin-top:24px;padding:13px 20px;border:0;border-radius:9px;background:#0f6c63;color:#fff;font-weight:700;font-size:16px}
</style></head><body><main class="card">
<?php if ($success): ?>
<h1>ログイン制限を解除しました</h1><div class="ok">直近15分の失敗履歴を解除しました。パスワードや2段階認証の設定は変更していません。この解除ページは自動削除されました。</div>
<?php else: ?>
<h1>ログイン制限解除</h1><p class="hint">対象メールアドレスと現在の接続元IPに紐づく、直近15分のログイン失敗履歴だけを削除します。</p>
<?php foreach ($errors as $error): ?><div class="error"><?=h($error)?></div><?php endforeach; ?>
<form method="post" autocomplete="off"><label>解除コード</label><input type="password" name="setup_code" autocomplete="new-password" required><label>管理者メールアドレス</label><input type="email" name="email" required><button type="submit">ログイン制限を解除</button></form>
<?php endif; ?>
</main></body></html>
PHP;

$output = str_replace('__SETUP_HASH__', var_export($setupHash, true), $template);
$directory = dirname($outputPath);
if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) exit(1);
if (file_put_contents($outputPath, $output, LOCK_EX) === false) exit(1);
chmod($outputPath, 0600);
fwrite(STDOUT, "SETUP_FILE={$outputPath}\nUNLOCK_CODE={$setupCode}\n");
