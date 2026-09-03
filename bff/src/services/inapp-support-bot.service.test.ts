import { describe, it, expect } from 'vitest';
import { searchHelpArticles, appendHelpArticleLinks } from './inapp-support-bot.service';

describe('searchHelpArticles', () => {
    it('encuentra el artículo de registrar atleta y le arma el href a /ayuda/:slug', () => {
        const results = searchHelpArticles('¿cómo registro un nuevo atleta?');
        const match = results.find((r) => r.slug === 'registrar-nuevo-atleta');
        expect(match).toBeDefined();
        expect(match?.href).toBe('/ayuda/registrar-nuevo-atleta');
    });

    it('encuentra el artículo de QR de inscripción con pago', () => {
        const results = searchHelpArticles('quiero crear un qr de inscripcion que cobre la matricula');
        const match = results.find((r) => r.slug === 'qr-inscripcion-con-pago');
        expect(match).toBeDefined();
        expect(match?.href).toBe('/ayuda/qr-inscripcion-con-pago');
    });

    it('devuelve arreglo vacío si no hay términos útiles', () => {
        expect(searchHelpArticles('  ')).toEqual([]);
    });
});

describe('appendHelpArticleLinks', () => {
    const found = [
        { slug: 'registrar-nuevo-atleta', title: 'Registrar un nuevo atleta manualmente', excerpt: '', snippet: '', href: '/ayuda/registrar-nuevo-atleta' },
    ];

    it('agrega el link si el texto del LLM no lo trae', () => {
        const out = appendHelpArticleLinks('search_help_articles', found, 'Claro, te explico cómo hacerlo.');
        expect(out).toContain('/ayuda/registrar-nuevo-atleta');
    });

    it('no duplica el link si el LLM ya lo citó', () => {
        const already = 'Mira la guía: /ayuda/registrar-nuevo-atleta';
        const out = appendHelpArticleLinks('search_help_articles', found, already);
        expect(out).toBe(already);
    });

    it('no toca el texto si la tool no fue search_help_articles', () => {
        const out = appendHelpArticleLinks('get_payment_status', found, 'Estás al día.');
        expect(out).toBe('Estás al día.');
    });

    it('no toca el texto si no hubo resultados', () => {
        const out = appendHelpArticleLinks('search_help_articles', [], 'No encontré nada.');
        expect(out).toBe('No encontré nada.');
    });
});
