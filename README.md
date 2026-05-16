# メール購読管理アプリ

複数メールアカウントの購読メールを横断管理し、ルールベースの不要度スコアで解除候補を整理するMVPです。

## 現在の状態

- SwiftUIのiPhoneアプリ
- 依存関係なしの静的Webアプリも残しています
- デモデータでアカウント管理、購読一覧、解除、保持、分析を確認可能
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

ローカルサーバーで確認する場合:

```bash
python3 -m http.server 5173
```

その後、`http://localhost:5173` を開きます。

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

- Phase 1: 静的MVP、ルールベーススコア、デモ操作
- Phase 2: SwiftUI版の操作性改善、ローカル保存、解除取り消し
- Phase 3: Gmail OAuth、Gmail API 同期
- Phase 4: Outlook / iCloud / Yahoo! Mail 対応
- Phase 5: サーバー連携、暗号化トークン保存、運用設計
