import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary atrapó un error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
          <div className="bg-white p-8 rounded-lg shadow-md text-center max-w-md">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Algo salió mal</h1>
            <p className="text-gray-700 mb-4">Ha ocurrido un error inesperado. Por favor, intenta recargar la página.</p>
            <button 
              onClick={() => window.location.reload()} 
              className="bg-red-500 text-white px-6 py-2 rounded hover:bg-red-600 font-semibold cursor-pointer"
            >
              Recargar Aplicación
            </button>
          </div>
        </div>
      );
    }
    return this.props.children; 
  }
}

export default ErrorBoundary;
