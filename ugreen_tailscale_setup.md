# UGREEN NAS: Tailscale Docker 導入手順

UGREEN NAS（UGOS）では、システム領域を汚さない **Docker（Container Station）** を利用したTailscaleの導入が推奨されています。

## 事前準備: Auth Keyの取得
Tailscaleネットワークにコンテナを自動登録するために「Auth Key」が必要です。
1. [Tailscale Admin Console](https://login.tailscale.com/admin/settings/keys) にアクセスし、ログインします。
2. 左側メニューの「Settings」>「Keys」を開きます。
3. **Auth keys** セクションの「Generate auth key」をクリックします。
4. 「Reusable（再利用可能）」や「Ephemeral（一時的）」などの用途に合わせてチェックを入れ、「Generate key」をクリックします。（基本はReusableを推奨）
5. 生成された `tskey-auth-...` で始まるキーをコピーしておきます。

## ステップ 1: Dockerアプリのインストール
1. UGREEN NASのWeb管理画面（UGOS）にログインします。
2. 「App Center（アプリセンター）」を開きます。
3. **Docker** アプリを検索し、インストールして起動します。

## ステップ 2: Tailscaleイメージのダウンロード
1. Dockerアプリ内の左メニューから「Image（イメージ）」を開きます。
2. 検索バーで `tailscale/tailscale` と検索します。
3. 公式イメージを選択し、「Pull（ダウンロード）」をクリックします。（タグは `latest` でOKです）

## ステップ 3: コンテナの作成と基本設定
1. ダウンロードが完了したら、Dockerアプリの「Container（コンテナ）」メニューを開き、「New Container（追加）」をクリックします。
2. ダウンロードした `tailscale/tailscale` イメージを選択します。
3. 以下の設定を行います：
   * **Network（ネットワーク）**: 必ず **`host`** モードに変更します。（重要：TailscaleがNASのネットワークインターフェースを直接管理するため）
   * **Privilege（特権モード）**: VPN機能を正常に動作させるため、特権モード（Privileged mode）を **オン** にします。
   * **Restart Policy（再起動ポリシー）**: NAS再起動時に自動起動するように `Always` に設定します。

## ステップ 4: 環境変数 (Environment Variables) の設定
コンテナ作成ウィザード内の「環境変数 (Environment)」タブを開き、以下の2つを追加します。

| 変数名 (Key) | 値 (Value) | 説明 |
| :--- | :--- | :--- |
| `TS_AUTHKEY` | `tskey-auth-...` (事前準備でコピーしたキー) | Tailscaleネットワークへの自動ログインに使用 |
| `TS_STATE_DIR` | `/var/lib/tailscale` | 設定ファイルや状態を保存するディレクトリの指定 |

## ステップ 5: ボリューム (Volume) のマウント設定
設定ファイルがコンテナ再起動で消えないように、NAS上のフォルダをマウントします。
「Storage（ストレージ） / Volume（ボリューム）」タブを開き、以下のマッピングを追加します。

| Host Path (NAS側のパス) | Container Path (コンテナ側のパス) |
| :--- | :--- |
| `/Docker/tailscale_data` (※任意のフォルダを作成) | `/var/lib/tailscale` |

※ NAS側に `Docker` 共有フォルダなどを作成し、その中に `tailscale_data` という空のフォルダを作って割り当ててください。

## ステップ 6: デプロイと接続確認
1. すべての設定が完了したら「Done（完了/デプロイ）」をクリックしてコンテナを起動します。
2. コンテナが「Running」状態になったことを確認します。
3. PCやスマホから [Tailscale Admin Console](https://login.tailscale.com/admin/machines) を開き、一覧に新しくNASのデバイス（Dockerコンテナ）が追加されていれば成功です！
4. 割り当てられた `100.x.x.x` のIPアドレスを使って、他のTailscaleデバイスからNAS（例えばRSSリーダーのポートなど）へアクセスできるかテストします。

> [!TIP]
> **Subnet Routing (サブネットルーティング) について**
> NASを踏み台にして自宅のローカルネットワーク全体にアクセスしたい場合は、環境変数に `TS_ROUTES=192.168.1.0/24` (ご自宅のサブネット) を追加し、Admin Console上でルーティングを許可する設定が必要です。まずは基本設定でつながるかを確認してください。
