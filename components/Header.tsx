"use client";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export default function Header() {
  const router = useRouter();
  return (
    <div className="flex items-center justify-between px-10 py-4 bg-primary text-primary-foreground mb-10">
      <div onClick={() => router.push("/")} className="cursor-pointer">
        <h1 className="text-2xl font-bold ">雑談のタネ🌱</h1>
      </div>
      <Button variant="outline">タネをまく✨</Button>
    </div>
  );
}
