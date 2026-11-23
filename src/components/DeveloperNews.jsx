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
  const [failed, setFailed] = useState(false);
  const url = newsWebUrl(src);
  if (!url || failed) return alt ? <span>{alt}</span> : null;
  return (
    <img
      src={url}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

function NewsMarkdown({ message, onLinkError }) {
  const idPrefix = useId().replace(/[^\w-]/g, "");
  if (!message.trim()) return null;
  return (
    <div className="news-markdown">
      <Markdown
        remarkPlugins={markdownPlugins}
        remarkRehypeOptions={{ clobberPrefix: `${idPrefix}-` }}
        skipHtml
        urlTransform={(value, key) => (key === "href" && value.startsWith("#") ? value : newsWebUrl(value))}
        components={{
          a: ({ href, children }) => <NewsLink href={href} onError={onLinkError}>{children}</NewsLink>,
          img: ({ src, alt }) => <NewsImage key={src} src={src} alt={alt} />,
          table: ({ children }) => <div className="news-table"><table>{children}</table></div>,
        }}
      >
        {message}
      </Markdown>
    </div>
  );
}

