// Confetti mínimo por canvas (sin dependencias, ~1.5s). CSP-safe.
// El caller decide no llamarlo si prefers-reduced-motion está activo.

interface Particle {
    x: number; y: number; vx: number; vy: number;
    size: number; color: string; rot: number; vr: number;
}

const COLORS = ['#22c55e', '#248223', '#f59e0b', '#0ea5e9', '#eab308', '#ffffff'];

export function fireConfetti(durationMs = 1500, count = 120): void {
    if (typeof document === 'undefined') return;
    const canvas = document.createElement('canvas');
    canvas.style.cssText =
        'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999';
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    document.body.appendChild(canvas);
    const g = canvas.getContext('2d');
    if (!g) { canvas.remove(); return; }

    const cx = canvas.width / 2;
    const parts: Particle[] = Array.from({ length: count }, () => {
        const angle = (Math.PI * 2 * Math.random());
        const speed = 4 + Math.random() * 7;
        return {
            x: cx, y: canvas.height * 0.35,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 4,
            size: 5 + Math.random() * 7,
            color: COLORS[Math.floor(Math.random() * COLORS.length)],
            rot: Math.random() * Math.PI,
            vr: (Math.random() - 0.5) * 0.4,
        };
    });

    const start = performance.now();
    function frame(now: number) {
        const elapsed = now - start;
        g!.clearRect(0, 0, canvas.width, canvas.height);
        for (const p of parts) {
            p.vy += 0.18;          // gravedad
            p.x += p.vx;
            p.y += p.vy;
            p.rot += p.vr;
            g!.save();
            g!.translate(p.x, p.y);
            g!.rotate(p.rot);
            g!.globalAlpha = Math.max(0, 1 - elapsed / durationMs);
            g!.fillStyle = p.color;
            g!.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
            g!.restore();
        }
        if (elapsed < durationMs) {
            requestAnimationFrame(frame);
        } else {
            canvas.remove();
        }
    }
    requestAnimationFrame(frame);
}
