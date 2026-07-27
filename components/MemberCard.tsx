import { Card, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";
import { memberData } from "@/app/page";

export default function MemberCard({
  memberData,
}: {
  memberData: Array<memberData>;
}) {
  return (
    <div className="grid grid-cols-3 gap-4">
      {memberData.map((member) => (
        <Card
          className="relative mx-auto w-full max-w-sm pt-0"
          key={member.name}
        >
          {/* <div className="absolute inset-0 z-30 aspect-video bg-black/35" /> */}
          {!member.image ? (
            <Image
              src="no_image_logo.png"
              width={500}
              height={500}
              alt="Event cover"
              // className="relative z-20 aspect-video w-full object-cover brightness-60 grayscale dark:brightness-40"
              className="relative aspect-video w-full object-cover"
            />
          ) : (
            <Image
              src={member.image}
              width={500}
              height={500}
              alt="Event cover"
              // className="relative z-20 aspect-video w-full object-cover brightness-60 grayscale dark:brightness-40"
              className="relative aspect-video w-full object-cover"
            />
          )}
          <CardHeader>
            <CardTitle>
              <span className="text-2xl font-bold">{member.name}</span>
              <span>さんのタネ🌱</span>
            </CardTitle>
          </CardHeader>
          <CardFooter>
            <Link href="/quiz" className="w-full">
              <Button className="w-full">見てみる👀</Button>
            </Link>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
