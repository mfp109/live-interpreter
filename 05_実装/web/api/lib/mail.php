<?php
declare(strict_types=1);

function smtp_read_response($socket, array $expectedCodes): string
{
    $response = '';
    while (($line = fgets($socket, 2048)) !== false) {
        $response .= $line;
        if (strlen($line) >= 4 && $line[3] === ' ') break;
    }
    if ($response === '') throw new RuntimeException('SMTP_EMPTY_RESPONSE');
    $code = (int)substr($response, 0, 3);
    if (!in_array($code, $expectedCodes, true)) throw new RuntimeException('SMTP_RESPONSE_' . $code);
    return $response;
}

function smtp_command($socket, string $command, array $expectedCodes): string
{
    if (fwrite($socket, $command . "\r\n") === false) throw new RuntimeException('SMTP_WRITE_FAILED');
    return smtp_read_response($socket, $expectedCodes);
}

function send_smtp_message(array $config, string $recipient, string $subject, string $body): bool
{
    $mail = $config['mail'] ?? [];
    $from = (string)($mail['from'] ?? '');
    $host = (string)($mail['smtp_host'] ?? '');
    $port = (int)($mail['smtp_port'] ?? 465);
    $username = (string)($mail['smtp_username'] ?? $from);
    $password = (string)($mail['smtp_password'] ?? '');
    if (!filter_var($from, FILTER_VALIDATE_EMAIL) || !filter_var($recipient, FILTER_VALIDATE_EMAIL)) return false;
    if (!preg_match('/^[A-Za-z0-9.-]+$/', $host) || $port < 1 || $port > 65535 || !filter_var($username, FILTER_VALIDATE_EMAIL) || $password === '') return false;
    if (str_contains($subject, "\r") || str_contains($subject, "\n")) return false;

    $domain = (string)(parse_url((string)($config['app_url'] ?? ''), PHP_URL_HOST) ?: 'localhost');
    $context = stream_context_create(['ssl' => [
        'verify_peer' => true,
        'verify_peer_name' => true,
        'peer_name' => $host,
        'SNI_enabled' => true,
    ]]);
    $errorNumber = 0;
    $errorMessage = '';
    $socket = @stream_socket_client(
        'ssl://' . $host . ':' . $port,
        $errorNumber,
        $errorMessage,
        15,
        STREAM_CLIENT_CONNECT,
        $context
    );
    if (!is_resource($socket)) {
        error_log('SMTP connection failed code=' . $errorNumber);
        return false;
    }
    stream_set_timeout($socket, 15);
    try {
        smtp_read_response($socket, [220]);
        smtp_command($socket, 'EHLO ' . $domain, [250]);
        smtp_command($socket, 'AUTH LOGIN', [334]);
        smtp_command($socket, base64_encode($username), [334]);
        smtp_command($socket, base64_encode($password), [235]);
        smtp_command($socket, 'MAIL FROM:<' . $from . '>', [250]);
        smtp_command($socket, 'RCPT TO:<' . $recipient . '>', [250, 251]);
        smtp_command($socket, 'DATA', [354]);

        $normalizedBody = preg_replace("/\r\n|\r|\n/", "\r\n", $body) ?? $body;
        $normalizedBody = preg_replace('/^\./m', '..', $normalizedBody) ?? $normalizedBody;
        $encodedSubject = mb_encode_mimeheader($subject, 'UTF-8');
        $message = implode("\r\n", [
            'Date: ' . date(DATE_RFC2822),
            'Message-ID: <' . bin2hex(random_bytes(16)) . '@' . $domain . '>',
            'From: ShalomWorks <' . $from . '>',
            'Reply-To: ' . $from,
            'To: <' . $recipient . '>',
            'Subject: ' . $encodedSubject,
            'MIME-Version: 1.0',
            'Content-Type: text/plain; charset=UTF-8',
            'Content-Transfer-Encoding: 8bit',
            'X-Mailer: ShalomWorks Live Interpreter',
            '',
            $normalizedBody,
        ]);
        if (fwrite($socket, $message . "\r\n.\r\n") === false) throw new RuntimeException('SMTP_DATA_WRITE_FAILED');
        smtp_read_response($socket, [250]);
        smtp_command($socket, 'QUIT', [221]);
        fclose($socket);
        return true;
    } catch (Throwable $error) {
        error_log('SMTP delivery failed code=' . $error->getMessage());
        fclose($socket);
        return false;
    }
}

function send_application_email(array $config, string $recipient, string $subject, string $body): bool
{
    $mail = $config['mail'] ?? [];
    if ((string)($mail['smtp_password'] ?? '') !== '') {
        return send_smtp_message($config, $recipient, $subject, $body);
    }
    $from = (string)($mail['from'] ?? '');
    if (!filter_var($from, FILTER_VALIDATE_EMAIL)) return false;
    $headers = [
        'From: ShalomWorks <' . $from . '>',
        'Reply-To: ' . $from,
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: 8bit',
        'X-Mailer: ShalomWorks Live Interpreter',
    ];
    return mail($recipient, mb_encode_mimeheader($subject, 'UTF-8'), $body, implode("\r\n", $headers), '-f' . $from);
}

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
    return send_application_email($config, $recipient, $subject, $body);
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
    return send_application_email($config, $recipient, $subject, $body);
}
