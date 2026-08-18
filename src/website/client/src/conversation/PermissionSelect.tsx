import { useEffect, useId, useRef, useState } from "react";
import { IconChevronDown, IconShield } from "../theme/icons";
import styles from "./PermissionSelect.module.css";

export type RunMode = "execute" | "plan" | "observe";

const OPTIONS: readonly { readonly id: RunMode; readonly label: string }[] = [
  { id: "execute", label: "Full access" },
  { id: "plan", label: "Plan" },
  { id: "observe", label: "Read only" },
];

interface PermissionSelectProps {
  readonly value: RunMode;
  readonly locked: boolean;
  readonly onChange: (mode: RunMode) => void;
}

export function PermissionSelect({ value, locked, onChange }: PermissionSelectProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const current = OPTIONS.find((option) => option.id === value) ?? OPTIONS[0]!;

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (event.target instanceof Node && rootRef.current?.contains(event.target) === true) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={styles.root}>
      <button
        type="button"
        className={styles.trigger}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`权限模式：${current.label}`}
        disabled={locked}
        onClick={() => setOpen((value) => !value)}
      >
        <span className={styles.shield} aria-hidden>
          <IconShield size={14} />
        </span>
        <span className={styles.label}>{current.label}</span>
        <span className={open ? styles.chevronOpen : styles.chevron} aria-hidden>
          <IconChevronDown size={12} />
        </span>
      </button>
      {open && (
        <ul id={menuId} className={styles.menu} role="listbox" aria-label="权限模式">
          {OPTIONS.map((option) => (
            <li key={option.id} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={option.id === value}
                className={option.id === value ? styles.itemActive : styles.item}
                onClick={() => {
                  onChange(option.id);
                  setOpen(false);
                }}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
