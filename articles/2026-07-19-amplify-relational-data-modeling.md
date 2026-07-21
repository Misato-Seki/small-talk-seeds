# AWS Amplify Gen2でリレーショナルなデータベースを作る方法

「雑談のタネ🌱」というクイズアプリを作る中で、1つのクイズ（Quiz）が複数の選択肢（Choice）を持つ、という1対多のリレーションをAWS Amplify Gen2のデータスキーマで実装した。その過程で気づいた設計上のポイントと、実際につまずいた点をまとめる。

## やりたかったこと

- `Quiz` モデル: クイズの本文（`content`）と種明かし（`description`）を持つ
- `Choice` モデル: `Quiz` に紐づく選択肢。1つの`Quiz`に対して複数の`Choice`が存在する（1対多）

## 最初に書いたスキーマとその問題点

最初に書いたスキーマは以下のような内容だった。

```ts
Quiz: a
  .model({
    content: a.string().required(),
    description: a.string().required(),
    choices: a.hasMany("Choice", "quizId")
  })
  .authorization((allow) => [allow.owner()]),

Choice: a
  .model({
    quizId: a.string().required(),
    quiz: a.belongsTo("Quiz", "quizId"),
    content: a.string().required(),
    is_boolean: a.boolean().required(),
  })
  .authorization((allow) => [allow.owner()]),
```

この状態には、大きく2つの問題があった。

### 問題1: 外部キーフィールドの型

`belongsTo` 側の外部キー（`quizId`）を `a.string()` にしていたが、Amplifyの公式ドキュメントのリレーション定義例では `a.id()` を使うようになっている。

参考: [Model one-to-many relationships | AWS Amplify Docs](https://docs.amplify.aws/react/build-a-backend/data/data-modeling/relationships/#model-one-to-many-relationships)

### 問題2: 認可設定の不整合

`defineData` 側の `defaultAuthorizationMode` は `"apiKey"` にしていたにもかかわらず、各モデルの `authorization()` には `allow.owner()` を指定していた。`owner()` ベースの認可はユーザー認証（Cognitoなど）が前提のルールであり、APIキー認証だけの構成とは噛み合わない。

### 解決方法

外部キーの型を `a.id()` に変更し、認可ルールも `defaultAuthorizationMode` に合わせて `allow.publicApiKey()` に統一した。

```ts
Quiz: a
  .model({
    content: a.string().required(),
    description: a.string().required(),
    choices: a.hasMany("Choice", "quizId")
  })
  .authorization((allow) => [allow.publicApiKey()]),

Choice: a
  .model({
    quizId: a.id(),
    quiz: a.belongsTo("Quiz", "quizId"),
    content: a.string().required(),
    answer: a.boolean().required(),
  })
  .authorization((allow) => [allow.publicApiKey()]),
```

（`is_boolean` は「何のbooleanか」が名前から読み取れなかったため、正解/不正解を表すという意味で `answer` にリネームした）


### リレーションを持つデータ作成の手順

`Quiz` と `Choice` はモデルが分かれているため、AppSyncの自動生成APIでは1回のmutationで両方をまとめて作ることはできない。GUIから手動でテストデータを作る場合は、次の2段階の手順が必要だった。

1. `createQuiz` を実行し、生成された `Quiz` の `id` を控える
2. その `id` を `quizId` として指定しながら、`createChoice` を選択肢の数だけ実行する

## まとめ

- Amplifyのリレーション定義では、外部キーフィールドは `a.id()` を使う
- `authorizationModes` のデフォルトと、各モデルの `authorization()` で指定する認可ルールは一致させる必要がある
- 1対多のリレーションは、自動生成APIでは親子を1回のmutationでまとめて作成できないため、フロントエンド側で「親を作る→IDを使って子を作る」という順序の処理を組む必要がある

## 参考

- [Model one-to-many relationships | AWS Amplify Docs](https://docs.amplify.aws/react/build-a-backend/data/data-modeling/relationships/#model-one-to-many-relationships)
