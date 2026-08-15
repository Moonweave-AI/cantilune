import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { useTheme } from "../theme/themeContext.js";
import { border, fg } from "../theme/theme.js";
import * as buf from "./textBuffer.js";

export interface AskPanelProps {
  readonly question: string;
  readonly options?: readonly string[];
  /** Resolves the paused loop with the user's answer (injected as a new user message). */
  readonly onAnswer: (reply: string) => void;
}

/**
 * Modal the termination controller raises when it verdicts ASK_USER.
 *
 * The loop is paused on the `onAskUser` promise while this panel is mounted. When
 * the controller offered `options`, they are picked with the arrow keys; without
 * options the panel is a free-text box. Submitting resolves the promise and the
 * loop injects the reply as a new user message, then resumes.
 */
export function AskPanel({ question, options, onAnswer }: AskPanelProps): React.ReactElement {
  const theme = useTheme();
  const { colors, glyphs, text } = theme;
  const [selected, setSelected] = useState(0);
  const [buffer, setBuffer] = useState(buf.EMPTY_BUFFER);

  function handleOptionsKey(key: { upArrow: boolean; downArrow: boolean; return: boolean }): void {
    if (key.upArrow) {
      setSelected((prev) => Math.max(0, prev - 1));
      return;
    }
    if (key.downArrow) {
      setSelected((prev) => Math.min((options?.length ?? 1) - 1, prev + 1));
      return;
    }
    if (key.return && options !== undefined && options.length > 0) {
      onAnswer(options[selected] ?? options[0] ?? "");
    }
  }

  function handleFreeTextKey(
    input: string,
    key: {
      backspace: boolean;
      delete: boolean;
      leftArrow: boolean;
      rightArrow: boolean;
      return: boolean;
      ctrl: boolean;
      meta: boolean;
    },
  ): void {
    if (key.return) {
      if (buffer.text.trim().length > 0) onAnswer(buffer.text);
      return;
    }
    if (key.backspace || key.delete) {
      setBuffer(buf.backspace);
      return;
    }
    if (key.leftArrow) {
      setBuffer(buf.moveLeft);
      return;
    }
    if (key.rightArrow) {
      setBuffer(buf.moveRight);
      return;
    }
    if (input.length > 0 && !key.ctrl && !key.meta) {
      setBuffer((prev) => buf.insert(prev, input));
    }
  }

  useInput(
    (input, key) => {
      if (key.escape) {
        // An empty answer lets the loop resume rather than hang; the controller
        // sees an empty user message and re-evaluates against the contract.
        onAnswer("");
        return;
      }
      if (options !== undefined) {
        handleOptionsKey(key);
        return;
      }
      handleFreeTextKey(input, key);
    },
    { isActive: true },
  );

  const hasOptions = options !== undefined;
  const optionsHint = `${glyphs.upDown} select ${glyphs.sep} Enter answer ${glyphs.sep} Esc skip`;
  const freeTextHint = `Enter answer ${glyphs.sep} Esc skip`;
  const submitHint = hasOptions ? optionsHint : freeTextHint;

  const { before, at, after } = buf.splitAtCursor(buffer);

  return (
    <Box flexDirection="column" borderStyle={theme.border} {...border(colors.accent)} paddingX={1}>
      <Box>
        <Text bold {...fg(colors.accent)}>
          {glyphs.prompt} Agent question
        </Text>
      </Box>
      <Text wrap="wrap">{question}</Text>

      {hasOptions && options !== undefined && options.length === 0 ? (
        <Text {...text.warning}>No options — Esc to answer freely would require a restart.</Text>
      ) : null}

      {hasOptions && options !== undefined && options.length > 0
        ? options.map((option, index) => {
            const isActive = index === selected;
            const marker = isActive ? glyphs.prompt : " ";
            return (
              <Box key={`${index}-${option}`}>
                <Text {...(isActive ? text.accent : {})}>{marker} </Text>
                <Text {...(isActive ? text.selected : {})}>{option}</Text>
              </Box>
            );
          })
        : null}

      {!hasOptions ? (
        <Box>
          <Text {...fg(colors.accent)}>{glyphs.prompt} </Text>
          <Text wrap="wrap">
            {before}
            <Text inverse>{at}</Text>
            {after}
          </Text>
        </Box>
      ) : null}

      <Text {...text.muted}>{submitHint}</Text>
    </Box>
  );
}
