# MemberCardが「JSX componentとして使えない」エラーで詰まったこと

メンバー一覧(`memberData`)を受け取って、メンバーの数だけカードを表示する`MemberCard`コンポーネントを作ろうとしたところ、以下のエラーが出た。

```
'MemberCard' cannot be used as a JSX component.
  Its type '(memberData: memberData[]) => { memberData: memberData[]; "": any; }' is not a valid JSX element type.
    Type '(memberData: memberData[]) => { memberData: memberData[]; "": any; }' is not assignable to type '(props: any, deprecatedLegacyContext?: any) => ReactNode'.
      Type '{ memberData: memberData[]; "": any; }' is not assignable to type 'ReactNode'.
```

エラーメッセージだけを見ると何が悪いのか分かりにくいが、原因は大きく2つあった。

## 起きた問題1: `return`しているJSXが、実はオブジェクトリテラルとして解釈されていた

最初のコードはこう書いていた。

```tsx
export default function MemberCard(memberData: Array<memberData>) {
  return (
    {memberData.map((member) => (
      <Card className="relative mx-auto w-full max-w-sm pt-0">
        {/* ... */}
      </Card>
    ))}
  );
}
```

### 原因

JSXの`{}`は「JSX要素の中に式を埋め込むための記法」であり、JSX要素という文脈があって初めて機能する。しかし上のコードは`return (`の直後にいきなり`{`が来ており、これを包むJSX要素が存在しない。そのため`{memberData.map(...)}`はJSXの式埋め込みではなく、ただの**オブジェクトリテラル**として解釈されてしまっていた。

エラーメッセージにあった`{ memberData: memberData[]; "": any; }`という型は、まさに「関数がオブジェクトを返している」ことを示している。関数コンポーネントの返り値は`ReactNode`(JSX要素や文字列、配列など)である必要があるため、オブジェクトを返す時点で「有効なJSXコンポーネントではない」というエラーになっていた。

### 解決方法

複数のJSX要素(`.map()`の結果)を1つの塊として返すには、それらを包む1つのJSX要素が必要。今回はFragment(`<>...</>`)ではなく、Tailwindでグリッドレイアウトを組みたかったので`<div>`で囲んだ。

```tsx
return (
  <div className="grid grid-cols-3 gap-4">
    {memberData.map((member) => (
      <Card key={member.name} className="relative mx-auto w-full max-w-sm pt-0">
        {/* ... */}
      </Card>
    ))}
  </div>
);
```

`{}`で式を埋め込む前に、必ずそれを包むJSX要素(タグ)がある状態にする、というのがポイント。

## 起きた問題2: propsの受け取り方が噛み合っていなかった

呼び出し側は以下のようにコンポーネントを呼んでいた。

```tsx
<MemberCard memberData={memberData} />
```

一方、コンポーネント側の定義はこうなっていた。

```tsx
export default function MemberCard(memberData: Array<memberData>) {
```

### 原因

JSXでコンポーネントに渡した属性(`memberData={memberData}`のような`attribute={value}`)は、すべてまとめて1つの「propsオブジェクト」として関数に渡される。つまり`<MemberCard memberData={memberData} />`と書くと、関数が実際に受け取る引数は`{ memberData: [...] }`という形のオブジェクトそのもの。

しかしコンポーネント側は、その引数の名前を`memberData`としたうえで型を`Array<memberData>`(配列)にしていた。これでは「配列を直接受け取る」つもりの型と、「実際に渡ってくるのはオブジェクト」という実態がズレてしまい、関数内で`memberData.map(...)`としても、実際には配列ではなくオブジェクトの`.map()`を呼ぼうとしていたことになる。

### 解決方法

propsオブジェクトを分割代入で受け取る形に直した。

```tsx
export default function MemberCard({
  memberData,
}: {
  memberData: Array<memberData>;
}) {
  // ここでの memberData は正しく配列になる
}
```

## 参考にしたドキュメント

- [Passing Props to a Component (React公式)](https://react.dev/learn/passing-props-to-a-component) — propsが1つのオブジェクトとして渡され、分割代入で取り出すという基本の考え方
- [TypeScript with React Components (React公式)](https://react.dev/learn/typescript#typing-component-props) — propsに型を付ける書き方

## まとめ

- JSXの`{}`による式の埋め込みは、それを包むJSX要素があって初めて成立する。`return ({expr})`のように単独で書くと、意図せずオブジェクトリテラルとして解釈されることがある
- コンポーネントに渡したJSX属性は、すべてまとめて1つのpropsオブジェクトとして関数に渡される。引数名を属性名と同じにしても、それだけでは中身が展開されない。分割代入で明示的に取り出す必要がある
- `.map()`でリストをレンダリングするときは各要素に一意な`key`を付ける
