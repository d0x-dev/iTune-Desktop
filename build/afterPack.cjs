const path = require("node:path");

module.exports = async (context) => {
  if (context.electronPlatformName !== "win32") return;

  const { rcedit } = await import("rcedit");
  const executable = path.join(context.appOutDir, "iTune Desktop.exe");
  await rcedit(executable, {
    "version-string": {
      FileDescription: "iTune Desktop",
      ProductName: "iTune Desktop",
      InternalName: "iTune Desktop",
      CompanyName: "iTune",
    },
    "file-version": context.packager.appInfo.version,
    "product-version": context.packager.appInfo.version,
    icon: path.join(context.packager.projectDir, "build", "icon.ico"),
  });
};
