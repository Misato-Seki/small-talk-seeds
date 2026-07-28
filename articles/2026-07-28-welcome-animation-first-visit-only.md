# ウェルカムアニメーションを「初回訪問時だけ」再生する実装で詰まったこと

ホーム画面のウェルカムアニメーション(`WelcomeMessage`コンポーネント)が、画面に戻るたびに毎回再生されてしまうのをやめ、「初回訪問時だけ」再生されるようにする機能を実装した。`localStorage`に訪問済みフラグを持たせ、アニメーション終了を検知して`page.tsx`に伝える、という設計にしたが、いくつかの箇所でつまずいた。

## やりたかったこと

- `localStorage`に「訪問済みフラグ」を保存し、初回訪問時だけ`WelcomeMessage`を表示する
- 表示するかどうかの判断は`page.tsx`側で持ち、非表示のときは`WelcomeMessage`をDOMごと消す
- アニメーションが最後まで再生し終わったタイミングで`localStorage`にフラグを書き込む(途中でページを離脱した場合は、次回また最初から見せたいため)

## 1. render中にDOM操作をしてしまった

アニメーション終了を検知するために、最初に書いたコードは以下のようなものだった。

```tsx
export default function WelcomeMessage({ onFinnish }: { onFinnish: () => {} }) {
  const animated = document.querySelector(".animated");
  animated.onanimationend = () => {
    onFinish;
  };
  return (
    <div className="... animated">
      ...
    </div>
  );
}
```

### 起きた問題

1. `document.querySelector(".animated")`を、コンポーネント関数の本体(JSXを`return`する前)に直接書いていた
2. `.onanimationend = () => { onFinish; }`と、素のDOM APIでイベントハンドラーを手動登録していた
3. `onFinish;`だけでは関数を**呼び出しておらず**、単に関数を参照しているだけだった
4. propsの型`() => {}`のつもりが、実際には`() => void`(戻り値なしの関数)ではなく「ほぼ何でも受け入れる型」になっていた

### 原因

一番大きな原因は「レンダー中に副作用(DOM操作)を書いてしまったこと」だった。

Reactのコンポーネント関数は、料理で言うと「レシピを書く」段階に相当する。「こういう見た目にしてね」という指示書(JSX)を組み立てているだけで、この時点ではまだ実際のDOM要素は出来上がっていない。`document.querySelector`で要素を探しに行く行為は「まだ出来ていない料理を触ろうとする」ようなもので、タイミングとして正しくない。

さらに、このアプリはNext.jsを使っており、`"use client"`と書いてあるコンポーネントでも、最初は**サーバー側で一度レンダーされる**。サーバー側には`document`(ブラウザのDOM API)がそもそも存在しないため、レンダー中に`document.querySelector`を呼ぶとエラーになり得る。

### 解決方法

「後からDOMを探しに行く」のをやめ、JSXの要素に直接`onAnimationEnd`属性を渡す形に変更した。

```tsx
export default function WelcomeMessage({ onFinish }: { onFinish: () => void }) {
  return (
    <div className="..." onAnimationEnd={onFinish}>
      ...
    </div>
  );
}
```

`onAnimationEnd`はReactが用意しているイベントハンドラー用のprop(`onClick`などと同じ仲間)で、CSSの`animationend`イベントに対応する。要素にあらかじめ「終わったらこれを呼んでね」という属性を書いておけば、`document.querySelector`で後から探しに行く必要自体がなくなる。

## 2. アニメーションのバブリングとevent.target判定

`WelcomeMessage`には、アニメーションしている`div`が3つある(外側1つ + 内側2つ)。

```tsx
<div className="... animate-[frame-fade-in-out_...] ..." onAnimationEnd={onFinish}>
  <div className="... animate-[first-text-fade-in-out_...] ...">...</div>
  <div className="... animate-[second-text-fade-in-out_...] ...">...</div>
</div>
```

CSSの`animationend`イベントはDOMイベントとしてバブリングする性質を持つ。Reactの合成イベント(`onAnimationEnd`)も素のDOMイベントをラップしたものなので、このバブリングの性質を引き継ぐ。そのため、内側2つの`div`のアニメーションが終わった時のイベントも外側の`div`まで伝わってきて、外側の`onAnimationEnd`(＝`onFinish`)が本来の1回ではなく複数回呼ばれてしまう可能性があった。

### 起きた問題

対処として「イベントが外側の`div`自身から発生したときだけ`onFinish`を呼ぶ」ようにしたかったが、最初に書いたコードは構文的に誤っていた。

```tsx
onAnimationEnd={
  if((e) === e.currentTarget) onFinish()
}
```

1. JSXの`{}`の中には**式(expression)**しか書けないが、`if`文は**文(statement)**なのでそのままでは書けない
2. `e`という引数がどこからも渡されておらず、アロー関数で包む(`(e) => { ... }`)という手順が抜けていた
3. 比較しているのが`e`自体と`e.currentTarget`になっており、本来比較すべき`e.target`ではなかった

### 原因

- 「イベントハンドラーには自動的にイベントオブジェクトが渡される」という前提と、「そのイベントオブジェクトを受け取るには引数として明示的に受け取る必要がある」という2点の理解が曖昧なまま書いてしまった
- `target`(イベントが実際に発生した要素)と`currentTarget`(イベントハンドラーが登録されている要素)という、似ているが役割の異なる2つのプロパティを混同していた

### 解決方法

アロー関数で引数`e`を受け取り、その関数の中(ブロック`{ }`の中)でなら`if`文が書けることを踏まえて、以下のように修正した。

```tsx
onAnimationEnd={(e) => {
  if (e.target === e.currentTarget) onFinish();
}}
```

- `e.target`: イベントが実際に発生した要素(バブリングしてきた場合は内側の`div`になる)
- `e.currentTarget`: イベントハンドラーが登録されている要素(今回は一番外側の`div`)
- この2つが一致する場合だけ`onFinish()`を呼ぶことで、内側の`div`のアニメーション終了イベントがバブリングしてきても無視できるようになった

## 3. useEffectでlocalStorageを読んだらcascading rendersの警告

`page.tsx`側では、以下のような実装にした。

```tsx
const [show, setShow] = useState<boolean>(false);

useEffect(() => {
  const flag_visited = localStorage.getItem("flag_visited");
  if (!flag_visited) setShow(true);
}, []);
```

### 起きた問題

以下のような警告が出た。

```
Error: Calling setState synchronously within an effect can trigger cascading renders
```

### 原因

依存配列を空`[]`にしているため、この`useEffect`自体は初回マウント時に1回しか実行されない。つまり無限ループではなく、以下の「2回だけのレンダー」を指す警告だと考えられる。

1. 初回レンダー(`show = false`、まだ何も表示しない)
2. マウント後に`useEffect`が実行され、`localStorage`が未訪問だった場合`setShow(true)`が呼ばれる
3. その結果、もう一度レンダーされる(`show = true`、ここで初めてアニメーションが表示される)

これは「まず非表示にしておき、`localStorage`の結果を見てから表示する」という、UX上の判断(「一瞬見えてから消える」より「一瞬見えなくてすぐ出る」方が良い)に基づいて意図的に選んだ設計の結果でもある。Reactの公式ドキュメント(「You Might Not Need an Effect」)でも、「外部ストアの値を読んでReactのstateに反映する」ような用途は、`useEffect` + `setState`が正当に必要なケースとして挙げられている。`localStorage`はReactの外側にある「外部ストア」にあたるため、このパターン自体は妥当と言える。

### 解決方法(結論)

- 実際に画面が壊れていたわけではなく、警告が出ているだけで動作は意図通りだった
- 依存配列が空`[]`のため無限ループにはならず、発生するのは「初回マウント時に1回だけ余分なレンダーが挟まる」という想定内の挙動
- この1回分の余分なレンダーは、「訪問済みかどうかをSSR時点では判定できない」という制約と、「一瞬見えなくてすぐ出る」というUX上の選択を両立させるためのトレードオフとして受け入れることにした

### 参考にしたドキュメント

- MDN Web Docs「[Window: localStorage property](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)」
  - `getItem(key)`は値が存在しない場合`null`を返す
  - `setItem(key, value)`は値を必ず文字列として保存する(真偽値をそのまま保存できない)
  - この2点の挙動を踏まえて、フラグの読み書き(`getItem`で`null`かどうかを判定、`setItem`で文字列として保存)を実装した

## まとめ

- コンポーネント関数の本体は「JSXを組み立てるための計算」を行う場所であり、DOM操作やブラウザAPIの呼び出しといった副作用を直接書いてはいけない。副作用が必要な場合は`useEffect`か、JSXのイベントハンドラー属性を使う
- JSXの`{}`は式しか受け付けない。`if`文などの制御構文を使いたい場合は、アロー関数で包んでその中に書く必要がある
- `event.target`(発生元の要素)と`event.currentTarget`(ハンドラーの登録先要素)は役割が違う。バブリングしてきたイベントを除外したい場合は、この2つを比較する
- `useEffect`の依存配列が空`[]`であれば、マウント時に1回しか実行されないため無限ループの心配はない。「外部ストア(localStorageなど)の値をReactのstateに同期する」目的での`useEffect` + `setState`は、Reactが正当なユースケースとして認めているパターンである
