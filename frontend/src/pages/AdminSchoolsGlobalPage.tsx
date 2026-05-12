import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Building, Search, Loader2, ChevronLeft, ChevronRight, School } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface GlobalSchool {
    id: string;
    name: string;
    city: string | null;
    verified: boolean;
    owner_email: string | null;
    created_at: string;
    children_count: number;
    branches_count: number;
}

const PAGE_SIZE = 20;

export default function AdminSchoolsGlobalPage() {
    const [schools, setSchools] = useState<GlobalSchool[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [verifiedFilter, setVerifiedFilter] = useState<'all' | 'verified' | 'pending'>('all');
    const [page, setPage] = useState(0);

    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
        return () => clearTimeout(t);
    }, [search]);

    useEffect(() => {
        setPage(0);
    }, [debouncedSearch, verifiedFilter]);

    const fetchSchools = useCallback(async () => {
        setLoading(true);
        try {
            const p_verified =
                verifiedFilter === 'all' ? null : verifiedFilter === 'verified';

            const { data, error } = await supabase.rpc('admin_list_schools_global' as any, {
                p_search: debouncedSearch || null,
                p_verified,
                p_limit: PAGE_SIZE,
                p_offset: page * PAGE_SIZE,
            });

            if (error) throw error;

            const payload = (data as any) || {};
            setSchools((payload.rows ?? []) as GlobalSchool[]);
            setTotal(payload.total ?? 0);
        } catch (err: any) {
            console.error('Error fetching global schools:', err);
            toast({
                title: 'Error al cargar escuelas',
                description: err?.message?.includes('Forbidden')
                    ? 'Tu cuenta no es super-admin de plataforma.'
                    : err?.message || 'No se pudieron cargar las escuelas.',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    }, [debouncedSearch, verifiedFilter, page]);

    useEffect(() => {
        fetchSchools();
    }, [fetchSchools]);

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const verifiedCount = schools.filter(s => s.verified).length;

    return (
        <div className="container mx-auto py-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                        <Building className="h-7 w-7 text-primary" />
                        Escuelas — Vista global
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Todas las escuelas registradas en la plataforma
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Card>
                    <CardContent className="p-4 text-center">
                        <p className="text-3xl font-bold text-blue-600">{total}</p>
                        <p className="text-sm text-muted-foreground mt-1">Total escuelas</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 text-center">
                        <p className="text-3xl font-bold text-emerald-600">{verifiedCount}</p>
                        <p className="text-sm text-muted-foreground mt-1">Verificadas (página)</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 text-center">
                        <p className="text-3xl font-bold text-amber-600">
                            {schools.length - verifiedCount}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">Pendientes (página)</p>
                    </CardContent>
                </Card>
            </div>

            <div className="flex gap-3 flex-wrap">
                <div className="relative max-w-xs flex-1">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por nombre o ciudad..."
                        className="pl-8"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <Select
                    value={verifiedFilter}
                    onValueChange={v => setVerifiedFilter(v as typeof verifiedFilter)}
                >
                    <SelectTrigger className="w-48">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        <SelectItem value="verified">Solo verificadas</SelectItem>
                        <SelectItem value="pending">Solo pendientes</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">
                        {total} escuela{total !== 1 ? 's' : ''}
                        {debouncedSearch && (
                            <span className="text-muted-foreground font-normal text-sm ml-2">
                                · filtro: "{debouncedSearch}"
                            </span>
                        )}
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : schools.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
                            <School className="h-10 w-10 opacity-30" />
                            <p className="text-sm">
                                No hay escuelas que coincidan con el filtro
                            </p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nombre</TableHead>
                                    <TableHead>Ciudad</TableHead>
                                    <TableHead>Owner</TableHead>
                                    <TableHead className="text-right">Atletas</TableHead>
                                    <TableHead className="text-right">Sedes</TableHead>
                                    <TableHead>Registro</TableHead>
                                    <TableHead>Estado</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {schools.map(s => (
                                    <TableRow key={s.id}>
                                        <TableCell className="font-medium">{s.name}</TableCell>
                                        <TableCell>{s.city || '—'}</TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                            {s.owner_email || '—'}
                                        </TableCell>
                                        <TableCell className="text-right">{s.children_count ?? 0}</TableCell>
                                        <TableCell className="text-right">{s.branches_count ?? 0}</TableCell>
                                        <TableCell className="text-xs">
                                            {s.created_at
                                                ? new Date(s.created_at).toLocaleDateString('es-CO', {
                                                      year: 'numeric',
                                                      month: 'short',
                                                      day: '2-digit',
                                                  })
                                                : '—'}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={s.verified ? 'default' : 'secondary'}>
                                                {s.verified ? 'Verificada' : 'Pendiente'}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {total > PAGE_SIZE && (
                <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                        Página {page + 1} de {totalPages}
                    </p>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page === 0 || loading}
                            onClick={() => setPage(p => Math.max(0, p - 1))}
                        >
                            <ChevronLeft className="h-4 w-4" />
                            Anterior
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page >= totalPages - 1 || loading}
                            onClick={() => setPage(p => p + 1)}
                        >
                            Siguiente
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
