"use client";

import { useState, useEffect } from "react";
import { generateClient, SelectionSet } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import { Amplify } from "aws-amplify";
import outputs from "@/amplify_outputs.json";
import "@aws-amplify/ui-react/styles.css";
import { Button } from "@/components/ui/button";

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

  return (
    <>
      {isFinished ? (
        <div>
          <h2>クイズ終了!</h2>
          <p>お疲れ様でした!</p>
        </div>
      ) : (
        <div>
          {displayedQuiz && (
            <div>
              <p>
                <strong>質問:</strong> {displayedQuiz.content}
              </p>
              {displayedQuiz.choices &&
                displayedQuiz.choices.length > 0 &&
                displayedQuiz.choices.map((choice) => (
                  <div key={choice.id}>
                    <p>
                      <strong>選択肢:</strong> {choice.content}
                    </p>
                    <p>
                      <strong>解答:</strong>{" "}
                      {choice.answer === true ? "⭕️" : "❌"}
                    </p>
                  </div>
                ))}
              <p>
                <strong>説明:</strong> {displayedQuiz.description}
              </p>
            </div>
          )}
          {quizzes.length === 0 ? (
            <p>クイズがありません。</p>
          ) : (
            <Button onClick={incrementDisplayedQuiz}>次の問題</Button>
          )}
        </div>
      )}
    </>
  );
}
