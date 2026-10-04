import type { OrderStatus } from '@/lib/store/orderStatus';

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  image_url: string;
  vendor_id: string;
  created_at?: string;
  discount?: number;
  rating?: number;
  reviews_count?: number;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface Order {
  id: string;
  user_id: string;
  total: number;
  /** Estados vigentes (M-F0-3); `pending`/`processing` son legacy, ver lib/store/orderStatus. */
  status: OrderStatus | 'pending' | 'processing';
  shipping_address: ShippingAddress;
  created_at: string;
  items: CartItem[];
}

export interface ShippingAddress {
  full_name: string;
  phone: string;
  address: string;
  city: string;
  postal_code: string;
  notes?: string;
}

export const PRODUCT_CATEGORIES = [
  'Calzado',
  'Ropa Deportiva',
  'Accesorios',
  'Equipamiento',
  'Tecnología',
  'Suplementos',
  'Balones',
  'Protección',
] as const;

export type ProductCategory = typeof PRODUCT_CATEGORIES[number];
