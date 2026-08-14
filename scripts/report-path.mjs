import { basename, isAbsolute, relative, resolve, sep } from "node:path";

export function toPortableReportPath(inputPath, projectRoot = process.cwd()) {
  const absolutePath = resolve(inputPath);
  const relativePath = relative(resolve(projectRoot), absolutePath);
  const outsideProject =
    relativePath === ".." ||
    relativePath.startsWith(`..${sep}`) ||
    isAbsolute(relativePath);

  if (outsideProject) {
    return basename(absolutePath);
  }

  return relativePath.split(sep).join("/") || ".";
}
