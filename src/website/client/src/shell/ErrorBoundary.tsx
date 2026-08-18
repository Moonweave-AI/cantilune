/**
 * Catch a render crash so one conversation node cannot blank the whole harness.
 */

import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  readonly children: ReactNode;
  readonly fallback?: ReactNode;
}

interface State {
  readonly error: Error | undefined;
}

export class ErrorBoundary extends Component<Props, State> {
  public constructor(props: Props) {
    super(props);
    this.state = { error: undefined };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  public componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("harness render failed", error, info.componentStack);
  }

  public render(): ReactNode {
    if (this.state.error === undefined) return this.props.children;
    if (this.props.fallback !== undefined) return this.props.fallback;
    return (
      <div style={{ padding: 24, color: "var(--cln-alias-label-primary)", maxWidth: 720 }}>
        <p style={{ fontWeight: 650, margin: "0 0 8px" }}>界面渲染出错</p>
        <pre
          style={{
            margin: 0,
            whiteSpace: "pre-wrap",
            color: "var(--cln-alias-label-secondary)",
            fontSize: 12,
          }}
        >
          {this.state.error.message}
        </pre>
      </div>
    );
  }
}
