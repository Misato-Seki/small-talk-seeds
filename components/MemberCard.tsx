import { Card, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";

export default function MemberCard() {
  return (
    <Card className="relative mx-auto w-full max-w-sm pt-0">
      {/* <div className="absolute inset-0 z-30 aspect-video bg-black/35" /> */}
      <Image
        src="misato_seki.jpeg"
        width={500}
        height={500}
        alt="Event cover"
        // className="relative z-20 aspect-video w-full object-cover brightness-60 grayscale dark:brightness-40"
        className="relative aspect-video w-full object-cover"
      />
      <CardHeader>
        <CardTitle>
          <span className="text-2xl font-bold">関 美里</span>
          <span>さんのタネ🌱</span>
        </CardTitle>
      </CardHeader>
      <CardFooter>
        <Link href="/quiz" className="w-full">
          <Button className="w-full">見てみる👀</Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
