import { describe, it, expect } from 'vitest';
import { debenCorrerLosCrons } from './crons-solo-en-render';

describe('debenCorrerLosCrons', () => {
    it('en Render sí', () => {
        expect(debenCorrerLosCrons({ RENDER: 'true' } as any)).toBe(true);
        expect(debenCorrerLosCrons({ RENDER_SERVICE_ID: 'srv-abc123' } as any)).toBe(true);
    });
    it('en un computador no, aunque NODE_ENV diga production', () => {
        expect(debenCorrerLosCrons({} as any)).toBe(false);
        expect(debenCorrerLosCrons({ NODE_ENV: 'production' } as any)).toBe(false);
        expect(debenCorrerLosCrons({ RENDER: 'false' } as any)).toBe(false);
    });
    it('en local solo si se pide explícito', () => {
        expect(debenCorrerLosCrons({ CRONS_LOCALES: 'true' } as any)).toBe(true);
        expect(debenCorrerLosCrons({ CRONS_LOCALES: '1' } as any)).toBe(false);
    });
});
