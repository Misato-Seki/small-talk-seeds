# Amplify Gen2で入れ子構造のデータ(hasManyリレーション)を取得してUIに表示するまで

「雑談のタネ🌱」では、1つの`Quiz`が複数の`Choice`(選択肢)を持つ1対多のリレーションになっている([2026-07-19の記事](2026-07-19-amplify-relational-data-modeling.md)参照)。このリレーション先のデータを、実際に画面(`app/page.tsx`)に表示するまでにいくつもつまずいたので、その過程をまとめる。

## やりたかったこと

- `client.models.Quiz`から取得した各クイズについて、紐づく`Choice`(選択肢)も一緒に取得したい
- 将来的に複数人が同時にアクセスする可能性があるため、1回きりの取得ではなくリアルタイム購読(`observeQuery`)を使いたい
- 取得したデータをReactのstateに入れて、JSXの`map`で画面に表示したい

## つまずいた点1: `quiz.choices`はそのままでは表示できない

最初、以下のようにJSXへ直接書いていた。

```tsx
<p><strong>選択肢:</strong> {quiz.choices}</p>
```

`Quiz`モデルのスキーマは以下の通りで、`choices`は単純な文字列や配列のフィールドではなく`hasMany`のリレーションだった。

```ts
Quiz: a
  .model({
    content: a.string().required(),
    description: a.string().required(),
    choices: a.hasMany("Choice", "quizId")
  })
```

Amplify Gen2では、`hasMany`で定義したフィールドは「呼び出すと関連データを取得できる関数(lazy loader)」になっており、クエリ結果に最初からデータが入っているわけではない。ここを理解していなかったため、単純にフィールドとして参照しても意図したデータは出てこなかった。

## つまずいた点2: lazy load か eager load か

Amplifyのドキュメントには関連データの取得方法が2種類あることが書かれている。

- **Lazy load**: `await quiz.choices()` のように、取得後に個別にリクエストする
- **Eager load**: 最初のクエリに `selectionSet` オプションを渡して、1回のリクエストでまとめて取得する

参考: [Model relationships | AWS Amplify Docs](https://docs.amplify.aws/react/build-a-backend/data/data-modeling/relationships/)

今回は`observeQuery`のコールバック(`next`)が同期関数のため、`await`を使うLazy loadは相性が悪い。そのため`selectionSet`によるEager loadを選んだ。

## つまずいた点3: 非同期処理をどこに置くか

`selectionSet`に切り替える前段階で、いったん一次取得用に`list()`を試した際、コンポーネント関数自体を`async`にしてトップレベルで`await`しようとしてしまった。

```tsx
export default async function App() {
  const { data: quizzesData } = await client.models.Quiz.list();
  setQuizzes(quizzesData);
  // ...
}
```

これには2つ問題があった。

1. クライアントコンポーネント(`"use client"`)の関数自体を`async`にすることはサポートされていない
2. `useEffect`の外でstate更新(`setQuizzes`)を直接呼んでいるため、レンダリングのたびに実行され無限ループになる

`observeQuery`は元々Promiseを返さず`.subscribe()`で購読する形式なので、`async`関数を用意する必要はなく、既存の`useEffect(() => { listQuizzes() }, [])`のパターンに`.subscribe()`を組み合わせれば良かった。

## つまずいた点4: `selectionSet`の書き方の間違い

`selectionSet`を導入する際、最初は渡す場所を間違えた。

```tsx
// NG: selectionSetを subscribe() に渡してしまっている
client.models.Quiz.observeQuery().subscribe(
  { selectionSet: ['id', 'content', 'description', 'choice.*'] },
  { next: (data) => setQuizzes([...data.items]) }
);
```

`selectionSet`は「何を取得するか」を指定するオプションなので、クエリを発行する`observeQuery()`自体の引数として渡す必要があった。また、`choice.*`と単数形で書いていたが、スキーマ上のフィールド名は`choices`(複数形)だったため、正しくは`choices.*`。

```tsx
// OK
client.models.Quiz.observeQuery(
  { selectionSet: ['id', 'content', 'description', 'choices.*'] }
).subscribe({
  next: (data) => setQuizzes([...data.items]),
});
```

## つまずいた点5: TypeScriptの型エラー

`selectionSet`で絞り込んだ結果は、`Schema["Quiz"]["type"]`(モデルの全フィールドを持つ型)とは形が異なる。そのため、`useState<Array<Schema["Quiz"]["type"]>>`で宣言していたstateにそのまま代入しようとすると型エラーになった。

存在しない型名を仮でその場に書いてしまい(`(data: quizzesWithChoices) => ...`)、当然ながら「そんな型は無い」というエラーになったこともあった。

正しくは、Amplifyが提供する`SelectionSet`ユーティリティ型を使って、`selectionSet`の内容から絞り込み後の型を導出する。

```tsx
import type { SelectionSet } from 'aws-amplify/data';

const selectionSet = ['id', 'content', 'description', 'choices.*'] as const;
type QuizWithChoices = SelectionSet<Schema['Quiz']['type'], typeof selectionSet>;

const [quizzes, setQuizzes] = useState<QuizWithChoices[]>([]);

function listQuizzes() {
  client.models.Quiz.observeQuery({ selectionSet }).subscribe({
    next: (data) => setQuizzes([...data.items]),
  });
}
```

`selectionSet`を配列リテラルとして`as const`付きの定数に切り出し、`observeQuery`とstateの型宣言の両方で同じ定数を参照することで、実際に取得するフィールドと型定義がずれなくなる。

参考: [Query data | AWS Amplify Docs](https://docs.amplify.aws/react/build-a-backend/data/query-data/)

## まとめ

- `hasMany`のリレーションフィールドは、クエリ結果にそのままデータが入っているわけではない(lazy loader)
- 関連データの取得は「Lazy load(個別に呼び出す)」と「Eager load(`selectionSet`でまとめて取得)」の2通りがあり、非同期コールバックの形式によって選びやすさが変わる
- `selectionSet`は`get`だけでなく`list`・`observeQuery`など読み取り系の操作全般で使える。ただし渡す場所は「クエリを発行する関数の引数」であり、`.subscribe()`ではない
- `selectionSet`で絞り込んだ結果をTypeScriptで安全に扱うには、`aws-amplify/data`の`SelectionSet`ユーティリティ型を使い、`selectionSet`定数から型を導出する

## 参考

- [Model relationships | AWS Amplify Docs](https://docs.amplify.aws/react/build-a-backend/data/data-modeling/relationships/)
- [Query data | AWS Amplify Docs](https://docs.amplify.aws/react/build-a-backend/data/query-data/)
