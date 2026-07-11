<?php
declare(strict_types=1);
require dirname(__DIR__).'/api/lib/totp.php';
$secret='GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
if(!verify_totp($secret,'287082',59))throw new RuntimeException('Known TOTP vector failed.');
if(verify_totp($secret,'287083',59))throw new RuntimeException('Invalid TOTP was accepted.');
echo "TOTP tests passed.\n";
