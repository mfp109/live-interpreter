<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') exit(1);
$outputPath = $argv[1] ?? dirname(__DIR__) . '/release/one-time-smtp-setup.php';
$setupCode = bin2hex(random_bytes(16));
$setupHash = hash('sha256', $setupCode);

$template = <<<'PHP'
<?php
declare(strict_types=1);
$nonce=base64_encode(random_bytes(18));
header('Cache-Control: no-store, max-age=0');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header("Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
const SETUP_HASH=__SETUP_HASH__;
function h(string $v):string{return htmlspecialchars($v,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');}
$errors=[];$success=false;
if(($_SERVER['REQUEST_METHOD']??'GET')==='POST'){
 $code=trim((string)($_POST['setup_code']??''));$password=(string)($_POST['smtp_password']??'');$recipient=strtolower(trim((string)($_POST['test_recipient']??'')));
 if(!hash_equals(SETUP_HASH,hash('sha256',$code)))$errors[]='設定コードが正しくありません。';
 if($password==='')$errors[]='supportメールのパスワードを入力してください。';
 if(!filter_var($recipient,FILTER_VALIDATE_EMAIL))$errors[]='テスト送信先メールアドレスが正しくありません。';
 $configPath=__DIR__.'/api/config.php';$mailPath=__DIR__.'/api/lib/mail.php';
 if(!is_file($configPath)||!is_file($mailPath))$errors[]='公開サイトの設定またはメールプログラムが見つかりません。';
 if(!$errors){
  try{
   $config=require $configPath;require_once $mailPath;
   $candidate=$config;$candidate['mail']=['from'=>'support@live-interpreter.shalomworks.tech','smtp_host'=>'mail60.conoha.ne.jp','smtp_port'=>465,'smtp_username'=>'support@live-interpreter.shalomworks.tech','smtp_password'=>$password];
   if(!send_smtp_message($candidate,$recipient,'ShalomWorks SMTP test',"SMTPによるメール送信テストに成功しました。\nこのメールが届けば認証メールを送信できます。"))throw new RuntimeException('SMTP_TEST_FAILED');
   $temp=$configPath.'.tmp-'.bin2hex(random_bytes(6));$contents="<?php\ndeclare(strict_types=1);\n\nreturn ".var_export($candidate,true).";\n";
   if(file_put_contents($temp,$contents,LOCK_EX)===false)throw new RuntimeException('CONFIG_WRITE_FAILED');@chmod($temp,0600);
   if(!rename($temp,$configPath)){@unlink($temp);throw new RuntimeException('CONFIG_RENAME_FAILED');}@chmod($configPath,0600);
   $success=true;@unlink(__FILE__);
  }catch(Throwable $e){error_log('SMTP setup failed code='.$e->getMessage());$errors[]='SMTP接続に失敗しました。メールパスワードを確認してください。';}
 }
}
?><!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ShalomWorks SMTP設定</title><style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f3f7f6;color:#15333a;padding:28px 16px}.card{max-width:620px;margin:auto;background:#fff;padding:28px;border-radius:18px;box-shadow:0 12px 40px #16333a18}label{display:block;font-weight:700;margin:18px 0 7px}input{width:100%;box-sizing:border-box;padding:12px;border:1px solid #b9c8c5;border-radius:9px;font-size:16px}button{margin-top:24px;padding:13px 20px;border:0;border-radius:9px;background:#0f6c63;color:#fff;font-weight:700}.error{background:#fff0f0;color:#981f1f;padding:12px;border-radius:8px;margin:10px 0}.ok{background:#eaf8ef;color:#175c34;padding:16px;border-radius:9px;line-height:1.7}.hint{color:#5d6d70;line-height:1.6}</style></head><body><main class="card">
<?php if($success):?><h1>SMTP設定が完了しました</h1><div class="ok">ConoHa SMTPからテストメールを送信し、設定を保存しました。設定用PHPは自動削除されました。</div>
<?php else:?><h1>メール送信設定</h1><p class="hint">supportメールのパスワードはチャットを通らず、ConoHa内の設定へ直接保存されます。</p><?php foreach($errors as $e):?><div class="error"><?=h($e)?></div><?php endforeach;?>
<form method="post"><label>設定コード</label><input type="password" name="setup_code" required><label>supportメールのパスワード</label><input type="password" name="smtp_password" required><label>テスト送信先（普段のGmail）</label><input type="email" name="test_recipient" required><button>SMTPをテストして保存</button></form><?php endif;?>
</main></body></html>
PHP;
$output=str_replace('__SETUP_HASH__',var_export($setupHash,true),$template);
if(file_put_contents($outputPath,$output,LOCK_EX)===false)exit(1);chmod($outputPath,0600);
fwrite(STDOUT,"SETUP_FILE={$outputPath}\nSETUP_CODE={$setupCode}\n");
