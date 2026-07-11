<?php
declare(strict_types=1);

require dirname(__DIR__) . '/api/lib/gateway.php';
$config = ['gateway_shared_secret'=>'test-secret'];
$payload = '{"session_id":"test"}';
$timestamp = (string)time();
$signature = hash_hmac('sha256', $timestamp.'.'.$payload, 'test-secret');
verify_gateway_request($config,$payload,$timestamp,$signature);
$failed=false;
try { verify_gateway_request($config,$payload.'x',$timestamp,$signature); } catch (RuntimeException) { $failed=true; }
if (!$failed) throw new RuntimeException('Tampered gateway payload accepted.');
$token=create_gateway_token($config,['sid'=>'s','exp'=>time()+60]);
if (substr_count($token,'.')!==1) throw new RuntimeException('Gateway token format invalid.');
echo "Gateway signature tests passed.\n";
