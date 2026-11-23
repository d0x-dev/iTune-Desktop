import { useCallback, useEffect, useRef, useState } from "react";

/* Shelf ordering adapted from iTune Android, DxV Studio / Dark, GPL-3.0. */
export function mergeSections(previous, incoming) {
  const sections = previous.map((section) => ({
    ...section,
    contents: [...section.contents],
  }));
  for (const section of incoming.filter(
    (section) => section.contents?.length,
  )) {
    const key = `${section.title.trim().toLowerCase()}|${section.strapline || ""}`;
    const existing = sections.find(
      (item) =>
        `${item.title.trim().toLowerCase()}|${item.strapline || ""}` === key,
    );
    if (!existing) {
      sections.push(section);
      continue;
    }
    const seen = new Set(
      existing.contents.map((item) => `${item.type}:${item.id}`),
    );
    existing.contents.push(
      ...section.contents.filter((item) => {
        const key = `${item.type}:${item.id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }),
    );
  }
  return sections;
}
export function orderedSections(sections, signedIn) {
  const priority = (section) => {
    if (/quick picks/i.test(section.title)) return 0;
    if (section.group === "personal") return 1;
    if (!signedIn && section.group === "trending") return 2;
    if (section.group === "feed" || !section.group) return 3;
    if (section.group === "trending") return 4;
    if (section.group === "charts") return 5;
    if (section.group === "podcasts") return 6;
    return 7;
  };
  return [...sections].sort((a, b) => priority(a) - priority(b));
}
export function useHomeFeed(kind, userProfile) {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [continuation, setContinuation] = useState(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const generation = useRef(0);
  const loadingNext = useRef(false);
  const tokens = useRef(new Set());
  const browseId = kind === "new" ? "FEmusic_explore" : "FEmusic_home";
  const append = useCallback(
    (data) =>
      setSections((previous) => mergeSections(previous, data?.sections || [])),
    [],
  );
  useEffect(() => {
    let active = true;
    const currentGeneration = ++generation.current;
    tokens.current.clear();
    setSections([]);
    setError("");
    setLoading(true);
    setLoadingMore(false);
    setContinuation(null);
    loadingNext.current = true;
    const initial = async () => {
      try {
        let page = await window.api.yt.getHome({ browseId, page: "initial" });
        if (!active) return;
        if (page?.error) throw new Error(page.error);
        append(page);
        setLoading(false);
        // Match the Android feed's initial continuation depth, then page further on scroll.
        for (let index = 0; active && page?.continuation && index < 3; index++) {
          const token = page.continuation;
          setContinuation(token);
          setLoadingMore(true);
          const next = await window.api.yt.getHome({ browseId, continuation: token });
          if (!active) return;
          if (next?.error) throw new Error(next.error);
          tokens.current.add(token);
          page = next;
          append(page);
          if (tokens.current.has(page?.continuation)) {
            setContinuation(null);
            return;
          }
        }
        if (active) setContinuation(page?.continuation || null);
      } catch {
        if (active) setError("Some music couldn’t load. Try refreshing.");
      } finally {
        if (active) {
          loadingNext.current = false;
          setLoading(false);
          setLoadingMore(false);
        }
      }
    };
    initial();
    if (kind === "home") {
      const feeds = ["FEmusic_explore", "FEmusic_non_music_audio"];
      if (!userProfile?.isLoggedIn) feeds.push("FEmusic_charts");
      for (const feed of feeds)
        window.api.yt
          .getHome({ browseId: feed, page: "initial" })
          .then((data) => {
            if (active) append(data);
          })
          .catch(() => {});
      if (userProfile?.isLoggedIn) {
        window.api.yt
          .getHistory()
          .then((data) => {
            if (!active) return;
            const seen = new Set();
            const recent = (data?.sections || [])
              .flatMap((section) => section.contents || [])
              .filter((item) => {
                if (seen.has(item.id)) return false;
                seen.add(item.id);
                return true;
              })
              .slice(0, 20);
            append({
              sections: [
                {
                  key: "personal-recent",
                  title: "Recently Played",
                  group: "personal",
                  layout: "songs",
                  contents: recent,
                },
              ],
            });
          })
          .catch(() => {});
        window.api.yt
          .getSubscribedArtists()
          .then((data) => {
            if (active)
              append({
                sections: [
                  {
                    key: "personal-artists",
                    title: "Your Artists",
                    group: "personal",
                    layout: "artists",
                    contents: (data?.artists || []).map((artist) => ({
                      ...artist,
                      title: artist.name,
                      type: "artist",
                    })),
                  },
                ],
              });
          })
          .catch(() => {});
        window.api.yt
          .getPlaylists()
          .then((data) => {
