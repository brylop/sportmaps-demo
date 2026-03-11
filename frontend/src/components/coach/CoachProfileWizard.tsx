import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useStorage } from '@/hooks/useStorage';
import { coachesAPI, CoachCertification } from '@/lib/api/coaches';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { SPORTS_LIST } from '@/lib/constants/sportsCatalog';

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Camera,
    X,
    Check,
    Plus,
    Trash2,
    FileText,
    Loader2,
    Upload,
    ArrowRight,
    ArrowLeft,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────
interface CertBlock {
    id: string;
    name: string;
    file: File | null;
    fileName: string;
    existingUrl?: string;
}

interface CoachProfileWizardProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
    initialStep?: number;
}

// ─── Component ──────────────────────────────────────────
export function CoachProfileWizard({ open, onOpenChange, onSuccess, initialStep = 1 }: CoachProfileWizardProps) {
    const { user, profile, updateProfile } = useAuth();
    const { uploadFile, uploading } = useStorage();

    // Wizard state
    const [currentStep, setCurrentStep] = useState(initialStep);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Step 1: Basic data
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [fullName, setFullName] = useState('');
    const [docType, setDocType] = useState('CC');
    const [docNumber, setDocNumber] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [primarySport, setPrimarySport] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Step 2: Certifications
    const [certBlocks, setCertBlocks] = useState<CertBlock[]>([
        { id: crypto.randomUUID(), name: '', file: null, fileName: '' }
    ]);
    const [existingCerts, setExistingCerts] = useState<CoachCertification[]>([]);

    // Step 1 validation errors
    const [errors, setErrors] = useState<Record<string, string>>({});

    // ─── Pre-fill from existing data ─────────────────────
    useEffect(() => {
        if (!open || !user?.id) return;
        setCurrentStep(initialStep);
        setIsLoading(true);

        const loadData = async () => {
            try {
                // Pre-fill from profiles
                setFullName(profile?.full_name || '');
                setPhone(profile?.phone || '');
                setEmail(user.email || '');
                setAvatarPreview(profile?.avatar_url || null);

                // Pre-fill from coach_profiles
                const coachProfile = await coachesAPI.getCoachProfile(user.id);
                if (coachProfile) {
                    setDocType(coachProfile.doc_type || 'CC');
                    setDocNumber(coachProfile.doc_number || '');
                    setPrimarySport(coachProfile.primary_sport || '');
                }

                // Load existing certifications
                const certs = await coachesAPI.getCertifications(user.id);
                setExistingCerts(certs);
            } catch (err) {
                console.error('Error loading coach data:', err);
            } finally {
                setIsLoading(false);
            }
        };

        loadData();
    }, [open, user?.id]);

    // ─── Avatar handler ──────────────────────────────────
    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setAvatarFile(file);
            const reader = new FileReader();
            reader.onloadend = () => setAvatarPreview(reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    // ─── Cert block handlers ─────────────────────────────
    const addCertBlock = () => {
        setCertBlocks(prev => [...prev, { id: crypto.randomUUID(), name: '', file: null, fileName: '' }]);
    };

    const removeCertBlock = (id: string) => {
        setCertBlocks(prev => prev.filter(b => b.id !== id));
    };

    const updateCertBlock = (id: string, field: keyof CertBlock, value: any) => {
        setCertBlocks(prev => prev.map(b => b.id === id ? { ...b, [field]: value } : b));
    };

    const handleCertFileChange = (blockId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            updateCertBlock(blockId, 'file', file);
            updateCertBlock(blockId, 'fileName', file.name);
        }
    };

    // ─── Step Validation ─────────────────────────────────
    const validateStep1 = (): boolean => {
        const newErrors: Record<string, string> = {};
        if (!fullName.trim()) newErrors.fullName = 'El nombre es obligatorio';
        if (!docType) newErrors.docType = 'Selecciona un tipo de documento';
        if (!docNumber.trim()) newErrors.docNumber = 'El número de documento es obligatorio';
        if (!phone.trim()) newErrors.phone = 'El teléfono es obligatorio';
        if (!primarySport.trim()) newErrors.primarySport = 'El deporte principal es obligatorio';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const nextStep = () => {
        if (currentStep === 1 && !validateStep1()) {
            toast.error('Completa todos los campos obligatorios');
            return;
        }
        setCurrentStep(2);
    };

    const prevStep = () => setCurrentStep(1);

    // ─── Submit ──────────────────────────────────────────
    const handleSubmit = async () => {
        if (!user?.id) return;

        // 1. VALIDATION: Check for duplicate certifications BEFORE any state/API changes
        const duplicates = certBlocks.filter(block => {
            if (!block.name.trim()) return false;
            const inExisting = existingCerts.some(ec => ec.name.toLowerCase() === block.name.trim().toLowerCase());
            const inNew = certBlocks.some(b => b.id !== block.id && b.name.trim().toLowerCase() === block.name.trim().toLowerCase());
            return inExisting || inNew;
        });

        if (duplicates.length > 0) {
            toast.error('No puedes agregar certificados con nombres que ya existen');
            return;
        }

        setIsSubmitting(true);
        try {
            // 2. Avatar Upload
            let avatarUrl = profile?.avatar_url || '';
            if (avatarFile) {
                const url = await uploadFile(avatarFile, 'avatars', `coaches/${user.id}`);
                if (url) avatarUrl = url;
            }

            // 3. Basic Profile Update (Silent to avoid double toast)
            await updateProfile({
                full_name: fullName.trim(),
                phone: phone.trim(),
                avatar_url: avatarUrl,
            }, { silent: true });

            // 4. Professional Profile Extension
            await coachesAPI.upsertCoachProfile({
                id: user.id,
                doc_type: docType,
                doc_number: docNumber.trim(),
                primary_sport: primarySport.trim(),
                profile_completed: true,
            });

            // 5. New Certifications
            for (const block of certBlocks) {
                if (!block.name.trim()) continue;

                let fileUrl: string | null = null;
                let fileName: string | null = null;

                if (block.file) {
                    const uploaded = await uploadFile(block.file, 'coach-certificates', `${user.id}`);
                    if (uploaded) {
                        fileUrl = uploaded;
                        fileName = block.fileName;
                    }
                }

                await coachesAPI.addCertification(user.id, block.name.trim(), fileUrl, fileName);
            }

            toast.success('Perfil profesional guardado exitosamente');
            onOpenChange(false);
            onSuccess();
        } catch (error: any) {
            console.error('Error saving coach profile:', error);
            toast.error('Error al guardar el perfil: ' + (error.message || 'Intenta de nuevo'));
        } finally {
            setIsSubmitting(false);
        }
    };

    // ─── Delete existing certification ───────────────────
    const handleDeleteExistingCert = async (cert: CoachCertification) => {
        try {
            await coachesAPI.deleteCertification(cert.id);
            setExistingCerts(prev => prev.filter(c => c.id !== cert.id));
            toast.success('Certificado eliminado');
        } catch {
            toast.error('Error al eliminar el certificado');
        }
    };

    // ─── Render ──────────────────────────────────────────
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[540px]">
                <DialogHeader>
                    <DialogTitle>Perfil Profesional</DialogTitle>
                    <DialogDescription>
                        Completa tu información profesional para activar todas las funciones de entrenador
                    </DialogDescription>
                </DialogHeader>

                {/* Stepper */}
                <div className="mb-6 mt-2 px-12">
                    <div className="relative flex justify-between items-center">
                        <div className="absolute top-5 left-0 w-full h-0.5 bg-muted z-0"></div>
                        <div
                            className="absolute top-5 left-0 h-0.5 bg-primary z-0 transition-all duration-300"
                            style={{ width: currentStep === 1 ? '0%' : '100%' }}
                        ></div>

                        <div className="relative z-10 flex flex-col items-center">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${currentStep >= 1 ? 'bg-primary border-primary text-white' : 'bg-background border-muted text-muted-foreground'
                                }`}>
                                {currentStep > 1 ? <Check className="w-5 h-5" /> : 1}
                            </div>
                            <span className={`text-[10px] mt-2 font-semibold uppercase tracking-wider ${currentStep >= 1 ? 'text-primary' : 'text-muted-foreground'
                                }`}>Datos Básicos</span>
                        </div>

                        <div className="relative z-10 flex flex-col items-center">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${currentStep >= 2 ? 'bg-primary border-primary text-white' : 'bg-background border-muted text-muted-foreground'
                                }`}>
                                2
                            </div>
                            <span className={`text-[10px] mt-2 font-semibold uppercase tracking-wider ${currentStep >= 2 ? 'text-primary' : 'text-muted-foreground'
                                }`}>Certificados</span>
                        </div>
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                ) : (
                    <div className="max-h-[55vh] overflow-y-auto px-1 custom-scrollbar">
                        {/* ═══════ STEP 1: Datos Básicos ═══════ */}
                        {currentStep === 1 && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                                {/* Avatar */}
                                <div className="flex flex-col items-center justify-center py-2 space-y-2">
                                    <div className="relative group">
                                        <Avatar className="w-24 h-24 border-2 border-primary/20">
                                            <AvatarImage src={avatarPreview || ''} className="object-cover" />
                                            <AvatarFallback className="bg-muted text-2xl font-bold">
                                                {fullName?.charAt(0) || <Camera className="w-8 h-8 opacity-20" />}
                                            </AvatarFallback>
                                        </Avatar>
                                        <label className="absolute bottom-0 right-0 bg-primary text-white p-1.5 rounded-full cursor-pointer hover:bg-primary/90 transition-colors shadow-lg">
                                            <Camera className="w-4 h-4" />
                                            <input
                                                type="file"
                                                className="hidden"
                                                accept="image/*"
                                                onChange={handleAvatarChange}
                                                ref={fileInputRef}
                                            />
                                        </label>
                                        {avatarPreview && avatarFile && (
                                            <button
                                                type="button"
                                                onClick={() => { setAvatarPreview(profile?.avatar_url || null); setAvatarFile(null); }}
                                                className="absolute -top-1 -right-1 bg-destructive text-white p-1 rounded-full shadow-md"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        )}
                                    </div>
                                    <span className="text-xs text-muted-foreground">Foto de Perfil</span>
                                </div>

                                {/* Full Name */}
                                <div className="space-y-2">
                                    <Label>Nombre Completo *</Label>
                                    <Input
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        placeholder="Ej: David Gómez Rodríguez"
                                    />
                                    {errors.fullName && <p className="text-xs text-destructive">{errors.fullName}</p>}
                                </div>

                                {/* Document */}
                                <div className="grid grid-cols-5 gap-3">
                                    <div className="col-span-2 space-y-2">
                                        <Label>Tipo Doc. *</Label>
                                        <Select value={docType} onValueChange={setDocType}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="CC">CC</SelectItem>
                                                <SelectItem value="CE">CE</SelectItem>
                                                <SelectItem value="TI">TI</SelectItem>
                                                <SelectItem value="PA">Pasaporte</SelectItem>
                                                <SelectItem value="NIT">NIT</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        {errors.docType && <p className="text-xs text-destructive">{errors.docType}</p>}
                                    </div>
                                    <div className="col-span-3 space-y-2">
                                        <Label>Número de Documento *</Label>
                                        <Input
                                            value={docNumber}
                                            onChange={(e) => setDocNumber(e.target.value)}
                                            placeholder="Ej: 1234567890"
                                        />
                                        {errors.docNumber && <p className="text-xs text-destructive">{errors.docNumber}</p>}
                                    </div>
                                </div>

                                {/* Contact */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                        <Label>Teléfono Celular *</Label>
                                        <Input
                                            type="tel"
                                            value={phone}
                                            onChange={(e) => setPhone(e.target.value)}
                                            placeholder="+57 300 000 0000"
                                        />
                                        {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Correo Electrónico</Label>
                                        <Input
                                            type="email"
                                            value={email}
                                            disabled
                                            className="bg-muted"
                                        />
                                    </div>
                                </div>

                                {/* Primary Sport */}
                                <div className="space-y-2">
                                    <Label>Deporte Principal *</Label>
                                    <Select value={primarySport} onValueChange={setPrimarySport}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecciona deporte" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {SPORTS_LIST.map((sport) => (
                                                <SelectItem key={sport} value={sport}>
                                                    {sport}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {errors.primarySport && <p className="text-xs text-destructive">{errors.primarySport}</p>}
                                </div>
                            </div>
                        )}

                        {/* ═══════ STEP 2: Certificados y Licencias ═══════ */}
                        {currentStep === 2 && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                                <p className="text-sm text-muted-foreground">
                                    Agrega tus certificaciones y licencias profesionales. Puedes subir archivos PDF o imágenes.
                                </p>

                                {/* Existing certifications */}
                                {existingCerts.length > 0 && (
                                    <div className="space-y-2">
                                        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Certificados guardados</Label>
                                        {existingCerts.map((cert) => (
                                            <div key={cert.id} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                                                <FileText className="w-5 h-5 text-primary shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium truncate">{cert.name}</p>
                                                    {cert.file_name && (
                                                        <p className="text-xs text-muted-foreground truncate">{cert.file_name}</p>
                                                    )}
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="shrink-0 h-8 w-8 text-destructive hover:text-destructive"
                                                    onClick={() => handleDeleteExistingCert(cert)}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* New certification blocks */}
                                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                                    {existingCerts.length > 0 ? 'Agregar nuevos' : 'Certificaciones'}
                                </Label>
                                {certBlocks.map((block, idx) => (
                                    <div key={block.id} className="space-y-3 p-4 rounded-lg border border-dashed">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium text-muted-foreground">
                                                Certificado {existingCerts.length + idx + 1}
                                            </span>
                                            {certBlocks.length > 1 && (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 text-destructive hover:text-destructive"
                                                    onClick={() => removeCertBlock(block.id)}
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </Button>
                                            )}
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Nombre del certificado</Label>
                                            <Input
                                                value={block.name}
                                                onChange={(e) => updateCertBlock(block.id, 'name', e.target.value)}
                                                placeholder="Ej: Licencia FIFA B, Certificado en Nutrición Deportiva..."
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Archivo adjunto</Label>
                                            <div className="relative">
                                                <input
                                                    type="file"
                                                    className="hidden"
                                                    id={`cert-file-${block.id}`}
                                                    accept=".pdf,image/*"
                                                    onChange={(e) => handleCertFileChange(block.id, e)}
                                                />
                                                <label
                                                    htmlFor={`cert-file-${block.id}`}
                                                    className="flex items-center gap-3 p-3 rounded-lg border-2 border-dashed cursor-pointer hover:border-primary/50 transition-colors"
                                                >
                                                    {block.fileName ? (
                                                        <>
                                                            <FileText className="w-5 h-5 text-primary" />
                                                            <span className="text-sm truncate flex-1">{block.fileName}</span>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-6 w-6"
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    updateCertBlock(block.id, 'file', null);
                                                                    updateCertBlock(block.id, 'fileName', '');
                                                                    // Reset the native input value so the SAME file can be picked again
                                                                    const input = document.getElementById(`cert-file-${block.id}`) as HTMLInputElement;
                                                                    if (input) input.value = '';
                                                                }}
                                                            >
                                                                <X className="w-3 h-3" />
                                                            </Button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Upload className="w-5 h-5 text-muted-foreground" />
                                                            <span className="text-sm text-muted-foreground">PDF o imagen (opcional)</span>
                                                        </>
                                                    )}
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                <Button
                                    type="button"
                                    variant="outline"
                                    className="w-full gap-2"
                                    onClick={addCertBlock}
                                >
                                    <Plus className="w-4 h-4" />
                                    Añadir otra certificación
                                </Button>
                            </div>
                        )}
                    </div>
                )}

                {/* ─── Footer Buttons ──────────────────────────── */}
                <div className="flex justify-between pt-4 border-t">
                    {currentStep === 1 ? (
                        <>
                            <Button variant="outline" onClick={() => onOpenChange(false)}>
                                Cancelar
                            </Button>
                            <Button onClick={nextStep} className="gap-2">
                                Siguiente
                                <ArrowRight className="w-4 h-4" />
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button variant="outline" onClick={prevStep} className="gap-2">
                                <ArrowLeft className="w-4 h-4" />
                                Anterior
                            </Button>
                            <Button
                                onClick={handleSubmit}
                                disabled={isSubmitting || uploading}
                                className="gap-2"
                            >
                                {isSubmitting || uploading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Guardando...
                                    </>
                                ) : (
                                    <>
                                        <Check className="w-4 h-4" />
                                        Guardar Perfil
                                    </>
                                )}
                            </Button>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
