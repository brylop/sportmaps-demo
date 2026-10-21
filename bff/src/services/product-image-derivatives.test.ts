import { describe, it, expect, vi } from 'vitest';

vi.mock('../config/supabase', () => ({ supabase: {} }));

import { storagePathFromUrl, derivativePath } from './product-image-derivatives';

const BASE = 'https://x.supabase.co/storage/v1/object/public/product-images';

describe('product-image-derivatives', () => {
    it('extrae la ruta del bucket product-images', () => {
        expect(storagePathFromUrl(`${BASE}/u1/123-ab.png`)).toBe('u1/123-ab.png');
        expect(storagePathFromUrl(`${BASE}/u1/123-ab.png?t=1`)).toBe('u1/123-ab.png');
    });

    it('ignora URLs de otros orígenes o vacías', () => {
        expect(storagePathFromUrl('https://cdn.otro.com/a.png')).toBeNull();
        expect(storagePathFromUrl(null)).toBeNull();
        expect(storagePathFromUrl('')).toBeNull();
    });

    it('no deriva de un derivado', () => {
        expect(storagePathFromUrl(`${BASE}/u1/123-ab.png__w600.webp`)).toBeNull();
    });

    it('arma la ruta del derivado', () => {
        expect(derivativePath('u1/123-ab.png', 600)).toBe('u1/123-ab.png__w600.webp');
    });
});
