# デプロイ・ロールバック・シークレット運用

Cloudflare **Workers** へのデプロイと、その後の切り戻し・秘密情報の更新手順。

## デプロイ

```bash
bun run deploy
```

`vite build && wrangler deploy` を実行する。ビルド成果物ではなく
`wrangler.toml` の `main`（`./src/ssr.tsx`）がエントリで、Cloudflare 連携は
`@cloudflare/vite-plugin` が担う。

デプロイ前に確認すること:

- `bun run check` と `bun run test` が通っている
- 本番の秘密情報が `wrangler secret` に登録済み（下記）

## デプロイ状況の確認

```bash
wrangler deployments list   # 直近のデプロイ一覧
wrangler versions list      # 直近のバージョン一覧（Version ID を取得する）
```

## ログ

`wrangler.toml` の `[observability] enabled = true` が、デプロイ済み Worker の
invocation log、`console.*`、未捕捉例外を Workers Logs に書く。Cloudflare
ダッシュボードの Observability タブ、`wrangler tail`、プロジェクト MCP
`cloudflare-observability` のいずれかから読む。

- Cursor: `.cursor/mcp.json`。初回は Cloudflare の OAuth。ツールは
  `query_worker_observability`、`observability_keys`、`observability_values`
- Claude Code: 同じ URL を `.mcp.json` に `type: http` で置いてある。初回は
  セッションでプロジェクト MCP を承認する

Workers Logs に入るのはデプロイ済み Worker だけである。`bun run dev` では同じ
`console.error` が開発サーバのターミナルに出る。クライアントへ返す失敗メッセージ
は固定文のままで、スタックはログ側にだけ残る。

## ロールバック

```bash
wrangler rollback                  # 直前のバージョンへ戻す
wrangler rollback <VERSION_ID>     # 指定バージョンへ戻す
```

`<VERSION_ID>` は `wrangler versions list` で確認する。引数を省略すると最新の
1つ前が対象になる。

## 秘密の初期登録（デプロイより先に）

`wrangler.toml` の `[secrets]` に列挙した名前は `required` 扱いなので、未登録の
まま `wrangler deploy` すると失敗する。名前を宣言する前に登録を済ませる、という
順序を守れば済む。

Worker がまだ存在しない場合も同じ順序でよい。`wrangler secret put` は登録先が
無いことを検出すると、プレースホルダの Worker を作ってよいか尋ね、承諾すれば
それを作ってから登録する。デプロイを先に済ませる必要はない。

```bash
wrangler secret put <NAME>     # 値は対話的に入力する
bun run deploy
```

**値をコマンドラインに書かないこと。** `wrangler secret put` は値を対話的に受け取り
エコーもしない。`wrangler secret bulk` に JSON をパイプする形は、既定のシェルでは
実値がヒストリファイルに残るので使わない（秘密は一時的にもファイルへ書かない）。同じ理由で `wrangler deploy --secrets-file <path>` も使わない。

秘密を**後から追加**する場合も順序は同じ。`[secrets]` に名前を足す前に登録する。
逆順にすると、既存 Worker のデプロイが必須チェックで失敗する。

## シークレットのローテーション

秘密情報はファイルに置かず `wrangler secret` で管理する。

```bash
wrangler secret list                        # 登録済みの名前を確認（値は出ない）
wrangler secret put <NAME>                  # 対話的に新しい値を入力
wrangler secret delete <NAME>               # 不要になった名前を削除
```

`wrangler secret put` は即時反映される（再デプロイ不要）。手順は「新しい値を
登録 → 動作確認 → 発行元で旧い値を失効」の順にする。逆順にすると、失効から
反映までの間その秘密を読む経路が落ちる。

## compatibility_date

`compatibility_date` は**インストール済みの `workerd` が対応する最新の日付**に固定する。
今日の日付に更新しない。`wrangler` を上げるときに一緒に上げるもので、上限は日付を設定して
`bun run dev` を走らせ、対応日付を名指しするエラーを読んで確かめる。変更後は
`bun run cf-typegen` を走らせる。

ローカル開発用の値は `.env.local`（gitignore 済み・エージェントからの読み取りも
拒否設定）に置く。本番の値をローカルに置く運用にはしない。
