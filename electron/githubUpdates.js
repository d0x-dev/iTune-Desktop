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
