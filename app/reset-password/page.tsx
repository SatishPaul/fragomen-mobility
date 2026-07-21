import { Suspense } from "react";
import { AuthPanel } from "@/components/AuthPanel";

export default function ResetPasswordPage() {
  return <main className="flex min-h-screen items-center justify-center p-6"><Suspense><AuthPanel mode="reset" /></Suspense></main>;
}
