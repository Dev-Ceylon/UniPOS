"use client";
import { Alert, Button } from "@unipos/ui";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg p-6">
      <Alert tone="danger" title="Something went wrong">
        <p className="mt-1">{process.env.NODE_ENV === "development" ? error.message : "Please try again. If it keeps happening, contact support."}</p>
      </Alert>
      <Button className="mt-4" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
