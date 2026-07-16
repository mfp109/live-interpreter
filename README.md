# ShalomWorks Live Interpreter

ShalomWorks Live Interpreter is a production-ready, browser-based voice interpretation service. A speaker talks naturally into a microphone, and listeners hear low-latency interpreted speech in another language without having to follow subtitles.

**OpenAI Build Week track:** Work & Productivity

**Live application:** [live-interpreter.shalomworks.tech](https://live-interpreter.shalomworks.tech/)

**Built with:** Codex, GPT-5.6, OpenAI Realtime Translation, React, PHP, Node.js, MySQL, Stripe, and WebSockets

## The problem

Live interpretation is often expensive or difficult to arrange for small teams, community events, education, travel, worship services, and international meetings. Text-only translation also forces listeners to look away from the speaker.

This service keeps the experience voice-first: the speaker talks, the system interprets, and the audience listens.

## Build Week scope and provenance

This is a pre-existing production project that was meaningfully extended after the OpenAI Build Week submission period opened on July 13, 2026 at 9:00 AM PT (July 14 at 1:00 AM JST/KST). Judges should evaluate the Build Week additions listed below, not the earlier product as a whole.

**Pre-Build Week baseline:** [`4620292`](https://github.com/mfp109/live-interpreter/commit/4620292), committed July 11, 2026.

| Date (JST/KST) | Commit | Build Week addition |
| --- | --- | --- |
| July 15, 2026 03:20 | [`1d7cf42`](https://github.com/mfp109/live-interpreter/commit/1d7cf42) | GPT-5.6 interpretation preparation brief |
| July 15, 2026 03:28 | [`202184d`](https://github.com/mfp109/live-interpreter/commit/202184d) | Public repository and evaluation documentation |
| July 15, 2026 09:41 | [`68f1c79`](https://github.com/mfp109/live-interpreter/commit/68f1c79) | Terminology-aware realtime interpretation mode |
| July 15, 2026 13:36 | [`156fffd`](https://github.com/mfp109/live-interpreter/commit/156fffd) | Explicit opt-in for custom terminology |
| July 15, 2026 14:30 | [`8de52a1`](https://github.com/mfp109/live-interpreter/commit/8de52a1) | One-minute free trial and first-purchase offer |
| July 15, 2026 14:36 | [`054d2fa`](https://github.com/mfp109/live-interpreter/commit/054d2fa) | Removal of the completed one-time migration endpoint |

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

This preparation feature deliberately does **not** claim to modify the Realtime Translation model. It prepares the human speaker before the session while the live interpretation pipeline remains independent.

## Build Week extension: Explicit Custom Terminology

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
- React, PHP, Node.js, SQL, and WebSocket implementation;
- Stripe credit purchasing and refund handling;
- multilingual interface design;
- unit tests and production verification;
- ConoHa WING and VPS deployment support;
- Build Week feature design and implementation.

Codex helped verify an important product constraint: the translation-specialized realtime model does not accept custom glossary instructions. That finding drove two truthful product decisions: keep GPT-5.6 preparation separate from the live audio path, and use the general realtime model only after explicit terminology opt-in.

During Build Week, Codex accelerated the project by tracing the existing React/PHP/Node/SQL architecture, comparing model capabilities, implementing both gateway and UI changes, writing regression tests, reviewing security boundaries, preparing the public repository, and verifying the deployed service. The key human product decision was to preserve the translation-specialized model as the default instead of trading away its purpose without user consent.

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
- 1 free minute for a newly verified account;
- a first-purchase-only offer of 30 minutes for ¥500;
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
05_実装/web/database/009_trial_and_intro_offer.sql
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

The final Build Week verification on July 16, 2026 passed the production web build, all 5 web tests, all 9 gateway tests, PHP syntax checks, and the PHP gateway-signature, refund-calculation, Stripe-signature, and TOTP tests.

## Judge testing

### Fast public demo

1. Open [live-interpreter.shalomworks.tech](https://live-interpreter.shalomworks.tech/).
2. Use the homepage audio demonstration to hear the Japanese-to-English interpretation flow without creating an account.

### End-to-end live test

1. Use the dedicated judge credentials supplied privately in the Devpost testing instructions. Credentials are intentionally not stored in this public repository.
2. Allow microphone access, choose an input and output language, and use the microphone/output checks.
3. Start interpretation and speak a short sentence.
4. Optionally enter names or specialist terms and explicitly select **Apply custom terminology** to test the alternate model path.
5. Generate an AI preparation brief to test the GPT-5.6 Structured Outputs workflow.

A newly registered and verified account receives one free minute. The dedicated judge account should remain credited and available free of charge through the end of the judging period on August 5, 2026.

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
