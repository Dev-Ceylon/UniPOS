import Link from "next/link";

export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold">You are offline</h1>
      <p className="text-muted">This page needs a connection. The register keeps working offline and syncs sales when you are back online.</p>
      <Link className="rounded-lg bg-primary px-4 py-2 font-medium text-primary-fg" href="/register">
        Open the register
      </Link>
    </main>
  );
}
