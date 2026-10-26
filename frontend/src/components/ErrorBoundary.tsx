import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { estaSinConexion, resetPwaCachesAndReload } from '@/pwa/resetCaches';

/**
 * ¿El error es un chunk que no cargó (pantalla lazy)? Incluye el caso en que
 * React.lazy recibe un módulo undefined porque el chunk respondió 503/HTML →
 * "Cannot read properties of undefined (reading 'default')".
 */
export function esErrorDeChunk(error: Error | null | undefined): boolean {
    const msg = error?.message || '';
    return (
        msg.includes('Failed to fetch dynamically imported module') ||
        msg.includes('error loading dynamically imported module') ||
        msg.includes('Importing a module script failed') ||
        msg.includes('Loading chunk') ||
        msg.includes('Loading CSS chunk') ||
        msg.includes("reading 'default'") ||
        msg.includes('reading "default"')
    );
}

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
    /** El chunk falló SIN señal: se espera a que vuelva para recargar. */
    sinConexion: boolean;
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
            errorInfo: null,
            sinConexion: false,
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

        // Auto-reload on stale/failed chunk errors (post-deploy o 503 del SW).
        if (!esErrorDeChunk(error)) return;

        // Sin señal: abrir una pantalla que aún no se había descargado. Recargar
        // ahora dejaba la app en la página de error del navegador; se muestra
        // «sin conexión» y se recarga sola cuando vuelve la señal. No consume el
        // guard de una-recarga-por-sesión: la recarga de después sí sirve.
        if (estaSinConexion()) {
            this.setState({ sinConexion: true });
            window.addEventListener('online', this.handleOnline);
            return;
        }

        const reloadedKey = 'chunk-reload';
        if (!sessionStorage.getItem(reloadedKey)) {
            sessionStorage.setItem(reloadedKey, '1');
            // Con el Cache Storage limpio: un service worker de una versión
            // anterior puede seguir sirviendo la build vieja.
            void resetPwaCachesAndReload();
            return;
        }
    }

    componentWillUnmount(): void {
        window.removeEventListener('online', this.handleOnline);
    }

    handleOnline = (): void => {
        window.removeEventListener('online', this.handleOnline);
        void resetPwaCachesAndReload();
    };

    // «Volver» sin señal: a la pantalla anterior (ya cargada). El boundary
    // envuelve todo el router, así que tras el cambio de ruta hay que soltar el
    // error para que vuelva a pintar; y ya no hace falta recargar al volver la red.
    handleVolver = (): void => {
        window.removeEventListener('online', this.handleOnline);
        window.addEventListener('popstate', () => {
            this.setState({ hasError: false, error: null, errorInfo: null, sinConexion: false });
        }, { once: true });
        window.history.back();
    };

    // Reparación completa (caché + service worker). Antes el botón solo
    // recargaba y, con el caché roto, la persona quedaba atascada.
    handleReload = (): void => {
        void resetPwaCachesAndReload({ unregister: true });
    };

    handleGoHome = (): void => {
        window.location.href = '/';
    };

    handleRetry = (): void => {
        // Un chunk que falló no se reintenta re-renderizando: React.lazy guarda
        // la promesa rechazada y vuelve a fallar en el acto. Hay que recargar.
        if (esErrorDeChunk(this.state.error)) {
            this.handleReload();
            return;
        }
        this.setState({ hasError: false, error: null, errorInfo: null, sinConexion: false });
    };

    render(): ReactNode {
        if (this.state.hasError) {
            // Custom fallback if provided
            if (this.props.fallback) {
                return this.props.fallback;
            }

            if (this.state.sinConexion) {
                return (
                    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
                        <Card className="max-w-lg w-full">
                            <CardHeader className="text-center">
                                <div className="w-16 h-16 mx-auto mb-4 bg-amber-500/10 rounded-full flex items-center justify-center">
                                    <WifiOff className="h-8 w-8 text-amber-600" />
                                </div>
                                <CardTitle className="text-2xl">Sin conexión</CardTitle>
                                <CardDescription>
                                    Esta pantalla todavía no se había descargado y no hay señal. Se abrirá sola
                                    apenas vuelva la conexión.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Button onClick={this.handleVolver} className="w-full" variant="outline">
                                    Volver
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                );
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
