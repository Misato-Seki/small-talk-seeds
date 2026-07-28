"use client";

import "@aws-amplify/ui-react/styles.css";
import MemberCard from "@/components/MemberCard";
import WelcomeMessage from "@/components/WelcomeMessage";
import { useState, useEffect } from "react";

export type memberData = {
  name: string;
  image: string;
};

const memberData: Array<memberData> = [
  { name: "関 美里", image: "misato_seki.jpeg" },
  { name: "山田 太郎", image: "" },
  { name: "山田 花子", image: "" },
  { name: "鈴木 一郎", image: "" },
];

export default function App() {
  const [show, setShow] = useState<boolean>(false);

  useEffect(() => {
    const flag_visited = localStorage.getItem("flag_visited");
    if (!flag_visited) setShow(true);
  }, []);

  function onFinish() {
    localStorage.setItem("flag_visited", "true");
    setShow(false);
  }

  return (
    <div>
      {show && <WelcomeMessage onFinish={onFinish} />}
      <MemberCard memberData={memberData} />
    </div>
  );
}
