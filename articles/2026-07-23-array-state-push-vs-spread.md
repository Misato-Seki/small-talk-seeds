# Reactのstate更新で配列にpush()を使ったら選択状態がおかしくなった件

「雑談のタネ🌱」のクイズ画面で、選択肢をクリックしたときに「選んだ選択肢のID」を配列で管理する答え合わせロジックを実装した。素朴に配列へ`push()`で追加する実装にしたところ、選択状態が意図通りに反映されず、原因を理解するまで詰まったのでまとめる。

## やったこと

複数選択できる選択肢を想定し、クリックされた選択肢のIDを配列のstateに保持する処理を書いた。

```tsx
const [selectedChoiceIDs, setSelectedChoiceIDs] = useState<Array<string>>([]);

function storeSelectedChoiceIDs(choiceId: string) {
  setSelectedChoiceIDs(selectedChoiceIDs.push(choiceId));
}
```

選択肢の`onClick`からこの関数を呼び出し、クリックのたびに`selectedChoiceIDs`に選んだ選択肢のIDが追加されていくことを期待した。

## 起きた問題

選択肢をクリックしても選択状態が正しく反映されない、あるいはstateの中身がおかしくなる、という現象が起きた。`console.log`で`selectedChoiceIDs`を確認しても、期待していた「選んだIDの配列」にならなかった。

## 原因

原因は2つ重なっていた。

**1. `Array.prototype.push()`の戻り値を誤解していた**

`push()`は配列に要素を追加した後の**配列の新しい長さ(数値)**を返すメソッドで、追加後の配列そのものを返すわけではない。そのため、

```tsx
setSelectedChoiceIDs(selectedChoiceIDs.push(choiceId));
```

と書くと、`setSelectedChoiceIDs`には配列ではなく「追加後の要素数」という数値が渡ってしまい、`selectedChoiceIDs`の型が`Array<string>`ではなくなってしまう。

**2. `push()`は元の配列を直接書き換える(破壊的メソッド)**

`push()`は新しい配列を作らず、呼び出し元の配列自体をミューテート(直接変更)する。Reactは「stateの参照が変わったかどうか」を見て再レンダリングするかを判断しているため、たとえ`push()`の戻り値の扱いを直しても、配列を直接書き換える書き方ではReactが変更を検知できないケースがある。Reactのstateは常に新しいオブジェクト・配列を作って`set〇〇`に渡す必要がある、というルールに反していた。

## 解決方法

`push()`ではなく、スプレッド構文(`...`)で新しい配列を作って`setSelectedChoiceIDs`に渡すように修正した。

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

- 追加時: `[...selectedChoiceIDs, choiceId]` で「元の配列の中身 + 新しいID」を持つ**新しい配列**を作って渡す
- 解除時(もう一度同じ選択肢をクリックした場合): `filter()` で対象のIDを除いた**新しい配列**を作って渡す

どちらも元の配列を書き換えず、新しい配列を作ってからstateにセットする、という点が共通している。

## まとめ

- `Array.prototype.push()`は追加後の**配列の長さ(数値)**を返す。追加後の配列が欲しい場合は戻り値を使ってはいけない
- `push()`や`splice()`などの破壊的メソッドは元の配列を直接書き換えるため、Reactのstate更新には不向き。Reactは「参照が変わったかどうか」で再レンダリングを判断するので、常に新しい配列・オブジェクトを作って`set〇〇`に渡す必要がある
- 配列stateへの追加は`[...array, newItem]`、削除は`array.filter(...)`のように、非破壊的な方法で新しい配列を作るのが基本パターン
