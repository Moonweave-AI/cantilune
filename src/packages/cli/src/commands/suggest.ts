/**
 * Hierarchical completion for slash input.
 *
 * Command names are multi-word (`/world actors`, `/schema epoch history`), so
 * offering all 68 of them as one flat list is both long and hides the structure
 * that is already there. This derives the next level of the tree for whatever
 * has been typed so far, letting the palette show ~20 short rows and drill in
 * as the user keeps typing.
 */
import type { CommandArg, CommandCategory, SlashCommand } from "./registry.js";

export interface CommandSuggestion {
  /** Full text to insert when accepted, e.g. `/world actors`. */
  readonly name: string;
  /** Just the segment this row contributes, e.g. `actors` — keeps rows short. */
  readonly label: string;
  readonly description: string;
  readonly category: CommandCategory;
  /** The runnable command at exactly this name, when one is registered. */
  readonly command: SlashCommand | undefined;
  /** Commands nested below this name; non-zero means accepting drills in. */
  readonly childCount: number;
  /** Required argument names not yet supplied. */
  readonly requiredArgs: readonly string[];
}

export interface CommandUsage {
  readonly name: string;
  readonly description: string;
  readonly args: readonly CommandArg[];
  /** Positional argument the caret sits on. */
  readonly argIndex: number;
  /** Required argument names still outstanding. */
  readonly missing: readonly string[];
}

export interface SuggestResult {
  readonly suggestions: readonly CommandSuggestion[];
  /** Set once the caret is past a resolved command's own name. */
  readonly usage: CommandUsage | null;
  /** Whether the text names a command whose required arguments are all present. */
  readonly runnable: boolean;
}

const EMPTY_RESULT: SuggestResult = { suggestions: [], usage: null, runnable: false };

/** Deep fuzzy matches appended at the top level, so `/actors` still finds `/world actors`. */
const FUZZY_MIN_FRAGMENT = 2;
const FUZZY_LIMIT = 6;

function nameWords(command: SlashCommand): readonly string[] {
  return command.name.replace(/^\//, "").toLowerCase().split(/\s+/).filter(Boolean);
}

function requiredPositionals(command: SlashCommand): readonly CommandArg[] {
  return (command.args ?? []).filter((arg) => arg.required && !arg.name.startsWith("--"));
}

/** The command named by the longest leading run of `words`. */
function longestPrefix(
  commands: readonly SlashCommand[],
  words: readonly string[],
): { readonly command: SlashCommand; readonly wordCount: number } | undefined {
  for (let wordCount = words.length; wordCount >= 1; wordCount--) {
    const target = words.slice(0, wordCount).join(" ");
    const command = commands.find((entry) => nameWords(entry).join(" ") === target);
    if (command !== undefined) return { command, wordCount };
  }
  return undefined;
}

interface Bucket {
  command: SlashCommand | undefined;
  childCount: number;
  firstCategory: CommandCategory;
}

function pluralSubcommands(count: number): string {
  return count === 1 ? "1 subcommand" : `${count} subcommands`;
}

/**
 * One row per distinct next segment below `prefixWords`, filtered by `fragment`.
 *
 * A segment can be both a runnable command and a parent (`/world` lists actors
 * and tasks yet also runs on its own), so both facts are carried through rather
 * than collapsed into a single "is a leaf" flag.
 */
function nextLevel(
  commands: readonly SlashCommand[],
  prefixWords: readonly string[],
  fragment: string,
): readonly CommandSuggestion[] {
  const depth = prefixWords.length;
  const buckets = new Map<string, Bucket>();

  for (const command of commands) {
    const words = nameWords(command);
    if (words.length <= depth) continue;
    if (!prefixWords.every((word, index) => words[index] === word)) continue;

    const segment = words[depth];
    if (segment === undefined || !segment.startsWith(fragment)) continue;

    const bucket = buckets.get(segment) ?? {
      command: undefined,
      childCount: 0,
      firstCategory: command.category,
    };
    if (words.length === depth + 1) bucket.command = command;
    else bucket.childCount += 1;
    buckets.set(segment, bucket);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([segment, bucket]) => {
      const name = `/${[...prefixWords, segment].join(" ")}`;
      return {
        name,
        label: depth === 0 ? name : segment,
        description: bucket.command?.description ?? pluralSubcommands(bucket.childCount),
        category: bucket.command?.category ?? bucket.firstCategory,
        command: bucket.command,
        childCount: bucket.childCount,
        requiredArgs:
          bucket.command === undefined
            ? []
            : requiredPositionals(bucket.command).map((arg) => arg.name),
      };
    });
}

/** Leaf matches anywhere in the tree, for users who know the last word only. */
function deepMatches(
  commands: readonly SlashCommand[],
  fragment: string,
  exclude: ReadonlySet<string>,
): readonly CommandSuggestion[] {
  return commands
    .filter((command) => {
      const words = nameWords(command);
      if (words.length < 2) return false;
      if (exclude.has(`/${words.join(" ")}`)) return false;
      return words.slice(1).some((word) => word.startsWith(fragment));
    })
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, FUZZY_LIMIT)
    .map((command) => ({
      name: command.name,
      label: command.name,
      description: command.description,
      category: command.category,
      command,
      childCount: 0,
      requiredArgs: requiredPositionals(command).map((arg) => arg.name),
    }));
}

function usageFor(
  command: SlashCommand,
  suppliedCount: number,
  endsWithSpace: boolean,
): CommandUsage {
  const required = requiredPositionals(command);
  return {
    name: command.name,
    description: command.description,
    args: command.args ?? [],
    argIndex: Math.max(0, endsWithSpace ? suppliedCount : suppliedCount - 1),
    missing: required.slice(suppliedCount).map((arg) => arg.name),
  };
}

/**
 * Completion state for the raw input text.
 *
 * `query` is the whole buffer, so trailing whitespace is meaningful: `/world`
 * offers segments starting with "world", while `/world ` has committed that
 * word and offers what lives beneath it.
 */
export function suggestCommands(commands: readonly SlashCommand[], query: string): SuggestResult {
  const raw = query.trimStart();
  if (!raw.startsWith("/")) return EMPTY_RESULT;

  const body = raw.slice(1);
  const endsWithSpace = body.length > 0 && /\s$/.test(body);
  const words = body.trim().toLowerCase().split(/\s+/).filter(Boolean);

  const depth = endsWithSpace ? words.length : Math.max(0, words.length - 1);
  const prefixWords = words.slice(0, depth);
  const fragment = endsWithSpace ? "" : (words[depth] ?? "");

  let suggestions = nextLevel(commands, prefixWords, fragment);
  if (depth === 0 && fragment.length >= FUZZY_MIN_FRAGMENT) {
    const shown = new Set(suggestions.map((entry) => entry.name));
    suggestions = [...suggestions, ...deepMatches(commands, fragment, shown)];
  }

  const resolved = longestPrefix(commands, words);
  if (resolved === undefined) return { suggestions, usage: null, runnable: false };

  const supplied = Math.max(0, words.length - resolved.wordCount);
  const runnable = supplied >= requiredPositionals(resolved.command).length;

  // Once the caret is past the command's own words and nothing deeper matches,
  // the user is typing arguments — a usage line is far more useful than an
  // empty candidate list.
  const pastName = words.length > resolved.wordCount || endsWithSpace;
  const usage =
    pastName && suggestions.length === 0
      ? usageFor(resolved.command, supplied, endsWithSpace)
      : null;

  return { suggestions, usage, runnable };
}

/**
 * Text the input buffer should hold after accepting `suggestion`.
 *
 * A trailing space is appended whenever more input is expected, which is what
 * makes repeated Tab walk down the tree: accepting `/world` yields `/world `,
 * and the next call then offers `actors`, `tasks`, and the rest.
 */
export function acceptSuggestion(suggestion: CommandSuggestion): string {
  const expectsMore = suggestion.childCount > 0 || suggestion.requiredArgs.length > 0;
  return expectsMore ? `${suggestion.name} ` : suggestion.name;
}
