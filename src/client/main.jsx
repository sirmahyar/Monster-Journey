import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";
import "./styles/fonts.css";
import "./styles/app.css";

// Canvas text falls back to a system font until the face has loaded, so fetch the HUD weights up front.
for (const weight of [700, 800, 900]) document.fonts?.load(`${weight} 20px Vazirmatn`).catch(() => {});

createRoot(document.getElementById("root")).render(<App />);
