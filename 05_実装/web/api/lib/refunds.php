<?php
declare(strict_types=1);
function refund_target_seconds(int $grantedSeconds,int $amountMinor,int $refundedMinor):int
{
    if($grantedSeconds<=0||$amountMinor<=0)return 0;
    $bounded=max(0,min($amountMinor,$refundedMinor));
    return min($grantedSeconds,(int)floor($grantedSeconds*($bounded/$amountMinor)));
}
function refund_delta_seconds(int $targetSeconds,int $alreadyRevokedSeconds):int
{
    return max(0,$targetSeconds-max(0,$alreadyRevokedSeconds));
}
