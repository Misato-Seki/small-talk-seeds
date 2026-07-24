# レビューモード中に選択肢をクリックできないようにする実装で詰まったこと

「雑談のタネ🌱」のクイズ画面で、「答えを見る👀」を押した後(`isReviewMode`が`true`の状態)は、選択肢をクリックしても選択状態が変わらないようにする機能を実装した。単純な機能に見えたが、実装の途中で何度か手戻りがあったので、その過程をまとめる。

## やりたかったこと

- `isReviewMode`が`true`の間は、選択肢をクリックしても選択状態(`selectedChoiceIDs`)が変わらないようにする
- 見た目上も「押せない」ことが伝わるようにする(カーソルやhoverの見た目)

## 1. stateを引数で渡そうとして、呼び出し側の更新を忘れた

最初に試したのは、選択状態を更新する関数`storeSelectedChoiceIDs`に`isReviewMode`を引数として渡す方法だった。

```tsx
function storeSelectedChoiceIDs(choiceId: string, isReviewMode: boolean) {
  // ...
}
```

### 起きた問題

関数のシグネチャ(引数)を変えたのに、呼び出し側の`onClick`は直し忘れていた。

```tsx
onClick={() => {
  storeSelectedChoiceIDs(choice.id); // 引数が1つ足りない
}}
```

### 原因

`storeSelectedChoiceIDs`は`QuizPage`コンポーネントの中で定義されている関数で、`isReviewMode`もその同じコンポーネントの`state`として存在する。つまり、わざわざ引数で渡さなくても、クロージャ(関数が定義されたスコープの変数をそのまま参照できる仕組み)によって`isReviewMode`を直接参照できる状態だった。引数として渡す設計にしたことで、呼び出し側にも変更が波及し、直し忘れが起きた。

### 解決方法

引数で渡すのをやめて、関数内で`isReviewMode`を直接参照する形にした。

```tsx
function storeSelectedChoiceIDs(choiceId: string) {
  if (isReviewMode) {
    return;
  }

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

呼び出し側は元のまま(`storeSelectedChoiceIDs(choice.id)`)で済むようになり、引数の渡し忘れという問題自体が起きなくなった。

なお、早期リターン(`if (isReviewMode) return;`)を関数の一番先頭に置くこともポイントだった。最初は`hasChoiceId`の計算を先に書いてから`isReviewMode`をチェックしていたが、これだと`isReviewMode`が`true`のときに無駄な計算が実行されてしまう。先頭でチェックすることで「レビューモード中は何もしない」という意図も読みやすくなった。

## 2. クリックを無効化しても、見た目はクリックできそうなままだった

関数側でクリックを無効化しても、選択肢の`div`には常に`cursor-pointer`や`hover:bg-gray-100`、`active:translate-y-px`が付いたままだった。

```tsx
className={`border rounded-xl p-3 mb-4 hover:bg-gray-100 active:translate-y-px cursor-pointer ...`}
```

### 起きた問題

動作としては選択できなくなっているのに、見た目はカーソルが指マークになったり、hoverで色が変わったりして「押せそう」に見えてしまい、動作と見た目が一致していなかった。

### 解決方法

これらのクラスも`isReviewMode`によって出し分けるようにした。

```tsx
className={`border rounded-xl p-4 mb-4 ${!isReviewMode ? "hover:bg-gray-100 active:translate-y-px cursor-pointer" : ""} ...`}
```

## 3. 同じ条件を呼び出し側と関数の中で二重にチェックしていた

選択肢の色分けを行う`getChoiceColorClass`は、呼び出し側ですでに`isReviewMode`をチェックしたうえで呼ばれている。

```tsx
${isReviewMode ? getChoiceColorClass(choice.id, choice.answer) : ""}
```

### 起きた問題

見た目の調整をしている途中で、`getChoiceColorClass`の中にも`isReviewMode`のチェックを追加してしまった。

```tsx
function getChoiceColorClass(choiceId: string, choiceAnswer: boolean) {
  if (!isReviewMode) return; // 呼び出し側とチェックが重複している
  // ...
}
```

### 原因

呼び出し側で`isReviewMode`がtrueのときしかこの関数を呼んでいないため、関数内の`if (!isReviewMode) return;`は実質的に到達しない分岐になっていた。同じ条件を「呼び出す前」と「関数の中」の両方でチェックしてしまい、責務が分散していた。

### 解決方法

「レビューモードかどうかの判定」は呼び出し側にすでにあるので、関数の中からは重複したチェックを取り除いた。`getChoiceColorClass`は色分けのロジックだけに専念させ、呼ぶかどうかの判断は呼び出し側に一本化した。

## まとめ

- コンポーネント内で定義した関数からは、同じコンポーネントの`state`をクロージャで直接参照できる。無理に引数で渡すと、シグネチャ変更のたびに呼び出し側の修正漏れが起きやすくなる
- 早期リターンは関数の先頭に置くと、無駄な処理を避けられ、かつ「こういう場合は何もしない」という意図も伝わりやすい
- 動作(クリックできるかどうか)と見た目(カーソルやhoverの変化)は連動させないと、ユーザーに誤解を与える
- 同じ条件を呼び出し側と関数の中の両方でチェックしていないか、責務がどちらにあるべきかを意識する
