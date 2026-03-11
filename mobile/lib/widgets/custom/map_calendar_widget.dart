// ============================================================
// SportMaps — flutter_map + table_calendar
//
// Componentes:
//   1. SmMapView   — Mapa con marcadores (reemplaza Leaflet)
//   2. SmCalendar  — Calendario con eventos (reemplaza react-day-picker)
//
// Paquetes requeridos:
//   flutter_map: ^6.1.0
//   latlong2: ^0.9.0
//   table_calendar: ^3.1.2
// ============================================================

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart' hide Path;
import 'package:table_calendar/table_calendar.dart';

import '../../theme/sportmaps_theme.dart';

// ─────────────────────────────────────────
// 1. SmMapView — Mapa interactivo
// ─────────────────────────────────────────

/// Modelo de datos para un marcador del mapa.
class SmMarkerData {
  final LatLng position;
  final String title;
  final String? subtitle;
  final Color color;
  final IconData icon;

  const SmMarkerData({
    required this.position,
    required this.title,
    this.subtitle,
    this.color = SmColors.primary,
    this.icon = Icons.sports_soccer,
  });
}

/// Mapa basado en OpenStreetMap con marcadores interactivos y popup.
///
/// ```dart
/// SmMapView(
///   initialCenter: LatLng(4.711, -74.072),
///   markers: [
///     SmMarkerData(
///       position: LatLng(4.711, -74.072),
///       title: 'Estadio El Campín',
///       subtitle: 'Bogotá, Colombia',
///       icon: Icons.stadium,
///     ),
///   ],
/// )
/// ```
class SmMapView extends StatefulWidget {
  final List<SmMarkerData> markers;
  final LatLng initialCenter;
  final double initialZoom;
  final double? height;

  const SmMapView({
    super.key,
    required this.markers,
    this.initialCenter = const LatLng(4.711, -74.072), // Bogotá default
    this.initialZoom = 12,
    this.height,
  });

  @override
  State<SmMapView> createState() => _SmMapViewState();
}

class _SmMapViewState extends State<SmMapView> {
  SmMarkerData? _selectedMarker;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: widget.height ?? 400,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: Stack(
          children: [
            // ── Mapa ──
            FlutterMap(
              options: MapOptions(
                initialCenter: widget.initialCenter,
                initialZoom: widget.initialZoom,
                onTap: (_, __) => setState(() => _selectedMarker = null),
              ),
              children: [
                TileLayer(
                  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                  userAgentPackageName: 'com.sportmaps.app',
                ),
                MarkerLayer(
                  markers: widget.markers.map((m) {
                    final isSelected = _selectedMarker == m;
                    return Marker(
                      point: m.position,
                      width: 48,
                      height: 48,
                      child: GestureDetector(
                        onTap: () => setState(() => _selectedMarker = m),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 200),
                          curve: Curves.easeOut,
                          transform: Matrix4.diagonal3Values(
                            isSelected ? 1.3 : 1.0,
                            isSelected ? 1.3 : 1.0,
                            1.0,
                          ),
                          child: _MapMarkerPin(
                            color: m.color,
                            icon: m.icon,
                            isSelected: isSelected,
                          ),
                        ),
                      ),
                    );
                  }).toList(),
                ),
              ],
            ),

            // ── Popup de marcador seleccionado ──
            if (_selectedMarker != null)
              Positioned(
                bottom: 16,
                left: 16,
                right: 16,
                child: _MarkerInfoCard(
                  marker: _selectedMarker!,
                  onClose: () => setState(() => _selectedMarker = null),
                ),
              ),

            // ── Atribución OSM ──
            Positioned(
              bottom: _selectedMarker != null ? 100 : 8,
              right: 8,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.8),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: const Text(
                  '© OpenStreetMap',
                  style: TextStyle(fontSize: 10, color: Colors.black54),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// Pin visual del marcador
class _MapMarkerPin extends StatelessWidget {
  final Color color;
  final IconData icon;
  final bool isSelected;

  const _MapMarkerPin({
    required this.color,
    required this.icon,
    this.isSelected = false,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: color,
            shape: BoxShape.circle,
            boxShadow: [
              BoxShadow(
                color: color.withValues(alpha: isSelected ? 0.5 : 0.3),
                blurRadius: isSelected ? 12 : 6,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Icon(icon, color: Colors.white, size: 18),
        ),
        CustomPaint(
          size: const Size(12, 6),
          painter: _PinTailPainter(color: color),
        ),
      ],
    );
  }
}

class _PinTailPainter extends CustomPainter {
  final Color color;
  _PinTailPainter({required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = color;
    final path = Path()
      ..moveTo(0, 0)
      ..lineTo(size.width / 2, size.height)
      ..lineTo(size.width, 0)
      ..close();
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant _PinTailPainter old) => old.color != color;
}

// Tarjeta de información del marcador seleccionado
class _MarkerInfoCard extends StatelessWidget {
  final SmMarkerData marker;
  final VoidCallback onClose;

  const _MarkerInfoCard({required this.marker, required this.onClose});

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 4,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: marker.color.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(marker.icon, color: marker.color, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(marker.title,
                      style: const TextStyle(
                          fontWeight: FontWeight.bold, fontSize: 14)),
                  if (marker.subtitle != null)
                    Text(marker.subtitle!,
                        style: const TextStyle(
                            fontSize: 12, color: SmColors.mutedForeground)),
                ],
              ),
            ),
            IconButton(
              icon: const Icon(Icons.close, size: 18),
              onPressed: onClose,
              color: Colors.grey,
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────
// 2. SmCalendar — Calendario con eventos
// ─────────────────────────────────────────

/// Calendario mensual con indicadores de eventos.
///
/// ```dart
/// SmCalendar(
///   events: {
///     DateTime(2026, 3, 15): ['Partido vs. Tigres', 'Entrenamiento'],
///     DateTime(2026, 3, 20): ['Copa Regional'],
///   },
///   onDaySelected: (day) => print('Seleccionado: $day'),
/// )
/// ```
class SmCalendar extends StatefulWidget {
  /// Mapa de fecha → lista de nombres de eventos.
  final Map<DateTime, List<String>> events;
  final void Function(DateTime day)? onDaySelected;
  final DateTime? initialSelectedDay;

  const SmCalendar({
    super.key,
    this.events = const {},
    this.onDaySelected,
    this.initialSelectedDay,
  });

  @override
  State<SmCalendar> createState() => _SmCalendarState();
}

class _SmCalendarState extends State<SmCalendar> {
  late DateTime _focusedDay;
  DateTime? _selectedDay;

  @override
  void initState() {
    super.initState();
    _focusedDay = DateTime.now();
    _selectedDay = widget.initialSelectedDay;
  }

  List<String> _getEventsForDay(DateTime day) {
    return widget.events[DateTime(day.year, day.month, day.day)] ?? [];
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      elevation: 0,
      color: Theme.of(context).colorScheme.surface,
      child: Padding(
        padding: const EdgeInsets.all(8),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TableCalendar<String>(
              firstDay: DateTime(2020),
              lastDay: DateTime(2030),
              focusedDay: _focusedDay,
              selectedDayPredicate: (day) => isSameDay(_selectedDay, day),
              eventLoader: _getEventsForDay,
              onDaySelected: (selected, focused) {
                setState(() {
                  _selectedDay = selected;
                  _focusedDay = focused;
                });
                widget.onDaySelected?.call(selected);
              },
              calendarStyle: CalendarStyle(
                // Día seleccionado — verde SportMaps
                selectedDecoration: const BoxDecoration(
                  color: SmColors.primary,
                  shape: BoxShape.circle,
                ),
                // Día de hoy
                todayDecoration: BoxDecoration(
                  color: SmColors.primary.withValues(alpha: 0.15),
                  shape: BoxShape.circle,
                ),
                todayTextStyle: const TextStyle(color: SmColors.primary),
                // Marcador de evento (naranja)
                markerDecoration: const BoxDecoration(
                  color: SmColors.accent,
                  shape: BoxShape.circle,
                ),
                markerSize: 5,
                markerMargin: const EdgeInsets.only(top: 2),
              ),
              headerStyle: const HeaderStyle(
                formatButtonVisible: false,
                titleCentered: true,
                titleTextStyle: TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 16,
                  color: SmColors.foreground,
                ),
                leftChevronIcon:
                    Icon(Icons.chevron_left, color: SmColors.primary),
                rightChevronIcon:
                    Icon(Icons.chevron_right, color: SmColors.primary),
              ),
              daysOfWeekStyle: const DaysOfWeekStyle(
                weekdayStyle: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: SmColors.mutedForeground),
                weekendStyle: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: SmColors.accent),
              ),
            ),

            // ── Lista de eventos del día seleccionado ──
            if (_selectedDay != null &&
                _getEventsForDay(_selectedDay!).isNotEmpty) ...[
              const Divider(height: 16),
              ...(_getEventsForDay(_selectedDay!).map((event) => ListTile(
                    dense: true,
                    leading: Container(
                      width: 8,
                      height: 8,
                      decoration: const BoxDecoration(
                        color: SmColors.accent,
                        shape: BoxShape.circle,
                      ),
                    ),
                    title: Text(event, style: const TextStyle(fontSize: 13)),
                  ))),
            ],
          ],
        ),
      ),
    );
  }
}
