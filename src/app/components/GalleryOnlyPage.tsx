import { Suspense, useState } from "react";
import { GROUND } from "../lib/atmosphere";
import { LANDING_FOCUS_ID } from "../lib/landingTransition";
import { useGalleryPush } from "../lib/labPush";
import { LiveVesselGallery, MemoryCarouselPage } from "./landingScenes";

/**
 * /gallery — the live gallery and nothing else, for recording its motion.
 * The same vessels, caption, ruler, arrows and header as /memory, but the
 * landing is never mounted behind it, the pond is not opened (or loaded) past
 * either end, the DialKit panels stay away, and the paper finish's watchdog
 * does not step the look down mid-take (App.tsx).
 *
 * ?focus=<id> opens on that memory (default: the piano, as Enter does);
 * ?carried=1 opens at depth without the dive.
 */
export function GalleryOnlyPage() {
  const [params] = useState(() => new URLSearchParams(window.location.search));
  const published = useGalleryPush();
  const [focus, setFocus] = useState<string | undefined>();
  return (
    <main style={{ position: "relative", width: "100%", height: "100dvh", overflow: "hidden", background: GROUND }}>
      <Suspense fallback={null}>
        <LiveVesselGallery dials={false} panels={published?.panels} pushedAt={published?.at ?? 0} onFocus={setFocus}>
          <MemoryCarouselPage
            galleryFocusId={focus ?? params.get("focus") ?? LANDING_FOCUS_ID}
            galleryCarried={focus !== undefined || params.get("carried") === "1"}
            onPondEnter={() => {}}
          />
        </LiveVesselGallery>
      </Suspense>
    </main>
  );
}
