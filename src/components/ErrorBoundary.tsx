import React from "react";

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("App error", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <div className="max-w-md text-center">
            <h1 className="font-display text-2xl text-foreground mb-2">Something went wrong</h1>
            <p className="text-muted-foreground mb-6">Refresh the page and try again.</p>
            <button
              type="button"
              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground"
              onClick={() => window.location.assign("/")}
            >
              Go to home
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
