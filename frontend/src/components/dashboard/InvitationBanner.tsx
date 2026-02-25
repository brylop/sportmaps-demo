import React from 'react';
import { Mail, Check, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Invitation {
    id: string;
    school_name: string;
    role_to_assign: string;
}

interface InvitationBannerProps {
    invitation: Invitation;
    onAction: () => void;
}

export const InvitationBanner: React.FC<InvitationBannerProps> = ({ invitation, onAction }) => {
    const { toast } = useToast();
    const [isAccepting, setIsAccepting] = React.useState(false);

    const handleAccept = async () => {
        if (!invitation?.id) {
            toast({
                title: "Error",
                description: "ID de invitación no disponible.",
                variant: "destructive"
            });
            return;
        }

        setIsAccepting(true);
        try {
            const { data, error } = await (supabase.rpc as any)('accept_invitation_pro', { p_invite_id: invitation.id });

            if (error) throw error;

            toast({
                title: "¡Invitación aceptada!",
                description: `Ahora eres parte de ${invitation.school_name}.`,
            });

            onAction();
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message || "No se pudo aceptar la invitación.",
                variant: "destructive"
            });
        } finally {
            setIsAccepting(false);
        }
    };

    return (
        <div className="bg-gradient-to-r from-primary via-[#1a5d19] to-primary rounded-2xl p-4 mb-6 text-white shadow-lg animate-in fade-in slide-in-from-top-4 border border-white/10 relative overflow-hidden">
            {/* Background pattern/glow */}
            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white/10 rounded-full blur-2xl pointer-events-none" />

            <div className="flex flex-col md:flex-row items-center justify-between gap-4 relative z-10">
                <div className="flex items-center gap-4">
                    <div className="bg-white/20 p-2.5 rounded-xl backdrop-blur-sm border border-white/20">
                        <Mail className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg leading-tight">¡Tienes una invitación pendiente!</h3>
                        <p className="text-sm text-white/90">
                            La academia <strong className="text-white underline decoration-accent-orange underline-offset-4">{invitation.school_name}</strong> quiere vincularte como <strong className="capitalize">{invitation.role_to_assign}</strong>.
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                    <button
                        onClick={handleAccept}
                        disabled={isAccepting || !invitation?.id}
                        className="bg-white text-primary px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-neutral-50 transition-all flex items-center gap-2 disabled:opacity-50 shadow-sm active:scale-95"
                    >
                        {isAccepting ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        ) : (
                            <Check className="w-4 h-4" />
                        )}
                        Aceptar Invitación
                    </button>
                    <button className="bg-black/20 text-white p-2.5 rounded-xl hover:bg-black/30 transition-colors border border-white/10">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};
