import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { AuthProvider } from "./auth/AuthProvider";
import { AppRoutes } from "./routes";
import { applyTheme, preferredTheme, ThemeProvider } from "./theme";
import "./styles.css";

applyTheme(preferredTheme());
createRoot(document.getElementById("root")!).render(
  <StrictMode><ThemeProvider><BrowserRouter><AuthProvider><AppRoutes /></AuthProvider></BrowserRouter></ThemeProvider></StrictMode>,
);
