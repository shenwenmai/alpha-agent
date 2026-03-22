// @ts-nocheck — React 19 无内置 class component 类型
import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          padding: '32px',
          color: '#AAAAAA',
          textAlign: 'center',
          gap: '16px',
        }}>
          <div style={{ fontSize: '40px' }}>:(</div>
          <div style={{ fontSize: '16px', fontWeight: 600, color: '#FFFFFF' }}>页面出错了</div>
          <div style={{ fontSize: '13px', maxWidth: '300px', lineHeight: 1.5 }}>
            {this.state.error?.message || '未知错误'}
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              marginTop: '8px',
              padding: '10px 24px',
              backgroundColor: '#E6B800',
              color: '#000',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            重试
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
