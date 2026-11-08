import { Component } from 'react';

// Shows a message instead of a blank page if a page crashes while drawing.
export default class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="h-screen grid place-items-center p-6 text-center">
        <div>
          <h1 className="text-xl font-bold mb-2">Something went wrong</h1>
          <p className="text-slate-500 mb-4">Refresh the page and try again.</p>
          <button type="button" className="btn-primary" onClick={() => window.location.assign('/')}>
            Back to the dashboard
          </button>
        </div>
      </div>
    );
  }
}
