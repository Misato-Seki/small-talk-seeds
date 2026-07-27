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
    "target": "es5"
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
  Array.from(answerSet).every((currentValue) =>
    userChoicesSet.has(currentValue),
  )
) {
  setScore(score + 1);
}
```

## 5. スコア判定はフロントエンドでやってよかったのか

実装が終わった後、そもそもこの正解判定はフロントエンド(ブラウザ側のJavaScript)でやるべきだったのか、それともバックエンドでやるべきだったのかを検討した。

### 判断基準

フロントエンド/バックエンドどちらで処理すべきかは、主に次の3つの観点で考えるとよい。

1. **改ざんされて困るか(信頼性)**: フロントエンドのコードはユーザーがブラウザの開発者ツールで見たり書き換えたりできる。ランキングや正式な成績など、不正な結果が許されないものはバックエンド側でも検証が必要
2. **計算に必要なデータが、すでにクライアントに渡っているか**: 正解の情報自体を見せたくない場合は、その情報をフロントに送らず、判定だけをバックエンドに問い合わせる設計にする必要がある。逆に、その情報が既にフロントに丸ごと渡っているなら、フロント側で判定してもセキュリティ上のデメリットは特にない
3. **その結果を後で使う(保存・集計)必要があるか**: 後から見返したり複数人の結果を集計したりする必要があるなら、DBへの保存が絡むためバックエンドが関わってくる

### このアプリに当てはめる

- [quiz/page.tsx:42-43](../app/quiz/page.tsx#L42-L43) の`selectionSet`には`choices.*`が含まれており、その中の`answer`(正解かどうかの真偽値)は、ユーザーが答える**前の時点**で既にブラウザに届いている。つまり正解情報は既にクライアントに渡っているため、判定をバックエンドに移してもセキュリティ的なメリットは生まれない
- 「雑談のタネ🌱」のスコアは雑談のきっかけ作りが目的であり、仮に改ざんされても実害はほぼない
- Phase1.5のスコープでは、スコアを後で見返したり集計したりする必要もない

これら3点から、今回フロントエンドで正解判定を実装した判断は妥当だったと結論づけた。

### 代替案とのトレードオフ

より厳密にするなら、「正解の選択肢がどれかという情報自体をクライアントに渡さず、ユーザーが選んだ選択肢が合っているかどうかだけをバックエンドに問い合わせる」という設計にする案も考えられる。これは本格的な採点システムやテストアプリで使われる一般的なパターンである。

ただし今回のアプリでは、レビューモードで結局正解を画面に表示する仕様になっているため、正解を秘匿するメリットはどのみちほぼない。その一方で、選択肢をクリックするたびに(あるいは判定のたびに)API通信が発生する分の実装コストとレイテンシは増える。この用途ではメリットに対してコストが見合わないため、フロントエンドで判定する現状の実装のままでよく、この設計パターンは「将来クイズが競争性を持つ(正式なスコアとして記録される、ランキングが出るなど)フェーズになったときの選択肢」として覚えておく、という結論にした。

## 6. 全問正解したのに正解数が1問少なく表示されるバグ

判定ロジックを実装し終えた後、動作確認をしていたところ、2問とも正解の選択肢を選んだはずなのに、結果画面で「2問中1問正解」と表示されてしまう現象に遭遇した。

### 起きた問題

- 1問目・2問目とも正解の選択肢を選んで進めたのに、`isFinished`になった結果画面のスコアが1問分しか加算されていなかった

### 原因

`incrementDisplayedQuiz`(次の問題に進む処理)を確認すると、`checkAnswer()`で正解判定をした後、`setDisplayedQuiz`で表示するクイズを次に進めているだけで、`selectedChoiceIDs`(ユーザーが選んだ選択肢IDを保持するstate)をリセットしていなかった。

```tsx
function incrementDisplayedQuiz() {
  const currentIndex = quizzes.findIndex(
    (quiz) => quiz.id === displayedQuiz?.id,
  );
  if (currentIndex === quizzes.length - 1) {
    checkAnswer();
    setIsFinished(true);
    return;
  } else {
    checkAnswer();
    const nextIndex = currentIndex + 1;
    setDisplayedQuiz(quizzes[nextIndex]);
  }
}
```

そのため、1問目で選んだ選択肢IDが2問目に進んだ後もstateに残ったままになり、2問目で新たに選択肢をクリックすると「1問目の選択肢ID + 2問目で選んだ選択肢ID」が混ざった状態で`checkAnswer()`の判定対象になっていた。`checkAnswer`は`answerSet.size === userChoicesSet.size`(選択肢の個数の一致)も見ているため、余分なIDが混ざっていると個数が合わなくなり、2問目を正解しても不正解として扱われてしまっていた。

### 解決方法

`incrementDisplayedQuiz`の中で、次の問題に進む(または結果画面に切り替える)前に`selectedChoiceIDs`を空配列にリセットするようにした。

```tsx
function incrementDisplayedQuiz() {
  const currentIndex = quizzes.findIndex(
    (quiz) => quiz.id === displayedQuiz?.id,
  );
  if (currentIndex === quizzes.length - 1) {
    checkAnswer();
    setSelectedChoiceIDs([]);
    setIsFinished(true);
    return;
  } else {
    checkAnswer();
    setSelectedChoiceIDs([]);
    const nextIndex = currentIndex + 1;
    setDisplayedQuiz(quizzes[nextIndex]);
  }
}
```

`checkAnswer()`は「その時点でのselectedChoiceIDs」を使って判定を終えてからリセットしているので、リセットのタイミングを判定処理の直後にすることで、判定への影響なく前の問題の選択状態をクリアできる。

## まとめ

- 複数正解がある問題を扱う場合、「完全一致・部分点・緩い基準」など正解の定義を実装前に決めておくと、判定ロジックの途中で迷わない
- `Set.has(value)`は単一要素の包含チェック用。集合同士を比較したいときは、片方を配列化して`every()`などで各要素をチェックする必要がある
- `Set`のスプレッド構文(`[...set]`)や`for...of`は、TypeScriptの`target`がES5だとエラーになることがある。`Array.from()`はこの制約を受けずに`Set`を配列化できる
- ロジックをフロントエンドとバックエンドのどちらに置くべきかは、「改ざん耐性が必要か」「判定に必要なデータが既にクライアントにあるか」「結果の保存・集計が必要か」の3点で判断する。既にデータがクライアントに渡っていて、改ざんされても実害が小さく、保存の必要もない今回のようなケースでは、フロントエンドでの判定で十分といえる
- 複数問にまたがってユーザーの選択状態を保持するstate(`selectedChoiceIDs`)は、次の問題に進むタイミングで明示的にリセットしないと前の問題の選択が残ってしまう。判定用のstateは「いつクリアすべきか」もセットで設計する必要がある
