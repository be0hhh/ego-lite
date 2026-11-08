import { execFileSync } from "node:child_process";

export function createBrowserPathMapper(windowsPaths = false) {
  if (!windowsPaths || process.platform === "win32") return (path) => path;
  const translated = new Map();
  return (path) => {
    if (!translated.has(path)) {
      const value = execFileSync("wslpath", ["-w", path], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "inherit"],
      });
      translated.set(path, value.replace(/\r?\n$/, "").replaceAll("\\", "/"));
    }
    return translated.get(path);
  };
}

export function mapBrowserContextPaths(context, toBrowserPath) {
  const result = { ...context };
  for (const key of [
    "artifactDir",
    "tempDir",
    "uploadPath",
    "uploadPathTwo",
    "explicitScreenshotPath",
    "environmentScreenshotPath",
    "metadataPath",
  ]) {
    if (typeof result[key] === "string") {
      result[key] = toBrowserPath(result[key]);
    }
  }
  return result;
}
