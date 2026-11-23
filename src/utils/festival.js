import { useEffect, useState } from "react";
import packageInfo from "../../package.json";

const cacheKey = `itune:festival:${packageInfo.version}`;
const inactive = { enabled: false, text: "", color: "" };

export function useFestival() {
  const [config, setConfig] = useState(() => {
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey));
      return cached?.enabled === true ? cached : inactive;
    } catch {
      return inactive;
    }
  });
