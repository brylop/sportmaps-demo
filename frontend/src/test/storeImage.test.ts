import { describe, it, expect } from 'vitest';
import { isStoreImage, storeImageUrl } from '@/components/store/StoreImage';

const URL_OK = 'https://x.supabase.co/storage/v1/object/public/product-images/u1/1-a.png';

describe('StoreImage', () => {
  it('reconoce solo imágenes del bucket product-images', () => {
    expect(isStoreImage(URL_OK)).toBe(true);
    expect(isStoreImage('https://cdn.otro.com/a.png')).toBe(false);
    expect(isStoreImage(`${URL_OK}__w600.webp`)).toBe(false);
  });

  it('arma la URL de la miniatura y conserva el query', () => {
    expect(storeImageUrl(URL_OK, 600)).toBe(`${URL_OK}__w600.webp`);
    expect(storeImageUrl(`${URL_OK}?t=1`, 200)).toBe(`${URL_OK}__w200.webp?t=1`);
  });

  it('deja intacta una URL ajena', () => {
    expect(storeImageUrl('https://cdn.otro.com/a.png', 600)).toBe('https://cdn.otro.com/a.png');
  });
});
