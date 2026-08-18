import { useState, type FormEvent } from "react";
import styles from "./Composer.module.css";

interface ComposerProps {
  readonly configured: boolean;
  readonly running: boolean;
  readonly provider: string | undefined;
  readonly model: string | undefined;
  readonly empty: boolean;
  readonly onSend: (instruction: string) => void;
  readonly onStop: () => void;
}

export function Composer({
  configured,
  running,
  provider,
  model,
  empty,
  onSend,
  onStop,
}: ComposerProps): JSX.Element {
  const [value, setValue] = useState("");
  const [composing, setComposing] = useState(false);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const instruction = value.trim();
    if (composing || instruction.length === 0 || running || !configured) return;
    onSend(instruction);
    setValue("");
  };
  return (
    <div className={`${styles.composerSeat} ${empty ? styles.empty : ""}`}>
      {running && (
        <div className={styles.turnStatus} role="status">
          Agent 正在运行…
        </div>
      )}
      <form className={styles.bar} onSubmit={submit}>
        <textarea
          className={`${styles.input} ${running ? styles.inputPending : ""}`}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onCompositionStart={() => setComposing(true)}
          onCompositionEnd={() => setComposing(false)}
          placeholder={configured ? "给智能体发送消息" : "请先在设置中连接模型"}
          disabled={!configured}
          rows={2}
          aria-label="Instruction input"
        />
        <div className={styles.toolbar}>
          <div className={styles.toolbarLeft}>
            <span className={styles.commandMark}>＋</span>
            <span className={styles.modelSeat}>
              {provider !== undefined ? `${provider} · ${model ?? "model"}` : "尚未连接模型"}
            </span>
          </div>
          <div className={styles.toolbarRight}>
            {running ? (
              <button
                type="button"
                className={styles.stopBtn}
                onClick={onStop}
                aria-label="停止运行"
              >
                ■
              </button>
            ) : (
              <button
                type="submit"
                className={styles.sendBtn}
                disabled={value.trim().length === 0 || !configured}
                aria-label="发送消息"
              >
                ↑
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
