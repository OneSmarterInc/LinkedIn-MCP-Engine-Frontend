import { useEffect, useState } from "react";

/** The page name after "#" in the address bar (#queue, #jobs …), like the design. */
export function useHashRoute<T extends string>(pages: readonly T[], fallback: T): T {
  const read = () => {
    const h = window.location.hash.slice(1) as T;
    return pages.includes(h) ? h : fallback;
  };
  const [page, setPage] = useState<T>(read);
  useEffect(() => {
    const onChange = () => setPage(read());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return page;
}
