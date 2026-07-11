<?php
declare(strict_types=1);

function send_verification_email(array $config, string $recipient, string $locale, string $token): bool
{
    $from = (string)($config['mail']['from'] ?? '');
    if (!filter_var($from, FILTER_VALIDATE_EMAIL)) throw new RuntimeException('Mail sender is not configured.');
    $url = rtrim((string)$config['app_url'], '/') . '/verify-email?token=' . rawurlencode($token);
    $messages = [
        'ja' => ['ShalomWorks メールアドレスの確認', "ご登録ありがとうございます。\n次のリンクを24時間以内に開いてください。\n\n{$url}\n\nこのメールに心当たりがない場合は破棄してください。"],
        'en' => ['Verify your ShalomWorks email', "Thank you for signing up.\nOpen this link within 24 hours:\n\n{$url}\n\nIf you did not create this account, ignore this email."],
        'zh-CN' => ['验证您的 ShalomWorks 邮箱', "感谢注册。请在24小时内打开以下链接：\n\n{$url}\n\n如果您没有注册，请忽略此邮件。"],
    ];
    [$subject, $body] = $messages[$locale] ?? $messages['en'];
    $headers = [
        'From: ShalomWorks <' . $from . '>',
        'Reply-To: ' . $from,
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: 8bit',
        'X-Mailer: ShalomWorks Live Interpreter',
    ];
    return mail($recipient, mb_encode_mimeheader($subject, 'UTF-8'), $body, implode("\r\n", $headers));
}
