# ShalomWorks Live Interpreter

ShalomWorks Live Interpreter is an OpenAI Build Week project with two working experiences: a native macOS interpretation app created during the formal Submission Period and a production browser service meaningfully extended during that period. A speaker talks naturally, and listeners hear low-latency interpreted speech in another language.

**OpenAI Build Week track:** Work & Productivity

**Live application:** [live-interpreter.shalomworks.tech](https://live-interpreter.shalomworks.tech/)

**Apple Silicon Mac download:** [Live Interpreter v0.1.0 for macOS](https://github.com/mfp109/live-interpreter/releases/tag/v0.1.0-mac-arm64)

**Demo video:** [Live Interpreter — Real-Time AI Interpretation for Web & Mac](https://youtu.be/S8HPPdMVj3g)

**Built with:** Codex, GPT-5.6, OpenAI Realtime, Electron, Core Audio, Objective-C, React, PHP, Node.js, MySQL, Stripe, and WebSockets

## The problem

Live interpretation is often expensive or difficult to arrange for small teams, community events, education, travel, worship services, and international meetings. Text-only translation also forces listeners to look away from the speaker.

This service keeps the experience voice-first: the speaker talks, the system interprets, and the audience listens.

## Build Week creation timeline

Live Interpreter was initiated during the OpenAI Build Week Registration Period. Because the first web experiment was committed before the formal Submission Period opened, this repository treats it as pre-existing for rule compliance and distinguishes it from the work added afterward. During the formal Submission Period, the project was meaningfully extended with a newly created native macOS application, a Mac-inspired web redesign, simultaneous audio and captions, dual captions, connection-aware billing, 13 interface languages, subscriptions, security work, and production deployment.

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
| July 16, 2026 | [`de397af`](https://github.com/mfp109/live-interpreter/commit/de397af) | Replace the experimental preparation/terminology flows with Mac-parity web interpretation modes, dual captions, 13 interface languages, and connection-aware billing |

The preparation-brief and custom-terminology commits remain in the dated history as Build Week experiments, but those features were deliberately removed from the final product in `de397af`. The final submission is evaluated from the current `main` branch, not from those superseded experiments.

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
- audio plus captions, audio only, or captions only;
- two simultaneous caption languages, including source-language transcription;
- reuse of the audio translation session when its language also appears as a caption;
- 13 interface languages;
- second-by-second billing based on the number of active translation and transcription connections;
- accounts, email verification, credits, subscriptions, Stripe Checkout, and refunds;
- server-enforced usage settlement and automatic session safeguards;
- the translation-specialized realtime model for translated audio and captions.

## Mac-parity web interpretation

The final Build Week web experience follows the successful Mac interaction model while respecting browser constraints:

- **Audio + captions**, **Audio only**, and **Captions only** are first-class modes;
- caption language 1 and caption language 2 can run simultaneously;
- source-language captions and translated captions can appear together;
- translated audio and a caption in the same language share one Realtime translation session;
- the page shows the calculated LI credit rate before the session starts;
- the entire site can switch among 13 interface languages.

Browser security prevents the web app from isolating the sound of another application or creating a native always-on-top caption window. Those capabilities remain Mac-specific. The web version uses microphone input and two captions inside the page.

## Connection-aware billing

The gateway meters the sessions that are actually active instead of charging one flat rate:

- source captions only: 1 LI credit per second;
- interpreted audio only: 12 credits per second;
- interpreted audio plus a caption in the same language: 12 credits per second;
- interpreted audio plus source captions: 13 credits per second;
- interpreted audio plus source captions plus a different translated caption: 25 credits per second;
- maximum supported combination: 37 credits per second.

The server authorizes the exact combination, returns the verified rate, and settles usage by elapsed seconds. The browser never decides its own billable rate.

## How OpenAI is used

### GPT-5.6

GPT-5.6 was used through Codex as the engineering intelligence for the Build Week redesign. It helped compare the Mac and web capabilities, remove unsuccessful experimental features, design the multi-session Realtime flow, implement dual captions and connection-aware billing, expand the web interface to 13 languages, create tests, review security boundaries, and carry the change through production deployment. GPT-5.6 is not presented as the live interpretation model.

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

During Build Week, Codex moved from requirements and architecture through Electron, Objective-C, React, PHP, Node.js, SQL, WebSockets, tests, security review, macOS packaging, and production deployment. The key human decisions were to make the Mac app useful for real meetings without a virtual audio cable, remove preparation and terminology features that did not improve the core experience, and bring the Mac product's audio/caption flexibility to the browser.

## Architecture

```text
macOS app (Electron + Core Audio)
  `-- direct ephemeral session --> OpenAI Realtime

Browser (React + Web Audio)
  |-- HTTPS --> ConoHa WING (PHP API + MySQL)
  |                |-- auth, credits, subscriptions, Stripe
  |                `-- signed authorization and usage settlement
  |
  `-- WebSocket --> ConoHa VPS Gateway (Node.js)
                         `-- one to three OpenAI Realtime sessions
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
- 13 interface languages: Japanese, English, Simplified Chinese, Spanish, Portuguese, French, German, Russian, Korean, Hindi, Indonesian, Vietnamese, and Italian;
- email verification, password reset, admin two-factor authentication, and login throttling;
- no routine storage of source audio, translated audio, or transcripts.

## Repository layout

```text
01_企画/                 Product planning
02_要件定義/             Requirements
03_基本設計/             High-level design
04_詳細設計/             Detailed design
05_実装/web/             React frontend, PHP API, SQL migrations
05_実装/gateway/         Node.js realtime gateway and usage settlement
05_実装/mac-app/         Electron + native Core Audio macOS app
```

## Download the native macOS app

The ready-to-run judge build supports Apple Silicon Macs (M1 or later) with macOS 13 or later.

1. Download `Live-Interpreter-macOS-Apple-Silicon-v0.1.0.zip` from the [GitHub Release](https://github.com/mfp109/live-interpreter/releases/tag/v0.1.0-mac-arm64).
2. Open the ZIP and move `Live Interpreter.app` to Applications.
3. On first launch, Control-click the app, choose **Open**, and confirm **Open** if macOS displays an unidentified-developer warning.
4. Open **Live Interpreter > Settings**, enter your own OpenAI API key, and save it. The key is encrypted locally and is not bundled with the download.
5. Allow Microphone and Screen Recording permissions when macOS asks. Restart the app after granting Screen Recording permission.

The release also includes a SHA-256 checksum file. The app is ad-hoc signed for hackathon testing and is not notarized through the Mac App Store.

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
npm start
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

The gateway test suite covers access-token verification, HMAC request verification, audio/caption session planning, translation-session reuse, source transcription, multi-session Realtime connections, and signed settlement boundaries.

The final Build Week verification on July 17, 2026 passed the production web build, all 13 web tests, all 10 gateway tests, PHP syntax and signature/Stripe/TOTP/refund tests, all 31 macOS app tests, the macOS static check, and creation of a packaged `.app`. A live integration check also opened two translated-caption sessions and one source-transcription session concurrently through OpenAI, with all three reaching `session.updated`.

## Judge testing

### Fast public demo

1. Open [live-interpreter.shalomworks.tech](https://live-interpreter.shalomworks.tech/).
2. Use the homepage audio demonstration to hear the Japanese-to-English interpretation flow without creating an account.

The public web service is the quickest no-install evaluation path and does not require a judge to supply an OpenAI API key.

### End-to-end live test

1. Use the dedicated judge credentials supplied privately in the Devpost testing instructions. Credentials are intentionally not stored in this public repository.
2. Allow microphone access and choose **Audio + captions**.
3. Choose Japanese input, English interpreted audio, source-language caption 1, and Chinese caption 2.
4. Confirm that the page shows 25 LI credits per second, then start and speak Japanese.
5. Verify English audio, Japanese source captions, and Chinese translated captions.
6. Repeat with **Audio only** or **Captions only**, and change the site display language from the header selector.

A newly registered and verified account receives one free minute. The dedicated judge account should remain credited and available free of charge through the end of the judging period on August 5, 2026.

### Native macOS experience

The submission video demonstrates the advanced native workflow, including per-application system-audio capture, independent audio routing, multilingual captions, and the shareable caption window. Its complete source is in `05_実装/mac-app`.

Judges with an Apple Silicon Mac can download the ready-to-run build from the [GitHub Release](https://github.com/mfp109/live-interpreter/releases/tag/v0.1.0-mac-arm64) and use their own OpenAI API key. Building from source is not required. This native test is optional: the public web evaluation path and dedicated judge account provide free product access without requiring a judge-owned key.

## Privacy and safety

- Audio and translation content are not routinely stored.
- Web API keys and payment secrets remain server-side.
- The native app encrypts its user-provided API key locally and keeps it outside renderer pages.
- Realtime sessions use short-lived, single-use access tokens.
- Credit balance is enforced by the gateway, not trusted to the browser.
- The gateway plans and settles every active translation and transcription connection; the browser cannot lower its own charge rate.

## 日本語概要

ShalomWorks Live Interpreterは、OpenAI Build Week中に新規制作したリアルタイム通訳プロジェクトです。高機能なmacOSアプリと、審査員がインストール不要で試せる事業用Web版を一つの製品として提供します。

macOS版は、Zoomやブラウザなど選択したアプリの音声、マイク、画面・ウィンドウ、音声・動画ファイルを入力にでき、原音と通訳音声の独立出力、1〜2言語字幕、共有用字幕ウィンドウ、字幕保存に対応します。Web版は、音声＋字幕・音声のみ・字幕のみ、二言語字幕、原語字幕、13種類の表示言語、接続数に応じた秒単位課金、会員・クレジット・決済・返金・自動終了を備えた公開サービスです。

音声・翻訳音声・翻訳本文は原則保存せず、APIキーや決済情報をブラウザへ渡さない構成です。

## License

Copyright © 2026 ShalomWorks. All rights reserved. See [LICENSE](LICENSE). The source is published for OpenAI Build Week evaluation and portfolio review; no permission is granted to copy, redistribute, or commercially use it.
