import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
    
    // Log error ke console untuk debugging
    console.error('Error caught by boundary:', error, errorInfo);
  }

  handleRefresh = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md w-full text-center">
            {/* Icon */}
            <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-10 h-10 text-red-500" />
            </div>

            {/* Title */}
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Terjadi Kesalahan
            </h1>

            {/* Description */}
            <p className="text-gray-500 mb-6">
              Maaf, aplikasi mengalami masalah. Silakan coba refresh halaman atau kembali ke beranda.
            </p>

            {/* Error Details (Collapsible) */}
            {this.state.error && (
              <div className="mb-6">
                <details className="text-left">
                  <summary className="text-sm text-gray-400 cursor-pointer hover:text-gray-600 mb-2">
                    Lihat detail error (untuk developer)
                  </summary>
                  <div className="bg-gray-100 rounded-xl p-4 text-left overflow-auto max-h-40">
                    <p className="text-xs text-red-600 font-mono mb-2">
                      {this.state.error.toString()}
                    </p>
                    {this.state.errorInfo && (
                      <pre className="text-xs text-gray-600 font-mono whitespace-pre-wrap">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    )}
                  </div>
                </details>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-3">
              <button
                onClick={this.handleRefresh}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-garden to-garden-dark text-white font-semibold flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-garden/30 transition-all"
              >
                <RefreshCw className="w-5 h-5" />
                Refresh Halaman
              </button>
              
              <button
                onClick={this.handleGoHome}
                className="w-full py-4 rounded-xl bg-gray-100 text-gray-700 font-semibold flex items-center justify-center gap-2 hover:bg-gray-200 transition-all"
              >
                <Home className="w-5 h-5" />
                Kembali ke Beranda
              </button>
            </div>

            {/* Footer */}
            <p className="text-xs text-gray-400 mt-6">
              Jika masalah berlanjut, hubungi administrator
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
