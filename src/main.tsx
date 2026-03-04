import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Apply stored theme or default to dark
const storedTheme = localStorage.getItem("app-theme") || "dark";
document.documentElement.classList.add(storedTheme === "light" ? "" : storedTheme);
if (storedTheme === "dark") document.documentElement.classList.add("dark");
if (storedTheme === "night") document.documentElement.classList.add("night");

createRoot(document.getElementById("root")!).render(<App />);
