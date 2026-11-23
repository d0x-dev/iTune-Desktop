import React, { useEffect, useId, useRef, useState } from "react";
import { ArrowUpRight, Newspaper, RefreshCw } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { newsInstanceKey, newsWebUrl } from "../../shared/developerNews.mjs";
import ITuneWaveIcon from "./ITuneWaveIcon";
import "./developerNews.css";

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });
const markdownPlugins = [remarkGfm];

function newsDate(timestamp) {
  const date = new Date(timestamp);
  return timestamp && !Number.isNaN(date.getTime()) ? dateFormat.format(date) : "";
}

function NewsLink({ href, className, children, onOpen, onError }) {
  const link = href?.startsWith("#") ? href : newsWebUrl(href);
  if (!link) return <span>{children}</span>;

  function open(event) {
    if (event.type === "auxclick" && event.button !== 1) return;
    event.preventDefault();
    if (link.startsWith("#")) {
      document.getElementById(link.slice(1))?.scrollIntoView({ block: "nearest" });
      return;
    }
    window.api.news.openLink(link).then(onOpen).catch(() => onError?.());
  }

  return (
    <a href={link} className={className} onClick={open} onAuxClick={open}>
      {children}
    </a>
  );
}

function NewsImage({ src, alt = "", className }) {
