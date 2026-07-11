<?php
declare(strict_types=1);

function grant_credit_lot(PDO $pdo, string $userId, string $balanceType, string $sourceType, string $sourceId, int $seconds, int $validDays): bool
{
    $stmt=$pdo->prepare('INSERT IGNORE INTO credit_lots (id,user_id,balance_type,source_type,source_id,seconds_granted,seconds_remaining,expires_at) VALUES (?,?,?,?,?,?,?,DATE_ADD(NOW(),INTERVAL ? DAY))');
    $stmt->execute([uuid_v4(),$userId,$balanceType,$sourceType,$sourceId,$seconds,$seconds,$validDays]);
    if($stmt->rowCount()!==1)return false;
    $column=$balanceType==='trial'?'trial_seconds':'paid_seconds';
    $pdo->prepare("UPDATE wallets SET {$column}={$column}+?,version=version+1 WHERE user_id=?")->execute([$seconds,$userId]);
    return true;
}

function consume_credit_lots(PDO $pdo,string $userId,int $requested): array
{
    $used=['trial'=>0,'paid'=>0];$remaining=$requested;
    $stmt=$pdo->prepare("SELECT id,balance_type,seconds_remaining FROM credit_lots WHERE user_id=? AND seconds_remaining>0 AND expires_at>NOW() ORDER BY FIELD(balance_type,'trial','paid'),expires_at,created_at FOR UPDATE");
    $stmt->execute([$userId]);
    foreach($stmt->fetchAll() as $lot){if($remaining<=0)break;$take=min($remaining,(int)$lot['seconds_remaining']);$pdo->prepare('UPDATE credit_lots SET seconds_remaining=seconds_remaining-? WHERE id=?')->execute([$take,$lot['id']]);$used[$lot['balance_type']]+=$take;$remaining-=$take;}
    if($used['trial']||$used['paid'])$pdo->prepare('UPDATE wallets SET trial_seconds=trial_seconds-?,paid_seconds=paid_seconds-?,version=version+1 WHERE user_id=?')->execute([$used['trial'],$used['paid'],$userId]);
    return ['trial'=>$used['trial'],'paid'=>$used['paid'],'total'=>$used['trial']+$used['paid']];
}

function revoke_paid_lot(PDO $pdo,string $userId,string $sourceType,string $sourceId,int $maximum): int
{
    $stmt=$pdo->prepare("SELECT id,seconds_remaining FROM credit_lots WHERE user_id=? AND balance_type='paid' AND source_type=? AND source_id=? FOR UPDATE");$stmt->execute([$userId,$sourceType,$sourceId]);$lot=$stmt->fetch();if(!$lot)return 0;
    $removed=min($maximum,(int)$lot['seconds_remaining']);if($removed<=0)return 0;
    $pdo->prepare('UPDATE credit_lots SET seconds_remaining=seconds_remaining-? WHERE id=?')->execute([$removed,$lot['id']]);
    $pdo->prepare('UPDATE wallets SET paid_seconds=paid_seconds-?,version=version+1 WHERE user_id=?')->execute([$removed,$userId]);return $removed;
}

function expire_credit_lots(PDO $pdo,?string $userId=null): int
{
    $sql='SELECT id,user_id,balance_type,seconds_remaining FROM credit_lots WHERE seconds_remaining>0 AND expires_at<=NOW()'.($userId!==null?' AND user_id=?':'').' FOR UPDATE';$stmt=$pdo->prepare($sql);$stmt->execute($userId!==null?[$userId]:[]);$expired=0;
    foreach($stmt->fetchAll() as $lot){$seconds=(int)$lot['seconds_remaining'];$column=$lot['balance_type']==='trial'?'trial_seconds':'paid_seconds';$pdo->prepare('UPDATE credit_lots SET seconds_remaining=0 WHERE id=?')->execute([$lot['id']]);$pdo->prepare("UPDATE wallets SET {$column}=GREATEST(0,{$column}-?),version=version+1 WHERE user_id=?")->execute([$seconds,$lot['user_id']]);$pdo->prepare("INSERT IGNORE INTO credit_ledger (id,user_id,entry_type,trial_delta,paid_delta,reference_type,reference_id,idempotency_key,note) VALUES (?,?,'expiry',?,?, 'credit_lot',?,?,'Credit expired')")->execute([uuid_v4(),$lot['user_id'],$lot['balance_type']==='trial'?-$seconds:0,$lot['balance_type']==='paid'?-$seconds:0,$lot['id'],'expiry:'.$lot['id']]);$expired+=$seconds;}
    return $expired;
}

function remove_paid_lots(PDO $pdo,string $userId,int $seconds): int
{
    $stmt=$pdo->prepare("SELECT id,seconds_remaining FROM credit_lots WHERE user_id=? AND balance_type='paid' AND seconds_remaining>0 AND expires_at>NOW() ORDER BY expires_at,created_at FOR UPDATE");$stmt->execute([$userId]);$remaining=$seconds;$removed=0;
    foreach($stmt->fetchAll() as $lot){if($remaining<=0)break;$take=min($remaining,(int)$lot['seconds_remaining']);$pdo->prepare('UPDATE credit_lots SET seconds_remaining=seconds_remaining-? WHERE id=?')->execute([$take,$lot['id']]);$remaining-=$take;$removed+=$take;}
    if($removed>0)$pdo->prepare('UPDATE wallets SET paid_seconds=paid_seconds-?,version=version+1 WHERE user_id=?')->execute([$removed,$userId]);return $removed;
}
