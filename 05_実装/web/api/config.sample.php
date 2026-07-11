<?php
declare(strict_types=1);

return [
    'app_env' => 'production',
    'app_url' => 'https://live-interpreter.shalomworks.tech',
    'db' => [
        'host' => 'localhost',
        'name' => 'CHANGE_ME',
        'user' => 'CHANGE_ME',
        'password' => 'CHANGE_ME',
        'charset' => 'utf8mb4',
    ],
    'session_name' => 'swli_session',
    'stripe_secret_key' => 'CHANGE_ME',
    'stripe_webhook_secret' => 'CHANGE_ME',
    'openai_api_key' => 'CHANGE_ME',
    'gateway_shared_secret' => 'CHANGE_ME',
    'gateway_url' => 'https://CHANGE_ME.example.com',
    'admin_totp_secret' => 'CHANGE_ME',
    'mail' => [
        'from' => 'CHANGE_ME',
        'transport' => 'mail',
        'host' => 'CHANGE_ME',
        'port' => 587,
        'user' => 'CHANGE_ME',
        'password' => 'CHANGE_ME',
    ],
    'legal' => [
        'seller_name' => 'CHANGE_ME',
        'address' => 'CHANGE_ME',
        'phone' => 'CHANGE_ME',
        'email' => 'CHANGE_ME',
    ],
];
