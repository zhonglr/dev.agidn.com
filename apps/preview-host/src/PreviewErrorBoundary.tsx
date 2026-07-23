import { Component, type ErrorInfo, type ReactNode } from "react";

interface PreviewErrorBoundaryProps {
  children: ReactNode;
  onError: (error: Error) => void;
  resetKey: string;
}

interface PreviewErrorBoundaryState {
  error: Error | null;
}

export class PreviewErrorBoundary extends Component<PreviewErrorBoundaryProps, PreviewErrorBoundaryState> {
  override state: PreviewErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): PreviewErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, _info: ErrorInfo): void {
    this.props.onError(error);
  }

  override componentDidUpdate(previousProps: PreviewErrorBoundaryProps): void {
    if (this.state.error && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  override render(): ReactNode {
    if (this.state.error) {
      return (
        <main className="preview-crash" role="alert">
          <strong>Preview could not render this revision.</strong>
          <p>{this.state.error.message}</p>
        </main>
      );
    }
    return this.props.children;
  }
}
