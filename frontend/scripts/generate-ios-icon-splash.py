"""
Genera el ícono de iOS (edge-to-edge, SIN esquinas redondeadas horneadas —
Apple aplica su propia máscara y rechaza íconos con transparencia/redondeo
propio) y el splash screen, a partir del ícono REAL de la app
(public/icons/icon-512.png — el que usan la PWA y toda la app en pantalla).

Antes de esto, ios/App/App/Assets.xcassets tenía el ícono placeholder
genérico de Capacitor (la "X" azul de plantilla), no el logo de SportMaps.

CORRECCIÓN 2026-09-06: esta función antes REDIBUJABA el logo a mano
(mismo código que generate-logo.py), lo que produjo un diseño simplificado
y desincronizado del real (pose del corredor distinta, sin la textura
granulada). Ahora parte del PNG real y solo le quita las esquinas
redondeadas horneadas — no vuelve a dibujar nada desde cero.
"""
from PIL import Image, ImageDraw
import os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Color de fondo real de public/icons/icon-512.png, muestreado de una zona
# sólida (no es el #FFA826 de generate-logo.py — es un asset distinto).
REAL_ICON_ORANGE = (251, 162, 34)


def create_sportmaps_icon_full_bleed(size=1024):
    """Parte de public/icons/icon-512.png (el ícono real, con esquinas
    redondeadas horneadas) y rellena esas esquinas con el mismo naranja
    para dejarlo edge-to-edge — sin redibujar el logo desde cero."""
    src_path = os.path.join(BASE, 'public', 'icons', 'icon-512.png')
    src = Image.open(src_path).convert('RGB')
    src_size = src.size[0]

    # Radio verificado a mano contra este asset específico (public/icons/
    # icon-512.png, 512x512): 90 cubre el borde con antialiasing sin comerse
    # las líneas blancas de "calle" que llegan cerca de las esquinas. Si se
    # reemplaza icon-512.png por un diseño con otro radio de esquina, hay
    # que reverificar visualmente (ver corner crops usados al depurar esto).
    radius = 90
    mask = Image.new('L', (src_size, src_size), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, src_size - 1, src_size - 1], radius=radius, fill=255)

    orange_layer = Image.new('RGB', (src_size, src_size), REAL_ICON_ORANGE)
    flat = Image.composite(src, orange_layer, mask)

    if size != src_size:
        flat = flat.resize((size, size), Image.LANCZOS)
    return flat


def create_rounded_mark_rgba():
    """Versión del ícono real CON esquinas transparentes de verdad (a
    diferencia de icon-512.png, que las trae rellenas de negro opaco) —
    para pegar sobre el fondo blanco del splash sin que se vean cuadradas."""
    src_path = os.path.join(BASE, 'public', 'icons', 'icon-512.png')
    src = Image.open(src_path).convert('RGB')
    size = src.size[0]
    radius = 90  # ver nota de radio en create_sportmaps_icon_full_bleed

    alpha = Image.new('L', (size, size), 0)
    ImageDraw.Draw(alpha).rounded_rectangle(
        [0, 0, size - 1, size - 1], radius=radius, fill=255)

    rgba = src.convert('RGBA')
    rgba.putalpha(alpha)
    return rgba


def create_splash(canvas_size=2732, mark_size=900):
    """Fondo blanco + ícono real (con esquinas transparentes) centrado."""
    canvas = Image.new('RGB', (canvas_size, canvas_size), (255, 255, 255))
    mark = create_rounded_mark_rgba()
    mark = mark.resize((mark_size, mark_size), Image.LANCZOS)
    offset = ((canvas_size - mark_size) // 2, (canvas_size - mark_size) // 2)
    canvas.paste(mark, offset, mark)
    return canvas


def main():
    ios_appicon_dir = os.path.join(BASE, 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset')
    ios_splash_dir = os.path.join(BASE, 'ios', 'App', 'App', 'Assets.xcassets', 'Splash.imageset')

    icon = create_sportmaps_icon_full_bleed(1024)
    icon_path = os.path.join(ios_appicon_dir, 'AppIcon-512@2x.png')
    icon.save(icon_path)
    print(f'OK icon -> {icon_path} ({icon.size})')

    splash = create_splash()
    for name in ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']:
        p = os.path.join(ios_splash_dir, name)
        splash.save(p)
        print(f'OK splash -> {p}')


if __name__ == '__main__':
    main()
