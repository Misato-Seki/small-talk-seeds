export default function WelcomeMessage() {
  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center outline-primary outline-2 rounded-lg p-4 mb-4 bg-white w-1/2 h-1/2 animate-[frame-fade-in-out_var(--welcome-duration)_ease-in-out_forwards]">
      {/* <div className="w-full"> */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 space-y-4 animate-[first-text-fade-in-out_var(--welcome-duration)_ease-in-out_forwards]">
        <p className="text-center text-6xl">🌱</p>
        <p className="text-center text-2xl font-bold">
          一緒に働く仲間との雑談のタネを見つけて
        </p>
      </div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 space-y-4 animate-[second-text-fade-in-out_var(--welcome-duration)_ease-in-out_forwards]">
        <p className="text-center text-6xl">🌸</p>
        <p className="text-center text-2xl font-bold">
          会話に花を咲かせましょう
        </p>
      </div>
      {/* </div> */}
    </div>
  );
}
