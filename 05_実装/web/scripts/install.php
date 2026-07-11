<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only.\n"); exit(1); }
$projectRoot = is_dir(__DIR__.'/database') ? __DIR__ : dirname(__DIR__);
$configPath = getenv('SWLI_CONFIG_PATH') ?: $projectRoot.'/api/config.php';
if (!is_file($configPath)) { fwrite(STDERR, "Config not found: {$configPath}\n"); exit(1); }
$config = require $configPath;
$db = $config['db'] ?? [];
$pdo = new PDO(
    sprintf('mysql:host=%s;dbname=%s;charset=%s', $db['host'] ?? '', $db['name'] ?? '', $db['charset'] ?? 'utf8mb4'),
    (string)($db['user'] ?? ''),
    (string)($db['password'] ?? ''),
    [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]
);
$pdo->exec('CREATE TABLE IF NOT EXISTS schema_migrations (version VARCHAR(100) PRIMARY KEY, applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
$applied = array_flip($pdo->query('SELECT version FROM schema_migrations')->fetchAll(PDO::FETCH_COLUMN));
$files = glob($projectRoot.'/database/*.sql') ?: [];
sort($files, SORT_STRING);
foreach ($files as $file) {
    $version = basename($file);
    if (isset($applied[$version])) continue;
    $sql = file_get_contents($file);
    if ($sql === false || trim($sql) === '') throw new RuntimeException("Empty migration: {$version}");
    $pdo->exec($sql);
    $stmt = $pdo->prepare('INSERT INTO schema_migrations (version) VALUES (?)');
    $stmt->execute([$version]);
    fwrite(STDOUT, "Applied {$version}\n");
}

$email = strtolower(trim((string)getenv('SWLI_ADMIN_EMAIL')));
$password = (string)getenv('SWLI_ADMIN_PASSWORD');
if ($email !== '' || $password !== '') {
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($password) < 16) {
        fwrite(STDERR, "SWLI_ADMIN_EMAIL must be valid and SWLI_ADMIN_PASSWORD must be at least 16 characters.\n");
        exit(1);
    }
    $id = bin2hex(random_bytes(4)).'-'.bin2hex(random_bytes(2)).'-4'.substr(bin2hex(random_bytes(2)),0,3).'-'.dechex(random_int(8,11)).substr(bin2hex(random_bytes(2)),0,3).'-'.bin2hex(random_bytes(6));
    $pdo->beginTransaction();
    try {
        $stmt=$pdo->prepare('SELECT id FROM users WHERE email=? FOR UPDATE');$stmt->execute([$email]);$existing=$stmt->fetchColumn();
        if ($existing) {
            $pdo->prepare("UPDATE users SET role='admin',status='active',email_verified_at=COALESCE(email_verified_at,NOW()),password_hash=?,auth_version=auth_version+1 WHERE id=?")->execute([password_hash($password,PASSWORD_DEFAULT),$existing]);
        } else {
            $pdo->prepare("INSERT INTO users (id,email,password_hash,role,status,email_verified_at,terms_version,terms_accepted_at) VALUES (?,?,?,'admin','active',NOW(),'2026-07-11',NOW())")->execute([$id,$email,password_hash($password,PASSWORD_DEFAULT)]);
            $pdo->prepare('INSERT INTO wallets (user_id) VALUES (?)')->execute([$id]);
        }
        $pdo->commit();
        fwrite(STDOUT, "Administrator created or updated.\n");
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
}
fwrite(STDOUT, "Installation complete.\n");
