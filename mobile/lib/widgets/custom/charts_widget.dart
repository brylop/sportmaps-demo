// ============================================================
// SportMaps — fl_chart (reemplaza Recharts)
// Paquete requerido: fl_chart: ^0.68.0
//
// Componentes:
//   1. SmLineChart — Rendimiento / Asistencia
//   2. SmBarChart  — KPIs / Estadísticas
//   3. SmPieChart  — Distribución de roles/categorías
// ============================================================

import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

import '../../theme/sportmaps_theme.dart';

// ─────────────────────────────────────────
// 1. LineChart — Rendimiento / Asistencia
// ─────────────────────────────────────────

/// Gráfica de línea con gradiente inferior y puntos interactivos.
///
/// ```dart
/// SmLineChart(
///   label: 'Asistencia %',
///   spots: [
///     FlSpot(0, 80), FlSpot(1, 85), FlSpot(2, 78),
///     FlSpot(3, 92), FlSpot(4, 88), FlSpot(5, 95),
///   ],
/// )
/// ```
class SmLineChart extends StatelessWidget {
  final List<FlSpot> spots;
  final String label;
  final Color lineColor;
  final Color gradientColor;
  final List<String>? bottomLabels;

  const SmLineChart({
    super.key,
    required this.spots,
    required this.label,
    this.lineColor = SmColors.primary,
    this.gradientColor = const Color(0x33248223),
    this.bottomLabels,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: Theme.of(context)
                .textTheme
                .titleSmall
                ?.copyWith(color: SmColors.mutedForeground)),
        const SizedBox(height: 8),
        AspectRatio(
          aspectRatio: 1.8,
          child: LineChart(
            LineChartData(
              gridData: FlGridData(
                show: true,
                drawVerticalLine: false,
                getDrawingHorizontalLine: (_) => const FlLine(
                  color: SmColors.border,
                  strokeWidth: 1,
                ),
              ),
              titlesData: FlTitlesData(
                leftTitles: AxisTitles(
                  sideTitles: SideTitles(
                    showTitles: true,
                    reservedSize: 40,
                    getTitlesWidget: (value, meta) => Text(
                      value.toInt().toString(),
                      style: const TextStyle(
                          fontSize: 11, color: SmColors.mutedForeground),
                    ),
                  ),
                ),
                bottomTitles: AxisTitles(
                  sideTitles: SideTitles(
                    showTitles: true,
                    getTitlesWidget: (value, meta) {
                      final idx = value.toInt();
                      final text = (bottomLabels != null &&
                              idx >= 0 &&
                              idx < bottomLabels!.length)
                          ? bottomLabels![idx]
                          : meta.formattedValue;
                      return Text(text,
                          style: const TextStyle(
                              fontSize: 11, color: SmColors.mutedForeground));
                    },
                  ),
                ),
                topTitles:
                    const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                rightTitles:
                    const AxisTitles(sideTitles: SideTitles(showTitles: false)),
              ),
              borderData: FlBorderData(show: false),
              lineBarsData: [
                LineChartBarData(
                  spots: spots,
                  isCurved: true,
                  color: lineColor,
                  barWidth: 3,
                  isStrokeCapRound: true,
                  dotData: FlDotData(
                    getDotPainter: (spot, _, __, ___) => FlDotCirclePainter(
                      radius: 4,
                      color: Colors.white,
                      strokeColor: lineColor,
                      strokeWidth: 2,
                    ),
                  ),
                  belowBarData: BarAreaData(
                    show: true,
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [gradientColor, Colors.transparent],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────
// 2. BarChart — KPIs / Estadísticas
// ─────────────────────────────────────────

/// Gráfica de barras verticales con tooltip al tocar.
///
/// ```dart
/// SmBarChart(
///   barGroups: [
///     smBarGroup(x: 0, value: 85),
///     smBarGroup(x: 1, value: 72, color: SmColors.accent),
///     smBarGroup(x: 2, value: 93),
///   ],
///   bottomLabels: ['Ene', 'Feb', 'Mar'],
/// )
/// ```
class SmBarChart extends StatelessWidget {
  final List<BarChartGroupData> barGroups;
  final List<String> bottomLabels;
  final double maxY;

  const SmBarChart({
    super.key,
    required this.barGroups,
    required this.bottomLabels,
    this.maxY = 100,
  });

  @override
  Widget build(BuildContext context) {
    return AspectRatio(
      aspectRatio: 1.6,
      child: BarChart(
        BarChartData(
          alignment: BarChartAlignment.spaceAround,
          maxY: maxY,
          barTouchData: BarTouchData(
            touchTooltipData: BarTouchTooltipData(
              getTooltipColor: (_) => SmColors.primary,
              getTooltipItem: (group, groupIndex, rod, rodIndex) =>
                  BarTooltipItem(
                '${rod.toY.round()}%',
                const TextStyle(
                    color: Colors.white, fontWeight: FontWeight.bold),
              ),
            ),
          ),
          gridData: FlGridData(
            show: true,
            drawVerticalLine: false,
            getDrawingHorizontalLine: (_) =>
                const FlLine(color: SmColors.border, strokeWidth: 1),
          ),
          borderData: FlBorderData(show: false),
          titlesData: FlTitlesData(
            bottomTitles: AxisTitles(
              sideTitles: SideTitles(
                showTitles: true,
                getTitlesWidget: (value, _) {
                  final idx = value.toInt();
                  if (idx < 0 || idx >= bottomLabels.length) {
                    return const SizedBox.shrink();
                  }
                  return Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Text(
                      bottomLabels[idx],
                      style: const TextStyle(
                          fontSize: 11, color: SmColors.mutedForeground),
                    ),
                  );
                },
              ),
            ),
            leftTitles: AxisTitles(
              sideTitles: SideTitles(
                showTitles: true,
                reservedSize: 36,
                getTitlesWidget: (value, _) => Text(
                  '${value.toInt()}%',
                  style: const TextStyle(
                      fontSize: 10, color: SmColors.mutedForeground),
                ),
              ),
            ),
            topTitles:
                const AxisTitles(sideTitles: SideTitles(showTitles: false)),
            rightTitles:
                const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          ),
          barGroups: barGroups,
        ),
      ),
    );
  }
}

/// Helper para crear un grupo de barras con colores SportMaps.
BarChartGroupData smBarGroup({
  required int x,
  required double value,
  Color color = SmColors.primary,
  double width = 18,
}) =>
    BarChartGroupData(
      x: x,
      barRods: [
        BarChartRodData(
          toY: value,
          color: color,
          width: width,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(4)),
        ),
      ],
    );

// ─────────────────────────────────────────
// 3. PieChart — Distribución de roles/categorías
// ─────────────────────────────────────────

/// PieChart con interacción touch que amplía la sección seleccionada.
///
/// ```dart
/// SmPieChart(
///   sections: [
///     PieChartSectionData(value: 40, color: SmColors.primary, title: '40%'),
///     PieChartSectionData(value: 30, color: SmColors.accent, title: '30%'),
///     PieChartSectionData(value: 30, color: SmColors.primaryGlow, title: '30%'),
///   ],
/// )
/// ```
class SmPieChart extends StatefulWidget {
  final List<PieChartSectionData> sections;
  final double radius;

  const SmPieChart({
    super.key,
    required this.sections,
    this.radius = 80,
  });

  @override
  State<SmPieChart> createState() => _SmPieChartState();
}

class _SmPieChartState extends State<SmPieChart> {
  int touchedIndex = -1;

  @override
  Widget build(BuildContext context) {
    return AspectRatio(
      aspectRatio: 1.3,
      child: PieChart(
        PieChartData(
          pieTouchData: PieTouchData(
            touchCallback: (event, pieTouchResponse) {
              setState(() {
                if (!event.isInterestedForInteractions ||
                    pieTouchResponse == null ||
                    pieTouchResponse.touchedSection == null) {
                  touchedIndex = -1;
                  return;
                }
                touchedIndex =
                    pieTouchResponse.touchedSection!.touchedSectionIndex;
              });
            },
          ),
          sections: widget.sections.asMap().entries.map((e) {
            final isTouched = e.key == touchedIndex;
            return e.value.copyWith(
              radius: isTouched ? widget.radius + 10 : widget.radius,
              titleStyle: TextStyle(
                fontSize: isTouched ? 14 : 12,
                fontWeight: FontWeight.bold,
                color: Colors.white,
              ),
            );
          }).toList(),
          sectionsSpace: 3,
          centerSpaceRadius: 40,
        ),
      ),
    );
  }
}
