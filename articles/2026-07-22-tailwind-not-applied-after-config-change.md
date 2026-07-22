# Tailwind CSSを導入したのにスタイルが反映されなかった件

「雑談のタネ🌱」のスタイリングをTailwind CSSで書いていくことにし、Next.js(App Router)構成のプロジェクトにTailwind CSS v4を導入した。設定ファイルを一通り書き終えてブラウザで確認したところ、Tailwindのユーティリティクラスが一切反映されておらず、原因調査に時間がかかったのでまとめる。

## やったこと

Tailwind CSS v4のセットアップとして、以下を行った。

- `tailwindcss` と `@tailwindcss/postcss` をdevDependenciesに追加
- `postcss.config.mjs` を作成し、`@tailwindcss/postcss` プラグインを登録

```js
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
```

- `app/globals.css` の先頭に `@import "tailwindcss";` を追加
- 動作確認用に、`app/page.tsx` の一部の要素へ試しに `text-4xl font-bold` というクラスを当てた

## 起きた問題

上記の設定を終えてブラウザで確認したが、`text-4xl font-bold` を当てた要素の見た目が全く変化せず、Tailwindが効いているように見えなかった。

## 原因調査

まず疑ったのは設定ファイルの書き方だったが、見直しても以下の点はすべてTailwind v4の作法として正しかった。

- `postcss.config.mjs` のプラグイン名・書き方
- `globals.css` の `@import "tailwindcss";` の位置(ファイル先頭にあるか)
- `app/layout.tsx` で `globals.css` がimportされているか
- `package.json` に `tailwindcss` / `@tailwindcss/postcss` が入っているか

設定ファイル自体に間違いがなかったため、次に以下を順番に確認した。

1. 開発サーバーのターミナルにエラーが出ていないか → 出ていなかった
2. 設定変更後に開発サーバーを再起動したか → **していなかった**
3. ブラウザのキャッシュ(ハードリロードで確認)
4. 対象の要素に本当にそのクラスが当たっているか(DevToolsで確認)

## 原因

`postcss.config.mjs` の作成やパッケージ追加(`npm install`)を行った後、`next dev` を起動したまま(再起動せずに)ブラウザで確認していたことが原因だった。

Next.jsの開発サーバーは、起動中にファイルの変更を検知して自動リロードしてくれる範囲が限られており、PostCSSの設定ファイルの新規作成や依存パッケージの追加のような「ビルドパイプライン自体の変更」は、サーバーを再起動しないと反映されない。

## 解決方法

開発サーバーを一度停止し(`Ctrl+C`)、`npm run dev` で起動し直したところ、Tailwindのユーティリティクラスが正しく反映されるようになった。

## まとめ

- Tailwind CSSやPostCSSなど、ビルドパイプラインに関わる設定ファイルを新規作成・変更した場合、Next.jsの開発サーバー(`next dev`)の自動リロードでは反映されないことがある
- 依存パッケージを追加した場合も同様に、開発サーバーの再起動が必要になることがある
- 「設定ファイルの記述は合っているのに反映されない」ときは、コードの間違い探しをする前に、まず開発サーバーを再起動してみるのが手早い切り分け方法になる
