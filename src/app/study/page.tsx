import { redirect } from "next/navigation";

/** The study screen now lives at `/`; keep the old URL working. */
export default function StudyRedirect() {
  redirect("/");
}
