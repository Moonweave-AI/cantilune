import React from "react";
import { Box, Text } from "ink";
import { useTheme } from "../theme/themeContext.js";
import { fg } from "../theme/theme.js";

export interface ReportSection {
  readonly heading: string;
  readonly content: string;
}

export interface ReportViewProps {
  readonly title: string;
  readonly sections: readonly ReportSection[];
}

export function ReportView({ title, sections }: ReportViewProps): React.ReactElement {
  const { colors, glyphs } = useTheme();

  return (
    <Box flexDirection="column">
      <Text bold {...fg(colors.heading)}>
        {title}
      </Text>
      {sections.map((section) => (
        <Box key={`${section.heading}:${section.content}`} flexDirection="column" marginTop={1}>
          <Box>
            <Text {...fg(colors.accent)}>{glyphs.arrow} </Text>
            <Text bold {...fg(colors.accent)}>
              {section.heading}
            </Text>
          </Box>
          <Text>{section.content}</Text>
        </Box>
      ))}
    </Box>
  );
}

export default ReportView;
