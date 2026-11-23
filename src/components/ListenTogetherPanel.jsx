import React, { useEffect, useState } from "react";
import {
  Check,
  Cloud,
  Copy,
  Loader2,
  LogOut,
  Radio,
  RefreshCw,
  Wifi,
  X,
} from "lucide-react";
import AndroidIcon from "./AndroidIcon";

export default function ListenTogetherPanel({
  session,
  role,
  connectionMode,
  displayName,
  settings,
  error,
  busy,
  onCreate,
  onJoin,
  onHostLan,
  onJoinLan,
  onScanLan,
  lanHosts,
  scanningLan,
  localIp,
  onLeave,
  onSettingsChange,
  onClose,
}) {
  const [name, setName] = useState(displayName || "iTune Listener");
  const [code, setCode] = useState("");
