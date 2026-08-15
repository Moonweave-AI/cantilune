import path from "node:path";

export function resolveSafePath(rootDir: string, userPath: string): string {
  const normalizedRoot = path.resolve(rootDir);
  const resolved = path.resolve(normalizedRoot, userPath);

  const relative = path.relative(normalizedRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Path outside allowed root: ${userPath}`);
  }

  return resolved;
}

export function matchGlobPattern(name: string, pattern: string): boolean {
  const regex = globToRegExp(pattern);
  return regex.test(name);
}

function globToRegExp(glob: string): RegExp {
  let regex = "^";
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i];
    if (ch === "*") {
      if (glob[i + 1] === "*") {
        regex += ".*";
        i++;
      } else {
        regex += String.raw`[^/\\]*`;
      }
    } else if (ch === "?") {
      regex += ".";
    } else if (ch === ".") {
      regex += String.raw`\.`;
    } else if (/[+^${}()|[\]\\]/.test(ch ?? "")) {
      regex += `\\${ch}`;
    } else {
      regex += ch;
    }
  }
  regex += "$";
  return new RegExp(regex, "i");
}
