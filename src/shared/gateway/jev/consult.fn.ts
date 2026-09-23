import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";
import { ConsultationSchema } from "@/shared/entities/world/consultation";
import { getJevReply } from "./consult";

// The wire hands `.validator` whatever the client sent, so the contract starts
// at this schema rather than at a parameter annotation.
const parseConsultation = Schema.decodeUnknownSync(ConsultationSchema);

export const consultJevFn = createServerFn({ method: "POST" })
  .validator(parseConsultation)
  .handler(({ data }) => getJevReply(data));
