import { describe, it, expect } from "vitest";
import {
  createTheme,
  detectGlyphSet,
  detectTheme,
  detectThemeName,
  fg,
  border,
  isThemeName,
  DEFAULT_THEME,
  THEME_NAMES,
} from "../../src/theme/theme.js";
import { PALETTES } from "../../src/theme/palette.js";
import { GLYPH_SETS } from "../../src/theme/glyphs.js";

describe("theme detection", () => {
  it("disables colour when NO_COLOR is set to any non-empty value", () => {
    expect(detectThemeName({ env: { NO_COLOR: "1" } })).toBe("mono");
    expect(detectThemeName({ env: { NO_COLOR: "anything" } })).toBe("mono");
  });

  it("ignores an empty NO_COLOR", () => {
    expect(detectThemeName({ env: { NO_COLOR: "" }, colorDepth: 24 })).toBe("moonlight");
  });

  it("disables colour when FORCE_COLOR is explicitly zero", () => {
    expect(detectThemeName({ env: { FORCE_COLOR: "0" } })).toBe("mono");
  });

  it("honours an explicit CANTILUNE_THEME over detection", () => {
    expect(detectThemeName({ env: { CANTILUNE_THEME: "daylight" }, colorDepth: 24 })).toBe(
      "daylight",
    );
    expect(detectThemeName({ env: { CANTILUNE_THEME: "ansi" }, colorDepth: 24 })).toBe("ansi");
  });

  it("falls through to detection when CANTILUNE_THEME is not a known theme", () => {
    expect(detectThemeName({ env: { CANTILUNE_THEME: "neon" }, colorDepth: 24 })).toBe("moonlight");
  });

  it("maps colour depth onto palette fidelity", () => {
    expect(detectThemeName({ env: {}, colorDepth: 1 })).toBe("mono");
    expect(detectThemeName({ env: {}, colorDepth: 4 })).toBe("ansi");
    expect(detectThemeName({ env: {}, colorDepth: 8 })).toBe("ansi");
    expect(detectThemeName({ env: {}, colorDepth: 24 })).toBe("moonlight");
  });

  it("assumes truecolor when the stream reports no depth", () => {
    expect(detectThemeName({ env: {} })).toBe("moonlight");
  });

  it("picks the light palette when COLORFGBG reports a light background", () => {
    expect(detectThemeName({ env: { COLORFGBG: "0;15" }, colorDepth: 24 })).toBe("daylight");
    expect(detectThemeName({ env: { COLORFGBG: "0;7" }, colorDepth: 24 })).toBe("daylight");
    expect(detectThemeName({ env: { COLORFGBG: "15;0" }, colorDepth: 24 })).toBe("moonlight");
  });

  it("only consults COLORFGBG for truecolor terminals", () => {
    expect(detectThemeName({ env: { COLORFGBG: "0;15" }, colorDepth: 4 })).toBe("ansi");
  });
});

describe("glyph set detection", () => {
  it("uses ascii when explicitly requested", () => {
    expect(detectGlyphSet({ CANTILUNE_ASCII: "1" })).toBe("ascii");
  });

  it("uses unicode when the locale names a UTF-8 encoding", () => {
    expect(detectGlyphSet({ LANG: "en_US.UTF-8" })).toBe("unicode");
    expect(detectGlyphSet({ LC_ALL: "zh_CN.utf8" })).toBe("unicode");
  });

  it("falls back to ascii for a non-UTF locale", () => {
    expect(detectGlyphSet({ LANG: "en_US.ISO-8859-1" })).toBe("ascii");
  });

  it("treats an absent locale as unicode-capable", () => {
    expect(detectGlyphSet({})).toBe("unicode");
  });

  it("prefers LC_ALL over LC_CTYPE and LANG", () => {
    expect(detectGlyphSet({ LC_ALL: "C", LC_CTYPE: "en_US.UTF-8", LANG: "en_US.UTF-8" })).toBe(
      "ascii",
    );
    expect(detectGlyphSet({ LC_CTYPE: "en_US.UTF-8", LANG: "C" })).toBe("unicode");
  });
});

describe("theme construction", () => {
  it("pairs each theme name with its palette", () => {
    for (const name of THEME_NAMES) {
      expect(createTheme(name).colors).toBe(PALETTES[name]);
    }
  });

  it("uses box-drawing borders for unicode and classic for ascii", () => {
    expect(createTheme("moonlight", "unicode").border).toBe("round");
    expect(createTheme("moonlight", "ascii").border).toBe("classic");
  });

  it("carries the matching glyph set", () => {
    expect(createTheme("ansi", "ascii").glyphs).toBe(GLYPH_SETS.ascii);
    expect(createTheme("ansi", "unicode").glyphs).toBe(GLYPH_SETS.unicode);
  });

  it("builds a usable theme from the live environment", () => {
    const theme = detectTheme({ CANTILUNE_THEME: "mono", LANG: "en_US.UTF-8" });
    expect(theme.name).toBe("mono");
    expect(theme.glyphs).toBe(GLYPH_SETS.unicode);
  });

  it("defaults to the moonlight unicode theme", () => {
    expect(DEFAULT_THEME.name).toBe("moonlight");
    expect(DEFAULT_THEME.border).toBe("round");
  });

  it("gives every mono token an undefined colour so nothing is tinted", () => {
    expect(Object.values(PALETTES.mono).every((value) => value === undefined)).toBe(true);
  });

  it("gives every non-mono palette the same token set", () => {
    const reference = Object.keys(PALETTES.moonlight).sort();
    for (const name of THEME_NAMES) {
      expect(Object.keys(PALETTES[name]).sort()).toEqual(reference);
    }
  });
});

describe("colour prop helpers", () => {
  it("omits the prop entirely for an undefined colour", () => {
    expect(fg(undefined)).toEqual({});
    expect(border(undefined)).toEqual({});
  });

  it("spreads a defined colour into the matching prop name", () => {
    expect(fg("#7AA2F7")).toEqual({ color: "#7AA2F7" });
    expect(border("cyan")).toEqual({ borderColor: "cyan" });
  });
});

describe("isThemeName", () => {
  it("accepts every published theme name", () => {
    for (const name of THEME_NAMES) {
      expect(isThemeName(name)).toBe(true);
    }
  });

  it("rejects anything else", () => {
    expect(isThemeName("solarized")).toBe(false);
    expect(isThemeName(undefined)).toBe(false);
    expect(isThemeName(42)).toBe(false);
    expect(isThemeName(null)).toBe(false);
  });
});
