import { defineStorage } from "@aws-amplify/backend";

export const storage = defineStorage({
  name: "smallTalkSeeds",
  access: (allow) => ({
    "media/*": [allow.guest.to(["read"])],
  }),
});
