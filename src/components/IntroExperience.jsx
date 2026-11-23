import React, { useEffect, useRef, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import ITuneWaveIcon from "./ITuneWaveIcon";

// Desktop port of Android iTune WelcomeScreen.kt and SplashScreen.kt.
// Originally created by DxV Studio ~~ Dark. Credits: DxV Studio, AirBeats, Dark. GPL-3.0.
const AMBIENT_FRAMES = [
  ["#0A031D", "#280659", "#FF0080", "#FF8800", "#130533"],
  ["#030304", "#140204", "#DF0024", "#CE001E", "#040406"],
  ["#020309", "#040B22", "#0047FF", "#0043FF", "#02050E"],
  ["#63264D", "#532149", "#FF629C", "#FFB26B", "#663D7F"],
  ["#FFFDFD", "#FFF6F9", "#FF9BBE", "#FFDF9B", "#FFF2F7"],
  ["#FFFFFF", "#FDFBFF", "#FF96BE", "#FFE3A2", "#D6C3FF"],
  ["#281040", "#331350", "#FF3A88", "#FF9A38", "#231144"],
];

const wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));
const GOOGLE_LOGO = `${import.meta.env.BASE_URL}android-icons/ic_google_logo.svg`;

function AmbientMesh() {
  return (
    <div className="welcome-mesh" aria-hidden="true">
      {AMBIENT_FRAMES.map(([base, center, topRight, bottomLeft, bottomRight], index) => (
        <span
          className="welcome-mesh-frame"
          key={base}
          style={{
            "--ambient-delay": `${-35 + index * 5}s`,
            backgroundColor: base,
            backgroundImage: `radial-gradient(circle at 50% 48%, ${center} 0%, transparent 58%), radial-gradient(circle at 94% 4%, ${topRight} 0%, transparent 54%), radial-gradient(circle at 4% 96%, ${bottomLeft} 0%, transparent 52%), radial-gradient(circle at 96% 96%, ${bottomRight} 0%, transparent 48%)`,
          }}
        />
      ))}
      <span className="welcome-mesh-sheen" />
    </div>
  );
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return reduced;
}

function TypingHeadline({ text, multiline = false }) {
  const [visible, setVisible] = useState("");
  const [cursor, setCursor] = useState(true);
  useEffect(() => {
    let active = true;
    const run = async () => {
      while (active) {
        setVisible("");
        setCursor(true);
        await wait(700);
        for (let index = 0; active && index < text.length; index += 1) {
          const character = text[index];
          const previous = text[index - 1];
          const delay =
            62 +
            ((index * 23) % 32) +
            (previous === " " ? 74 : character === " " ? 38 : 0) +
            (character === character.toUpperCase() && /[A-Z]/.test(character) && index > 0 ? 48 : 0);
          await wait(delay);
          if (active) setVisible(text.slice(0, index + 1));
        }
        await wait(280);
        if (!active) break;
        setCursor(false);
        await wait(5500);
        if (!active) break;
        setCursor(true);
        await wait(750);
        for (let deleted = 0; active && deleted < text.length; deleted += 1) {
          await wait(deleted === 0 ? 86 : deleted === 1 ? 62 : deleted === 2 ? 48 : 34 + (deleted % 3) * 4);
          if (active) setVisible(text.slice(0, Math.max(0, text.length - deleted - 1)));
        }
        await wait(520);
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [text]);
  return (
    <h1 className={`welcome-typing ${multiline ? "multiline" : ""}`}>
      {visible}
      <span className={`typing-caret ${cursor ? "" : "hidden"}`} />
    </h1>
  );
}

export function SplashExperience({ newUser, onFinished }) {
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(false);
  const [travel, setTravel] = useState("");
  const [revealing, setRevealing] = useState(false);
  const reducedMotion = useReducedMotion();
  const finishRef = useRef(onFinished);
  finishRef.current = onFinished;

  useEffect(() => {
    let active = true;
    let currentText = "";
    const type = async (value, delay) => {
      setTyping(true);
      for (let index = 1; active && index <= value.length; index += 1) {
        currentText = value.slice(0, index);
        setText(currentText);
        await wait(delay + ((index * 17) % 25));
      }
      setTyping(false);
    };
    const erase = async (delay) => {
      setTyping(true);
      while (active && currentText.length) {
        currentText = currentText.slice(0, -1);
        setText(currentText);
        await wait(delay);
      }
      setTyping(false);
    };
    const run = async () => {
      if (reducedMotion) {
        setText("iTune");
        await wait(260);
      } else {
        await wait(220);
        await type("iTune", 75);
        await wait(550);
        await erase(48);
        await wait(200);
        await type("AirBeats", 68);
        await wait(600);
        await erase(45);
        await wait(200);
        await type("Naah!", 72);
        await wait(600);
        await erase(48);
        await wait(200);
        await type("iTune", 80);
        await wait(480);
      }
      if (!active) return;
      if (!newUser) {
        setRevealing(true);
        await wait(reducedMotion ? 80 : 700);
      }
      setTravel(newUser ? "to-welcome" : "to-home");
      await wait(reducedMotion ? 100 : 850);
      if (active) finishRef.current();
    };
    run();
    return () => {
      active = false;
    };
  }, [newUser, reducedMotion]);

  return (
    <section className={`intro-screen splash-screen ${travel} ${revealing ? "reveal-app" : ""}`}>
      <AmbientMesh />
      <div className="splash-wave"><ITuneWaveIcon size={92} /></div>
      <div className="splash-word">
        {text}<span className={`typing-caret ${typing ? "active" : ""}`} />
      </div>
    </section>
  );
}

export function WelcomeExperience({
  userProfile,
  authLoading,
  onLogin,
  onComplete,
  fromSplash = false,
}) {
  const [step, setStep] = useState("name");
  const [name, setName] = useState(userProfile?.name || "");
  const [nameError, setNameError] = useState(false);
  const [loginBusy, setLoginBusy] = useState(false);
  const [outroText, setOutroText] = useState("");
  const [showLoader, setShowLoader] = useState(false);
  const [travel, setTravel] = useState("");
  const [revealing, setRevealing] = useState(false);
  const finalName = useRef("");
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;
  const reducedMotion = useReducedMotion();

  const submitName = () => {
    const cleaned = name.trim();
    if (!cleaned) {
      setNameError(true);
      return;
    }
    setName(cleaned);
    setStep("google");
  };
  const startOutro = (nextName) => {
    finalName.current = String(nextName || name || "Listener").trim() || "Listener";
    setStep("outro");
  };
  const continueWithGoogle = async () => {
    if (loginBusy || authLoading) return;
    if (userProfile?.isLoggedIn) {
      startOutro(userProfile.name || name);
      return;
    }
    setLoginBusy(true);
    const profile = await onLogin();
    setLoginBusy(false);
    if (profile?.isLoggedIn) startOutro(profile.name || name);
  };

  useEffect(() => {
    if (step !== "outro") return;
    let active = true;
    const type = async (value) => {
      setOutroText("");
      await wait(reducedMotion ? 20 : 360);
      for (let index = 0; active && index < value.length; index += 1) {
        await wait(reducedMotion ? 4 : 62 + ((index * 23) % 32));
        if (active) setOutroText(value.slice(0, index + 1));
      }
    };
    const erase = async (value) => {
      await wait(reducedMotion ? 10 : 320);
      for (let deleted = 0; active && deleted < value.length; deleted += 1) {
        await wait(reducedMotion ? 3 : deleted < 3 ? [86, 62, 48][deleted] : 34 + (deleted % 3) * 4);
        if (active) setOutroText(value.slice(0, Math.max(0, value.length - deleted - 1)));
      }
    };
    const run = async () => {
      const timing = (normal) => (reducedMotion ? 20 : normal);
      setShowLoader(true);
      await type("Signing In");
      await wait(timing(1050));
      await erase("Signing In");
      setShowLoader(false);
      await wait(timing(220));
      const greeting = `Hi, ${finalName.current}, We Got You!`;
      await type(greeting);
      await wait(timing(1250));
      await erase(greeting);
      await wait(timing(220));
      const customising = "Customising Your feed..";
      await type(customising);
      await wait(timing(1150));
      await erase(customising);
      await wait(timing(240));
      setOutroText("iTune");
      setTravel("to-center");
      await wait(timing(1430));
      await erase("iTune");
      await wait(timing(2000));
      await type("AirBeats");
      await wait(timing(2500));
      await erase("AirBeats");
      await wait(timing(220));
      await type("iTune");
      await wait(timing(520));
      setRevealing(true);
      await wait(timing(960));
      setTravel("to-home");
      await wait(timing(860));
      if (active) completeRef.current(finalName.current);
    };
    run();
    return () => {
      active = false;
    };
  }, [step, reducedMotion]);

  const brandTraveling = step === "outro" && travel;
  return (
    <section className={`intro-screen welcome-screen ${fromSplash ? "from-splash" : ""} ${travel} ${revealing ? "reveal-app" : ""}`}>
      <AmbientMesh />
      {!brandTraveling && (
        <header className="welcome-corner-brand">
          <ITuneWaveIcon size={34} />
          <strong>iTune</strong>
        </header>
      )}

      {step === "name" && (
        <div className="welcome-panel name-step">
          <TypingHeadline text="Welcome to iTune" />
          <label className={`welcome-name-field ${nameError ? "error" : ""}`}>
            <input
              value={name}
              autoFocus
              placeholder="Your Name"
              onChange={(event) => {
                setName(event.target.value);
                if (event.target.value.trim()) setNameError(false);
              }}
              onKeyDown={(event) => event.key === "Enter" && submitName()}
            />
          </label>
          {nameError && <p>Enter your name to personalize iTune</p>}
