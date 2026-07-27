# クイズページで「1問ずつ表示」を実装するときにハマったこと

## やりたかったこと

クイズページ（`app/quiz/page.tsx`）では、もともとDBから取得した全クイズを`quizzes.map(...)`で一覧表示していた。これを、

- 1問だけ表示する
- 「次の問題」ボタンで次のクイズに進める
- 最後の問題まで到達したら終了画面を出す

という形に変更したかった。実装の過程で、大きく2つのポイントでハマったので、それぞれ「起きた問題」「原因」「解決方法」をまとめる。

## ハマったポイント1: 非同期データとstate更新のタイミング

### 起きた問題

「今表示中の1問」を管理するために`displayedQuiz`というstateを新しく追加した。

```ts
const [quizzes, setQuizzes] = useState<Array<QuizWithChoices>>([]);
const [displayedQuiz, setDisplayedQuiz] = useState<QuizWithChoices | null>(
  quizzes.length > 0 ? quizzes[0] : null,
);
```

一見良さそうだが、実際に動かすと`displayedQuiz`がずっと`null`のままになり、クイズが表示されなかった。

### 原因

`useState`の初期値は、コンポーネントが最初にマウントされた瞬間の1回だけ評価される。この時点では`quizzes`はまだ`[]`（空配列）で、実際のクイズデータは`client.models.Quiz.observeQuery(...).subscribe(...)`を通じて**非同期**に届く。つまり、

```ts
function listQuizzes() {
  client.models.Quiz.observeQuery({ ... }).subscribe({
    next: (data) => setQuizzes([...data.items]),
  });
}
```

の`next`コールバックが呼ばれるのは、初回レンダーよりずっと後。`displayedQuiz`の初期値を決めるタイミングでは、まだ本物のデータが存在しない。

### 試行錯誤

いくつかの誤った直し方を試した。

1. **`useEffect`の中で`insertDisplayedQuiz(quizzes)`を呼ぶ**

   ```ts
   useEffect(() => {
     listQuizzes();
     insertDisplayedQuiz(quizzes);
   }, []);
   ```

   これも同じタイミングの問題が起きる。`listQuizzes()`を呼んだ直後に`quizzes`を参照しても、データが届く前なので依然として空配列。さらに依存配列が`[]`なので、このeffect自体もマウント時に1回しか実行されない。

2. **`listQuizzes`を`async`にして`await`を使う**

   ```ts
   async function listQuizzes() {
     client.models.Quiz.observeQuery({ ... }).subscribe({
       next: (data) => setQuizzes([...data.items]),
     });
     await setDisplayedQuiz(quizzes.length > 0 ? quizzes[0] : null);
   }
   ```

   `await`が効果を持つのは右辺が**Promiseを返す場合**だけ。`setDisplayedQuiz(...)`はReactのstate更新関数でPromiseを返さないし、`.subscribe(...)`自体も「データが届いたらコールバックを呼ぶ」という登録をしてすぐ処理を返すだけなので、関数を`async`にしても待ち時間は生まれない。

3. **`subscribe`に渡すオブジェクトに`next`キーを2つ書く**
   ```ts
   .subscribe({
     next: (data) => setQuizzes([...data.items]),
     next: (data) => setDisplayedQuiz(data.items.length > 0 ? data.items[0] : null),
   });
   ```
   JavaScriptのオブジェクトリテラルで同じキーを2つ書くと、後に書いた方だけが有効になり前のものは上書きされて消える。この場合`setQuizzes`を呼ぶ方の`next`が消えてしまい、`quizzes`自体が更新されなくなる。

### 解決方法

「新しいデータが届いた瞬間」に必要な処理（`setQuizzes`と`setDisplayedQuiz`の両方）をまとめて実行する関数を1つ作り、`subscribe`の`next`コールバックはその関数を呼ぶだけにした。

```ts
function insertQuizzes(quizzes: Array<QuizWithChoices>) {
  if (quizzes.length > 0) {
    setQuizzes(quizzes);
    setDisplayedQuiz(quizzes[0]);
  } else {
    setQuizzes([]);
    setDisplayedQuiz(null);
  }
}

function listQuizzes() {
  client.models.Quiz.observeQuery({
    selectionSet: ["id", "content", "description", "choices.*"],
  }).subscribe({
    next: (data) => insertQuizzes([...data.items]),
  });
}
```

ポイントは、「実際に新しいデータが手に入るのは`next`コールバックの中だけ」という前提に合わせて、更新したいstateを全部そこから更新するようにしたこと。外側の`quizzes`変数（古い値を参照し続ける可能性がある）に頼らず、コールバックの引数`data.items`（届いたばかりの最新データ）を直接使うようにした。

## ハマったポイント2: 最後の問題に到達したときの処理

「次の問題」ボタンを押したとき、配列の最後を超えてしまうケースをどう扱うか（ループする／止める／終了画面を出す）を決める必要があった。今回は「終了画面を出す」を選択し、`isFinished`というstateを追加して対応した。

```ts
function incrementDisplayedQuiz() {
  const currentIndex = quizzes.findIndex(
    (quiz) => quiz.id === displayedQuiz?.id,
  );
  if (currentIndex === quizzes.length - 1) {
    setIsFinished(true);
    return;
  } else {
    const nextIndex = currentIndex + 1;
    setDisplayedQuiz(quizzes[nextIndex]);
  }
}
```

JSX側は、`isFinished`の真偽値で「終了メッセージ」と「クイズ表示」を出し分ける形にした。

## まとめ

- `useState`の初期値や`useEffect`の依存配列は「いつ評価されるか」を意識しないと、非同期データと噛み合わずstateが更新されないバグを生みやすい
- 非同期処理まわりのstate更新は、「新しいデータが手に入った場所」でまとめて行うのが安全
- `async`/`await`は右辺がPromiseを返す場合にしか意味を持たない
- オブジェクトリテラルで同じキーを重複させると後勝ちで前が消える
- 深くネストした括弧は、エディタの括弧ハイライト機能を使って対応関係を確認すると構文エラーを見つけやすい
