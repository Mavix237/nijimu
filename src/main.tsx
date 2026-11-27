
  import { createRoot } from "react-dom/client";
  import App from "./app/App";
  import "./styles/index.css";
  import { startAnalytics } from "./app/lib/analytics";

  startAnalytics();

  createRoot(document.getElementById("root")!).render(<App />);
  