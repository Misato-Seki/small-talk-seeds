# クイズ画像の403エラーと、imageUrlのstate管理で詰まったこと

「雑談のタネ🌱」のクイズ画面で、問題に紐づく画像をAmplify Storage(S3)から取得して表示する機能を実装した。まず画像取得自体が403エラーで失敗し、原因調査に時間がかかった。さらに、403エラーを解決した後も、`imageUrl`というstateの管理方法を巡って何度か手戻りが発生した。その過程をまとめる。

## やりたかったこと

- `Quiz`テーブルの`image_key`をもとに、Amplify Storageから画像の署名付きURLを取得する
- 取得したURLを`next/image`の`Image`コンポーネントの`src`に渡して表示する

## 1. 画像取得が403エラーになる

### 起きた問題

`getUrl`でパスを指定して画像URLを取得しようとしたが、実際に画像を読み込もうとすると403エラーになった。

```ts
const linkToStorageFile = await getUrl({
  path: image_key,
});
```

`amplify/storage/resource.ts`のアクセス設定は次の通りで、`media/`配下のみ`guest`(未認証ユーザー)の読み取りを許可していた。

```ts
export const storage = defineStorage({
  name: "smallTalkSeeds",
  access: (allow) => ({
    "media/*": [allow.guest.to(["read"])],
  }),
});
```

このルールに合わせて`path: `media/${image_key}``のように`media/`プレフィックスを付けてみたが、それでも403は解消しなかった。

### 原因

原因は2つあった。

1. **`image_key`に`media/`プレフィックスを付けずにリクエストしていた**ため、アクセスルールが許可している範囲(`media/*`)の外にリクエストしていた
2. プレフィックスを付けても403が続いた本当の理由は、**S3バケット上に`media/`フォルダ自体を作らず、画像をバケット直下にアップロードしていた**ため。パスの形式(`media/xxx.png`)は正しくても、S3上に実在するキーとは一致していなかった

### 解決方法

S3コンソールで`media/`フォルダを作成し、その中に画像をアップロードし直したところ、画像が正しく表示されるようになった。パス指定は`path: image_key`(呼び出し側では`image_key`自体に`media/`を含めない)のままで、DB側の値とS3側の実際の格納場所を一致させることが解決の本質だった。

## 2. `next/image`が「srcが無い」という警告を出す

画像は表示されるようになったが、ブラウザのコンソールに以下の警告が出ていた。

```
Image is missing required "src" property
```

### 起きた問題

`Image`コンポーネントの描画条件が`displayedQuiz.image_key`(クイズ読み込み時から存在する値)になっていた一方、実際に`src`へ渡す`imageUrl`は非同期で取得するstateで、初期値は空文字列`""`だった。

```tsx
const [imageUrl, setImageUrl] = useState<string>("");
// ...
{
  displayedQuiz.image_key && (
    <Image src={imageUrl} alt="問題画像" height={500} width={500} />
  );
}
```

### 原因

`image_key`が存在する(=これから画像URLが手に入る予定)ことと、`imageUrl`が実際に描画に使える値になっている(=もう手に入っている)ことは別の状態なのに、前者だけで描画可否を判定していた。そのため、`useEffect`による非同期取得が完了する前の一瞬、`src=""`のまま`Image`がマウントされ、警告が出ていた。

### 解決方法

描画条件を`image_key`ではなく`imageUrl`自体があるかどうかに変更した。

```tsx
{
  imageUrl && <Image src={imageUrl} alt="問題画像" height={500} width={500} />;
}
```

## 3. 前の問題の画像が残ってしまう問題と、リセット処理の置き場所探し

`imageUrl`の描画条件を直したことで、今度は「次の問題に進んだ瞬間、前の問題の画像が残ってしまう(特に次の問題に画像が無い場合、ずっと残り続ける)」という別の問題が見えてきた。この`imageUrl`を「いつリセットすべきか」の置き場所を巡って、何度か手戻りが発生した。

### 試行錯誤1: 「次の問題」ボタンのonClickでリセット

```tsx
onClick={() => {
  incrementDisplayedQuiz();
  toggleMode();
  setImageUrl("");
}}
```

React 18の自動バッチングにより、同じイベントハンドラ内の`setState`はまとめて1回の再描画になるため、動作自体はした。しかし、リセットのルールが「特定のボタンの実装」に紐づいてしまい、`displayedQuiz`が変わる別の経路(後述のバックエンド更新など)ではリセットされない、という抜け漏れが残っていた。

### 試行錯誤2: `incrementDisplayedQuiz`関数の中に移動

呼び出し元(ボタン)ではなく、`displayedQuiz`を更新している関数自体にリセット処理を持たせた。

```tsx
function incrementDisplayedQuiz() {
  // ...
  if (currentIndex === quizzes.length - 1) {
    checkAnswer();
    setSelectedChoiceIDs([]);
    setImageUrl("");
    setIsFinished(true);
    return;
  } else {
    checkAnswer();
    setSelectedChoiceIDs([]);
    setImageUrl("");
    const nextIndex = currentIndex + 1;
    setDisplayedQuiz(quizzes[nextIndex]);
  }
}
```

これで「次の問題」ボタン経由の遷移はカバーできたが、`displayedQuiz`は`observeQuery`(バックエンドのデータ変更をリアルタイムに検知する仕組み)経由の`insertQuizzes`関数でも更新されており、そちらの経路は依然カバーできていなかった。同じ3行(`checkAnswer(); setSelectedChoiceIDs([]); setImageUrl("");`)が2箇所に重複している点も気になっていた。

### 試行錯誤3: マウント時の`useEffect`内、`listQuizzes()`の直後に配置

「バックエンド更新を検知するのはここのはず」と考え、`listQuizzes()`を呼んでいる`useEffect`の中に置いてみた。

```tsx
useEffect(() => {
  listQuizzes();
  setImageUrl("");
}, []);
```

### 起きた問題

依存配列が`[]`のこの`useEffect`自体は**マウント時に1回しか実行されない**。`listQuizzes()`が内部で開始しているのは購読(`subscribe`)であり、実際にバックエンドの更新を検知して`insertQuizzes`(→`setDisplayedQuiz`)を呼んでいるのは、`subscribe`に渡した`next`コールバックの方だった。

```tsx
function listQuizzes() {
  client.models.Quiz.observeQuery({/* ... */}).subscribe({
    next: (data) => insertQuizzes([...data.items]),
  });
}
```

「`useEffect`の中に書いたから、データ更新のたびに実行される」と考えたのが誤りで、実質`useState("")`の初期値と変わらない、何の意味もない配置になっていた。

### 試行錯誤4: `insertQuizzes`関数の中に移動

`setDisplayedQuiz`を実際に呼んでいる場所である`insertQuizzes`にリセット処理を移した。

```tsx
function insertQuizzes(quizzes: Array<QuizWithChoices>) {
  if (quizzes.length > 0) {
    setQuizzes(quizzes);
    setDisplayedQuiz(quizzes[0]);
    setImageUrl("");
  } else {
    setQuizzes([]);
    setDisplayedQuiz(null);
    setImageUrl("");
  }
}
```

これでバックエンド更新経由の抜け漏れは解消したが、今度は「リセットする処理(`insertQuizzes`・`incrementDisplayedQuiz`)」と「再取得する処理(`image_key`の変化を見ている`useEffect`)」が別の場所に分かれてしまっていることが問題として残った。もし`observeQuery`が発火しても`quizzes[0]`の`image_key`が前と変わらない場合、`setImageUrl("")`は実行されるのに、`image_key`を依存配列に持つ`useEffect`は値が変化していないため再発火せず、画像が消えたまま二度と表示されなくなる、という新しいバグの芽があった。

### 解決方法: リセットと再取得を1箇所(image_keyを見るuseEffect)に統合

最終的に、「`image_key`が変わったらリセットしてから取得しに行く」という一連の処理を、`image_key`の変化を検知する`useEffect`自身の中にまとめた。

```tsx
useEffect(() => {
  setImageUrl("");
  if (displayedQuiz?.image_key) getImageUrl(displayedQuiz.image_key);
}, [displayedQuiz?.image_key]);
```

そのうえで、`incrementDisplayedQuiz`や`insertQuizzes`に個別に書いていた`setImageUrl("")`はすべて削除した。`displayedQuiz`を更新する経路がボタン経由でもバックエンド更新経由でも、最終的に`image_key`という1つの値の変化としてこの`useEffect`に集約されるため、更新経路ごとにリセット処理を書き忘れる/重複させる心配がなくなった。

### 原因(振り返り)

一連の手戻りの根本原因は、「`imageUrl`をリセットする」という責務を、**「`displayedQuiz`を更新している複数の場所」に個別に持たせようとしていた**ことだった。`displayedQuiz`の更新経路は「次の問題ボタン」と「バックエンドのobserveQuery更新」の2つあり、更新経路が増えるたびにリセット処理も追加しなければならない設計になっていた。本来は「`image_key`という値が変化した」という一点に反応する場所に処理を集約すべきだった。

## まとめ

- S3から画像を取得する際の403エラーは、アクセスルール上のパス形式が合っていても、S3上に実在するキー(フォルダ構成含む)とDB側の値が一致していなければ解消しない。
- `next/image`の`src`に非同期取得した値を渡す場合、描画条件は「取得できているかどうか(値そのもの)」で判定する。「取得のトリガーになる値(今回は`image_key`)」で判定すると、取得完了前の空の状態で描画されてしまう
- `useEffect`の依存配列が`[]`のeffectは、マウント時に1回しか実行されない。内部で`subscribe`しているコールバックがその後何度も呼ばれるとしても、それはeffect本体の再実行とは別物なので注意する
- あるstate(`imageUrl`)が別のstate(`image_key`)の変化に連動してリセット・再取得されるべき場合、「`image_key`を更新している場所全部」に処理を書くのではなく、「`image_key`の変化を検知する場所(依存配列に持つ`useEffect`)」に処理を集約したほうが、更新経路が増えても書き忘れが起きにくい
