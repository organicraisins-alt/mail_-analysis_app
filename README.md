# メール購読管理アプリ

Gmailの「配信登録を管理」のように、複数メールアカウントに届く配信メールを送信元単位で横断管理するMVPです。

## 現在の状態

- SwiftUIのiPhoneアプリ
- 依存関係なしの静的Webアプリも残しています
- デモデータでアカウント管理、配信登録一覧、管理対象外設定、分析を確認可能
- iPhoneアプリのデータは `UserDefaults` に保存
- Web版のデータはブラウザの `localStorage` に保存
- 外部AIは未使用

## iPhoneアプリの使い方

XcodeをインストールしたMacで、次のファイルを開いてください。

```text
ios/MailSubscriptionManager.xcodeproj
```

Xcodeで開いたら:

1. 上部の実行先で iPhone シミュレータを選択
2. `MailSubscriptionManager` スキームを選択
3. Run ボタンで起動

この環境では現在 `/Applications/Xcode.app` がなく、Command Line Toolsのみ有効です。シミュレータで実際に動かすにはApp StoreからXcodeをインストールしてください。

## Web版の使い方

`index.html` をブラウザで開いてください。

デモだけ確認する場合:

```bash
python3 -m http.server 5173
```

その後、`http://localhost:5173` を開きます。

## 実Gmailでテストする

Gmail連携はローカルOAuthサーバーで動きます。本文は取得せず、Gmail APIの `format=metadata` で `From` / `Subject` / `Date` / `List-Unsubscribe` ヘッダーだけ取得します。

解除操作では、選択したGmail由来の送信元について次を実行できます。

- 今後のメールをGmailフィルタでゴミ箱へ送る
- 既存の該当メールをGmailのゴミ箱へ移動する

完全削除は行いません。

Google Cloudで次を準備してください。

1. Google Cloud Consoleでプロジェクトを作成
2. Gmail APIを有効化
3. OAuth同意画面を作成し、自分のGmailをテストユーザーに追加
4. OAuthクライアントIDを「ウェブアプリケーション」で作成
5. 承認済みリダイレクトURIに `http://127.0.0.1:5173/oauth2callback` を追加

その後、`.env.example` を `.env` にコピーして値を入れます。

```bash
cp .env.example .env
```

```text
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://127.0.0.1:5173/oauth2callback
PORT=5173
```

起動:

```bash
npm run dev:gmail
```

ブラウザで `http://127.0.0.1:5173/` を開き、`Gmail接続` → Google認証 → `Gmail取得` の順に操作します。

OAuthトークンは `.local/google-token.json` に保存され、GitHubにはpushされません。

既に `gmail.readonly` だけで接続済みの場合は、権限が足りません。`.local/google-token.json` を削除してから `Gmail接続` をやり直してください。

### 解除ボタンの現在の挙動

`解除` は、メール内の購読解除URLへアクセスする方式ではありません。

解除前には確認ダイアログを表示し、同じ送信元ドメインの候補をチェックボックスで選べます。チェックを外したものは解除対象外として保持扱いになります。

Gmail由来の対象を選択した場合は、確認ダイアログの設定に応じてGmailフィルタ作成と既存メールのゴミ箱移動を実行します。実際の購読解除を行う場合は、`List-Unsubscribe` ヘッダーの内容を解析し、解除先URLまたはメール送信先をユーザーに明示したうえで、最終確認を追加してから実行する設計にします。

## 資材構成

```text
.
├── index.html
├── ios/
│   ├── MailSubscriptionManager.xcodeproj
│   └── MailSubscriptionManager/
├── src/
│   ├── app.js
│   └── styles.css
├── docs/
│   └── requirements-summary.md
└── .github/
    └── ISSUE_TEMPLATE/
        └── feature.md
```

## GitHub 管理方針

- `main`: 動作確認済みの安定版
- `feature/*`: 機能追加
- `fix/*`: 不具合修正
- Pull Request 単位でレビュー、確認、マージする

## ロードマップ

- Phase 1: 配信登録管理MVP、ルールベース整理候補、デモ操作
- Phase 2: SwiftUI版の操作性改善、ローカル保存、解除取り消し
- Phase 3: Gmail OAuth、Gmail API 同期
- Phase 4: Outlook / iCloud / Yahoo! Mail 対応
- Phase 5: サーバー連携、暗号化トークン保存、運用設計
