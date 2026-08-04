/**
 * MiTiendaPage — entrada del padre/atleta a la tienda de SU escuela.
 *
 * Resuelve el slug de la tienda de la escuela activa (BFF
 * /marketplace/school-store/:schoolId) y redirige a la vitrina pública
 * /tienda/:slug. Si la escuela no tiene tienda publicada, muestra un aviso.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { bffClient } from '@/lib/api/bffClient';
import { Button } from '@/components/ui/button';
import { Loader2, Store } from 'lucide-react';

interface StoreResolve {
  ok: boolean;
  data?: { slug: string | null; published: boolean; display_name: string | null };
}

export default function MiTiendaPage() {
  const { schoolId } = useSchoolContext();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'unavailable'>('loading');
  const [schoolName, setSchoolName] = useState<string>('tu escuela');

  useEffect(() => {
    let active = true;
    (async () => {
      if (!schoolId) return;
      try {
        const r = await bffClient.get<StoreResolve>(`/api/v1/marketplace/school-store/${schoolId}`);
        if (!active) return;
        if (r.data?.display_name) setSchoolName(r.data.display_name);
        if (r.ok && r.data?.slug && r.data.published) {
          navigate(`/tienda/${r.data.slug}`, { replace: true });
        } else {
          setStatus('unavailable');
        }
      } catch {
        if (active) setStatus('unavailable');
      }
    })();
    return () => { active = false; };
  }, [schoolId, navigate]);

  if (status === 'loading') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 p-6 text-center">
      <Store className="h-12 w-12 text-muted-foreground/40" />
      <h1 className="text-xl font-bold">La tienda aún no está disponible</h1>
      <p className="text-muted-foreground max-w-sm">
        {schoolName} todavía no ha publicado su tienda de productos. Te avisaremos cuando esté lista.
      </p>
      <Button variant="outline" onClick={() => navigate('/marketplace')}>Explorar el marketplace</Button>
    </div>
  );
}
