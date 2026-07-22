# ESLintがAmplifyの自動生成コードを誤検知した件

Next.js公式ドキュメントの手順に沿って、`eslint-config-next` と `eslint-config-prettier` を使ったESLint/Prettier周りの設定を進めていたところ、`npx eslint .` を実行した際にAWS Amplifyのビルド成果物に対して大量のエラーが出た。その原因調査と対処法をまとめる。

参考にしたドキュメント: [ESLint Plugin | Next.js Docs](https://nextjs.org/docs/app/api-reference/config/eslint)

## 起きた問題

`eslint eslint-config-next` のインストール後、`eslint.config.mjs` を作成して `npx eslint .` を実行したところ、以下のようなエラーが出力された。

```
  705:12  error  React Hook "usePascalCaseForObjectKeys" is called in function "parsePropertiesToDynamoDBInput" that is neither a React function component nor a custom React Hook function...  react-hooks/rules-of-hooks
  714:59  error  React Hook "usePascalCaseForObjectKeys" cannot be called inside a callback...  react-hooks/rules-of-hooks
  717:42  error  React Hook "usePascalCaseForObjectKeys" is called conditionally...  react-hooks/rules-of-hooks
```

自分で書いたコードには一切触れていないファイル（Amplifyが自動生成したビルド成果物）に対して、Reactのルール違反エラーが出ており、何が起きているのか分からなかった。

## 原因

`eslint-config-next` には `eslint-plugin-react-hooks` が含まれており、このプラグインは「`use` で始まる名前の関数 = React Hook」というルールで対象を判定する。

エラーが出ていた `amplify-table-manager-handler.js` はAmplifyが自動生成したコードで、たまたま `usePascalCaseForObjectKeys` という「`use` から始まる」名前の関数が定義されていた。これがReact Hookとして誤って扱われ、「Hookの呼び出しルール違反」という誤検知（false positive）が発生していた。

本来、Lintの対象は自分たちが書いたソースコードだけであるべきだが、当時の `eslint.config.mjs` の `globalIgnores` には以下の4つしか入っておらず、Amplifyのビルド出力先である `.amplify/` が除外対象に含まれていなかった。

```js
globalIgnores([
  '.next/**',
  'out/**',
  'build/**',
  'next-env.d.ts',
]),
```

## 解決方法

`globalIgnores` に `.amplify/` 配下を除外するパターンを追加する。

ただし、最初に追加したのは `./amplify/**`（先頭にドットなし）だった。プロジェクトルートには `amplify`（設定用ソースコード）と `.amplify`（ビルド成果物の出力先）という**似た名前の別ディレクトリ**が存在しており、glob パターンでは先頭の `.` の有無で全く別のディレクトリとして扱われる。そのため `./amplify/**` は実際にエラーが出ていた `.amplify/artifacts/cdk.out/...` にはマッチせず、効果がなかった。

正しくは以下のように、ドット付きの `.amplify/**` を追加する必要があった。

```js
globalIgnores([
  '.next/**',
  'out/**',
  'build/**',
  'next-env.d.ts',
  '.amplify/**',
]),
```

これで `npx eslint .` を再実行すると、Amplifyの自動生成コードはLint対象から除外され、誤検知エラーは解消した。

## おまけ: Prettierの公式ドキュメントは分かりにくい

Prettier本体（`npm i -D prettier`）のインストール後、VS Code上でのフォーマット設定（`.vscode/settings.json` の `editor.defaultFormatter` や `editor.formatOnSave` など）について調べようとしたが、[Prettier公式サイト](https://prettier.io/)の説明は情報が分散していて分かりにくかった。

こういうエディタ連携まわりの実践的な設定は、公式ドキュメントを読み込むより「prettier settings.json」のようなキーワードで検索して、実例が載っている記事を探した方が早い。

## まとめ

- `eslint-config-next` の `eslint-plugin-react-hooks` は「`use` で始まる関数名」を機械的にReact Hook扱いするため、無関係な自動生成コードでも誤検知が起こりうる
- ビルドツール（AWS Amplifyなど）が生成するディレクトリは、ESLintの `globalIgnores` に明示的に追加しないとLint対象から漏れない
- glob パターンでは先頭の `.` の有無が区別される。似た名前の `amplify` / `.amplify` のような紛らわしいディレクトリがある場合は、実際にエラーが出ているファイルの絶対パスとパターンを見比べて確認する
- VS Code連携などの実践的なPrettier設定は、公式ドキュメントより実例ベースの記事を検索した方が早く解決することがある

## 参考

- [ESLint Plugin | Next.js Docs](https://nextjs.org/docs/app/api-reference/config/eslint)
