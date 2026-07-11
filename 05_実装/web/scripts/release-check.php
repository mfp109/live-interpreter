<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') exit(1);
$path = $argv[1] ?? dirname(__DIR__).'/api/config.php';
if (!is_file($path)) { fwrite(STDERR,"Missing config.php\n"); exit(1); }
$config = require $path;
$required = [
  'app_url'=>$config['app_url']??null,
  'db.host'=>$config['db']['host']??null,'db.name'=>$config['db']['name']??null,'db.user'=>$config['db']['user']??null,'db.password'=>$config['db']['password']??null,
  'stripe_secret_key'=>$config['stripe_secret_key']??null,'stripe_webhook_secret'=>$config['stripe_webhook_secret']??null,
  'gateway_shared_secret'=>$config['gateway_shared_secret']??null,'gateway_url'=>$config['gateway_url']??null,
  'admin_totp_secret'=>$config['admin_totp_secret']??null,'cron_secret'=>$config['cron_secret']??null,'security_hash_secret'=>$config['security_hash_secret']??null,
  'mail.from'=>$config['mail']['from']??null,
  'legal.seller_name'=>$config['legal']['seller_name']??null,'legal.address'=>$config['legal']['address']??null,'legal.phone'=>$config['legal']['phone']??null,'legal.email'=>$config['legal']['email']??null,
];
$bad=[];foreach($required as $key=>$value){if(!is_string($value)||trim($value)===''||str_contains($value,'CHANGE_ME'))$bad[]=$key;}
foreach(['gateway_shared_secret','cron_secret','security_hash_secret'] as $key){if(is_string($required[$key]??null)&&strlen((string)$required[$key])<32)$bad[]=$key.' (too short)';}
if($bad){fwrite(STDERR,"Production configuration incomplete:\n- ".implode("\n- ",array_unique($bad))."\n");exit(1);}
fwrite(STDOUT,"Production configuration check passed.\n");
