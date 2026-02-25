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
        <div className="bg-blue-600 rounded-xl p-4 mb-6 text-white shadow-lg animate-in fade-in slide-in-from-top-4">
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="bg-white/20 p-2 rounded-lg">
                        <Mail className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h3 className="font-bold">¡Tienes una invitación pendiente!</h3>
                        <p className="text-sm text-blue-100">
                            La academia <strong>{invitation.school_name}</strong> quiere vincularte como <strong>{invitation.role_to_assign}</strong>.
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleAccept}
                        disabled={isAccepting || !invitation?.id}
                        className="bg-white text-blue-600 px-4 py-2 rounded-lg font-bold text-sm hover:bg-blue-50 transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                        {isAccepting ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                        ) : (
                            <Check className="w-4 h-4" />
                        )}
                        Aceptar
                    </button>
                    <button className="bg-blue-700 text-white px-3 py-2 rounded-lg text-sm hover:bg-blue-800 transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};
