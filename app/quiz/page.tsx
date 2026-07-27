"use client";

import { useState, useEffect } from "react";
import { generateClient, SelectionSet } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import { Amplify } from "aws-amplify";
import outputs from "@/amplify_outputs.json";
import "@aws-amplify/ui-react/styles.css";
import { Button } from "@/components/ui/button";
import { Card, CardFooter } from "@/components/ui/card";
import { Check } from "lucide-react";
import Link from "next/link";

Amplify.configure(outputs);

const client = generateClient<Schema>();

const selectionSet = ["id", "content", "description", "choices.*"] as const;
type QuizWithChoices = SelectionSet<
  Schema["Quiz"]["type"],
  typeof selectionSet
>;

export default function QuizPage() {
  const [quizzes, setQuizzes] = useState<Array<QuizWithChoices>>([]);
  const [displayedQuiz, setDisplayedQuiz] = useState<QuizWithChoices | null>(
    quizzes.length > 0 ? quizzes[0] : null,
  );
  const [isFinished, setIsFinished] = useState<boolean>(false);
  const [isReviewMode, setIsReviewMode] = useState<boolean>(false);
  const [selectedChoiceIDs, setSelectedChoiceIDs] = useState<Array<string>>([]);
  const [score, setScore] = useState<number>(0);

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

  useEffect(() => {
    listQuizzes();
  }, []);

  // 次の問題に進む
  function incrementDisplayedQuiz() {
    // 今の問題のindex
    const currentIndex = quizzes.findIndex(
      (quiz) => quiz.id === displayedQuiz?.id,
    );
    // 最後の問題なら、結果画面に移行する
    if (currentIndex === quizzes.length - 1) {
      checkAnswer();
      setSelectedChoiceIDs([]);
      setIsFinished(true);
      return;
    } else {
      // それ以外
      checkAnswer();
      setSelectedChoiceIDs([]);
      const nextIndex = currentIndex + 1;
      setDisplayedQuiz(quizzes[nextIndex]);
    }
  }

  function toggleMode() {
    setIsReviewMode(!isReviewMode);
  }

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

  function getChoiceColorClass(choiceId: string, choiceAnswer: boolean) {
    if (!isReviewMode) return;
    if (choiceAnswer === false && !selectedChoiceIDs.includes(choiceId)) {
      return "text-gray-400 border-gray-400";
    } else if (choiceAnswer === false && selectedChoiceIDs.includes(choiceId)) {
      return "border-red-400 bg-red-400/25";
    } else {
      return "border-green-400 bg-green-400/25";
    }
  }

  function checkAnswer() {
    // 正解の選択肢IDを持つSetを作る
    const answerSet = new Set<string>();
    displayedQuiz?.choices.forEach((choice) => {
      if (choice.answer === true) answerSet.add(choice.id);
    });
    // ユーザーが選んだ選択肢IDを持つSetを作る
    const userChoicesSet = new Set(selectedChoiceIDs);
    // 中身を比較し、スコアを更新
    if (
      answerSet.size === userChoicesSet.size &&
      Array.from(answerSet).every((currentValue) =>
        userChoicesSet.has(currentValue),
      )
    ) {
      setScore((prev) => prev + 1);
    }
  }

  // 後で消す
  console.log("selectedChoiceIDs: ", selectedChoiceIDs);
  console.log("isReviewMode: ", isReviewMode);
  console.log("Score: ", score);

  return (
    <>
      {isFinished ? (
        <div className="flex justify-center">
          <Card className="items-center p-6">
            <Check color="#00786f" size={48} strokeWidth={3} />
            <h2 className="text-xl font-bold">クイズ終了!</h2>
            <p className="text-lg">
              {quizzes.length}問中<strong> {score} </strong>問正解しました✨
            </p>
            <p className="text-lg">関さんに話しかけてみましょう〜🌸</p>
            <CardFooter>
              <Link href="/" className="w-full">
                <Button>ホームへ戻る🏠</Button>
              </Link>
            </CardFooter>
          </Card>
        </div>
      ) : (
        <div>
          {displayedQuiz && (
            <div className="">
              <div className="flex flex-col space-y-3 mb-3">
                <strong>問題</strong>
                <p className="mb-3">{displayedQuiz.content}</p>
              </div>
              {displayedQuiz.choices &&
                displayedQuiz.choices.length > 0 &&
                displayedQuiz.choices.map((choice) => (
                  <div
                    key={choice.id}
                    className={`border rounded-xl p-4 mb-4 ${!isReviewMode ? "hover:bg-gray-100 active:translate-y-px cursor-pointer" : ""} ${selectedChoiceIDs.includes(choice.id) ? "bg-gray-100 outline-2 outline-offset-2 outline-primary " : ""} ${isReviewMode ? getChoiceColorClass(choice.id, choice.answer) : ""}`}
                    onClick={() => {
                      storeSelectedChoiceIDs(choice.id);
                    }}
                  >
                    <p>{choice.content}</p>
                  </div>
                ))}
              {!isReviewMode && (
                <Button onClick={toggleMode} className="">
                  答えを見る👀
                </Button>
              )}
              {isReviewMode && (
                <div className="flex flex-col space-y-3 mb-4 border p-4 rounded-xl">
                  <strong>説明</strong>
                  <p>{displayedQuiz.description}</p>
                </div>
              )}
            </div>
          )}
          {isReviewMode && (
            <Button
              onClick={() => {
                incrementDisplayedQuiz();
                toggleMode();
              }}
            >
              次の問題👉
            </Button>
          )}
        </div>
      )}
    </>
  );
}
