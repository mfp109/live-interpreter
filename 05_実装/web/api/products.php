<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/lib/products.php';
$pdo = db($config);
$rows = $pdo->query('SELECT id,code,name_key,product_type,billing_interval,seconds_granted,price_minor,currency FROM products WHERE active=1 ORDER BY sort_order,id')->fetchAll();
$user = current_user($config);
if ($user && !introductory_offer_available($pdo, (string)$user['id'])) {
    $rows = array_values(array_filter(
        $rows,
        static fn(array $row): bool => (string)$row['id'] !== INTRODUCTORY_PRODUCT_ID
    ));
}
$subscription = $user ? active_subscription($pdo, (string)$user['id']) : null;
json_response(['ok' => true, 'products' => $rows, 'subscription' => $subscription]);
