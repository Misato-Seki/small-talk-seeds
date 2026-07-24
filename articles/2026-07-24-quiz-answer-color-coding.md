# クイズの正誤判定「色分け」機能を実装するまでに詰まったこと

「雑談のタネ🌱」のクイズ画面で、「答えを見る👀」ボタンを押したときに、選んだ選択肢が正解なら緑・不正解なら赤で色をつけ、正解の選択肢も分かるように色分けする機能を実装した。この機能を作る過程でいくつか詰まったので、その内容をまとめる。

## やりたかったこと

- ユーザーが選択肢をクリックすると、選んだ状態を覚えておく
- 「答えを見る👀」ボタンを押したら、選んだ選択肢ごとに次のルールで色をつける
  - 選んだ & 正解 → 緑
  - 選んだ & 不正解 → 赤
  - 選んでいない & 正解 → 緑（正解を示す）
  - 選んでいない & 不正解 → 色なし

## 1. 選んだ選択肢を配列stateで覚えておく

まず、クリックされた選択肢のIDを配列で管理する処理を実装した。ここで`Array.prototype.push()`の戻り値の勘違いと、Reactのstateを直接書き換えてしまう(mutateする)ミスの2つが重なって詰まった。この部分は別記事にまとめてあるので、詳細はそちらを参照。

→ [Reactのstate更新で配列にpush()を使ったら選択状態がおかしくなった件](./2026-07-23-array-state-push-vs-spread.md)

最終的には、追加は`[...selectedChoiceIDs, choiceId]`、削除は`selectedChoiceIDs.filter(...)`のように、常に新しい配列を作って`setSelectedChoiceIDs`に渡す形で解決した。

```tsx
function storeSelectedChoiceIDs(choiceId: string) {
  const hasChoiceId = selectedChoiceIDs.includes(choiceId);
  if (hasChoiceId) {
    const newIds: Array<string> = selectedChoiceIDs.filter(
      (id) => id !== choiceId,
    );
    setSelectedChoiceIDs(newIds);
  } else {
    setSelectedChoiceIDs([...selectedChoiceIDs, choiceId]);
  }
}
```

## 2. 色分けクラスを組み立てる処理でテンプレートリテラルと オブジェクトリテラルを混同した

選んだかどうか(`selectedChoiceIDs`)と、正解かどうか(`choice.answer`)の組み合わせから、Tailwindのクラス名を返す関数を用意した。

```tsx
function getChoiceColorClass(choiceId: string, choiceAnswer: boolean) {
  if (choiceAnswer === false && !selectedChoiceIDs.includes(choiceId)) {
    return "text-gray-400 border-gray-400";
  } else if (
    choiceAnswer === false &&
    selectedChoiceIDs.includes(choiceId)
  ) {
    return "border-red-400 bg-red-400/25";
  } else {
    return "border-green-400 bg-green-400/25";
  }
}
```

この関数を、選択肢の`className`をテンプレートリテラルで組み立てている箇所から呼び出そうとした。

### 起きた問題

以下のように書いたところ、`getChoiceColorClass`に`choice.id`と`choice.answer`を渡せず、エラーになった。

```tsx
className={`border rounded-xl p-3 mb-3 ${
  isReviewMode ? {getChoiceColorClass(choice.id, choice.answer)} : ""
}`}
```

### 原因

JSXの中で式を評価してはめ込む書き方(`{式}`)と、テンプレートリテラルの中で式を評価してはめ込む書き方(`${式}`)を混同していた。

すでに`${ }`の中にいるので、その中はただのJavaScript/TypeScriptの式として評価される。そこにさらに`{ }`を書くと、JSXのような「式をはめ込む中括弧」としては扱われず、**オブジェクトリテラルを作ろうとしている**と解釈されてしまう。

つまり`{getChoiceColorClass(choice.id, choice.answer)}`は「関数を引数付きで呼び出す式」ではなく、「`{ }`というオブジェクトの中に、プロパティとして関数呼び出しを書こうとしている」という、文法的におかしい書き方になっていた。

### 解決方法

`${ }`の中はすでに式が評価される場所なので、余計な`{ }`を外し、関数呼び出しをそのまま書くだけでよかった。

```tsx
className={`border rounded-xl p-3 mb-3 ${
  isReviewMode ? getChoiceColorClass(choice.id, choice.answer) : ""
}`}
```

## まとめ

- `Array.prototype.push()`の戻り値は追加後の配列の**長さ(数値)**であり、配列そのものではない。Reactのstateを配列で持つ場合は、`push()`のような破壊的メソッドを避け、スプレッド構文や`filter()`で新しい配列を作って`set〇〇`に渡す(詳細は[別記事](./2026-07-23-array-state-push-vs-spread.md)を参照)
- JSXの`{式}`とテンプレートリテラルの`${式}`は役割が似ているが別物。テンプレートリテラルの`${ }`の中はすでに式を評価する文脈なので、関数呼び出しなどをそのまま書けばよく、さらに`{ }`で囲む必要はない
- `{ }`を式の中に単体で書くと、JavaScript/TypeScriptは基本的に「オブジェクトリテラル」として解釈しようとするため、意図しない書き方になっていないか注意が必要
