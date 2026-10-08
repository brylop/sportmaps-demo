// /products (y sus alias /categories, /promotions) muestran el mismo "Mis productos"
// que /vendor/products: lista del BFF con estado en español, stock real (suma de
// variantes), filtros y ajuste de stock con motivo. Antes era una tabla aparte que
// leía products.stock por vendor_id (0 en productos con tallas, nada para el admin
// de la escuela) y marcaba "stock bajo" con < 20 fijo.
export { default } from './vendor/VendorProductsPage';
