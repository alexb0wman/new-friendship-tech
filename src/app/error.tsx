"use client";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="standalone-state" id="main">
      <h1>Let's try that again.</h1>
      <p>This screen could not load.</p>
      <button className="button lime" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
