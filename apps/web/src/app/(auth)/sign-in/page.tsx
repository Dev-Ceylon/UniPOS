import { Suspense } from "react";
import { env } from "@/lib/env";
import { AuthForm } from "../auth-form";

export const metadata = { title: "Sign in" };

export default function SignIn() {
  return (
    <Suspense>
      <AuthForm mode="sign-in" googleEnabled={!!env.google} />
    </Suspense>
  );
}
