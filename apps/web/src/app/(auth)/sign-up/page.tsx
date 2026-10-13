import { Suspense } from "react";
import { env } from "@/lib/env";
import { AuthForm } from "../auth-form";

export const metadata = { title: "Create account" };

export default function SignUp() {
  return (
    <Suspense>
      <AuthForm mode="sign-up" googleEnabled={!!env.google} />
    </Suspense>
  );
}
