import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import "./apple.css";
import { initializeBrowserApi } from "./utils/browserApi";
import { PreferencesProvider } from "./utils/preferences";

initializeBrowserApi();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <PreferencesProvider>
      <App />
    </PreferencesProvider>
  </React.StrictMode>,
);
