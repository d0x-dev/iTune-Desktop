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

function NewsMetadata({ item, fallbackTag = "" }) {
  const date = newsDate(item.timestamp);
  return (
    <div className="news-metadata">
      {(item.tag || fallbackTag) && <span className="news-tag">{item.tag || fallbackTag}</span>}
      {item.author && <span>{item.author}</span>}
      {date && <span>{date}</span>}
    </div>
  );
}

function NewsArticle({ item }) {
  const [linkError, setLinkError] = useState(false);
  const onLinkError = () => setLinkError(true);
  return (
    <article className="news-article">
      <header className="news-article-heading">
        <NewsMetadata item={item} />
        <h2>{item.title || "iTune News"}</h2>
      </header>
      <NewsImage key={item.imageUrl} src={item.imageUrl} className="news-banner" />
      <NewsMarkdown message={item.message} onLinkError={onLinkError} />
      {item.actionUrl && (
        <NewsLink href={item.actionUrl} className="news-article-action" onError={onLinkError}>
          {item.actionText || "Learn More"} <ArrowUpRight size={16} aria-hidden="true" />
        </NewsLink>
      )}
      {linkError && <p className="error-text" role="status">Couldn’t open the link.</p>}
    </article>
  );
}

export function DeveloperNewsView({ feed, initialItemKey }) {
  const [selectedKey, setSelectedKey] = useState(initialItemKey);
  const selected = feed.items.find((item) => newsInstanceKey(item) === selectedKey) ?? feed.items[0];
  return (
    <div className="page news-page" aria-busy={feed.loading}>
      <header className="page-heading">
        <h1>News from dev</h1>
        <button className="icon-button" aria-label="Refresh news" title="Refresh news" onClick={feed.refresh} disabled={feed.loading}>
          <RefreshCw size={17} className={feed.loading ? "news-refreshing" : undefined} />
        </button>
      </header>
      {feed.error && selected && <p className="news-feed-status" role="status">Couldn’t refresh news. Showing saved posts.</p>}
      {selected ? (
        <div className="news-layout">
          <nav className="news-posts" aria-label="News posts">
            {feed.items.map((item) => (
              <button
                key={newsInstanceKey(item)}
                type="button"
                className="news-post"
                aria-current={selected === item ? "true" : undefined}
                onClick={() => setSelectedKey(newsInstanceKey(item))}
              >
                <NewsMetadata item={item} />
                <span className="news-post-title">{item.title || "iTune News"}</span>
              </button>
            ))}
          </nav>
          <NewsArticle key={newsInstanceKey(selected)} item={selected} />
        </div>
      ) : (
        <div className="empty-state" role="status">
          <Newspaper aria-hidden="true" />
          <h2>{feed.loading ? "Checking for news…" : feed.error ? "News couldn’t load" : "No news yet"}</h2>
          {feed.error && <button className="primary-button" onClick={feed.refresh}>Try again</button>}
        </div>
      )}
    </div>
  );
}

export function DeveloperNewsPopup({ item, onDismiss, onOpenNews }) {
  const dialog = useRef(null);
  const [linkError, setLinkError] = useState(false);
  const onLinkError = () => setLinkError(true);

  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);

  return (
    <dialog
      ref={dialog}
      className="news-popup"
      aria-labelledby="news-popup-title"
      onCancel={(event) => { event.preventDefault(); onDismiss(); }}
      onClick={(event) => { if (event.target === event.currentTarget) onDismiss(); }}
    >
      <div className="news-popup-inner">
        <div className="news-popup-body" tabIndex={0}>
          <header className="news-popup-heading">
            <div className="news-popup-icon" aria-hidden="true"><ITuneWaveIcon size={26} /></div>
            <h2 id="news-popup-title">{item.title || "iTune News"}</h2>
            <NewsMetadata item={item} fallbackTag="News from Developer" />
          </header>
          <NewsImage key={item.imageUrl} src={item.imageUrl} className="news-banner" />
          <NewsMarkdown message={item.message} onLinkError={onLinkError} />
          {linkError && <p className="error-text" role="status">Couldn’t open the link.</p>}
        </div>
        <div className="news-popup-actions">
          {item.actionUrl && (
            <NewsLink href={item.actionUrl} onOpen={onDismiss} onError={onLinkError}>
              {item.actionText || "Learn More"} <ArrowUpRight size={15} aria-hidden="true" />
            </NewsLink>
          )}
          <button type="button" onClick={onOpenNews}>All News</button>
          <button type="button" className="news-dismiss" onClick={onDismiss}>Dismiss</button>
        </div>
      </div>
    </dialog>
  );
}
