const path = require("node:path");

module.exports = async (context) => {
  if (context.electronPlatformName !== "win32") return;

  const { rcedit } = await import("rcedit");
  const executable = path.join(context.appOutDir, "iTune Desktop.exe");
  await rcedit(executable, {
    "version-string": {
