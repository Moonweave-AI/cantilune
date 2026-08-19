import styles from "./NoticeBanner.module.css";

interface NoticeBannerProps {
  readonly message: string;
  readonly onDismiss: () => void;
}

export function NoticeBanner({ message, onDismiss }: NoticeBannerProps): JSX.Element {
  return (
    <div className={styles.banner} role="alert">
      <span className={styles.message}>{message}</span>
      <button type="button" className={styles.dismiss} onClick={onDismiss} aria-label="关闭提示">
        ×
      </button>
    </div>
  );
}
