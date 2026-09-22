import { Link } from "@tanstack/react-router";

export const NotFound = () => (
  <main className="grid h-dvh place-items-center bg-background">
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-muted-foreground">ページが見つかりません</p>
      <Link
        className="text-sm text-foreground underline underline-offset-4"
        to="/"
      >
        世界へ戻る
      </Link>
    </div>
  </main>
);
