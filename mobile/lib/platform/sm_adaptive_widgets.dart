// ============================================================
// SportMaps — Adaptive UI Components
// Widgets que se comportan diferente en iOS / Android / Web
// ============================================================

import 'package:flutter/material.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:sportmaps/platform/sm_adaptive_scaffold.dart';
import 'package:sportmaps/theme/sportmaps_theme.dart';

// ─────────────────────────────────────────
// 1. ADAPTIVE ALERT DIALOG
//    Android → AlertDialog (Material)
//    iOS → CupertinoAlertDialog
//    Web → AlertDialog con max-width
// ─────────────────────────────────────────
class SmAdaptiveDialog {
  static Future<bool?> confirm(
    BuildContext context, {
    required String title,
    required String message,
    String confirmText = 'Confirmar',
    String cancelText = 'Cancelar',
    bool destructive = false,
  }) {
    if (SmPlatform.isIOS) {
      return showCupertinoDialog<bool>(
        context: context,
        builder: (_) => CupertinoAlertDialog(
          title: Text(title),
          content: Text(message),
          actions: [
            CupertinoDialogAction(
              isDestructiveAction: destructive,
              onPressed: () => Navigator.pop(context, true),
              child: Text(confirmText),
            ),
            CupertinoDialogAction(
              onPressed: () => Navigator.pop(context, false),
              child: Text(cancelText),
            ),
          ],
        ),
      );
    }

    // Android + Web
    return showDialog<bool>(
      context: context,
      builder: (_) => kIsWeb
          ? _WebDialog(
              title: title,
              message: message,
              confirmText: confirmText,
              cancelText: cancelText,
              destructive: destructive,
            )
          : AlertDialog(
              title: Text(title),
              content: Text(message),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context, false),
                  child: Text(cancelText),
                ),
                ElevatedButton(
                  onPressed: () => Navigator.pop(context, true),
                  style: ElevatedButton.styleFrom(
                    backgroundColor:
                        destructive ? SmColors.destructive : SmColors.primary,
                    foregroundColor: Colors.white,
                  ),
                  child: Text(confirmText),
                ),
              ],
            ),
    );
  }
}

class _WebDialog extends StatelessWidget {
  final String title;
  final String message;
  final String confirmText;
  final String cancelText;
  final bool destructive;

  const _WebDialog({
    required this.title,
    required this.message,
    required this.confirmText,
    required this.cancelText,
    required this.destructive,
  });

  @override
  Widget build(BuildContext context) {
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 440),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 12),
              Text(message,
                  style: Theme.of(context)
                      .textTheme
                      .bodyMedium
                      ?.copyWith(color: SmColors.mutedForeground)),
              const SizedBox(height: 24),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TextButton(
                    onPressed: () => Navigator.pop(context, false),
                    child: Text(cancelText),
                  ),
                  const SizedBox(width: 8),
                  ElevatedButton(
                    onPressed: () => Navigator.pop(context, true),
                    style: ElevatedButton.styleFrom(
                      backgroundColor:
                          destructive ? SmColors.destructive : SmColors.primary,
                      foregroundColor: Colors.white,
                    ),
                    child: Text(confirmText),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────
// 2. ADAPTIVE DATE PICKER
//    Android → showDatePicker (Material)
//    iOS → CupertinoDatePicker (bottom sheet)
//    Web → showDatePicker con locale
// ─────────────────────────────────────────
class SmAdaptiveDatePicker {
  static Future<DateTime?> show(
    BuildContext context, {
    DateTime? initialDate,
    DateTime? firstDate,
    DateTime? lastDate,
  }) async {
    final now = DateTime.now();
    final initial = initialDate ?? now;
    final first = firstDate ?? DateTime(1920);
    final last = lastDate ?? DateTime(now.year + 10);

    if (SmPlatform.isIOS) {
      DateTime picked = initial;
      final result = await showCupertinoModalPopup<DateTime>(
        context: context,
        builder: (_) => Container(
          height: 300,
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.surface,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: Column(
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  CupertinoButton(
                    child: const Text('Cancelar'),
                    onPressed: () => Navigator.pop(context),
                  ),
                  CupertinoButton(
                    child: const Text('Listo',
                        style: TextStyle(color: Color(0xFF248223))),
                    onPressed: () => Navigator.pop(context, picked),
                  ),
                ],
              ),
              Expanded(
                child: CupertinoDatePicker(
                  mode: CupertinoDatePickerMode.date,
                  initialDateTime: initial,
                  minimumDate: first,
                  maximumDate: last,
                  onDateTimeChanged: (d) => picked = d,
                ),
              ),
            ],
          ),
        ),
      );
      return result;
    }

    // Android + Web
    return showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: first,
      lastDate: last,
      builder: (ctx, child) => Theme(
        data: Theme.of(ctx).copyWith(
          colorScheme: Theme.of(ctx).colorScheme.copyWith(
                primary: SmColors.primary,
              ),
        ),
        child: child!,
      ),
    );
  }
}

// ─────────────────────────────────────────
// 3. ADAPTIVE LOADING INDICATOR
//    iOS → CupertinoActivityIndicator
//    Android/Web → CircularProgressIndicator
// ─────────────────────────────────────────
class SmAdaptiveLoader extends StatelessWidget {
  final double size;
  final Color? color;

  const SmAdaptiveLoader({super.key, this.size = 24, this.color});

  @override
  Widget build(BuildContext context) {
    if (SmPlatform.isIOS) {
      return CupertinoActivityIndicator(radius: size / 2);
    }
    return SizedBox(
      width: size,
      height: size,
      child: CircularProgressIndicator(
        strokeWidth: 2.5,
        color: color ?? SmColors.primary,
      ),
    );
  }
}

// ─────────────────────────────────────────
// 4. ADAPTIVE PAGE TRANSITIONS
//    iOS → CupertinoPageRoute (slide derecha)
//    Android → MaterialPageRoute (fade+scale)
//    Web → FadeTransition
// ─────────────────────────────────────────
Route<T> smAdaptiveRoute<T>(Widget page) {
  if (SmPlatform.isIOS) {
    return CupertinoPageRoute<T>(builder: (_) => page);
  }
  if (kIsWeb) {
    return PageRouteBuilder<T>(
      pageBuilder: (_, __, ___) => page,
      transitionsBuilder: (_, anim, __, child) =>
          FadeTransition(opacity: anim, child: child),
      transitionDuration: const Duration(milliseconds: 200),
    );
  }
  return MaterialPageRoute<T>(builder: (_) => page);
}

// ─────────────────────────────────────────
// 5. ADAPTIVE SCROLL PHYSICS
//    iOS → BouncingScrollPhysics
//    Android → ClampingScrollPhysics
//    Web → NeverScrollableScrollPhysics (gestos propios)
// ─────────────────────────────────────────
ScrollPhysics get smAdaptiveScrollPhysics {
  if (SmPlatform.isIOS) {
    return const BouncingScrollPhysics();
  }
  if (kIsWeb) {
    return const ClampingScrollPhysics();
  }
  return const ClampingScrollPhysics();
}

// ─────────────────────────────────────────
// 6. ADAPTIVE SWITCH
//    iOS → CupertinoSwitch
//    Android/Web → Switch (Material 3)
// ─────────────────────────────────────────
class SmAdaptiveSwitch extends StatelessWidget {
  final bool value;
  final ValueChanged<bool> onChanged;
  final Color? activeColor;

  const SmAdaptiveSwitch({
    super.key,
    required this.value,
    required this.onChanged,
    this.activeColor,
  });

  @override
  Widget build(BuildContext context) {
    final color = activeColor ?? SmColors.primary;
    if (SmPlatform.isIOS) {
      return CupertinoSwitch(
        value: value,
        onChanged: onChanged,
        activeTrackColor: color,
      );
    }
    return Switch(
      value: value,
      onChanged: onChanged,
      activeThumbColor: color,
    );
  }
}

// ─────────────────────────────────────────
// 7. ADAPTIVE BACK BUTTON / NAVIGATION
//    iOS → chevron.left (Cupertino)
//    Android → arrow_back (Material)
//    Web → oculto (usa breadcrumbs)
// ─────────────────────────────────────────
class SmAdaptiveBackButton extends StatelessWidget {
  final VoidCallback? onPressed;

  const SmAdaptiveBackButton({super.key, this.onPressed});

  @override
  Widget build(BuildContext context) {
    if (kIsWeb) {
      return const SizedBox.shrink();
    }

    if (SmPlatform.isIOS) {
      return CupertinoNavigationBarBackButton(
        color: SmColors.primary,
        onPressed: onPressed ?? () => Navigator.of(context).pop(),
      );
    }

    return IconButton(
      icon: const Icon(Icons.arrow_back),
      onPressed: onPressed ?? () => Navigator.of(context).pop(),
      color: SmColors.primary,
    );
  }
}

// ─────────────────────────────────────────
// 8. WEB-ONLY: Hover effects
//    En mobile, onHover no aplica
// ─────────────────────────────────────────
class SmHoverCard extends StatefulWidget {
  final Widget child;
  final VoidCallback? onTap;
  final EdgeInsetsGeometry? padding;

  const SmHoverCard({
    super.key,
    required this.child,
    this.onTap,
    this.padding,
  });

  @override
  State<SmHoverCard> createState() => _SmHoverCardState();
}

class _SmHoverCardState extends State<SmHoverCard> {
  bool _hovered = false;

  @override
  Widget build(BuildContext context) {
    return MouseRegion(
      onEnter: (_) => kIsWeb ? setState(() => _hovered = true) : null,
      onExit: (_) => kIsWeb ? setState(() => _hovered = false) : null,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: widget.padding ?? const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: _hovered
                ? SmColors.primary.withValues(alpha: 0.4)
                : SmColors.border,
          ),
          boxShadow: _hovered
              ? [
                  BoxShadow(
                    color: SmColors.primary.withValues(alpha: 0.08),
                    blurRadius: 16,
                    offset: const Offset(0, 4),
                  ),
                ]
              : [],
        ),
        child: GestureDetector(
          onTap: widget.onTap,
          child: widget.child,
        ),
      ),
    );
  }
}
