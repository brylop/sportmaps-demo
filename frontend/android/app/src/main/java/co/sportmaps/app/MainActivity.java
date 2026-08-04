package co.sportmaps.app;

import android.os.Bundle;
import android.view.View;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    /**
     * Android 15+ (y obligatorio al targetear API 36) fuerza edge-to-edge: la
     * ventana ocupa la pantalla completa y el contenido web queda POR DEBAJO de
     * la barra de estado y de la de navegacion. Se veia en la barra superior de
     * la landing: sus iconos caian dentro de la franja de la barra de estado.
     *
     * La app son ~78 paginas escritas sin safe-area (17 cabeceras `sticky top-0`
     * repartidas), asi que en vez de auditar cada una paddeamos el contenedor
     * del WebView con los insets del sistema. El layout web vuelve a comportarse
     * como antes de Android 15 y no hay que tocar CSS pagina por pagina.
     *
     * OJO: esto va de la mano con `plugins.SystemBars.insetsHandling = 'disable'`
     * en capacitor.config.ts. Capacitor 8 instala su propio listener de insets y
     * solo puede haber uno por vista; si se reactiva, los insets se aplicarian
     * dos veces y quedaria doble margen arriba.
     *
     * Si algun dia se quiere edge-to-edge de verdad (contenido bajo barras
     * translucidas), el camino es el inverso: quitar esto, devolver
     * insetsHandling a 'css' y aplicar env(safe-area-inset-*) en cada cabecera.
     */
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        View content = findViewById(android.R.id.content);
        ViewCompat.setOnApplyWindowInsetsListener(content, (view, windowInsets) -> {
            Insets bars = windowInsets.getInsets(
                WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
            );
            Insets ime = windowInsets.getInsets(WindowInsetsCompat.Type.ime());
            boolean keyboardVisible = windowInsets.isVisible(WindowInsetsCompat.Type.ime());

            // Con el teclado abierto manda su inset: si no, el contenido queda
            // paddeado por la barra de navegacion que el propio teclado ya tapa.
            view.setPadding(bars.left, bars.top, bars.right, keyboardVisible ? ime.bottom : bars.bottom);

            return WindowInsetsCompat.CONSUMED;
        });
    }
}
