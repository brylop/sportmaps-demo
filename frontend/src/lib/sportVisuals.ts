export interface SportVisual {
    label: string;
    sessionLabel: string;
    memberLabel: string;
    categoryLabel: string;
    icon: string;
    color: string;
    bgColor: string;
}

const SPORT_VISUALS: Record<string, SportVisual> = {
    // ═══════════════════════════════════════════════════════════════════
    // OLÍMPICOS DE VERANO
    // ═══════════════════════════════════════════════════════════════════
    atletismo: { label: 'Atletismo', sessionLabel: 'Entrenamiento', memberLabel: 'Atleta', categoryLabel: 'Prueba', icon: '🏃', color: 'text-red-600', bgColor: 'bg-red-50' },
    natacion: { label: 'Natación', sessionLabel: 'Clase', memberLabel: 'Nadador', categoryLabel: 'Nivel', icon: '🏊', color: 'text-cyan-600', bgColor: 'bg-cyan-50' },
    natacion_en_aguas_abiertas: { label: 'Aguas Abiertas', sessionLabel: 'Sesión', memberLabel: 'Nadador', categoryLabel: 'Distancia', icon: '🌊', color: 'text-blue-600', bgColor: 'bg-blue-50' },
    saltos_acuaticos: { label: 'Saltos Acuáticos', sessionLabel: 'Entrenamiento', memberLabel: 'Clavadista', categoryLabel: 'Plataforma', icon: '🤸', color: 'text-sky-600', bgColor: 'bg-sky-50' },
    waterpolo: { label: 'Waterpolo', sessionLabel: 'Entrenamiento', memberLabel: 'Jugador', categoryLabel: 'Categoría', icon: '🤽', color: 'text-blue-700', bgColor: 'bg-blue-50' },
    natacion_artistica_sincronizada: { label: 'Natación Artística', sessionLabel: 'Ensayo', memberLabel: 'Nadadora', categoryLabel: 'Modalidad', icon: '💃', color: 'text-pink-500', bgColor: 'bg-pink-50' },
    tiro_con_arco: { label: 'Tiro con Arco', sessionLabel: 'Sesión', memberLabel: 'Arquero', categoryLabel: 'Modalidad', icon: '🏹', color: 'text-green-800', bgColor: 'bg-green-50' },
    badminton: { label: 'Bádminton', sessionLabel: 'Partido', memberLabel: 'Jugador', categoryLabel: 'Nivel', icon: '🏸', color: 'text-lime-600', bgColor: 'bg-lime-50' },
    baloncesto: { label: 'Baloncesto', sessionLabel: 'Entrenamiento', memberLabel: 'Jugador', categoryLabel: 'Categoría', icon: '🏀', color: 'text-orange-500', bgColor: 'bg-orange-50' },
    boxeo: { label: 'Boxeo', sessionLabel: 'Entrenamiento', memberLabel: 'Boxeador', categoryLabel: 'Categoría', icon: '🥊', color: 'text-orange-600', bgColor: 'bg-orange-50' },
    piraguismo_esprint: { label: 'Piragüismo Sprint', sessionLabel: 'Sesión', memberLabel: 'Palista', categoryLabel: 'Embarcación', icon: '🛶', color: 'text-teal-600', bgColor: 'bg-teal-50' },
    piraguismo_eslalon: { label: 'Piragüismo Eslalon', sessionLabel: 'Sesión', memberLabel: 'Palista', categoryLabel: 'Modalidad', icon: '🛶', color: 'text-teal-700', bgColor: 'bg-teal-50' },
    ciclismo_en_ruta: { label: 'Ciclismo Ruta', sessionLabel: 'Salida', memberLabel: 'Ciclista', categoryLabel: 'Categoría', icon: '🚴', color: 'text-yellow-600', bgColor: 'bg-yellow-50' },
    ciclismo_en_pista: { label: 'Ciclismo Pista', sessionLabel: 'Sesión', memberLabel: 'Ciclista', categoryLabel: 'Prueba', icon: '🚴', color: 'text-yellow-700', bgColor: 'bg-yellow-50' },
    bmx_racing: { label: 'BMX Racing', sessionLabel: 'Sesión', memberLabel: 'Piloto', categoryLabel: 'Categoría', icon: '🚲', color: 'text-amber-600', bgColor: 'bg-amber-50' },
    bmx_freestyle: { label: 'BMX Freestyle', sessionLabel: 'Sesión', memberLabel: 'Rider', categoryLabel: 'Modalidad', icon: '🚲', color: 'text-amber-700', bgColor: 'bg-amber-50' },
    mountain_bike: { label: 'Mountain Bike', sessionLabel: 'Ruta', memberLabel: 'Ciclista', categoryLabel: 'Modalidad', icon: '🚵', color: 'text-emerald-700', bgColor: 'bg-emerald-50' },
    hipica_doma: { label: 'Hípica Doma', sessionLabel: 'Clase', memberLabel: 'Jinete', categoryLabel: 'Nivel', icon: '🐴', color: 'text-amber-800', bgColor: 'bg-amber-50' },
    hipica_concurso_completo: { label: 'Concurso Completo', sessionLabel: 'Sesión', memberLabel: 'Jinete', categoryLabel: 'Nivel', icon: '🐴', color: 'text-amber-700', bgColor: 'bg-amber-50' },
    hipica_salto: { label: 'Hípica Salto', sessionLabel: 'Clase', memberLabel: 'Jinete', categoryLabel: 'Nivel', icon: '🐴', color: 'text-amber-900', bgColor: 'bg-amber-50' },
    esgrima: { label: 'Esgrima', sessionLabel: 'Clase', memberLabel: 'Esgrimista', categoryLabel: 'Arma', icon: '🤺', color: 'text-slate-600', bgColor: 'bg-slate-50' },
    futbol: { label: 'Fútbol', sessionLabel: 'Entrenamiento', memberLabel: 'Jugador', categoryLabel: 'Categoría', icon: '⚽', color: 'text-green-700', bgColor: 'bg-green-50' },
    golf: { label: 'Golf', sessionLabel: 'Ronda', memberLabel: 'Golfista', categoryLabel: 'Handicap', icon: '⛳', color: 'text-green-600', bgColor: 'bg-green-50' },
    gimnasia_artistica: { label: 'Gimnasia Artística', sessionLabel: 'Entrenamiento', memberLabel: 'Gimnasta', categoryLabel: 'Aparato', icon: '🤸', color: 'text-pink-600', bgColor: 'bg-pink-50' },
    gimnasia_ritmica: { label: 'Gimnasia Rítmica', sessionLabel: 'Ensayo', memberLabel: 'Gimnasta', categoryLabel: 'Aparato', icon: '🎀', color: 'text-fuchsia-500', bgColor: 'bg-fuchsia-50' },
    trampolin: { label: 'Trampolín', sessionLabel: 'Clase', memberLabel: 'Gimnasta', categoryLabel: 'Modalidad', icon: '🤸', color: 'text-violet-500', bgColor: 'bg-violet-50' },
    balonmano: { label: 'Balonmano', sessionLabel: 'Entrenamiento', memberLabel: 'Jugador', categoryLabel: 'Categoría', icon: '🤾', color: 'text-blue-600', bgColor: 'bg-blue-50' },
    hockey_sobre_hierba: { label: 'Hockey', sessionLabel: 'Entrenamiento', memberLabel: 'Jugador', categoryLabel: 'Categoría', icon: '🏑', color: 'text-green-800', bgColor: 'bg-green-50' },
    judo: { label: 'Judo', sessionLabel: 'Clase', memberLabel: 'Judoka', categoryLabel: 'Cinturón', icon: '🥋', color: 'text-blue-800', bgColor: 'bg-blue-50' },
    lucha_libre: { label: 'Lucha Libre', sessionLabel: 'Entrenamiento', memberLabel: 'Luchador', categoryLabel: 'Peso', icon: '🤼', color: 'text-red-700', bgColor: 'bg-red-50' },
    lucha_grecorromana: { label: 'Lucha Grecorromana', sessionLabel: 'Entrenamiento', memberLabel: 'Luchador', categoryLabel: 'Peso', icon: '🤼', color: 'text-red-800', bgColor: 'bg-red-50' },
    pentatlon_moderno: { label: 'Pentatlón', sessionLabel: 'Sesión', memberLabel: 'Pentatleta', categoryLabel: 'Disciplina', icon: '🏅', color: 'text-indigo-600', bgColor: 'bg-indigo-50' },
    remo: { label: 'Remo', sessionLabel: 'Sesión', memberLabel: 'Remero', categoryLabel: 'Embarcación', icon: '🚣', color: 'text-sky-700', bgColor: 'bg-sky-50' },
    rugby_7: { label: 'Rugby', sessionLabel: 'Entrenamiento', memberLabel: 'Jugador', categoryLabel: 'Categoría', icon: '🏉', color: 'text-green-900', bgColor: 'bg-green-50' },
    vela: { label: 'Vela', sessionLabel: 'Navegación', memberLabel: 'Navegante', categoryLabel: 'Clase', icon: '⛵', color: 'text-blue-500', bgColor: 'bg-blue-50' },
    tiro_deportivo: { label: 'Tiro Deportivo', sessionLabel: 'Sesión', memberLabel: 'Tirador', categoryLabel: 'Modalidad', icon: '🎯', color: 'text-gray-700', bgColor: 'bg-gray-50' },
    skateboarding: { label: 'Skateboarding', sessionLabel: 'Sesión', memberLabel: 'Skater', categoryLabel: 'Modalidad', icon: '🛹', color: 'text-zinc-600', bgColor: 'bg-zinc-50' },
    escalada_deportiva: { label: 'Escalada', sessionLabel: 'Sesión', memberLabel: 'Escalador', categoryLabel: 'Modalidad', icon: '🧗', color: 'text-stone-600', bgColor: 'bg-stone-50' },
    surf: { label: 'Surf', sessionLabel: 'Sesión', memberLabel: 'Surfista', categoryLabel: 'Modalidad', icon: '🏄', color: 'text-cyan-700', bgColor: 'bg-cyan-50' },
    tenis_de_mesa: { label: 'Tenis de Mesa', sessionLabel: 'Partido', memberLabel: 'Jugador', categoryLabel: 'Nivel', icon: '🏓', color: 'text-red-500', bgColor: 'bg-red-50' },
    taekwondo: { label: 'Taekwondo', sessionLabel: 'Clase', memberLabel: 'Taekwondista', categoryLabel: 'Cinturón', icon: '🥋', color: 'text-blue-700', bgColor: 'bg-blue-50' },
    tenis: { label: 'Tenis', sessionLabel: 'Clase', memberLabel: 'Jugador', categoryLabel: 'Nivel', icon: '🎾', color: 'text-yellow-600', bgColor: 'bg-yellow-50' },
    triatlon: { label: 'Triatlón', sessionLabel: 'Entrenamiento', memberLabel: 'Triatleta', categoryLabel: 'Distancia', icon: '🏊‍♂️', color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
    voleibol: { label: 'Voleibol', sessionLabel: 'Entrenamiento', memberLabel: 'Jugador', categoryLabel: 'Categoría', icon: '🏐', color: 'text-yellow-500', bgColor: 'bg-yellow-50' },
    halterofilia: { label: 'Halterofilia', sessionLabel: 'Sesión', memberLabel: 'Halterófilo', categoryLabel: 'Peso', icon: '🏋️', color: 'text-gray-800', bgColor: 'bg-gray-50' },

    // ═══════════════════════════════════════════════════════════════════
    // NO OLÍMPICOS / LATAM RELEVANTES
    // ═══════════════════════════════════════════════════════════════════
    beisbol_softbol: { label: 'Béisbol/Sóftbol', sessionLabel: 'Entrenamiento', memberLabel: 'Jugador', categoryLabel: 'Categoría', icon: '⚾', color: 'text-red-600', bgColor: 'bg-red-50' },
    flag_football: { label: 'Flag Football', sessionLabel: 'Entrenamiento', memberLabel: 'Jugador', categoryLabel: 'Categoría', icon: '🏈', color: 'text-amber-600', bgColor: 'bg-amber-50' },
    squash: { label: 'Squash', sessionLabel: 'Partido', memberLabel: 'Jugador', categoryLabel: 'Nivel', icon: '🎾', color: 'text-indigo-500', bgColor: 'bg-indigo-50' },
    automovilismo: { label: 'Automovilismo', sessionLabel: 'Sesión', memberLabel: 'Piloto', categoryLabel: 'Categoría', icon: '🏎️', color: 'text-red-500', bgColor: 'bg-red-50' },
    ajedrez: { label: 'Ajedrez', sessionLabel: 'Sesión', memberLabel: 'Jugador', categoryLabel: 'Rating', icon: '♟️', color: 'text-slate-700', bgColor: 'bg-slate-50' },
    bolos_bowling: { label: 'Bolos', sessionLabel: 'Juego', memberLabel: 'Jugador', categoryLabel: 'Nivel', icon: '🎳', color: 'text-rose-500', bgColor: 'bg-rose-50' },
    billar: { label: 'Billar', sessionLabel: 'Partida', memberLabel: 'Jugador', categoryLabel: 'Modalidad', icon: '🎱', color: 'text-emerald-800', bgColor: 'bg-emerald-50' },
    pelota_vasca: { label: 'Pelota Vasca', sessionLabel: 'Partido', memberLabel: 'Pelotari', categoryLabel: 'Modalidad', icon: '🤾', color: 'text-red-700', bgColor: 'bg-red-50' },
    motociclismo: { label: 'Motociclismo', sessionLabel: 'Sesión', memberLabel: 'Piloto', categoryLabel: 'Categoría', icon: '🏍️', color: 'text-gray-700', bgColor: 'bg-gray-50' },

    // ═══════════════════════════════════════════════════════════════════
    // ARTES MARCIALES Y COMBATE
    // ═══════════════════════════════════════════════════════════════════
    karate: { label: 'Karate', sessionLabel: 'Clase', memberLabel: 'Karateka', categoryLabel: 'Cinturón', icon: '🥋', color: 'text-red-700', bgColor: 'bg-red-50' },
    muay_thai: { label: 'Muay Thai', sessionLabel: 'Clase', memberLabel: 'Peleador', categoryLabel: 'Peso', icon: '🥊', color: 'text-orange-700', bgColor: 'bg-orange-50' },
    kickboxing: { label: 'Kickboxing', sessionLabel: 'Clase', memberLabel: 'Peleador', categoryLabel: 'Peso', icon: '🥊', color: 'text-red-600', bgColor: 'bg-red-50' },
    wushu_kung_fu: { label: 'Wushu / Kung Fu', sessionLabel: 'Clase', memberLabel: 'Practicante', categoryLabel: 'Forma', icon: '🥋', color: 'text-amber-700', bgColor: 'bg-amber-50' },
    ju_jitsu: { label: 'Ju-Jitsu', sessionLabel: 'Clase', memberLabel: 'Atleta', categoryLabel: 'Cinturón', icon: '🥋', color: 'text-blue-700', bgColor: 'bg-blue-50' },
    lucha_olimpica_grappling: { label: 'Grappling', sessionLabel: 'Clase', memberLabel: 'Luchador', categoryLabel: 'Peso', icon: '🤼', color: 'text-purple-700', bgColor: 'bg-purple-50' },
    mma_artes_marciales_mixtas: { label: 'MMA', sessionLabel: 'Clase', memberLabel: 'Peleador', categoryLabel: 'Peso', icon: '🥊', color: 'text-red-600', bgColor: 'bg-red-50' },

    // ═══════════════════════════════════════════════════════════════════
    // RAQUETA Y PELOTA
    // ═══════════════════════════════════════════════════════════════════
    padel: { label: 'Pádel', sessionLabel: 'Partido', memberLabel: 'Jugador', categoryLabel: 'Nivel', icon: '🎾', color: 'text-green-600', bgColor: 'bg-green-50' },
    raquetbol: { label: 'Ráquetbol', sessionLabel: 'Partido', memberLabel: 'Jugador', categoryLabel: 'Nivel', icon: '🎾', color: 'text-blue-500', bgColor: 'bg-blue-50' },
    fronton_handball_mural: { label: 'Frontón', sessionLabel: 'Partido', memberLabel: 'Jugador', categoryLabel: 'Nivel', icon: '🤾', color: 'text-indigo-600', bgColor: 'bg-indigo-50' },

    // ═══════════════════════════════════════════════════════════════════
    // OTROS
    // ═══════════════════════════════════════════════════════════════════
    patinaje_de_velocidad_en_linea: { label: 'Patinaje en Línea', sessionLabel: 'Sesión', memberLabel: 'Patinador', categoryLabel: 'Distancia', icon: '⛸️', color: 'text-blue-600', bgColor: 'bg-blue-50' },
    futbol_americano: { label: 'Fútbol Americano', sessionLabel: 'Entrenamiento', memberLabel: 'Jugador', categoryLabel: 'Posición', icon: '🏈', color: 'text-amber-800', bgColor: 'bg-amber-50' },
    ultimate_frisbee: { label: 'Ultimate Frisbee', sessionLabel: 'Entrenamiento', memberLabel: 'Jugador', categoryLabel: 'Categoría', icon: '🥏', color: 'text-teal-500', bgColor: 'bg-teal-50' },
    polo: { label: 'Polo', sessionLabel: 'Chukker', memberLabel: 'Polista', categoryLabel: 'Handicap', icon: '🐴', color: 'text-amber-700', bgColor: 'bg-amber-50' },
    deportes_electronicos_esports: { label: 'Esports', sessionLabel: 'Sesión', memberLabel: 'Jugador', categoryLabel: 'Rank', icon: '🎮', color: 'text-violet-600', bgColor: 'bg-violet-50' },

    // ═══════════════════════════════════════════════════════════════════
    // PARALÍMPICOS
    // ═══════════════════════════════════════════════════════════════════
    atletismo_paralimpico: { label: 'Para Atletismo', sessionLabel: 'Entrenamiento', memberLabel: 'Atleta', categoryLabel: 'Clase', icon: '🏃‍♂️', color: 'text-red-500', bgColor: 'bg-red-50' },
    natacion_paralimpica: { label: 'Para Natación', sessionLabel: 'Clase', memberLabel: 'Nadador', categoryLabel: 'Clase', icon: '🏊', color: 'text-cyan-700', bgColor: 'bg-cyan-50' },
    boccia: { label: 'Boccia', sessionLabel: 'Sesión', memberLabel: 'Jugador', categoryLabel: 'Clase', icon: '🎯', color: 'text-green-600', bgColor: 'bg-green-50' },
    goalball: { label: 'Goalball', sessionLabel: 'Entrenamiento', memberLabel: 'Jugador', categoryLabel: 'Categoría', icon: '⚽', color: 'text-blue-800', bgColor: 'bg-blue-50' },
    tenis_en_silla_de_ruedas: { label: 'Tenis en Silla', sessionLabel: 'Partido', memberLabel: 'Jugador', categoryLabel: 'Clase', icon: '🎾', color: 'text-yellow-700', bgColor: 'bg-yellow-50' },
    baloncesto_en_silla_de_ruedas: { label: 'Basquet en Silla', sessionLabel: 'Entrenamiento', memberLabel: 'Jugador', categoryLabel: 'Clasificación', icon: '🏀', color: 'text-orange-600', bgColor: 'bg-orange-50' },

    // ═══════════════════════════════════════════════════════════════════
    // URBANOS / ACROBÁTICOS
    // ═══════════════════════════════════════════════════════════════════
    breakdance_breaking: { label: 'Breaking', sessionLabel: 'Sesión', memberLabel: 'B-boy/B-girl', categoryLabel: 'Nivel', icon: '🕺', color: 'text-fuchsia-600', bgColor: 'bg-fuchsia-50' },
    parkour_freerunning: { label: 'Parkour', sessionLabel: 'Sesión', memberLabel: 'Traceur', categoryLabel: 'Nivel', icon: '🏃', color: 'text-stone-700', bgColor: 'bg-stone-50' },
    acrobacias_cheerleading_tumbling: { label: 'Cheerleading', sessionLabel: 'Ensayo', memberLabel: 'Atleta', categoryLabel: 'Nivel', icon: '📣', color: 'text-pink-500', bgColor: 'bg-pink-50' },
    cheerleading_all_stars: { label: 'Cheer All Stars', sessionLabel: 'Ensayo', memberLabel: 'Cheerleader', categoryLabel: 'Nivel', icon: '📣', color: 'text-pink-600', bgColor: 'bg-pink-50' },

    // ═══════════════════════════════════════════════════════════════════
    // FITNESS / FUNCIONAL
    // ═══════════════════════════════════════════════════════════════════
    entrenamiento_funcional: { label: 'Funcional', sessionLabel: 'Clase', memberLabel: 'Alumno', categoryLabel: 'Nivel', icon: '💪', color: 'text-orange-500', bgColor: 'bg-orange-50' },
    crossfit: { label: 'CrossFit', sessionLabel: 'WOD', memberLabel: 'Atleta', categoryLabel: 'División', icon: '🏋️', color: 'text-red-600', bgColor: 'bg-red-50' },
    cross_training: { label: 'Cross Training', sessionLabel: 'Clase', memberLabel: 'Alumno', categoryLabel: 'Nivel', icon: '🔥', color: 'text-amber-600', bgColor: 'bg-amber-50' },
    lucha: { label: 'Lucha', sessionLabel: 'Entrenamiento', memberLabel: 'Luchador', categoryLabel: 'Peso', icon: '🤼', color: 'text-red-800', bgColor: 'bg-red-50' },

    // ═══════════════════════════════════════════════════════════════════
    // ALIASES (compatibilidad con keys existentes en sport_configs)
    // ═══════════════════════════════════════════════════════════════════
    mma: { label: 'MMA', sessionLabel: 'Clase', memberLabel: 'Atleta', categoryLabel: 'Categoría', icon: '🥊', color: 'text-red-600', bgColor: 'bg-red-50' },
    bjj: { label: 'BJJ', sessionLabel: 'Clase', memberLabel: 'Atleta', categoryLabel: 'Cinturón', icon: '🥋', color: 'text-blue-700', bgColor: 'bg-blue-50' },
    boxing: { label: 'Boxeo', sessionLabel: 'Entrenamiento', memberLabel: 'Boxeador', categoryLabel: 'Categoría', icon: '🥊', color: 'text-orange-600', bgColor: 'bg-orange-50' },
    chess: { label: 'Ajedrez', sessionLabel: 'Sesión', memberLabel: 'Jugador', categoryLabel: 'División', icon: '♟️', color: 'text-slate-700', bgColor: 'bg-slate-50' },
    tennis: { label: 'Tenis', sessionLabel: 'Clase', memberLabel: 'Jugador', categoryLabel: 'Nivel', icon: '🎾', color: 'text-yellow-600', bgColor: 'bg-yellow-50' },
    yoga: { label: 'Yoga', sessionLabel: 'Clase', memberLabel: 'Alumno', categoryLabel: 'Nivel', icon: '🧘', color: 'text-purple-600', bgColor: 'bg-purple-50' },
    swimming: { label: 'Natación', sessionLabel: 'Clase', memberLabel: 'Nadador', categoryLabel: 'Nivel', icon: '🏊', color: 'text-cyan-600', bgColor: 'bg-cyan-50' },
    football: { label: 'Fútbol', sessionLabel: 'Entrenamiento', memberLabel: 'Jugador', categoryLabel: 'Categoría', icon: '⚽', color: 'text-green-700', bgColor: 'bg-green-50' },
    basketball: { label: 'Baloncesto', sessionLabel: 'Entrenamiento', memberLabel: 'Jugador', categoryLabel: 'Categoría', icon: '🏀', color: 'text-orange-500', bgColor: 'bg-orange-50' },
};

export const DEFAULT_VISUAL: SportVisual = {
    label: 'Deporte',
    sessionLabel: 'Sesión',
    memberLabel: 'Atleta',
    categoryLabel: 'Categoría',
    icon: '🏃',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
};

export function getSportVisual(sport: string | null | undefined): SportVisual {
    if (!sport) return DEFAULT_VISUAL;
    // Try exact match first, then normalized
    const key = sport.toLowerCase().replace(/\s+/g, '_');
    return SPORT_VISUALS[key] ?? SPORT_VISUALS[sport.toLowerCase()] ?? DEFAULT_VISUAL;
}

export function getAllSportVisuals(): Record<string, SportVisual> {
    return SPORT_VISUALS;
}
