import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../app/globals.css";
import "./static.css";
import DietApp from "../app/DietApp";

const container = document.getElementById("root");

if (!container) {
  throw new Error("Root container #root was not found in the document.");
}

createRoot(container).render(
  <StrictMode>
    <DietApp />
  </StrictMode>,
);
