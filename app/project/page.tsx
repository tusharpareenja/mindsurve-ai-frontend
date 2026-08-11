import { redirect } from "next/navigation"

/** Legacy projects home — welcome is the logged-in landing page. */
export default function ProjectIndexRedirect() {
  redirect("/welcome")
}
