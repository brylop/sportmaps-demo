import { MASCOT_ALT, MASCOT_IMG } from '@/config/mascot';
import './mapi.css';

/** Avatar circular de Mapi para conversaciones del asistente (mapi-avatar-512.png). */
export function MapiAvatar({ className = 'w-8 h-8' }: { className?: string }) {
    return (
        <img
            src={MASCOT_IMG.avatar512}
            alt={MASCOT_ALT}
            width={512}
            height={512}
            decoding="async"
            className={`${className} rounded-full object-cover shrink-0 bg-primary/10`}
        />
    );
}

/**
 * Mapi para los avisos del modo Recepción: entra con rebote y luego se balancea.
 * Animación CSS simple mientras se definen las de Rive. Con «reducir movimiento»
 * se queda quieta. `badge` conserva el significado del aviso (saludo, check, lupa, fiesta).
 */
export function MapiToastMascot({ badge, animate }: { badge?: string; animate: boolean }) {
    return (
        <div className={`relative shrink-0 w-16 h-16 ${animate ? 'mapi-pop' : ''}`}>
            <img
                src={MASCOT_IMG.body400}
                alt={MASCOT_ALT}
                width={400}
                height={385}
                decoding="async"
                className={`w-full h-full object-contain ${animate ? 'mapi-sway' : ''}`}
            />
            {badge && (
                <span className="absolute -bottom-1 -right-1 text-xl leading-none drop-shadow">{badge}</span>
            )}
        </div>
    );
}
