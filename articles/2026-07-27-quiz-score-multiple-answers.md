# 正解数の表示と複数正答問題への対応で詰まったこと

「雑談のタネ🌱」のクイズ画面で、`isFinished`になったタイミングで正解数を表示する機能を実装した。問題によっては正解の選択肢が複数あるケースも想定されており、その判定ロジックを組み立てる過程でいくつか詰まったので、その過程をまとめる。

## やりたかったこと

- クイズが全問終わった(`isFinished`が`true`になった)タイミングで、何問正解したかを表示する
- 選択肢が複数正解になっている問題にも対応できる判定にする

## 1. 「複数正解の問題」で何をもって正解とするかを決める必要があった

実装を始める前に、そもそも複数正解がある問題の「正解」をどう定義するかという設計判断が必要だった。候補として

- 完全一致: 正解の選択肢セットとユーザーが選んだ選択肢セットが完全に一致したときのみ正解
- 部分一致: 選んだ中で合っていた数 / 正解の総数で部分点を出す
- 緩い基準: 正解に1つでも含まれていればOK

の3つを検討し、今回はシンプルさを優先して「完全一致」方式を採用することにした。この判断がないまま実装を始めると、判定ロジックの途中で「これはどう扱うんだっけ」と迷うことになるので、先に方針を決めてから手を動かすようにした。

## 2. `choices`と`selectedChoiceIDs`をどう比較するか

完全一致を判定するには、以下の2つの集合を比較する必要がある。

- `displayedQuiz.choices`のうち`answer === true`なものの`id`一覧(正解セット)
- `selectedChoiceIDs`(ユーザーが選んだセット)

配列のまま`includes`などで比較すると順序や重複の影響を受けやすいため、両方とも`Set`に変換してから比較する方針にした。

```tsx
function checkAnswer() {
  const answerSet = new Set<string>();
  displayedQuiz?.choices.forEach((choice) => {
    if (choice.answer === true) answerSet.add(choice.id);
  });
  const userChoicesSet = new Set(selectedChoiceIDs);
  // ここから比較処理
}
```

## 3. `Set.has()`に配列をそのまま渡してエラーになった

完全一致の判定として、最初は次のようなコードを書いた。

```tsx
if (
  answerSet.size === userChoicesSet.size &&
  userChoicesSet.has([...answerSet])
) {
  setScore(score + 1);
}
```

### 起きた問題

`Argument of type 'any[]' is not assignable to parameter of type 'string'.`という型エラーが発生した。

### 原因

`Set.has(value)`は「1つの値がそのSetに含まれているか」を調べるメソッドで、値は要素そのもの(この場合は`string`)を渡す必要がある。`[...answerSet]`は`Set`を配列に展開したもの(`string[]`)なので、「配列という1つの値」を`has()`に渡してしまっていた。`has()`は集合同士の包含関係を調べるメソッドではないため、これでは意図した判定にならない。

### 解決方法

「配列の各要素それぞれについて、もう片方のSetに含まれているか」を確認する必要があるため、配列の全要素が条件を満たすかを判定する[`Array.prototype.every()`](https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/Array/every)を使った。

```tsx
if (
  answerSet.size === userChoicesSet.size &&
  [...answerSet].every((currentValue) => userChoicesSet.has(currentValue))
) {
  setScore(score + 1);
}
```

`size`が同じであることと、`answerSet`の全要素が`userChoicesSet`にも含まれていることの両方を確認することで、過不足のない完全一致判定になる。

## 4. `Set`のスプレッド構文がTypeScriptの設定でエラーになった

`.every()`に置き換えた後、今度は`[...answerSet]`の部分で別のエラーが出た。

```
Type 'Set<string>' can only be iterated through when using the '--downlevelIteration' flag or with a '--target' of 'es2015' or higher.
```

### 原因

`tsconfig.json`を確認すると`"target": "es5"`になっていた。

```json
{
  "compilerOptions": {
    "target": "es5",
    // ...
  }
}
```

`Set`はES2015で導入された反復可能(iterable)なオブジェクトで、スプレッド構文(`[...set]`)や`for...of`でこれを展開するには、TypeScriptがES2015以降を前提としたコード変換をする必要がある。`target`が`es5`だとその変換方法が使えず、エラーになっていた。

### 解決方法

`tsconfig.json`の`target`を上げる方法もあるが、プロジェクト全体の設定に影響するため、今回はコード側で回避することにした。[`Array.from()`](https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/Array/from)はスプレッド構文とは異なるコード変換経路で処理されるため、`target: es5`のままでもこの制約に引っかからずに`Set`を配列化できる。

```tsx
if (
  answerSet.size === userChoicesSet.size &&
  Array.from(answerSet).every((currentValue) => userChoicesSet.has(currentValue))
) {
  setScore(score + 1);
}
```

## まとめ

- 複数正解がある問題を扱う場合、「完全一致・部分点・緩い基準」など正解の定義を実装前に決めておくと、判定ロジックの途中で迷わない
- `Set.has(value)`は単一要素の包含チェック用。集合同士を比較したいときは、片方を配列化して`every()`などで各要素をチェックする必要がある
- `Set`のスプレッド構文(`[...set]`)や`for...of`は、TypeScriptの`target`がES5だとエラーになることがある。`Array.from()`はこの制約を受けずに`Set`を配列化できる
