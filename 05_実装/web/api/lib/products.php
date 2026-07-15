<?php
declare(strict_types=1);

const INTRODUCTORY_PRODUCT_ID = '00000000-0000-4000-8000-000000000030';

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
