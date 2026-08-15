import React from "react";
import { Box, Text } from "ink";
import { useTheme } from "../theme/themeContext.js";
import { fg } from "../theme/theme.js";
import { ViewFrame } from "./ViewFrame.js";

export interface SearchResult {
  readonly line: number;
  readonly content: string;
  readonly source: string;
}

export interface SearchViewProps {
  readonly results: readonly SearchResult[];
  readonly query: string;
}

export function SearchView({ results, query }: SearchViewProps): React.ReactElement {
  const { colors, text } = useTheme();
  const plural = results.length === 1 ? "" : "s";

  return (
    <ViewFrame
      title="Search"
      tone="warning"
      subtitle={`"${query}" ${String(results.length)} result${plural}`}
      {...(results.length === 0 ? { empty: "No matches found." } : {})}
    >
      {results.map((r) => (
        <Box key={`${r.source}:${r.line}:${r.content}`} flexDirection="column" marginBottom={1}>
          <Text>
            <Text {...fg(colors.info)}>{r.source}</Text>
            <Text {...text.muted}> :{r.line}</Text>
          </Text>
          <Text> {r.content}</Text>
        </Box>
      ))}
    </ViewFrame>
  );
}

export default SearchView;
