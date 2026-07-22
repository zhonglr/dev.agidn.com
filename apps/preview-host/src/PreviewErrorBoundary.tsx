import { Component, type ErrorInfo, type ReactNode } from "react";

interface PreviewErrorBoundaryProps {
  children: ReactNode;
  onError: (error: Error) => void;
}

interface PreviewErrorBoundaryState {
  error?: Error;
}

export class PreviewErrorBoundary extends Component<PreviewErrorBoundaryProps, PreviewErrorBoundaryState> {
  override state: PreviewErrorBoundaryState = {};

  static getDerivedStateFromError(error: Error): PreviewErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, _info: ErrorInfo): void {
    this.props.onError(error);
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
