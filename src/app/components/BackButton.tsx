import { useNavigate } from "react-router";

interface BackButtonProps {
  onClick?: () => void;
}

/** Same centerline as the wordmark and the corner icons (those are 36px at top 22). */
const HEADER_CENTER = 40;
const BACK_SIZE = 32;

export function BackButton({ onClick }: BackButtonProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      navigate(-1); // Go back to previous page
    }
  };

  return (
    <button
      onClick={handleClick}
      aria-label="back"
      style={{
        position: "absolute",
        top: HEADER_CENTER - BACK_SIZE / 2,
        left: "var(--chrome-left)",
        width: BACK_SIZE,
        height: BACK_SIZE,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "transparent",
        border: "none",
        cursor: "pointer",
        padding: 0,
        zIndex: 100,
        opacity: 0.6,
        transition: "opacity 0.2s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.opacity = "1";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.opacity = "0.6";
      }}
    >
      {/* Left arrow */}
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#7b7b87"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
    </button>
  );
}