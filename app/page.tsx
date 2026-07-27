"use client";

import "@aws-amplify/ui-react/styles.css";
import MemberCard from "@/components/MemberCard";
import WelcomeMessage from "@/components/WelcomeMessage";

export type memberData = {
  name: string;
  image: string;
};

export default function App() {
  const memberData: Array<memberData> = [
    { name: "関 美里", image: "misato_seki.jpeg" },
    { name: "山田 太郎", image: "" },
    { name: "山田 花子", image: "" },
    { name: "鈴木 一郎", image: "" },
  ];

  return (
    <div>
      <WelcomeMessage />
      <MemberCard memberData={memberData} />
    </div>
  );
}
