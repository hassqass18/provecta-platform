"use client";

import { useRouter } from "next/navigation";

export function ThemeToggle({ theme }: { theme: "dark" | "light" }) {
  const router = useRouter();
  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.cookie = `theme=${next};path=/;max-age=31536000;samesite=lax`;
    router.refresh();
  }
  return (
    <button onClick={toggle} className="btn btn-outline-light">
      {theme === "dark" ? "Light theme" : "Dark theme"}
    </button>
  );
}
