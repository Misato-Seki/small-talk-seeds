"use client";

import "@aws-amplify/ui-react/styles.css";
import MemberCard from "@/components/MemberCard";
import WelcomeMessage from "@/components/WelcomeMessage";

export default function App() {
  // const [todos, setTodos] = useState<Array<Schema["Todo"]["type"]>>([]);

  // function deleteTodo(id: string) {
  //   client.models.Todo.delete({ id })
  // }

  // function listTodos() {
  //   client.models.Todo.observeQuery().subscribe({
  //     next: (data) => setTodos([...data.items]),
  //   });
  // }

  // function createTodo() {
  //   client.models.Todo.create({
  //     content: window.prompt("Todo content"),
  //   });
  // }

  return (
    <div>
      <WelcomeMessage />
      <MemberCard />
    </div>
  );
}
