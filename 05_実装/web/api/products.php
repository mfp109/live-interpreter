<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';
$rows = db($config)->query('SELECT id,code,name_key,seconds_granted,price_minor,currency FROM products WHERE active=1 ORDER BY sort_order,id')->fetchAll();
json_response(['ok' => true, 'products' => $rows]);
