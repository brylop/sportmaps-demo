/**
 * Vista previa de un video de la jugada. YouTube (dominio youtube-nocookie) y
 * Vimeo se incrustan; todo lo demás (cámaras deportivas, Drive, Dropbox) es una
 * tarjeta que abre el enlace en otra pestaña con rel="noopener noreferrer":
 * nunca un iframe a un dominio sin embed público verificado.
 */
import { ExternalLink, Video } from 'lucide-react';
import { PROVIDER_LABEL, embedUrl, formatClock, watchUrl, type PlayVideo } from '@/lib/school/tacticalMedia';

export function VideoPreview({ video, className = '' }: { video: PlayVideo; className?: string }) {
  const src = embedUrl(video);
  if (src) {
    return (
      <div className={`relative w-full overflow-hidden rounded-lg bg-black ${className}`} style={{ aspectRatio: '16 / 9' }}>
        <iframe
          key={src}
          src={src}
          title={video.title}
          className="absolute inset-0 h-full w-full"
          allow="encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
          loading="lazy"
          data-testid="video-embed"
        />
      </div>
    );
  }
  const href = watchUrl(video);
  const label = PROVIDER_LABEL[video.provider];
  return (
    <div className={`flex flex-col items-center justify-center gap-3 rounded-lg border border-white/10 bg-gradient-to-br from-zinc-800 to-zinc-900 p-5 text-center ${className}`} style={{ aspectRatio: '16 / 9' }}
      data-testid="video-link-card">
      <Video className="h-8 w-8 text-white/50" />
      <div>
        <p className="font-semibold text-white">{video.title}</p>
        <p className="text-xs text-white/55">
          {label}{video.start_s ? ` · desde el minuto ${formatClock(video.start_s)}` : ''}
          {video.provider !== 'sportmaps' ? ' · se abre en una pestaña nueva' : ''}
        </p>
      </div>
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-500">
          Ver en {label} <ExternalLink className="h-3.5 w-3.5" />
        </a>
      ) : (
        <p className="text-xs text-white/50">Este video todavía no se puede ver acá.</p>
      )}
    </div>
  );
}
