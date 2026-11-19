import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    if (import.meta.env.DEV) {
      // keep the real error visible in the console during development
      console.error('App error:', error, info);
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="error-page" role="alert">
        <div>
          <div className="empty-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3 2.8 20h18.4L12 3Z" />
              <path d="M12 9v5M12 17.2h.01" />
            </svg>
          </div>
          <h1 style={{ fontSize: '1.4rem', marginTop: 14 }}>حصلت مشكلة غير متوقعة</h1>
          <p className="muted">بياناتك محفوظة، جرّب تحديث الصفحة، ولو المشكلة فضلت كلّمنا</p>
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
            تحديث الصفحة
          </button>
        </div>
      </main>
    );
  }
}
