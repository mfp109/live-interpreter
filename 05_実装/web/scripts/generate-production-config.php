<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') exit(1);
$required=['SWLI_DB_NAME','SWLI_DB_USER','SWLI_DB_PASSWORD','SWLI_STRIPE_SECRET_KEY','SWLI_STRIPE_WEBHOOK_SECRET','SWLI_GATEWAY_URL','SWLI_OPENAI_API_KEY','SWLI_MAIL_FROM','SWLI_LEGAL_SELLER_NAME','SWLI_LEGAL_ADDRESS','SWLI_LEGAL_PHONE','SWLI_LEGAL_EMAIL'];
$values=[];$missing=[];foreach($required as $key){$value=(string)getenv($key);if($value==='')$missing[]=$key;else $values[$key]=$value;}
if($missing){fwrite(STDERR,"Missing environment values:\n- ".implode("\n- ",$missing)."\n");exit(1);}
foreach($values as $key=>$value){if(str_contains($value,"\n")||str_contains($value,"\r")){fwrite(STDERR,"Invalid newline in {$key}.\n");exit(1);}}
if(!filter_var($values['SWLI_GATEWAY_URL'],FILTER_VALIDATE_URL)||!str_starts_with($values['SWLI_GATEWAY_URL'],'https://')){fwrite(STDERR,"SWLI_GATEWAY_URL must be an HTTPS URL.\n");exit(1);}
foreach(['SWLI_MAIL_FROM','SWLI_LEGAL_EMAIL'] as $key){if(!filter_var($values[$key],FILTER_VALIDATE_EMAIL)){fwrite(STDERR,"{$key} must be a valid email address.\n");exit(1);}}
$webPath=getenv('SWLI_WEB_CONFIG_PATH')?:dirname(__DIR__).'/api/config.php';
$gatewayPath=getenv('SWLI_GATEWAY_ENV_PATH')?:dirname(__DIR__,2).'/gateway/.env';
if((is_file($webPath)||is_file($gatewayPath))&&!in_array('--force',$argv,true)){fwrite(STDERR,"Configuration already exists. Use --force only when intentionally rotating it.\n");exit(1);}
$random=fn(int $bytes):string=>bin2hex(random_bytes($bytes));
$base32=function(string $bytes):string{$alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';$bits='';foreach(str_split($bytes) as $char)$bits.=str_pad(decbin(ord($char)),8,'0',STR_PAD_LEFT);$out='';foreach(str_split($bits,5) as $part){if(strlen($part)<5)$part=str_pad($part,5,'0');$out.=$alphabet[bindec($part)];}return $out;};
$gatewaySecret=$random(32);$cronSecret=$random(32);$hashSecret=$random(32);$totpSecret=$base32(random_bytes(20));
$config=[
 'app_env'=>'production','app_url'=>'https://live-interpreter.shalomworks.tech',
 'db'=>['host'=>getenv('SWLI_DB_HOST')?:'localhost','name'=>$values['SWLI_DB_NAME'],'user'=>$values['SWLI_DB_USER'],'password'=>$values['SWLI_DB_PASSWORD'],'charset'=>'utf8mb4'],
 'session_name'=>'swli_session','stripe_secret_key'=>$values['SWLI_STRIPE_SECRET_KEY'],'stripe_webhook_secret'=>$values['SWLI_STRIPE_WEBHOOK_SECRET'],
 'gateway_shared_secret'=>$gatewaySecret,'gateway_url'=>$values['SWLI_GATEWAY_URL'],'admin_totp_secret'=>$totpSecret,'cron_secret'=>$cronSecret,'security_hash_secret'=>$hashSecret,
 'business'=>['openai_usd_per_minute'=>0.034,'usd_jpy_rate'=>(float)(getenv('SWLI_USD_JPY_RATE')?:160),'stripe_fee_rate'=>0.036],
 'mail'=>['from'=>$values['SWLI_MAIL_FROM']],
 'legal'=>['seller_name'=>$values['SWLI_LEGAL_SELLER_NAME'],'address'=>$values['SWLI_LEGAL_ADDRESS'],'phone'=>$values['SWLI_LEGAL_PHONE'],'email'=>$values['SWLI_LEGAL_EMAIL']],
];
@mkdir(dirname($webPath),0700,true);@mkdir(dirname($gatewayPath),0700,true);
file_put_contents($webPath,"<?php\ndeclare(strict_types=1);\n\nreturn ".var_export($config,true).";\n",LOCK_EX);chmod($webPath,0600);
$gateway="PORT=8787\nOPENAI_API_KEY={$values['SWLI_OPENAI_API_KEY']}\nGATEWAY_SHARED_SECRET={$gatewaySecret}\nWEB_API_BASE=https://live-interpreter.shalomworks.tech/api\nALLOWED_ORIGIN=https://live-interpreter.shalomworks.tech\n";
file_put_contents($gatewayPath,$gateway,LOCK_EX);chmod($gatewayPath,0600);
fwrite(STDOUT,"Production configuration created.\nAdmin TOTP secret (store in your authenticator): {$totpSecret}\nCron bearer secret: {$cronSecret}\n");
