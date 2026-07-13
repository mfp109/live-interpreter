<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "CLI only.\n");
    exit(1);
}

$gatewayEnvPath = $argv[1] ?? '';
$outputPath = $argv[2] ?? dirname(__DIR__) . '/release/one-time-setup.php';
if ($gatewayEnvPath === '' || !is_file($gatewayEnvPath)) {
    fwrite(STDERR, "Usage: php generate-browser-setup.php /path/to/gateway.env [output.php]\n");
    exit(1);
}

$gatewayEnv = file_get_contents($gatewayEnvPath);
if ($gatewayEnv === false || !preg_match('/^GATEWAY_SHARED_SECRET=(.+)$/m', $gatewayEnv, $match)) {
    fwrite(STDERR, "GATEWAY_SHARED_SECRET was not found.\n");
    exit(1);
}
$gatewaySecret = trim($match[1]);
if ($gatewaySecret === '' || str_contains($gatewaySecret, "\n") || str_contains($gatewaySecret, "\r")) {
    fwrite(STDERR, "Invalid Gateway shared secret.\n");
    exit(1);
}

$migrationFiles = glob(dirname(__DIR__) . '/database/*.sql') ?: [];
sort($migrationFiles, SORT_STRING);
if ($migrationFiles === []) {
    fwrite(STDERR, "No database migrations found.\n");
    exit(1);
}
$migrations = [];
foreach ($migrationFiles as $file) {
    $sql = file_get_contents($file);
    if ($sql === false || trim($sql) === '') {
        fwrite(STDERR, "Invalid migration: " . basename($file) . "\n");
        exit(1);
    }
    $migrations[basename($file)] = $sql;
}

$setupToken = (string)(getenv('SWLI_SETUP_CODE') ?: bin2hex(random_bytes(16)));
if (!preg_match('/^[a-f0-9]{32}$/', $setupToken)) {
    fwrite(STDERR, "SWLI_SETUP_CODE must be 32 lowercase hexadecimal characters.\n");
    exit(1);
}
$replacements = [
    '__SETUP_TOKEN_HASH__' => var_export(hash('sha256', $setupToken), true),
    '__GATEWAY_SHARED_SECRET__' => var_export($gatewaySecret, true),
    '__MIGRATIONS__' => var_export($migrations, true),
];

$template = <<<'PHP'
<?php
declare(strict_types=1);

header('Cache-Control: no-store, max-age=0');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header("Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");

const SETUP_TOKEN_HASH = __SETUP_TOKEN_HASH__;
const GATEWAY_SHARED_SECRET = __GATEWAY_SHARED_SECRET__;
const MIGRATIONS = __MIGRATIONS__;

function h(string $value): string { return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
function uuid_v4_setup(): string
{
    $data = random_bytes(16);
    $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
    $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}
function base32_setup(string $bytes): string
{
    $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    $bits = '';
    foreach (str_split($bytes) as $char) $bits .= str_pad(decbin(ord($char)), 8, '0', STR_PAD_LEFT);
    $out = '';
    foreach (str_split($bits, 5) as $part) {
        if (strlen($part) < 5) $part = str_pad($part, 5, '0');
        $out .= $alphabet[bindec($part)];
    }
    return $out;
}
function posted(string $key): string { return trim((string)($_POST[$key] ?? '')); }

$errors = [];
$success = false;
$totpSecret = '';
$configPath = __DIR__ . '/api/config.php';
$stage = 'validation';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $token = posted('setup_token');
    if (!hash_equals(SETUP_TOKEN_HASH, hash('sha256', $token))) $errors[] = '設定コードが正しくありません。';

    $dbName = posted('db_name');
    $dbUser = posted('db_user');
    $dbPassword = (string)($_POST['db_password'] ?? '');
    $stripeSecret = posted('stripe_secret_key');
    $stripeWebhook = posted('stripe_webhook_secret');
    $adminEmail = strtolower(posted('admin_email'));
    $adminPassword = (string)($_POST['admin_password'] ?? '');
    $adminPasswordConfirm = (string)($_POST['admin_password_confirm'] ?? '');
    $mailFrom = strtolower(posted('mail_from'));
    $sellerName = posted('seller_name');
    $legalAddress = posted('legal_address');
    $legalPhone = posted('legal_phone');
    $legalEmail = strtolower(posted('legal_email'));

    if (!preg_match('/^[A-Za-z0-9_]+$/', $dbName)) $errors[] = 'DB名の形式が正しくありません。';
    if (!preg_match('/^[A-Za-z0-9_]+$/', $dbUser)) $errors[] = 'DBユーザー名の形式が正しくありません。';
    if ($dbPassword === '') $errors[] = 'DBパスワードを入力してください。';
    if (!str_starts_with($stripeSecret, 'sk_test_')) $errors[] = 'Stripeのテスト用シークレットキーを入力してください。';
    if (!str_starts_with($stripeWebhook, 'whsec_')) $errors[] = 'Webhook署名シークレットの形式が正しくありません。';
    if (!filter_var($adminEmail, FILTER_VALIDATE_EMAIL)) $errors[] = '管理者メールアドレスが正しくありません。';
    if (strlen($adminPassword) < 16) $errors[] = '管理者パスワードは16文字以上にしてください。';
    if (!hash_equals($adminPassword, $adminPasswordConfirm)) $errors[] = '管理者パスワードが一致しません。';
    if (!filter_var($mailFrom, FILTER_VALIDATE_EMAIL)) $errors[] = '送信元メールアドレスが正しくありません。';
    if ($sellerName === '' || $legalAddress === '' || $legalPhone === '') $errors[] = '販売者表示の項目をすべて入力してください。';
    if (!filter_var($legalEmail, FILTER_VALIDATE_EMAIL)) $errors[] = '問い合わせメールアドレスが正しくありません。';
    if (is_file($configPath)) $errors[] = '設定はすでに存在します。上書きは行いません。';

    if ($errors === []) {
        try {
            $stage = 'db_connect';
            $pdo = new PDO(
                "mysql:host=localhost;dbname={$dbName};charset=utf8mb4",
                $dbUser,
                $dbPassword,
                [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
            );
            $stage = 'schema_migrations';
            $pdo->exec('CREATE TABLE IF NOT EXISTS schema_migrations (version VARCHAR(100) PRIMARY KEY, applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
            $applied = array_flip($pdo->query('SELECT version FROM schema_migrations')->fetchAll(PDO::FETCH_COLUMN));
            foreach (MIGRATIONS as $version => $sql) {
                if (isset($applied[$version])) continue;
                $stage = 'migration_' . preg_replace('/[^0-9A-Za-z_]/', '_', $version);
                $pdo->exec($sql);
                $stmt = $pdo->prepare('INSERT INTO schema_migrations (version) VALUES (?)');
                $stmt->execute([$version]);
            }

            $stage = 'admin_account';
            $adminId = uuid_v4_setup();
            $pdo->beginTransaction();
            $stmt = $pdo->prepare('SELECT id FROM users WHERE email=? FOR UPDATE');
            $stmt->execute([$adminEmail]);
            $existing = $stmt->fetchColumn();
            if ($existing) {
                $pdo->prepare("UPDATE users SET role='admin',status='active',email_verified_at=COALESCE(email_verified_at,NOW()),password_hash=?,auth_version=auth_version+1 WHERE id=?")
                    ->execute([password_hash($adminPassword, PASSWORD_DEFAULT), $existing]);
                $adminId = (string)$existing;
            } else {
                $pdo->prepare("INSERT INTO users (id,email,password_hash,role,status,email_verified_at,terms_version,terms_accepted_at) VALUES (?,?,?,'admin','active',NOW(),'2026-07-11',NOW())")
                    ->execute([$adminId, $adminEmail, password_hash($adminPassword, PASSWORD_DEFAULT)]);
                $pdo->prepare('INSERT INTO wallets (user_id) VALUES (?)')->execute([$adminId]);
            }
            $pdo->commit();

            $totpSecret = base32_setup(random_bytes(20));
            $config = [
                'app_env' => 'production',
                'app_url' => 'https://live-interpreter.shalomworks.tech',
                'db' => ['host'=>'localhost','name'=>$dbName,'user'=>$dbUser,'password'=>$dbPassword,'charset'=>'utf8mb4'],
                'session_name' => 'swli_session',
                'stripe_secret_key' => $stripeSecret,
                'stripe_webhook_secret' => $stripeWebhook,
                'gateway_shared_secret' => GATEWAY_SHARED_SECRET,
                'gateway_url' => 'https://gateway.live-interpreter.shalomworks.tech',
                'admin_totp_secret' => $totpSecret,
                'cron_secret' => bin2hex(random_bytes(32)),
                'security_hash_secret' => bin2hex(random_bytes(32)),
                'business' => ['openai_usd_per_minute'=>0.034,'usd_jpy_rate'=>160.0,'stripe_fee_rate'=>0.071],
                'mail' => ['from'=>$mailFrom],
                'legal' => ['seller_name'=>$sellerName,'address'=>$legalAddress,'phone'=>$legalPhone,'email'=>$legalEmail],
            ];
            $stage = 'config_write';
            $tempPath = $configPath . '.tmp-' . bin2hex(random_bytes(6));
            $contents = "<?php\ndeclare(strict_types=1);\n\nreturn " . var_export($config, true) . ";\n";
            if (file_put_contents($tempPath, $contents, LOCK_EX) === false) throw new RuntimeException('CONFIG_WRITE_FAILED');
            @chmod($tempPath, 0600);
            if (!rename($tempPath, $configPath)) { @unlink($tempPath); throw new RuntimeException('CONFIG_RENAME_FAILED'); }
            @chmod($configPath, 0600);
            $success = true;
            @unlink(__FILE__);
        } catch (Throwable $error) {
            if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) $pdo->rollBack();
            error_log('SWLI browser setup failed: ' . $error->getMessage());
            $driverCode = $error instanceof PDOException ? (string)($error->errorInfo[1] ?? '') : '';
            $diagnostic = match ($driverCode) {
                '1044', '1045' => 'DB_AUTH_OR_PERMISSION_FAILED',
                '1049' => 'DB_NOT_FOUND',
                '1050', '1060', '1061' => 'DB_PARTIAL_MIGRATION',
                '1142', '1143' => 'DB_PERMISSION_FAILED',
                '1205', '1213' => 'DB_BUSY_RETRY',
                '2002', '2003', '2005' => 'DB_HOST_CONNECTION_FAILED',
                default => 'SETUP_' . strtoupper(preg_replace('/[^0-9A-Za-z_]/', '_', $stage)) . '_FAILED',
            };
            $errors[] = '設定に失敗しました。秘密情報は保存されていません。診断コード: ' . $diagnostic;
        }
    }
}
?>
<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ShalomWorks 初期設定</title><style>
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f4f7fb;color:#18243a;margin:0;padding:32px 16px}.card{max-width:760px;margin:auto;background:#fff;border-radius:18px;padding:28px;box-shadow:0 12px 40px #1a31501a}h1{font-size:24px}h2{font-size:18px;margin-top:28px;border-top:1px solid #dde4ee;padding-top:22px}label{display:block;font-weight:650;margin:15px 0 6px}input{width:100%;box-sizing:border-box;padding:12px;border:1px solid #bcc7d6;border-radius:9px;font-size:16px}.hint{color:#5c687a;font-size:14px;line-height:1.6}.error{background:#fff1f1;color:#9d1c1c;padding:12px;border-radius:9px;margin:10px 0}.ok{background:#edf9f1;color:#145c31;padding:18px;border-radius:12px;line-height:1.7}.secret{font-family:monospace;word-break:break-all;background:#eef2f8;padding:12px;border-radius:8px}button{margin-top:25px;background:#3157d5;color:white;border:0;border-radius:10px;padding:14px 22px;font-size:16px;font-weight:700;cursor:pointer}
</style></head><body><main class="card">
<?php if ($success): ?>
<h1>初期設定が完了しました</h1><div class="ok">DB、管理者、Stripeテスト接続、Gateway接続を設定しました。設定用PHPは自動削除されました。</div>
<h2>管理者2段階認証</h2><p>Google Authenticator等で「セットアップキーを入力」を選び、次のキーを登録してください。この画面を閉じると再表示できません。</p><p class="secret"><?=h($totpSecret)?></p><p>アカウント名: ShalomWorks Live Interpreter<br>キーの種類: 時間ベース</p>
<?php else: ?>
<h1>ShalomWorks Live Interpreter 初期設定</h1><p class="hint">秘密情報はこのサイトとConoHa DBへ直接送られます。チャットには送信されません。入力値は画面に再表示しません。</p>
<?php foreach ($errors as $error): ?><div class="error"><?=h($error)?></div><?php endforeach; ?>
<form method="post" autocomplete="off">
<label>設定コード</label><input type="password" name="setup_token" required>
<h2>ConoHaデータベース</h2>
<label>DB名</label><input name="db_name" value="dvhm5_interpreter" required>
<label>DBユーザー名</label><input name="db_user" value="dvhm5_interpreter" required>
<label>DBパスワード</label><input type="password" name="db_password" required>
<h2>Stripe サンドボックス</h2>
<label>テスト用シークレットキー（sk_test_...）</label><input type="password" name="stripe_secret_key" required>
<label>Webhook署名シークレット（whsec_...）</label><input type="password" name="stripe_webhook_secret" required>
<h2>管理者アカウント</h2>
<label>管理者メールアドレス</label><input type="email" name="admin_email" required>
<label>管理者パスワード（16文字以上）</label><input type="password" name="admin_password" minlength="16" required>
<label>管理者パスワード（確認）</label><input type="password" name="admin_password_confirm" minlength="16" required>
<h2>メール・販売者表示</h2>
<label>送信元メールアドレス</label><input type="email" name="mail_from" placeholder="support@live-interpreter.shalomworks.tech" required>
<label>販売者名</label><input name="seller_name" required>
<label>所在地の表示</label><input name="legal_address" required>
<label>電話番号の表示</label><input name="legal_phone" required>
<label>問い合わせメールアドレス</label><input type="email" name="legal_email" required>
<p class="hint">この画面はStripeのテスト環境だけを設定します。本番決済への切替は、法定表示と販売者確認の完了後に別途行います。</p>
<button type="submit">テスト環境を設定する</button></form>
<?php endif; ?></main></body></html>
PHP;

$output = str_replace(array_keys($replacements), array_values($replacements), $template);
if (file_put_contents($outputPath, $output, LOCK_EX) === false) {
    fwrite(STDERR, "Failed to write setup file.\n");
    exit(1);
}
chmod($outputPath, 0600);
fwrite(STDOUT, "SETUP_FILE={$outputPath}\nSETUP_CODE={$setupToken}\n");
