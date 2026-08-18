import type { ThemePreference } from "./theme";
import { IconMoon, IconSun, IconSystem } from "./icons";
import styles from "./ThemeToggle.module.css";

interface ThemeToggleProps {
  readonly theme: ThemePreference;
  readonly onChange: (theme: ThemePreference) => void;
  readonly compact?: boolean;
}

const OPTIONS: readonly { readonly value: ThemePreference; readonly label: string }[] = [
  { value: "light", label: "浅色" },
  { value: "dark", label: "深色" },
  { value: "system", label: "跟随系统" },
];

export function ThemeToggle({ theme, onChange, compact = false }: ThemeToggleProps): JSX.Element {
  if (compact) {
    return (
      <div className={styles.compact} role="group" aria-label="外观">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={theme === option.value ? styles.compactActive : styles.compactBtn}
            onClick={() => onChange(option.value)}
            aria-label={option.label}
            title={option.label}
          >
            <ThemeGlyph value={option.value} />
          </button>
        ))}
      </div>
    );
  }
  return (
    <div className={styles.cards} role="radiogroup" aria-label="外观">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={theme === option.value}
          className={theme === option.value ? styles.cardActive : styles.card}
          onClick={() => onChange(option.value)}
        >
          <span className={styles.preview} data-scheme={option.value}>
            <span className={styles.previewSide} />
            <span className={styles.previewMain}>
              <i />
              <i />
              <i />
            </span>
          </span>
          <em>
            <ThemeGlyph value={option.value} />
            {option.label}
          </em>
        </button>
      ))}
    </div>
  );
}

function ThemeGlyph({ value }: { readonly value: ThemePreference }): JSX.Element {
  if (value === "light") return <IconSun size={14} />;
  if (value === "dark") return <IconMoon size={14} />;
  return <IconSystem size={14} />;
}
