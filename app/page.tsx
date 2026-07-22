"use client";

import { useState, useEffect } from "react";
import { generateClient, SelectionSet } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import "./../app/app.css";
import { Amplify } from "aws-amplify";
import outputs from "@/amplify_outputs.json";
import "@aws-amplify/ui-react/styles.css";

Amplify.configure(outputs);

const client = generateClient<Schema>();

const selectionSet = ["id", "content", "description", "choices.*"] as const;
type QuizzesWithChoices = SelectionSet<
  Schema["Quiz"]["type"],
  typeof selectionSet
>;

export default function App() {
  // const [todos, setTodos] = useState<Array<Schema["Todo"]["type"]>>([]);
  const [quizzes, setQuizzes] = useState<Array<QuizzesWithChoices>>([]);

  // function deleteTodo(id: string) {
  //   client.models.Todo.delete({ id })
  // }

  // function listTodos() {
  //   client.models.Todo.observeQuery().subscribe({
  //     next: (data) => setTodos([...data.items]),
  //   });
  // }

  function listQuizzes() {
    client.models.Quiz.observeQuery({
      selectionSet: ["id", "content", "description", "choices.*"],
    }).subscribe({
      next: (data) => setQuizzes([...data.items]),
    });
  }
  console.log("quizzes", quizzes);

  useEffect(() => {
    // listTodos();
    listQuizzes();
  }, []);

  // function createTodo() {
  //   client.models.Todo.create({
  //     content: window.prompt("Todo content"),
  //   });
  // }

  return (
    <main>
      <h1>My Quizzes</h1>
      {/* <button onClick={createTodo}>+ new</button> */}
      <ul>
        {quizzes.map((quiz) => (
          <li
            // onClick={() => deleteTodo(todo.id)}
            key={quiz.id}
          >
            <p>
              <strong>質問:</strong> {quiz.content}
            </p>
            {quiz.choices &&
              quiz.choices.length > 0 &&
              quiz.choices.map((choice) => (
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
              <strong>説明:</strong> {quiz.description}
            </p>
          </li>
        ))}
      </ul>
      <div>
        🥳 App successfully hosted. Try creating a new todo.
        <br />
        <a href="https://docs.amplify.aws/nextjs/start/quickstart/nextjs-app-router-client-components/">
          Review next steps of this tutorial.
        </a>
      </div>
    </main>
  );
}
