import { BlobScene } from "./BlobScene";

/**
 * The landing, alone. Enter stays on this page: the gallery, pond, and
 * create flow are not part of this branch.
 */
export function LandingPage() {
  return (
    <main style={{ position: "relative", width: "100%", height: "100dvh", overflow: "hidden", background: "#e4e4e6" }}>
      <div style={{ position: "absolute", inset: 0, zIndex: 40 }}>
        <BlobScene
          classicChrome
          ctaLabel="Enter"
          showPlus={false}
          onNewMemory={() => {}}
        />
      </div>
    </main>
  );
}
