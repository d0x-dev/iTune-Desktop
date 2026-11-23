const fs = require("fs");
const path = require("path");
const { Readable, Transform } = require("stream");
const { pipeline } = require("stream/promises");

const REPOSITORY = "d0x-dev/iTune-Desktop";
const RELEASES_API = `https://api.github.com/repos/${REPOSITORY}/releases?per_page=100`;
const RELEASES_PAGE = `https://github.com/${REPOSITORY}/releases`;

function versionParts(value) {
  const match = String(value || "").match(/\d+(?:\.\d+)*/);
  return match ? match[0].split(".").map(Number) : [];
}

function compareVersions(first, second) {
  const left = versionParts(first);
  const right = versionParts(second);
  if (!left.length || !right.length) return 0;
  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    const difference = (left[index] || 0) - (right[index] || 0);
    if (difference) return Math.sign(difference);
  }
  return 0;
}

function formatRelease(release) {
  return {
    tag: release.tag_name,
    name: release.name || release.tag_name,
    notes: release.body || "No release notes were published.",
    publishedAt: release.published_at || "",
    url: release.html_url || RELEASES_PAGE,
    prerelease: Boolean(release.prerelease),
    assets: (release.assets || []).map((asset) => ({
      name: asset.name,
      size: Number(asset.size) || 0,
      downloadUrl: asset.browser_download_url,
      contentType: asset.content_type || "application/octet-stream",
    })),
  };
}

async function fetchReleases() {
  const response = await fetch(RELEASES_API, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "iTune-Desktop",
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    throw new Error(`GitHub returned HTTP ${response.status}`);
  }
  const releases = await response.json();
  return releases.filter((release) => !release.draft).map(formatRelease);
}

async function checkForUpdates(currentVersion) {
  const releases = await fetchReleases();
  const stableReleases = releases
    .filter((release) => !release.prerelease && versionParts(release.tag).length)
    .sort((left, right) => compareVersions(right.tag, left.tag));
  const latestRelease = stableReleases[0] || null;
  return {
    repository: REPOSITORY,
    releases,
    latestRelease,
    currentVersion,
    updateAvailable:
      Boolean(latestRelease) &&
      compareVersions(latestRelease.tag, currentVersion) > 0,
    checkedAt: new Date().toISOString(),
    releasesUrl: RELEASES_PAGE,
  };
}

async function findReleaseAsset(tag, assetName) {
  const releases = await fetchReleases();
  const release = releases.find((item) => item.tag === tag);
  const asset = release?.assets.find((item) => item.name === assetName);
  if (!asset) throw new Error("That file is no longer attached to the release.");

  const url = new URL(asset.downloadUrl);
  if (
    !["github.com", "release-assets.githubusercontent.com", "objects.githubusercontent.com"].includes(
      url.hostname,
    )
  ) {
    throw new Error("GitHub returned an unexpected download address.");
  }
  return { release, asset };
}

function isInstallerAsset(name) {
  return /.*(?:setup|installer).*\.exe$/i.test(name);
}

function findPlatformUpdateAsset(assets, platform) {
