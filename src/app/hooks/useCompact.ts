import { useEffect, useState } from "react";

/** The phone breakpoint. Matches the `max-width: 600px` block in
    src/styles/responsive.css, which moves the header chrome. */
export const COMPACT_QUERY = "(max-width: 600px)";

/** True on a phone-width screen; follows rotation and window resizes.
    Prefer CSS (clamp, the --chrome-* variables) where a value can be
    expressed there — this is for layouts that change shape. */
export function useCompact(): boolean {
  const [compact, setCompact] = useState(() => window.matchMedia(COMPACT_QUERY).matches);
  useEffect(() => {
    const media = window.matchMedia(COMPACT_QUERY);
    const change = () => setCompact(media.matches);
    change();
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  return compact;
}
