# iPhoneアプリ開発メモ

## 必要なソフト

- Xcode
- iOS Simulator

どちらもApp Store版のXcodeに含まれます。

## 開くファイル

```text
ios/MailSubscriptionManager.xcodeproj
```

## 現在できること

- ダッシュボード表示
- アカウント一覧
- 購読メール一覧
- サービス、カテゴリ、並び替え
- 解除、保持
- 解除済みの復元
- カテゴリ別分析
- スコアリング重みの変更
- デモデータ初期化

## 実メール連携を入れる前の注意

Gmail、Outlook、Yahoo! MailはOAuth設定が必要です。iCloud Mailはアプリ専用パスワードを使うIMAP接続になるため、保存時の暗号化設計を先に入れる必要があります。

初期実装順は次がおすすめです。

1. Gmail OAuth
2. Gmail APIでヘッダーのみ取得
3. List-Unsubscribeヘッダー解析
4. 解除前の確認画面
5. キーチェーン保存
