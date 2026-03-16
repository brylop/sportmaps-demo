import { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { hexToHsl } from '@/contexts/ThemeContext'

export interface InvitationBranding {
    logo_url: string | null
    school_name: string | null
    branding_settings: {
        primary_color: string
        secondary_color: string
        show_sportmaps_watermark: boolean
    } | null
}

export function useInvitationBranding(token: string | null) {
    const [branding, setBranding] = useState<InvitationBranding | null>(null)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (!token) return

        async function load() {
            setLoading(true)
            try {
                // Obtenemos los datos con la función Rpc creada en la DB
                const { data, error } = await supabase
                    .rpc('get_school_branding_by_invitation', { p_token: token })
                    .maybeSingle()

                if (error) {
                    console.error("Error fetching invitation branding:", error)
                    return
                }

                if (data) {
                    const typedData = data as any;
                    setBranding({
                        logo_url: typedData.logo_url,
                        school_name: typedData.school_name,
                        branding_settings: {
                            primary_color: typedData.primary_color,
                            secondary_color: typedData.secondary_color,
                            show_sportmaps_watermark: typedData.show_sportmaps_watermark
                        }
                    })

                    // Si hay color primario, lo inyectamos al documento
                    if (typedData.primary_color) {
                        document.documentElement.style.setProperty(
                            '--primary',
                            hexToHsl(typedData.primary_color)
                        )
                        document.documentElement.style.setProperty(
                            '--secondary',
                            hexToHsl(typedData.secondary_color)
                        )
                    }
                }
            } finally {
                setLoading(false)
            }
        }

        load()

        // Cleanup: revertir a colores por defecto si se desmonta o cambia el token (ThemesProvider can also take over)
        return () => {
            document.documentElement.style.removeProperty('--primary')
            document.documentElement.style.removeProperty('--secondary')
        }
    }, [token])

    return branding
}
