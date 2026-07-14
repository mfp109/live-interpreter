# ShalomWorks Live Interpreter

ShalomWorks Live Interpreter is a production-ready, browser-based voice interpretation service. A speaker talks naturally into a microphone, and listeners hear low-latency interpreted speech in another language without having to follow subtitles.

**OpenAI Build Week track:** Work & Productivity

**Live application:** [live-interpreter.shalomworks.tech](https://live-interpreter.shalomworks.tech/)

**Built with:** Codex, GPT-5.6, OpenAI Realtime Translation, React, PHP, Node.js, MySQL, Stripe, and WebSockets

## The problem

Live interpretation is often expensive or difficult to arrange for small teams, community events, education, travel, worship services, and international meetings. Text-only translation also forces listeners to look away from the speaker.

This service keeps the experience voice-first: the speaker talks, the system interprets, and the audience listens.

## Build Week extension: AI Meeting Preparation Brief

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

This feature deliberately does **not** claim to modify the Realtime Translation model. It prepares the human speaker before the session while the live interpretation pipeline remains independent.

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
- React, PHP, Node.js, SQL, and WebSocket implementation;
- Stripe credit purchasing and refund handling;
- multilingual interface design;
- unit tests and production verification;
- ConoHa WING and VPS deployment support;
- Build Week feature design and implementation.

The Build Week extension was designed after verifying an important product constraint: the current Realtime Translation model does not accept custom glossaries or prompts. Codex therefore separated GPT-5.6 preparation from the realtime audio path instead of presenting a misleading glossary-injection feature.

## Architecture

```text
Browser (React + Web Audio)
  |-- HTTPS --> ConoHa WING (PHP API + MySQL)
  |                |-- auth, credits, Stripe, daily AI quota
  |                `-- signed request --> Gateway /prepare
  |
  `-- WebSocket --> ConoHa VPS Gateway (Node.js)
                         |-- GPT-5.6 Responses API
                         `-- Realtime Translation API
```

Secrets never reach the browser. The OpenAI API key is stored only on the VPS gateway. Requests from the PHP application to the gateway are authenticated with an HMAC signature and a short timestamp window.

## Main product features

- multilingual input/output language selection;
- always-on microphone level meter;
- output-volume test and volume controls;
- pause/resume without consuming purchased time;
- warning after 9 minutes and automatic stop after 10 minutes without confirmation;
- 15 free minutes for a newly verified account;
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
```

## Local development

### Requirements

- Node.js 22+
- PHP 8.1+
- MySQL 8+
- an OpenAI API key

### Frontend and PHP API

```bash
cd 05_実装/web
npm ci
npm run build
```

Copy `05_実装/web/api/config.sample.php` to `api/config.php` and replace every `CHANGE_ME` value. Never commit the resulting `config.php`.

Apply the SQL migrations in filename order. The latest Build Week migration is:

```text
05_実装/web/database/008_ai_preparation_usage.sql
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
```

The gateway test suite covers access-token verification, HMAC request verification, GPT-5.6 request construction, non-storage configuration, Structured Output extraction, and Responses API integration boundaries.

## Privacy and safety

- Audio and translation content are not routinely stored.
- GPT-5.6 preparation input and output are not persisted by the application.
- OpenAI requests use `store: false` where applicable.
- API keys and payment secrets remain server-side.
- Preparation requests are signed and expire after 60 seconds.
- The preparation feature is limited to five generations per user per day and 2,000 input characters per request.
- Realtime sessions use short-lived, single-use access tokens.
- Credit balance is enforced by the gateway, not trusted to the browser.

## 日本語概要

ShalomWorks Live Interpreterは、マイクへ話した音声を低遅延で別の言語の音声へ通訳するWebサービスです。Build Weekでは、GPT-5.6を使って通訳前に固有名詞・数字・専門用語・誤訳リスクを整理する「AI会議準備ブリーフ」を追加しました。

音声・翻訳音声・翻訳本文は原則保存せず、APIキーや決済情報をブラウザへ渡さない構成です。

## License

Copyright © 2026 ShalomWorks. All rights reserved. See [LICENSE](LICENSE). The source is published for OpenAI Build Week evaluation and portfolio review; no permission is granted to copy, redistribute, or commercially use it.
