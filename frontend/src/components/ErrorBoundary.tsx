import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary component that catches JavaScript errors anywhere in the child
 * component tree, logs those errors, and displays a fallback UI.
 */
class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null
        };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        // Update state so the next render will show the fallback UI
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        // Log error to console in development
        console.error('ErrorBoundary caught an error:', error, errorInfo);

        this.setState({ errorInfo });

        // TODO: Log to error reporting service (e.g., Sentry, LogRocket)
        // logErrorToService(error, errorInfo);
    }

    handleReload = (): void => {
        window.location.reload();
    };

    handleGoHome = (): void => {
        window.location.href = '/';
    };

    handleRetry = (): void => {
        this.setState({ hasError: false, error: null, errorInfo: null });
    };

    render(): ReactNode {
        if (this.state.hasError) {
            // Custom fallback if provided
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // Default error UI
            return (
                <div className="min-h-screen flex items-center justify-center p-4 bg-background">
                    <Card className="max-w-lg w-full animate-in fade-in zoom-in duration-300">
                        <CardHeader className="text-center">
                            <div className="w-16 h-16 mx-auto mb-4 bg-red-500/10 rounded-full flex items-center justify-center">
                                <AlertTriangle className="h-8 w-8 text-red-500" />
                            </div>
                            <CardTitle className="text-2xl">Algo salió mal</CardTitle>
                            <CardDescription>
                                Ha ocurrido un error inesperado. Puedes intentar recargar la página o volver al inicio.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Error details in development */}
                            {import.meta.env.DEV && this.state.error && (
                                <div className="p-4 bg-muted rounded-lg overflow-auto max-h-48">
                                    <p className="text-sm font-mono text-red-600 dark:text-red-400">
                                        {this.state.error.toString()}
                                    </p>
                                    {this.state.errorInfo && (
                                        <pre className="text-xs mt-2 text-muted-foreground whitespace-pre-wrap">
                                            {this.state.errorInfo.componentStack}
                                        </pre>
                                    )}
                                </div>
                            )}

                            <div className="flex flex-col sm:flex-row gap-3">
                                <Button
                                    onClick={this.handleRetry}
                                    className="flex-1"
                                    variant="default"
                                >
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                    Reintentar
                                </Button>
                                <Button
                                    onClick={this.handleGoHome}
                                    className="flex-1"
                                    variant="outline"
                                >
                                    <Home className="h-4 w-4 mr-2" />
                                    Ir al Inicio
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
