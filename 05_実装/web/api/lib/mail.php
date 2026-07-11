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

function send_password_reset_email(array $config, string $recipient, string $locale, string $token): bool
{
    $from = (string)($config['mail']['from'] ?? '');
    if (!filter_var($from, FILTER_VALIDATE_EMAIL)) throw new RuntimeException('Mail sender is not configured.');
    $url = rtrim((string)$config['app_url'], '/') . '/reset-password?token=' . rawurlencode($token);
    $messages = [
        'ja' => ['ShalomWorks パスワード再設定', "パスワードを再設定するには、1時間以内に次のリンクを開いてください。\n\n{$url}\n\n心当たりがない場合、このメールは破棄してください。"],
        'en' => ['Reset your ShalomWorks password', "Open this link within one hour to reset your password:\n\n{$url}\n\nIf you did not request this, ignore this email."],
        'zh-CN' => ['重置您的 ShalomWorks 密码', "请在一小时内打开以下链接重置密码：\n\n{$url}\n\n如果您没有请求重置，请忽略此邮件。"],
    ];
    [$subject, $body] = $messages[$locale] ?? $messages['en'];
    $headers = ['From: ShalomWorks <'.$from.'>','Reply-To: '.$from,'Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: 8bit'];
    return mail($recipient, mb_encode_mimeheader($subject, 'UTF-8'), $body, implode("\r\n", $headers));
}
