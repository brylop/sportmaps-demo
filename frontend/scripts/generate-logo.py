"""
Generate SportMaps favicon and logo using Pillow.
Creates a clean icon: orange rounded square + green map pin + white runner.
"""
from PIL import Image, ImageDraw, ImageFont
import math
import os

def create_sportmaps_icon(size=512):
    """Create the SportMaps icon programmatically."""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    margin = int(size * 0.02)
    radius = int(size * 0.15)
    
    # ─── Orange rounded square background ───
    orange = (255, 168, 38)  # #FFA826
    x0, y0 = margin, margin
    x1, y1 = size - margin, size - margin
    draw.rounded_rectangle([x0, y0, x1, y1], radius=radius, fill=orange)
    
    # ─── White map road lines ───
    line_w = int(size * 0.02)
    white = (255, 255, 255, 200)
    
    # Diagonal lines crossing the square
    draw.line([(margin, int(size*0.3)), (int(size*0.45), margin)], fill=white, width=line_w)
    draw.line([(margin, int(size*0.6)), (int(size*0.7), margin)], fill=white, width=line_w)
    draw.line([(int(size*0.2), size-margin), (size-margin, int(size*0.35))], fill=white, width=line_w)
    draw.line([(margin, int(size*0.85)), (size-margin, int(size*0.6))], fill=white, width=line_w)
    draw.line([(int(size*0.55), size-margin), (size-margin, int(size*0.8))], fill=white, width=line_w)
    
    # ─── Green map pin ───
    green = (46, 139, 87)  # #2E8B57
    green_dark = (34, 120, 70)
    
    cx, cy = int(size * 0.45), int(size * 0.42)  # Center of pin circle
    pin_r = int(size * 0.18)  # Radius of pin circle
    
    # Pin body (circle + triangle point)
    # Draw triangle point first
    point_y = cy + int(pin_r * 2.2)
    draw.polygon([
        (cx - int(pin_r * 0.5), cy + int(pin_r * 0.7)),
        (cx + int(pin_r * 0.5), cy + int(pin_r * 0.7)),
        (cx, point_y)
    ], fill=green)
    
    # White outline circle
    outline_w = int(size * 0.025)
    draw.ellipse([cx - pin_r - outline_w, cy - pin_r - outline_w, 
                   cx + pin_r + outline_w, cy + pin_r + outline_w], fill=(255, 255, 255))
    # Green circle
    draw.ellipse([cx - pin_r, cy - pin_r, cx + pin_r, cy + pin_r], fill=green)
    
    # ─── White runner stick figure ───
    runner_white = (255, 255, 255)
    sw = max(int(size * 0.018), 2)  # stroke width
    
    # Head
    head_r = int(pin_r * 0.15)
    head_cx = cx + int(pin_r * 0.1)
    head_cy = cy - int(pin_r * 0.45)
    draw.ellipse([head_cx - head_r, head_cy - head_r, head_cx + head_r, head_cy + head_r], fill=runner_white)
    
    # Body
    body_top = (head_cx - int(pin_r * 0.05), head_cy + head_r)
    body_bottom = (cx - int(pin_r * 0.1), cy + int(pin_r * 0.3))
    draw.line([body_top, body_bottom], fill=runner_white, width=sw)
    
    # Arms (running pose)
    arm_start = (head_cx - int(pin_r * 0.02), cy - int(pin_r * 0.15))
    draw.line([arm_start, (cx - int(pin_r * 0.35), cy - int(pin_r * 0.3))], fill=runner_white, width=sw)
    draw.line([arm_start, (cx + int(pin_r * 0.3), cy + int(pin_r * 0.05))], fill=runner_white, width=sw)
    
    # Legs (running pose)
    hip = body_bottom
    draw.line([hip, (cx - int(pin_r * 0.4), cy + int(pin_r * 0.55))], fill=runner_white, width=sw)
    draw.line([hip, (cx + int(pin_r * 0.2), cy + int(pin_r * 0.6))], fill=runner_white, width=sw)
    
    return img


def main():
    base = r'c:\Users\Usuario\Documents\demo\sportmaps-demo\frontend'
    
    # Generate icon at different sizes
    icon_512 = create_sportmaps_icon(512)
    
    # Save as main logo
    icon_512.save(os.path.join(base, 'public', 'sportmaps-logo.png'))
    icon_512.save(os.path.join(base, 'src', 'assets', 'sportmaps-logo.png'))
    print('✅ sportmaps-logo.png saved (public + src/assets)')
    
    # Save as favicon.png (32x32 and 64x64 for quality)
    icon_64 = icon_512.resize((64, 64), Image.LANCZOS)
    icon_64.save(os.path.join(base, 'public', 'favicon.png'))
    print('✅ favicon.png saved (64x64)')
    
    # Save as favicon.ico (multi-size)
    icon_16 = icon_512.resize((16, 16), Image.LANCZOS)
    icon_32 = icon_512.resize((32, 32), Image.LANCZOS)
    icon_48 = icon_512.resize((48, 48), Image.LANCZOS)
    icon_16.save(os.path.join(base, 'public', 'favicon.ico'), 
                 format='ICO', sizes=[(16,16), (32,32), (48,48)])
    print('✅ favicon.ico saved (16+32+48)')
    
    print('\nAll logo files generated!')


if __name__ == '__main__':
    main()
