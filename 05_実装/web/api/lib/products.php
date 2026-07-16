<?php
declare(strict_types=1);

const INTRODUCTORY_PRODUCT_ID = '00000000-0000-4000-8000-000000000030';

function active_subscription(PDO $pdo, string $userId): ?array
{
    $stmt = $pdo->prepare(
        "SELECT s.id,s.product_id,s.stripe_subscription_id,s.stripe_customer_id,s.status,s.cancel_at_period_end,s.current_period_end,p.code
         FROM subscriptions s JOIN products p ON p.id=s.product_id
         WHERE s.user_id=? AND s.status IN ('trialing','active','past_due') LIMIT 1"
    );
    $stmt->execute([$userId]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function topup_available(PDO $pdo, string $userId): bool
{
    $subscription = active_subscription($pdo, $userId);
    return $subscription !== null && in_array($subscription['status'], ['trialing', 'active'], true);
}

function introductory_offer_available(PDO $pdo, string $userId): bool
{
    $stmt = $pdo->prepare(
        "SELECT COUNT(*) FROM payments
         WHERE user_id=? AND (
           status IN ('paid','refunded','disputed')
           OR (product_id=? AND status='created' AND created_at>DATE_SUB(NOW(),INTERVAL 2 MINUTE))
         )"
    );
    $stmt->execute([$userId, INTRODUCTORY_PRODUCT_ID]);
    return (int)$stmt->fetchColumn() === 0;
}
