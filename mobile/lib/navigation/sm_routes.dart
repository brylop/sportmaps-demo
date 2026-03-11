// ============================================================
// SportMaps — Rutas (constantes)
// Archivo independiente para evitar imports circulares
// ============================================================

abstract class SmRoutes {
  static const landing        = '/';
  static const login          = '/login';
  static const register       = '/register';
  static const forgotPassword = '/forgot-password';
  static const invite         = '/invite';
  static const schoolSlug     = '/s/:slug';
  static const eventSlug      = '/event/:slug';
  static const dashboard      = '/dashboard';
  static const explore        = '/explore';
  static const profile        = '/profile';
  static const notifications  = '/notifications';
  static const settings       = '/settings';
  static const messages       = '/messages';
  static const children       = '/children';
  static const childDetail    = '/children/:id';
  static const childProgress  = '/children/:id/progress';
  static const teams          = '/teams';
  static const teamDetail     = '/teams/:id';
  static const events         = '/events';
  static const eventDetail    = '/events/:id';
  static const finance        = '/finance';
  static const checkout       = '/checkout';
  static const schools        = '/schools';
  static const users          = '/users';
  static const training       = '/training';
  static const attendance     = '/attendance';
  static const performance    = '/performance';
}
