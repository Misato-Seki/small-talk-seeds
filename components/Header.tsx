import { Button } from "@/components/ui/button";

export default function Header() {
  return (
    <div className="flex items-center justify-between px-10 py-4 bg-primary text-primary-foreground mb-10">
      <h1 className="text-2xl font-bold">雑談のタネ🌱</h1>
      <Button variant="outline">タネをまく✨</Button>
    </div>
  );
}
