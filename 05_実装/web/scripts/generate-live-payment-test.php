<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "CLI only.\n");
    exit(1);
}

$outputPath = $argv[1] ?? dirname(__DIR__) . '/release/one-time-live-payment-test.php';
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
require_once __DIR__ . '/api/lib/stripe.php';

const SETUP_HASH = __SETUP_HASH__;
const TEST_PRODUCT_ID = '00000000-0000-4000-8000-000000000100';

function h(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

$errors = [];
$user = current_user($config);
$isAdmin = is_array($user)
    && ($user['role'] ?? '') === 'admin'
    && ($_SESSION['admin_2fa_verified'] ?? false) === true;
$csrf = issue_csrf_token();

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
    $setupCode = trim((string)($_POST['setup_code'] ?? ''));
    $suppliedCsrf = (string)($_POST['csrf'] ?? '');
    if (!$isAdmin) $errors[] = '管理者としてログインし、2段階認証を完了してください。';
    if (!hash_equals(SETUP_HASH, hash('sha256', $setupCode))) $errors[] = 'テストコードが正しくありません。';
    if (!hash_equals($csrf, $suppliedCsrf)) $errors[] = '画面の有効期限が切れました。再読み込みしてください。';
    if (($config['stripe_mode'] ?? '') !== 'live' || !str_starts_with((string)($config['stripe_secret_key'] ?? ''), 'sk_live_')) {
        $errors[] = 'Stripe本番環境への切替を確認できません。';
    }

    if ($errors === []) {
        $pdo = db($config);
        $paymentId = uuid_v4();
        try {
            $pdo->prepare(
                "INSERT INTO products (id,code,name_key,seconds_granted,price_minor,currency,active,sort_order)
                 VALUES (?,'production_test_100','product.production_test',60,100,'JPY',0,9999)
                 ON DUPLICATE KEY UPDATE seconds_granted=60,price_minor=100,currency='JPY',active=0"
            )->execute([TEST_PRODUCT_ID]);
            $pdo->prepare("INSERT INTO payments (id,user_id,product_id,amount_minor,currency,status) VALUES (?,?,?,?,?,'created')")
                ->execute([$paymentId, $user['id'], TEST_PRODUCT_ID, 100, 'JPY']);

            $session = stripe_request($config, 'POST', '/v1/checkout/sessions', [
                'mode' => 'payment',
                'customer_email' => $user['email'],
                'client_reference_id' => $user['id'],
                'success_url' => rtrim($config['app_url'], '/') . '/account?checkout=success&session_id={CHECKOUT_SESSION_ID}',
                'cancel_url' => rtrim($config['app_url'], '/') . '/account?checkout=cancelled',
                'locale' => $user['locale'] === 'zh-CN' ? 'zh' : $user['locale'],
                'line_items[0][quantity]' => 1,
                'line_items[0][price_data][currency]' => 'jpy',
                'line_items[0][price_data][unit_amount]' => 100,
                'line_items[0][price_data][product_data][name]' => 'ShalomWorks Live Interpreter - production test (1 minute)',
                'metadata[payment_id]' => $paymentId,
                'metadata[user_id]' => $user['id'],
                'metadata[product_id]' => TEST_PRODUCT_ID,
                'payment_intent_data[metadata][payment_id]' => $paymentId,
            ], 'live-test:' . $paymentId);
            $pdo->prepare('UPDATE payments SET stripe_checkout_session_id=? WHERE id=?')->execute([$session['id'], $paymentId]);
            audit_admin($config, $user['id'], 'create_live_payment_test', 'payment', $paymentId);
            @unlink(__FILE__);
            header('Location: ' . $session['url'], true, 303);
            exit;
        } catch (Throwable $error) {
            error_log('Live payment test failed payment=' . $paymentId . ' error=' . $error->getMessage());
            $pdo->prepare("UPDATE payments SET status='failed' WHERE id=?")->execute([$paymentId]);
            $errors[] = '¥100の決済画面を開始できませんでした。設定は変更されていません。';
        }
    }
}
?>
<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ShalomWorks 本番決済テスト</title><style>
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f3f7f6;color:#15333a;margin:0;padding:28px 16px}.card{max-width:620px;margin:auto;background:#fff;padding:28px;border-radius:18px;box-shadow:0 12px 40px #16333a18}.hint{color:#5d6d70;line-height:1.65}.summary{background:#edf7f4;padding:16px;border-radius:10px;line-height:1.7}.error{background:#fff0f0;color:#981f1f;padding:12px;border-radius:8px;margin:10px 0}label{display:block;font-weight:700;margin:18px 0 7px}input{width:100%;box-sizing:border-box;padding:12px;border:1px solid #b9c8c5;border-radius:9px;font-size:16px}button{margin-top:24px;padding:13px 20px;border:0;border-radius:9px;background:#0f6c63;color:#fff;font-weight:700;font-size:16px}
</style></head><body><main class="card"><h1>本番決済テスト</h1>
<?php if (!$isAdmin): ?><div class="error">先に通常サイトのマイページから管理者としてログインし、2段階認証を完了してください。</div><?php endif; ?>
<?php foreach ($errors as $error): ?><div class="error"><?=h($error)?></div><?php endforeach; ?>
<div class="summary">請求額：¥100<br>追加クレジット：1分<br>用途：Stripe本番決済・Webhook・返金の確認</div>
<p class="hint">ボタンを押すとStripeの本番決済画面へ移動し、このテストページは自動削除されます。一般の商品一覧には表示されません。</p>
<form method="post" autocomplete="off"><input type="hidden" name="csrf" value="<?=h($csrf)?>"><label>テストコード</label><input type="password" name="setup_code" autocomplete="new-password" required><button type="submit"<?=$isAdmin?'':' disabled'?>>¥100の本番決済を開始</button></form>
</main></body></html>
PHP;

$output = str_replace('__SETUP_HASH__', var_export($setupHash, true), $template);
$directory = dirname($outputPath);
if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) exit(1);
if (file_put_contents($outputPath, $output, LOCK_EX) === false) exit(1);
chmod($outputPath, 0600);
fwrite(STDOUT, "SETUP_FILE={$outputPath}\nTEST_CODE={$setupCode}\n");
