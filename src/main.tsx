import { Component, StrictMode, type ErrorInfo, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; message: string; stack: string }> {
  state = { hasError: false, message: '', stack: '' };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message, stack: error.stack || '' };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App crashed:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 14,
            background: '#f7f6f1',
            color: '#333',
            padding: 24,
            textAlign: 'center',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <h1 style={{ fontSize: 20, margin: 0 }}>界面出现异常</h1>
          <p style={{ margin: 0, fontSize: 13, color: '#888' }}>重新加载后再试。若本地数据异常，请使用“我的手册”中的备份恢复；此操作不会清除数据。</p>
          <pre style={{ margin: 0, fontSize: 10, color: '#b25a3c', maxWidth: 360, overflow: 'auto', textAlign: 'left', whiteSpace: 'pre-wrap' }}>{`${this.state.message}\n${this.state.stack}`}</pre>
          <button
            onClick={() => window.location.reload()}
            style={{ padding: '11px 26px', borderRadius: 6, border: 0, background: '#c65c35', color: '#fff', fontSize: 14, cursor: 'pointer' }}
          >
            重新加载
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
