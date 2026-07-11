<?php
declare(strict_types=1);
require dirname(__DIR__).'/api/lib/refunds.php';
function check(bool $condition,string $message):void{if(!$condition){fwrite(STDERR,"FAIL: {$message}\n");exit(1);}}
check(refund_target_seconds(3600,1500,300)===720,'20 percent refund');
check(refund_delta_seconds(refund_target_seconds(3600,1500,600),720)===720,'cumulative 40 percent removes only the new 20 percent');
check(refund_delta_seconds(refund_target_seconds(3600,1500,600),1440)===0,'duplicate cumulative event removes nothing');
check(refund_target_seconds(3600,1500,999999)===3600,'refund is capped at full purchase');
check(refund_target_seconds(3600,0,100)===0,'zero amount fails closed');
fwrite(STDOUT,"Refund calculation tests passed.\n");
