<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "CLI only.\n");
    exit(1);
}

$outputPath = $argv[1] ?? dirname(__DIR__) . '/release/one-time-stripe-live-setup.php';
$setupCode = bin2hex(random_bytes(16));
$setupHash = hash('sha256', $setupCode);

$template = <<<'PHP'
<?php
declare(strict_types=1);

header('Cache-Control: no-store, max-age=0');
header('Pragma: no-cache');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header("Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
header('Referrer-Policy: no-referrer');

const SETUP_HASH = __SETUP_HASH__;

function h(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function stripe_key_is_valid(string $secret): bool
{
    $url = 'https://api.stripe.com/v1/account';
    if (function_exists('curl_init')) {
        $curl = curl_init($url);
        if ($curl === false) return false;
        curl_setopt_array($curl, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPAUTH => CURLAUTH_BASIC,
            CURLOPT_USERPWD => $secret . ':',
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_TIMEOUT => 20,
            CURLOPT_HTTPHEADER => ['Accept: application/json'],
        ]);
        $body = curl_exec($curl);
        $status = (int)curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
        curl_close($curl);
        if ($status !== 200 || !is_string($body)) return false;
        $decoded = json_decode($body, true);
        return is_array($decoded) && isset($decoded['id']) && str_starts_with((string)$decoded['id'], 'acct_');
    }

    $context = stream_context_create([
        'http' => [
            'method' => 'GET',
            'header' => "Authorization: Basic " . base64_encode($secret . ':') . "\r\nAccept: application/json\r\n",
            'timeout' => 20,
            'ignore_errors' => true,
        ],
    ]);
    $body = @file_get_contents($url, false, $context);
    $statusLine = $http_response_header[0] ?? '';
    if (!is_string($body) || !preg_match('/\s200\s/', $statusLine)) return false;
    $decoded = json_decode($body, true);
    return is_array($decoded) && isset($decoded['id']) && str_starts_with((string)$decoded['id'], 'acct_');
}

$errors = [];
$success = false;
$configPath = __DIR__ . '/api/config.php';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
    $setupCode = trim((string)($_POST['setup_code'] ?? ''));
    $stripeSecret = trim((string)($_POST['stripe_secret_key'] ?? ''));
    $stripeWebhook = trim((string)($_POST['stripe_webhook_secret'] ?? ''));
    $confirmed = (string)($_POST['confirmed'] ?? '') === 'yes';

    if (!hash_equals(SETUP_HASH, hash('sha256', $setupCode))) {
        $errors[] = '設定コードが正しくありません。';
    }
    if (!preg_match('/^sk_live_[A-Za-z0-9_]+$/', $stripeSecret)) {
        $errors[] = 'Stripe本番用シークレットキー（sk_live_...）を入力してください。';
    }
    if (!preg_match('/^whsec_[A-Za-z0-9_]+$/', $stripeWebhook)) {
        $errors[] = '本番Webhookの署名シークレット（whsec_...）を入力してください。';
    }
    if (!$confirmed) {
        $errors[] = '本番決済へ切り替える確認欄にチェックしてください。';
    }
    if (!is_file($configPath)) {
        $errors[] = '公開サイトの設定ファイルが見つかりません。';
    }

    if ($errors === []) {
        try {
            $config = require $configPath;
            if (!is_array($config)) throw new RuntimeException('CONFIG_INVALID');

            $currentSecret = (string)($config['stripe_secret_key'] ?? '');
            $currentWebhook = (string)($config['stripe_webhook_secret'] ?? '');
            if ($currentSecret === '' || $currentWebhook === '') throw new RuntimeException('STRIPE_CONFIG_MISSING');
            if (!stripe_key_is_valid($stripeSecret)) throw new RuntimeException('STRIPE_LIVE_KEY_INVALID');

            $candidate = $config;
            if (str_starts_with($currentSecret, 'sk_test_')) {
                $candidate['stripe_test_secret_key'] = $currentSecret;
                $candidate['stripe_test_webhook_secret'] = $currentWebhook;
            }
            $candidate['stripe_secret_key'] = $stripeSecret;
            $candidate['stripe_webhook_secret'] = $stripeWebhook;
            $candidate['stripe_mode'] = 'live';
            $candidate['stripe_live_enabled_at'] = gmdate('c');

            $tempPath = $configPath . '.tmp-' . bin2hex(random_bytes(6));
            $contents = "<?php\ndeclare(strict_types=1);\n\nreturn " . var_export($candidate, true) . ";\n";
            if (file_put_contents($tempPath, $contents, LOCK_EX) === false) {
                throw new RuntimeException('CONFIG_WRITE_FAILED');
            }
            @chmod($tempPath, 0600);
            if (!rename($tempPath, $configPath)) {
                @unlink($tempPath);
                throw new RuntimeException('CONFIG_RENAME_FAILED');
            }
            @chmod($configPath, 0600);
            $success = true;
            @unlink(__FILE__);
        } catch (Throwable $error) {
            error_log('Stripe live setup failed code=' . $error->getMessage());
            $errors[] = match ($error->getMessage()) {
                'STRIPE_LIVE_KEY_INVALID' => 'Stripeが本番用シークレットキーを確認できませんでした。キーを確認してください。',
                'STRIPE_CONFIG_MISSING', 'CONFIG_INVALID' => '現在のStripe設定を読み取れませんでした。設定は変更されていません。',
                default => '本番設定の保存に失敗しました。現在の設定は変更されていません。',
            };
        }
    }
}
?>
<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ShalomWorks Stripe本番切替</title><style>
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f3f7f6;color:#15333a;margin:0;padding:28px 16px}.card{max-width:650px;margin:auto;background:#fff;padding:28px;border-radius:18px;box-shadow:0 12px 40px #16333a18}h1{font-size:25px}.hint{color:#5d6d70;line-height:1.65}.warning{background:#fff7e8;color:#704600;padding:14px;border-radius:9px;line-height:1.6}.error{background:#fff0f0;color:#981f1f;padding:12px;border-radius:8px;margin:10px 0}.ok{background:#eaf8ef;color:#175c34;padding:16px;border-radius:9px;line-height:1.7}label{display:block;font-weight:700;margin:18px 0 7px}input[type=password]{width:100%;box-sizing:border-box;padding:12px;border:1px solid #b9c8c5;border-radius:9px;font-size:16px}.confirm{display:flex;gap:10px;align-items:flex-start;line-height:1.5;margin-top:22px}.confirm input{margin-top:5px}button{margin-top:24px;padding:13px 20px;border:0;border-radius:9px;background:#0f6c63;color:#fff;font-weight:700;font-size:16px}
</style></head><body><main class="card">
<?php if ($success): ?>
<h1>Stripe本番切替が完了しました</h1><div class="ok">本番用キーをStripeで確認し、公開サイトへ保存しました。この設定ページは自動削除されました。次は少額の実決済テストを行います。</div>
<?php else: ?>
<h1>Stripe本番環境へ切り替え</h1>
<p class="hint">入力した秘密情報は、この公開サイトからStripeとConoHa内の設定ファイルへ直接送られます。チャットには送信されません。</p>
<div class="warning">保存すると、これ以降のクレジット購入は実際のカード決済になります。Stripeダッシュボードの「本番環境」で作成したキーだけを使用してください。</div>
<?php foreach ($errors as $error): ?><div class="error"><?=h($error)?></div><?php endforeach; ?>
<form method="post" autocomplete="off">
<label>設定コード</label><input type="password" name="setup_code" autocomplete="new-password" required>
<label>本番用シークレットキー（sk_live_...）</label><input type="password" name="stripe_secret_key" autocomplete="new-password" required>
<label>本番Webhook署名シークレット（whsec_...）</label><input type="password" name="stripe_webhook_secret" autocomplete="new-password" required>
<label class="confirm"><input type="checkbox" name="confirmed" value="yes" required><span>本番環境へ切り替わり、以後は実際の決済になることを確認しました。</span></label>
<button type="submit">本番キーを確認して切り替える</button>
</form>
<?php endif; ?>
</main></body></html>
PHP;

$output = str_replace('__SETUP_HASH__', var_export($setupHash, true), $template);
$directory = dirname($outputPath);
if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) {
    fwrite(STDERR, "Unable to create output directory.\n");
    exit(1);
}
if (file_put_contents($outputPath, $output, LOCK_EX) === false) {
    fwrite(STDERR, "Unable to write setup file.\n");
    exit(1);
}
chmod($outputPath, 0600);
fwrite(STDOUT, "SETUP_FILE={$outputPath}\nSETUP_CODE={$setupCode}\n");
