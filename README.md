# ShalomWorks Live Interpreter

ShalomWorks Live Interpreter is an OpenAI Build Week project with two working experiences: a native macOS interpretation app created during the formal Submission Period and a production browser service meaningfully extended during that period. A speaker talks naturally, and listeners hear low-latency interpreted speech in another language.

**OpenAI Build Week track:** Work & Productivity

**Live application:** [live-interpreter.shalomworks.tech](https://live-interpreter.shalomworks.tech/)

**Built with:** Codex, GPT-5.6, OpenAI Realtime, Electron, Core Audio, Objective-C, React, PHP, Node.js, MySQL, Stripe, and WebSockets

## The problem

Live interpretation is often expensive or difficult to arrange for small teams, community events, education, travel, worship services, and international meetings. Text-only translation also forces listeners to look away from the speaker.

This service keeps the experience voice-first: the speaker talks, the system interprets, and the audience listens.

## Build Week creation timeline

Live Interpreter was initiated during the OpenAI Build Week Registration Period. Because the first web experiment was committed before the formal Submission Period opened, this repository treats it as pre-existing for rule compliance and distinguishes it from the work added afterward. During the formal Submission Period, the project was meaningfully extended with the GPT-5.6 workflow, realtime terminology mode, production business system, subscriptions, and a newly created native macOS application.

The dated history is intentionally explicit: the first experiment was committed on July 11, 2026, the formal Submission Period opened on July 13 at 9:00 AM PT (July 14 at 1:00 AM JST/KST), and the advanced macOS application was created on July 15.

| Date (JST/KST) | Commit | Build Week development |
| --- | --- | --- |
| July 11, 2026 11:39 | [`71e5167`](https://github.com/mfp109/live-interpreter/commit/71e5167) | Registration-period baseline: start the Live Interpreter web experiment |
| July 15, 2026 03:20 | [`1d7cf42`](https://github.com/mfp109/live-interpreter/commit/1d7cf42) | GPT-5.6 interpretation preparation brief |
| July 15, 2026 03:28 | [`202184d`](https://github.com/mfp109/live-interpreter/commit/202184d) | Public repository and evaluation documentation |
| July 15, 2026 09:41 | [`68f1c79`](https://github.com/mfp109/live-interpreter/commit/68f1c79) | Terminology-aware realtime interpretation mode |
| July 15, 2026 13:36 | [`156fffd`](https://github.com/mfp109/live-interpreter/commit/156fffd) | Explicit opt-in for custom terminology |
| July 15, 2026 14:30 | [`8de52a1`](https://github.com/mfp109/live-interpreter/commit/8de52a1) | One-minute free trial and first-purchase offer |
| July 15, 2026 14:36 | [`054d2fa`](https://github.com/mfp109/live-interpreter/commit/054d2fa) | Removal of the completed one-time migration endpoint |
| July 16, 2026 | [`6a8feed`](https://github.com/mfp109/live-interpreter/commit/6a8feed) | Native macOS app with system-audio capture, routing, captions, and offline UI languages |

## Two working experiences

### Native macOS app

The macOS app is the advanced meeting and media interpretation surface:

- captures a selected app such as Zoom or a browser without requiring BlackHole;
- accepts a microphone, screen/window, local audio file, or local video file;
- routes original and interpreted audio independently;
- supports audio only, captions only, or audio plus captions;
- displays one or two caption languages in a separate shareable, always-on-top window;
- exports caption history as interleaved or grouped text;
- includes 13 interface languages locally, so changing the interface never consumes API usage;
- stores a user-provided OpenAI API key with local encryption instead of exposing it to renderer code.

### Production web service

The browser service is the public, no-install evaluation and business surface:

- low-latency voice-to-voice interpretation;
- accounts, email verification, credits, subscriptions, Stripe Checkout, and refunds;
- server-enforced usage settlement and automatic session safeguards;
- GPT-5.6 preparation briefs;
- default translation-specialized realtime mode and explicit Custom Terminology opt-in.

## GPT-5.6 AI Meeting Preparation Brief

The Build Week work adds a new GPT-5.6-powered preparation workflow. Before a live session, a user enters:

- the speaking and target languages;
- the situation and purpose;
- important names, numbers, abbreviations, and domain terms.

GPT-5.6 returns a structured preparation brief containing:

- a concise session summary;
- suggested translations and notes for key terms;
- likely interpretation risks;
- speaking techniques that reduce ambiguity;
- a pre-session checklist.

This preparation feature deliberately does **not** claim to modify the Realtime Translation model. It prepares the human speaker before the session while the live interpretation pipeline remains independent.

## Explicit Custom Terminology mode

The default live path uses `gpt-realtime-translate`, OpenAI's translation-specialized realtime model. This is the normal mode because it is optimized for low-latency speech-to-speech translation.

When a user explicitly selects **Apply custom terminology**, the gateway switches that session to the general `gpt-realtime` model and supplies controlled instructions for names, specialist vocabulary, and abbreviations. The switch never happens silently: the interface identifies the model tradeoff and requires affirmative user action.

## How OpenAI is used

### GPT-5.6

The preparation brief uses the Responses API with:

- `model: gpt-5.6`;
- Structured Outputs with a strict JSON Schema;
- `store: false`;
- low reasoning effort for responsive preparation;
- a hashed `safety_identifier`;
- server-side daily and input-length limits.

### Realtime Translation

Live audio is relayed through a dedicated Node.js gateway to OpenAI's Realtime Translation API. The browser sends PCM audio over a short-lived authenticated WebSocket. Translated audio is streamed back for immediate playback.

### Codex

Codex was used as the primary engineering agent across the full delivery lifecycle:

- product and business requirements;
- architecture and threat-aware design;
- Electron renderer and secure preload boundaries;
- native Objective-C/Core Audio process capture;
- macOS packaging, local encryption, and caption-window behavior;
- React, PHP, Node.js, SQL, and WebSocket implementation;
- Stripe credit purchasing and refund handling;
- multilingual interface design;
- unit tests and production verification;
- ConoHa WING and VPS deployment support;
- Build Week feature design and implementation.

Codex helped verify an important product constraint: the translation-specialized realtime model does not accept custom glossary instructions. That finding drove two truthful product decisions: keep GPT-5.6 preparation separate from the live audio path, and use the general realtime model only after explicit terminology opt-in.

During Build Week, Codex moved from requirements and architecture through Electron, Objective-C, React, PHP, Node.js, SQL, WebSockets, tests, security review, macOS packaging, and production deployment. The key human product decisions were to make the Mac app useful for real meetings without a virtual audio cable and to preserve the translation-specialized model as the web default instead of changing models without user consent.

## Architecture

```text
macOS app (Electron + Core Audio)
  `-- direct ephemeral session --> OpenAI Realtime

Browser (React + Web Audio)
  |-- HTTPS --> ConoHa WING (PHP API + MySQL)
  |                |-- auth, credits, subscriptions, Stripe, daily AI quota
  |                `-- signed request --> Gateway /prepare
  |
  `-- WebSocket --> ConoHa VPS Gateway (Node.js)
                         |-- GPT-5.6 Responses API
                         `-- OpenAI Realtime
```

Web secrets never reach the browser. Its OpenAI API key is stored only on the VPS gateway, and PHP-to-gateway requests use HMAC signatures with a short timestamp window. The Mac app accepts the owner's own API key and stores it with local encryption; renderer pages cannot read the saved plaintext key.

## Web product features

- multilingual input/output language selection;
- always-on microphone level meter;
- output-volume test and volume controls;
- pause/resume without consuming purchased time;
- warning after 9 minutes and automatic stop after 10 minutes without confirmation;
- 1 free minute for a newly verified account;
- a first-purchase-only offer of 30 minutes for ¥500;
- monthly plans and additional LI credit purchases;
- prepaid interpretation credits with Stripe Checkout;
- refunds that revoke the corresponding unused credit;
- Japanese, English, and Simplified Chinese interface;
- email verification, password reset, admin two-factor authentication, and login throttling;
- no routine storage of source audio, translated audio, or transcripts.

## Repository layout

```text
01_企画/                 Product planning
02_要件定義/             Requirements
03_基本設計/             High-level design
04_詳細設計/             Detailed design
05_実装/web/             React frontend, PHP API, SQL migrations
05_実装/gateway/         Node.js realtime and GPT-5.6 gateway
05_実装/mac-app/         Electron + native Core Audio macOS app
```

## Local development

### Requirements

- Node.js 22+
- PHP 8.1+
- MySQL 8+
- an OpenAI API key
- macOS 13+ and Xcode Command Line Tools for the native app

### Native macOS app

```bash
cd 05_実装/mac-app
npm ci
npm test
npm run check
npm run dev
```

To build the distributable application locally:

```bash
npm run package:mac
```

The Mac app asks each owner for an OpenAI API key on the device. The key is encrypted in Electron's local secure storage and is not included in this repository.

### Frontend and PHP API

```bash
cd 05_実装/web
npm ci
npm run build
```

Copy `05_実装/web/api/config.sample.php` to `api/config.php` and replace every `CHANGE_ME` value. Never commit the resulting `config.php`.

Apply the SQL migrations in filename order. The latest Build Week migration is:

```text
05_実装/web/database/010_subscription_credits.sql
```

### Gateway

```bash
cd 05_実装/gateway
cp .env.example .env
npm ci
npm test
npm start
```

Set the gateway environment values in `.env`, including `OPENAI_API_KEY`, `GATEWAY_SHARED_SECRET`, `WEB_API_BASE`, and `ALLOWED_ORIGIN`. Do not commit `.env`.

## Validation

```bash
# Web build and PHP checks
cd 05_実装/web
npm run build
find api -name '*.php' -print0 | xargs -0 -n1 php -l
for test_file in tests/*.php; do php "$test_file"; done

# Gateway tests
cd ../gateway
npm test

# Native macOS app
cd ../mac-app
npm test
npm run check
npm run package:mac
```

The gateway test suite covers access-token verification, HMAC request verification, GPT-5.6 request construction, non-storage configuration, Structured Output extraction, and Responses API integration boundaries.

The final Build Week verification on July 16, 2026 passed the production web build, the web and PHP checks, all 9 gateway tests, all 31 macOS app tests, the macOS static check, and creation of a packaged `.app`.

## Judge testing

### Fast public demo

1. Open [live-interpreter.shalomworks.tech](https://live-interpreter.shalomworks.tech/).
2. Use the homepage audio demonstration to hear the Japanese-to-English interpretation flow without creating an account.

The public web service is the quickest no-install evaluation path and does not require a judge to supply an OpenAI API key.

### End-to-end live test

1. Use the dedicated judge credentials supplied privately in the Devpost testing instructions. Credentials are intentionally not stored in this public repository.
2. Allow microphone access, choose an input and output language, and use the microphone/output checks.
3. Start interpretation and speak a short sentence.
4. Optionally enter names or specialist terms and explicitly select **Apply custom terminology** to test the alternate model path.
5. Generate an AI preparation brief to test the GPT-5.6 Structured Outputs workflow.

A newly registered and verified account receives one free minute. The dedicated judge account should remain credited and available free of charge through the end of the judging period on August 5, 2026.

### Native macOS experience

The submission video demonstrates the advanced native workflow, including per-application system-audio capture, independent audio routing, multilingual captions, and the shareable caption window. Its complete source is in `05_実装/mac-app`.

Judges who want to run it locally can follow the native app commands above and use their own OpenAI API key. This is optional: the public web evaluation path and dedicated judge account provide free product access without requiring a judge-owned key.

## Privacy and safety

- Audio and translation content are not routinely stored.
- GPT-5.6 preparation input and output are not persisted by the application.
- OpenAI requests use `store: false` where applicable.
- Web API keys and payment secrets remain server-side.
- The native app encrypts its user-provided API key locally and keeps it outside renderer pages.
- Preparation requests are signed and expire after 60 seconds.
- The preparation feature is limited to five generations per user per day and 2,000 input characters per request.
- Realtime sessions use short-lived, single-use access tokens.
- Credit balance is enforced by the gateway, not trusted to the browser.

## 日本語概要

ShalomWorks Live Interpreterは、OpenAI Build Week中に新規制作したリアルタイム通訳プロジェクトです。高機能なmacOSアプリと、審査員がインストール不要で試せる事業用Web版を一つの製品として提供します。

macOS版は、Zoomやブラウザなど選択したアプリの音声、マイク、画面・ウィンドウ、音声・動画ファイルを入力にでき、原音と通訳音声の独立出力、1〜2言語字幕、共有用字幕ウィンドウ、字幕保存に対応します。Web版は、低遅延音声通訳、GPT-5.6による通訳準備ブリーフ、明示選択式のカスタム用語モード、会員・クレジット・決済・返金・自動終了まで備えた公開サービスです。

音声・翻訳音声・翻訳本文は原則保存せず、APIキーや決済情報をブラウザへ渡さない構成です。

## License

Copyright © 2026 ShalomWorks. All rights reserved. See [LICENSE](LICENSE). The source is published for OpenAI Build Week evaluation and portfolio review; no permission is granted to copy, redistribute, or commercially use it.
