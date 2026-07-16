<?php
declare(strict_types=1);

header('Cache-Control: no-store, max-age=0');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: no-referrer');

require __DIR__ . '/bootstrap.php';
require_method('POST');

const MIGRATION_TOKEN_HASH = '53ea7dd76ec98560b629665228f312e1903c82cccf4588f85ec9a60de03808ee';
const MIGRATION_VERSION = '010_subscription_credits.sql';

$body=json_body();
$token=trim((string)($body['token']??''));
if(!hash_equals(MIGRATION_TOKEN_HASH,hash('sha256',$token))){
    json_error('MIGRATION_TOKEN_INVALID','Invalid migration token.',403);
}

function migration_column_exists(PDO $pdo,string $table,string $column):bool
{
    $stmt=$pdo->prepare('SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?');
    $stmt->execute([$table,$column]);
    return (int)$stmt->fetchColumn()>0;
}

$pdo=db($config);
try{
    $stmt=$pdo->prepare('SELECT COUNT(*) FROM schema_migrations WHERE version=?');
    $stmt->execute([MIGRATION_VERSION]);
    $alreadyApplied=(int)$stmt->fetchColumn()>0;

    if(!$alreadyApplied){
        if(!migration_column_exists($pdo,'products','product_type')){
            $pdo->exec("ALTER TABLE products ADD COLUMN product_type ENUM('intro','subscription','topup','legacy') NOT NULL DEFAULT 'legacy' AFTER name_key");
        }
        if(!migration_column_exists($pdo,'products','billing_interval')){
            $pdo->exec("ALTER TABLE products ADD COLUMN billing_interval ENUM('one_time','month') NOT NULL DEFAULT 'one_time' AFTER product_type");
        }
        if(!migration_column_exists($pdo,'payments','stripe_invoice_id')){
            $pdo->exec('ALTER TABLE payments ADD COLUMN stripe_invoice_id VARCHAR(255) NULL UNIQUE AFTER stripe_payment_intent_id');
        }
        if(!migration_column_exists($pdo,'payments','stripe_subscription_id')){
            $pdo->exec('ALTER TABLE payments ADD COLUMN stripe_subscription_id VARCHAR(255) NULL AFTER stripe_invoice_id');
        }
        $pdo->exec("ALTER TABLE credit_lots MODIFY source_type ENUM('trial','payment','subscription','admin') NOT NULL");
        $pdo->exec("ALTER TABLE credit_ledger MODIFY entry_type ENUM('trial_grant','purchase','subscription_grant','usage','expiry','refund','chargeback','admin_adjustment','reservation','release') NOT NULL");
        $pdo->exec("CREATE TABLE IF NOT EXISTS subscriptions (
          id CHAR(36) PRIMARY KEY,user_id CHAR(36) NOT NULL,product_id CHAR(36) NOT NULL,
          stripe_subscription_id VARCHAR(255) NOT NULL UNIQUE,stripe_customer_id VARCHAR(255) NOT NULL,
          status ENUM('incomplete','incomplete_expired','trialing','active','past_due','canceled','unpaid','paused') NOT NULL DEFAULT 'incomplete',
          cancel_at_period_end TINYINT(1) NOT NULL DEFAULT 0,current_period_end DATETIME NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          CONSTRAINT fk_subscription_user FOREIGN KEY (user_id) REFERENCES users(id),
          CONSTRAINT fk_subscription_product FOREIGN KEY (product_id) REFERENCES products(id),
          UNIQUE KEY uq_active_subscription_user (user_id),INDEX idx_subscription_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        $pdo->beginTransaction();
        $stmt=$pdo->prepare('SELECT COUNT(*) FROM schema_migrations WHERE version=? FOR UPDATE');
        $stmt->execute([MIGRATION_VERSION]);
        if((int)$stmt->fetchColumn()===0){
            $pdo->exec('UPDATE products SET seconds_granted=seconds_granted*12');
            $pdo->exec('UPDATE wallets SET trial_seconds=trial_seconds*12,paid_seconds=paid_seconds*12,reserved_seconds=reserved_seconds*12');
            $pdo->exec('UPDATE credit_lots SET seconds_granted=seconds_granted*12,seconds_remaining=seconds_remaining*12');
            $pdo->exec('UPDATE credit_ledger SET trial_delta=trial_delta*12,paid_delta=paid_delta*12');
            $pdo->exec('UPDATE payments SET revoked_seconds=revoked_seconds*12');
            $pdo->exec("UPDATE products SET product_type='intro',billing_interval='one_time' WHERE code='intro_30'");
            $pdo->exec("UPDATE products SET product_type='legacy',billing_interval='one_time',active=0 WHERE code IN ('starter_60','standard_300','event_1000')");
            $pdo->exec("INSERT INTO products (id,code,name_key,product_type,billing_interval,seconds_granted,price_minor,currency,active,sort_order) VALUES
              ('10000000-0000-4000-8000-000000000001','subscription_lite','product.subscription.lite','subscription','month',43200,980,'JPY',1,10),
              ('10000000-0000-4000-8000-000000000002','subscription_standard','product.subscription.standard','subscription','month',108000,1980,'JPY',1,20),
              ('10000000-0000-4000-8000-000000000003','subscription_pro','product.subscription.pro','subscription','month',259200,3980,'JPY',1,30),
              ('20000000-0000-4000-8000-000000000001','topup_small','product.topup.small','topup','one_time',18000,500,'JPY',1,40),
              ('20000000-0000-4000-8000-000000000002','topup_medium','product.topup.medium','topup','one_time',72000,1500,'JPY',1,50),
              ('20000000-0000-4000-8000-000000000003','topup_large','product.topup.large','topup','one_time',180000,3000,'JPY',1,60)
              ON DUPLICATE KEY UPDATE name_key=VALUES(name_key),product_type=VALUES(product_type),billing_interval=VALUES(billing_interval),seconds_granted=VALUES(seconds_granted),price_minor=VALUES(price_minor),currency=VALUES(currency),active=1,sort_order=VALUES(sort_order)");
            $pdo->prepare('INSERT INTO schema_migrations (version) VALUES (?)')->execute([MIGRATION_VERSION]);
        }
        $pdo->commit();
    }

    $users=$pdo->query('SELECT u.email,u.status,w.trial_seconds,w.paid_seconds FROM users u JOIN wallets w ON w.user_id=u.id ORDER BY u.created_at')->fetchAll();
    @unlink(__FILE__);
    json_response(['ok'=>true,'migration'=>MIGRATION_VERSION,'already_applied'=>$alreadyApplied,'users'=>$users]);
}catch(Throwable $error){
    if($pdo->inTransaction())$pdo->rollBack();
    error_log('One-time migration 010 failed: '.$error->getMessage());
    json_error('MIGRATION_FAILED','Database migration failed.',500);
}
