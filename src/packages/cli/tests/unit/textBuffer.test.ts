import { describe, it, expect } from "vitest";
import * as buf from "../../src/tui/textBuffer.js";

/** Compact literal for a buffer: `ab|cd` means the caret sits between b and c. */
function at(text: string): buf.TextBuffer {
  const cursor = text.indexOf("|");
  return { text: text.replace("|", ""), cursor: cursor === -1 ? text.length : cursor };
}

function show(buffer: buf.TextBuffer): string {
  return `${buffer.text.slice(0, buffer.cursor)}|${buffer.text.slice(buffer.cursor)}`;
}

describe("construction", () => {
  it("starts empty with the caret at the origin", () => {
    expect(buf.EMPTY_BUFFER).toEqual({ text: "", cursor: 0 });
  });

  it("puts the caret at the end when seeded from text", () => {
    expect(show(buf.fromText("hello"))).toBe("hello|");
  });
});

describe("insert", () => {
  it("inserts at the caret and advances past the inserted text", () => {
    expect(show(buf.insert(at("ab|cd"), "XY"))).toBe("abXY|cd");
  });

  it("appends to an empty buffer", () => {
    expect(show(buf.insert(buf.EMPTY_BUFFER, "hi"))).toBe("hi|");
  });

  it("inserts multi-line chunks verbatim", () => {
    expect(buf.insert(at("a|b"), "1\n2").text).toBe("a1\n2b");
  });
});

describe("delete", () => {
  it("backspace removes the character before the caret", () => {
    expect(show(buf.backspace(at("ab|cd")))).toBe("a|cd");
  });

  it("backspace is a no-op at the start of the buffer", () => {
    const start = at("|abc");
    expect(buf.backspace(start)).toBe(start);
  });

  it("delete removes the character under the caret", () => {
    expect(show(buf.deleteForward(at("ab|cd")))).toBe("ab|d");
  });

  it("delete is a no-op at the end of the buffer", () => {
    const end = at("abc|");
    expect(buf.deleteForward(end)).toBe(end);
  });
});

describe("character movement", () => {
  it("moves left and right by one", () => {
    expect(show(buf.moveLeft(at("ab|cd")))).toBe("a|bcd");
    expect(show(buf.moveRight(at("ab|cd")))).toBe("abc|d");
  });

  it("stops at both ends rather than wrapping", () => {
    const start = at("|abc");
    const end = at("abc|");
    expect(buf.moveLeft(start)).toBe(start);
    expect(buf.moveRight(end)).toBe(end);
  });
});

describe("line boundaries", () => {
  it("finds the start of the current line", () => {
    expect(buf.lineStart("one\ntwo", 5)).toBe(4);
    expect(buf.lineStart("one\ntwo", 2)).toBe(0);
    expect(buf.lineStart("one", 0)).toBe(0);
  });

  it("finds the end of the current line", () => {
    expect(buf.lineEnd("one\ntwo", 1)).toBe(3);
    expect(buf.lineEnd("one\ntwo", 5)).toBe(7);
  });

  it("home and end move within the current line only", () => {
    expect(show(buf.moveHome(at("one\ntw|o")))).toBe("one\n|two");
    expect(show(buf.moveEnd(at("on|e\ntwo")))).toBe("one|\ntwo");
  });
});

describe("word movement", () => {
  it("jumps left over whitespace and then over the word", () => {
    expect(show(buf.moveWordLeft(at("alpha beta|")))).toBe("alpha |beta");
    expect(show(buf.moveWordLeft(at("alpha beta  |")))).toBe("alpha |beta  ");
  });

  it("jumps right over whitespace and then over the word", () => {
    expect(show(buf.moveWordRight(at("|alpha beta")))).toBe("alpha| beta");
    expect(show(buf.moveWordRight(at("alpha|  beta")))).toBe("alpha  beta|");
  });

  it("clamps at the buffer ends", () => {
    expect(buf.moveWordLeft(at("|abc")).cursor).toBe(0);
    expect(buf.moveWordRight(at("abc|")).cursor).toBe(3);
  });

  it("deletes the word to the left", () => {
    expect(show(buf.deleteWordLeft(at("alpha beta|")))).toBe("alpha |");
    expect(show(buf.deleteWordLeft(at("alpha beta| gamma")))).toBe("alpha | gamma");
  });

  it("leaves the buffer untouched when there is no word to delete", () => {
    const start = at("|abc");
    expect(buf.deleteWordLeft(start)).toBe(start);
  });
});

describe("line kills", () => {
  it("kills to the end of the line", () => {
    expect(show(buf.killToLineEnd(at("ab|cd")))).toBe("ab|");
    expect(show(buf.killToLineEnd(at("ab|cd\nef")))).toBe("ab|\nef");
  });

  it("kills to the start of the line", () => {
    expect(show(buf.killToLineStart(at("ab|cd")))).toBe("|cd");
    expect(show(buf.killToLineStart(at("ab\ncd|ef")))).toBe("ab\n|ef");
  });

  it("is a no-op when the caret already sits at the boundary", () => {
    const lineEnd = at("abc|");
    const lineHead = at("|abc");
    expect(buf.killToLineEnd(lineEnd)).toBe(lineEnd);
    expect(buf.killToLineStart(lineHead)).toBe(lineHead);
  });
});

describe("newline", () => {
  it("inserts a line break at the caret", () => {
    expect(show(buf.newline(at("ab|cd")))).toBe("ab\n|cd");
  });
});

describe("splitAtCursor", () => {
  it("splits around the character under the caret", () => {
    expect(buf.splitAtCursor(at("ab|cd"))).toEqual({ before: "ab", at: "c", after: "d" });
  });

  it("renders a space when the caret is past the last character", () => {
    expect(buf.splitAtCursor(at("abc|"))).toEqual({ before: "abc", at: " ", after: "" });
  });

  it("renders a newline under the caret as a space so the row stays intact", () => {
    expect(buf.splitAtCursor(at("ab|\ncd"))).toEqual({ before: "ab", at: " ", after: "cd" });
  });
});

describe("looksLikePaste", () => {
  it("treats multi-character input containing a newline as a paste", () => {
    expect(buf.looksLikePaste("a\nb")).toBe(true);
  });

  it("treats long input as a paste", () => {
    expect(buf.looksLikePaste("123456789")).toBe(true);
  });

  it("treats ordinary keystrokes and short sequences as typing", () => {
    expect(buf.looksLikePaste("a")).toBe(false);
    expect(buf.looksLikePaste("")).toBe(false);
    expect(buf.looksLikePaste("12345678")).toBe(false);
    expect(buf.looksLikePaste("\n")).toBe(false);
  });
});
