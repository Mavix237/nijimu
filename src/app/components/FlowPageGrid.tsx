import type { CSSProperties, ReactNode, Ref } from "react";
import { FLOW_PAGE } from "../lib/theme";

/** Shared screen rows. Navigation stays above the content heading; the scene
 * remains interactive through empty grid cells. Used across the current flow. */
export function FlowPageGrid({ heading, scene, actions, headingRef, headingStyle, actionsStyle, style, headingTop = FLOW_PAGE.headingTop, actionBottom = FLOW_PAGE.actionBottom }: {
  heading?: ReactNode;
  scene?: ReactNode;
  actions?: ReactNode;
  headingRef?: Ref<HTMLDivElement>;
  headingStyle?: CSSProperties;
  actionsStyle?: CSSProperties;
  style?: CSSProperties;
  headingTop?: string;
  actionBottom?: string;
}) {
  return <div data-flow-grid style={{
    position: "absolute", inset: 0, display: "grid",
    // the side margin the header keeps (responsive.css; 20px off a phone)
    gridTemplateColumns: "var(--chrome-inset, 20px) minmax(0, 1fr) var(--chrome-inset, 20px)",
    gridTemplateRows: `[navigation] ${FLOW_PAGE.navigationHeight}px [space] calc(${headingTop} - ${FLOW_PAGE.navigationHeight}px) [heading] max-content [scene] minmax(0, 1fr) [actions] max-content [footer] ${actionBottom}`,
    pointerEvents: "none", zIndex: 30, ...style,
  }}>
    <div ref={headingRef} data-flow-heading style={{
      gridColumn: 2, gridRow: "heading", justifySelf: "center", alignSelf: "start",
      width: "100%", maxWidth: FLOW_PAGE.headingWidth, textAlign: "center", ...headingStyle,
    }}>{heading}</div>
    {scene && <div data-flow-scene style={{ gridColumn: 2, gridRow: "scene", position: "relative", minHeight: 0 }}>{scene}</div>}
    <div data-flow-actions style={{
      gridColumn: 2, gridRow: "actions", justifySelf: "center", alignSelf: "end",
      display: "flex", justifyContent: "center", minHeight: FLOW_PAGE.actionHeight, pointerEvents: actions ? "auto" : "none", ...actionsStyle,
    }}>{actions}</div>
  </div>;
}
