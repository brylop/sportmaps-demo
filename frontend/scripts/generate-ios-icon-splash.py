"""
Genera el ícono de iOS (edge-to-edge, SIN esquinas redondeadas horneadas —
Apple aplica su propia máscara y rechaza íconos con transparencia/redondeo
propio) y el splash screen, reusando el diseño real de scripts/generate-logo.py.

Antes de esto, ios/App/App/Assets.xcassets tenía el ícono placeholder
genérico de Capacitor (la "X" azul de plantilla), no el logo de SportMaps.
"""
from PIL import Image, ImageDraw
import os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def create_sportmaps_icon_full_bleed(size=1024):
    """Mismo diseño de generate-logo.py pero SIN margen ni esquinas
    redondeadas — edge-to-edge, como exige el App Icon de iOS."""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    margin = 0
    x0, y0 = margin, margin
    x1, y1 = size - margin, size - margin

    orange = (255, 168, 38)  # #FFA826
    draw.rectangle([x0, y0, x1, y1], fill=orange)

    line_w = int(size * 0.02)
    white = (255, 255, 255, 200)
    draw.line([(margin, int(size * 0.3)), (int(size * 0.45), margin)], fill=white, width=line_w)
    draw.line([(margin, int(size * 0.6)), (int(size * 0.7), margin)], fill=white, width=line_w)
    draw.line([(int(size * 0.2), size - margin), (size - margin, int(size * 0.35))], fill=white, width=line_w)
    draw.line([(margin, int(size * 0.85)), (size - margin, int(size * 0.6))], fill=white, width=line_w)
    draw.line([(int(size * 0.55), size - margin), (size - margin, int(size * 0.8))], fill=white, width=line_w)

    green = (46, 139, 87)  # #2E8B57
    cx, cy = int(size * 0.45), int(size * 0.42)
    pin_r = int(size * 0.18)

    point_y = cy + int(pin_r * 2.2)
    draw.polygon([
        (cx - int(pin_r * 0.5), cy + int(pin_r * 0.7)),
        (cx + int(pin_r * 0.5), cy + int(pin_r * 0.7)),
        (cx, point_y)
    ], fill=green)

    outline_w = int(size * 0.025)
    draw.ellipse([cx - pin_r - outline_w, cy - pin_r - outline_w,
                  cx + pin_r + outline_w, cy + pin_r + outline_w], fill=(255, 255, 255))
    draw.ellipse([cx - pin_r, cy - pin_r, cx + pin_r, cy + pin_r], fill=green)

    runner_white = (255, 255, 255)
    sw = max(int(size * 0.018), 2)

    head_r = int(pin_r * 0.15)
    head_cx = cx + int(pin_r * 0.1)
    head_cy = cy - int(pin_r * 0.45)
    draw.ellipse([head_cx - head_r, head_cy - head_r, head_cx + head_r, head_cy + head_r], fill=runner_white)

    body_top = (head_cx - int(pin_r * 0.05), head_cy + head_r)
    body_bottom = (cx - int(pin_r * 0.1), cy + int(pin_r * 0.3))
    draw.line([body_top, body_bottom], fill=runner_white, width=sw)

    arm_start = (head_cx - int(pin_r * 0.02), cy - int(pin_r * 0.15))
    draw.line([arm_start, (cx - int(pin_r * 0.35), cy - int(pin_r * 0.3))], fill=runner_white, width=sw)
    draw.line([arm_start, (cx + int(pin_r * 0.3), cy + int(pin_r * 0.05))], fill=runner_white, width=sw)

    hip = body_bottom
    draw.line([hip, (cx - int(pin_r * 0.4), cy + int(pin_r * 0.55))], fill=runner_white, width=sw)
    draw.line([hip, (cx + int(pin_r * 0.2), cy + int(pin_r * 0.6))], fill=runner_white, width=sw)

    # Apple no acepta canal alfa en el App Icon: aplanar sobre fondo opaco.
    flat = Image.new('RGB', (size, size), orange)
    flat.paste(img, (0, 0), img)
    return flat


def create_splash(canvas_size=2732, mark_size=900):
    """Fondo blanco + logo de marca (ya redondeado, asset existente)
    centrado — el splash NO se enmascara, así que reusar el asset con
    esquinas redondeadas ya generado está bien acá."""
    canvas = Image.new('RGB', (canvas_size, canvas_size), (255, 255, 255))
    mark = Image.open(os.path.join(BASE, 'public', 'sportmaps-logo.png')).convert('RGBA')
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
