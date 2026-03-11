// ============================================================
// SportMaps — Componentes ✅ DIRECTOS
// Los 28 widgets con equivalente nativo Flutter/Material 3
// Archivo centralizado — import único para toda la app
// ============================================================

// ignore_for_file: prefer_const_constructors

import 'package:flutter/material.dart';
import '../../theme/sportmaps_theme.dart';

// ════════════════════════════════════════════════════════════
// SECCIÓN 1 — INPUTS
// ════════════════════════════════════════════════════════════

// ─────────────────────────────────────────
// 1. SmInput (TextField estilizado)
//    → reemplaza <Input> shadcn
// ─────────────────────────────────────────
class SmInput extends StatelessWidget {
  final String? label;
  final String? hint;
  final String? helper;
  final String? errorText;
  final TextEditingController? controller;
  final TextInputType keyboardType;
  final bool obscureText;
  final bool readOnly;
  final bool autofocus;
  final int? maxLines;
  final int? maxLength;
  final IconData? prefixIcon;
  final Widget? suffix;
  final ValueChanged<String>? onChanged;
  final VoidCallback? onTap;
  final FormFieldValidator<String>? validator;
  final String? initialValue;
  final TextInputAction textInputAction;
  final FocusNode? focusNode;

  const SmInput({
    super.key,
    this.label,
    this.hint,
    this.helper,
    this.errorText,
    this.controller,
    this.keyboardType = TextInputType.text,
    this.obscureText = false,
    this.readOnly = false,
    this.autofocus = false,
    this.maxLines = 1,
    this.maxLength,
    this.prefixIcon,
    this.suffix,
    this.onChanged,
    this.onTap,
    this.validator,
    this.initialValue,
    this.textInputAction = TextInputAction.next,
    this.focusNode,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (label != null) ...[
          Text(
            label!,
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
                  fontWeight: FontWeight.w500,
                  color: Theme.of(context).colorScheme.onSurface,
                ),
          ),
          const SizedBox(height: 6),
        ],
        TextFormField(
          controller: controller,
          initialValue: initialValue,
          keyboardType: keyboardType,
          obscureText: obscureText,
          readOnly: readOnly,
          autofocus: autofocus,
          maxLines: maxLines,
          maxLength: maxLength,
          focusNode: focusNode,
          textInputAction: textInputAction,
          onChanged: onChanged,
          onTap: onTap,
          validator: validator,
          style: Theme.of(context).textTheme.bodyMedium,
          decoration: InputDecoration(
            hintText: hint,
            helperText: helper,
            errorText: errorText,
            prefixIcon: prefixIcon != null
                ? Icon(prefixIcon,
                    size: 18,
                    color: Theme.of(context).colorScheme.onSurfaceVariant)
                : null,
            suffixIcon: suffix,
            counterText: maxLength != null ? null : '',
          ),
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────
// 2. SmPasswordInput — Input con toggle show/hide
//    → reemplaza <Input type="password">
// ─────────────────────────────────────────
class SmPasswordInput extends StatefulWidget {
  final String? label;
  final String? hint;
  final TextEditingController? controller;
  final FormFieldValidator<String>? validator;
  final ValueChanged<String>? onChanged;

  const SmPasswordInput({
    super.key,
    this.label,
    this.hint = 'Tu contraseña',
    this.controller,
    this.validator,
    this.onChanged,
  });

  @override
  State<SmPasswordInput> createState() => _SmPasswordInputState();
}

class _SmPasswordInputState extends State<SmPasswordInput> {
  bool _visible = false;

  @override
  Widget build(BuildContext context) {
    return SmInput(
      label: widget.label ?? 'Contraseña',
      hint: widget.hint,
      controller: widget.controller,
      obscureText: !_visible,
      keyboardType: TextInputType.visiblePassword,
      prefixIcon: Icons.lock_outline,
      suffix: IconButton(
        icon: Icon(
          _visible ? Icons.visibility_off_outlined : Icons.visibility_outlined,
          size: 18,
          color: SmColors.mutedForeground,
        ),
        onPressed: () => setState(() => _visible = !_visible),
      ),
      validator: widget.validator,
      onChanged: widget.onChanged,
    );
  }
}

// ─────────────────────────────────────────
// 3. SmCheckbox
//    → reemplaza <Checkbox> shadcn
// ─────────────────────────────────────────
class SmCheckbox extends StatelessWidget {
  final bool value;
  final String label;
  final ValueChanged<bool?> onChanged;
  final String? description;

  const SmCheckbox({
    super.key,
    required this.value,
    required this.label,
    required this.onChanged,
    this.description,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () {
        onChanged(!value);
      },
      borderRadius: BorderRadius.circular(4),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: 20,
              height: 20,
              child: Checkbox(
                value: value,
                onChanged: onChanged,
                materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                visualDensity: VisualDensity.compact,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label, style: Theme.of(context).textTheme.bodyMedium),
                  if (description != null) ...[
                    const SizedBox(height: 2),
                    Text(description!,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: SmColors.mutedForeground,
                            )),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────
// 4. SmSwitch
//    → reemplaza <Switch> shadcn
// ─────────────────────────────────────────
class SmSwitch extends StatelessWidget {
  final bool value;
  final String label;
  final ValueChanged<bool> onChanged;
  final String? description;

  const SmSwitch({
    super.key,
    required this.value,
    required this.label,
    required this.onChanged,
    this.description,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: Theme.of(context).textTheme.bodyMedium),
              if (description != null)
                Text(description!,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: SmColors.mutedForeground,
                        )),
            ],
          ),
        ),
        Switch(
          value: value,
          onChanged: onChanged,
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────
// 5. SmSlider
//    → reemplaza <Slider> shadcn
// ─────────────────────────────────────────
class SmSlider extends StatelessWidget {
  final double value;
  final double min;
  final double max;
  final int? divisions;
  final String? label;
  final String? fieldLabel;
  final ValueChanged<double> onChanged;

  const SmSlider({
    super.key,
    required this.value,
    required this.onChanged,
    this.min = 0,
    this.max = 100,
    this.divisions,
    this.label,
    this.fieldLabel,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (fieldLabel != null)
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(fieldLabel!, style: Theme.of(context).textTheme.labelLarge),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: SmColors.primary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  label ?? value.toStringAsFixed(0),
                  style: TextStyle(
                      color: SmColors.primary,
                      fontSize: 12,
                      fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
        Slider(
          value: value,
          min: min,
          max: max,
          divisions: divisions,
          label: label ?? value.toStringAsFixed(0),
          onChanged: onChanged,
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────
// 6. SmSelect (DropdownMenu M3)
//    → reemplaza <Select> shadcn
// ─────────────────────────────────────────
class SmSelectOption<T> {
  final T value;
  final String label;
  final IconData? icon;

  const SmSelectOption({
    required this.value,
    required this.label,
    this.icon,
  });
}

class SmSelect<T> extends StatelessWidget {
  final String? label;
  final T? value;
  final List<SmSelectOption<T>> options;
  final ValueChanged<T?> onChanged;
  final String? hint;
  final FormFieldValidator<T>? validator;

  const SmSelect({
    super.key,
    this.label,
    this.value,
    required this.options,
    required this.onChanged,
    this.hint,
    this.validator,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (label != null) ...[
          Text(label!,
              style: Theme.of(context)
                  .textTheme
                  .labelLarge
                  ?.copyWith(fontWeight: FontWeight.w500)),
          const SizedBox(height: 6),
        ],
        DropdownButtonFormField<T>(
          initialValue: value,
          hint: hint != null
              ? Text(hint!, style: TextStyle(color: SmColors.mutedForeground))
              : null,
          decoration: const InputDecoration(),
          validator: validator != null ? (v) => validator!(v) : null,
          items: options
              .map((opt) => DropdownMenuItem<T>(
                    value: opt.value,
                    child: Row(
                      children: [
                        if (opt.icon != null) ...[
                          Icon(opt.icon,
                              size: 16, color: SmColors.mutedForeground),
                          const SizedBox(width: 8),
                        ],
                        Text(opt.label),
                      ],
                    ),
                  ))
              .toList(),
          onChanged: onChanged,
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────
// 7. SmRadioGroup
//    → reemplaza <RadioGroup> shadcn
// ─────────────────────────────────────────
class SmRadioGroup<T> extends StatelessWidget {
  final String? label;
  final T? groupValue;
  final List<SmSelectOption<T>> options;
  final ValueChanged<T?> onChanged;
  final Axis direction;

  const SmRadioGroup({
    super.key,
    this.label,
    required this.groupValue,
    required this.options,
    required this.onChanged,
    this.direction = Axis.vertical,
  });

  @override
  Widget build(BuildContext context) {
    final items = options
        .map((opt) => RadioListTile<T>(
              title: Text(opt.label,
                  style: Theme.of(context).textTheme.bodyMedium),
              value: opt.value,
              groupValue: groupValue,
              onChanged: onChanged,
              dense: true,
              contentPadding: EdgeInsets.zero,
              activeColor: SmColors.primary,
              visualDensity: VisualDensity.compact,
            ))
        .toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (label != null) ...[
          Text(label!,
              style: Theme.of(context)
                  .textTheme
                  .labelLarge
                  ?.copyWith(fontWeight: FontWeight.w500)),
          const SizedBox(height: 4),
        ],
        if (direction == Axis.horizontal)
          Row(children: items.map((w) => Expanded(child: w)).toList())
        else
          Column(children: items),
      ],
    );
  }
}

// ─────────────────────────────────────────
// 8. SmToggleGroup (SegmentedButton M3)
//    → reemplaza <ToggleGroup> shadcn
// ─────────────────────────────────────────
class SmToggleGroup<T> extends StatelessWidget {
  final Set<T> selected;
  final List<SmSelectOption<T>> options;
  final ValueChanged<Set<T>> onChanged;
  final bool multiSelect;

  const SmToggleGroup({
    super.key,
    required this.selected,
    required this.options,
    required this.onChanged,
    this.multiSelect = false,
  });

  @override
  Widget build(BuildContext context) {
    return SegmentedButton<T>(
      segments: options
          .map((opt) => ButtonSegment<T>(
                value: opt.value,
                label: Text(opt.label),
                icon: opt.icon != null ? Icon(opt.icon, size: 16) : null,
              ))
          .toList(),
      selected: selected,
      onSelectionChanged: onChanged,
      multiSelectionEnabled: multiSelect,
      style: SegmentedButton.styleFrom(
        selectedBackgroundColor: SmColors.primary.withValues(alpha: 0.1),
        selectedForegroundColor: SmColors.primary,
      ),
    );
  }
}

// ════════════════════════════════════════════════════════════
// SECCIÓN 2 — LAYOUT & CONTENIDO
// ════════════════════════════════════════════════════════════

// ─────────────────────────────────────────
// 9. SmCard
//    → reemplaza <Card> shadcn
// ─────────────────────────────────────────
class SmCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final VoidCallback? onTap;
  final Color? backgroundColor;
  final Border? border;
  final double elevation;
  final BorderRadius? borderRadius;

  const SmCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.onTap,
    this.backgroundColor,
    this.border,
    this.elevation = 0,
    this.borderRadius,
  });

  @override
  Widget build(BuildContext context) {
    final br = borderRadius ?? BorderRadius.circular(12);
    return Material(
      color: backgroundColor ?? Theme.of(context).colorScheme.surface,
      borderRadius: br,
      elevation: elevation,
      child: InkWell(
        onTap: onTap,
        borderRadius: br,
        child: Container(
          padding: padding,
          decoration: BoxDecoration(
            borderRadius: br,
            border: border ??
                Border.all(
                    color: Theme.of(context).colorScheme.outlineVariant,
                    width: 1),
          ),
          child: child,
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────
// 10. SmStatCard — Dashboard KPI card
//     → reemplaza StatCard.tsx
// ─────────────────────────────────────────
class SmStatCard extends StatelessWidget {
  final String title;
  final String value;
  final String? trend;
  final bool trendUp;
  final IconData icon;
  final Color? iconColor;
  final String? subtitle;
  final VoidCallback? onTap;

  const SmStatCard({
    super.key,
    required this.title,
    required this.value,
    required this.icon,
    this.trend,
    this.trendUp = true,
    this.iconColor,
    this.subtitle,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final color = iconColor ?? SmColors.primary;
    return SmCard(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Flexible(
                child: Text(title,
                    style: Theme.of(context).textTheme.labelLarge?.copyWith(
                          color: SmColors.mutedForeground,
                          fontWeight: FontWeight.w500,
                        )),
              ),
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, color: color, size: 18),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(value,
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.bold,
                  )),
          if (trend != null || subtitle != null) ...[
            const SizedBox(height: 4),
            if (trend != null)
              Row(
                children: [
                  Icon(
                    trendUp ? Icons.trending_up : Icons.trending_down,
                    size: 14,
                    color: trendUp ? SmColors.primary : SmColors.destructive,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    trend!,
                    style: TextStyle(
                      fontSize: 12,
                      color: trendUp ? SmColors.primary : SmColors.destructive,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              )
            else
              Text(subtitle!,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: SmColors.mutedForeground,
                      )),
          ],
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────
// 11. SmAvatar
//     → reemplaza <Avatar> shadcn
// ─────────────────────────────────────────
class SmAvatar extends StatelessWidget {
  final String? imageUrl;
  final String? name;
  final double size;
  final Color? backgroundColor;
  final VoidCallback? onTap;
  final bool showBadge;
  final Color? badgeColor;

  const SmAvatar({
    super.key,
    this.imageUrl,
    this.name,
    this.size = 40,
    this.backgroundColor,
    this.onTap,
    this.showBadge = false,
    this.badgeColor,
  });

  String get _initials {
    if (name == null || name!.isEmpty) {
      return '?';
    }
    final parts = name!.trim().split(' ');
    if (parts.length >= 2) {
      return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
    }
    return parts.first[0].toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final bg = backgroundColor ?? SmColors.primary;

    Widget avatar = CircleAvatar(
      radius: size / 2,
      backgroundColor: bg,
      backgroundImage: imageUrl != null ? NetworkImage(imageUrl!) : null,
      child: imageUrl == null
          ? Text(
              _initials,
              style: TextStyle(
                color: Colors.white,
                fontSize: size * 0.35,
                fontWeight: FontWeight.bold,
              ),
            )
          : null,
    );

    if (showBadge) {
      avatar = Stack(
        clipBehavior: Clip.none,
        children: [
          avatar,
          Positioned(
            right: 0,
            bottom: 0,
            child: Container(
              width: size * 0.28,
              height: size * 0.28,
              decoration: BoxDecoration(
                color: badgeColor ?? SmColors.primary,
                shape: BoxShape.circle,
                border: Border.all(color: Colors.white, width: 2),
              ),
            ),
          ),
        ],
      );
    }

    if (onTap != null) {
      return GestureDetector(onTap: onTap, child: avatar);
    }
    return avatar;
  }
}

// ─────────────────────────────────────────
// 12. SmBadge
//     → reemplaza <Badge> shadcn
// ─────────────────────────────────────────
enum SmBadgeVariant { primary, secondary, destructive, outline, warning }

class SmBadge extends StatelessWidget {
  final String label;
  final SmBadgeVariant variant;
  final IconData? icon;

  const SmBadge({
    super.key,
    required this.label,
    this.variant = SmBadgeVariant.primary,
    this.icon,
  });

  @override
  Widget build(BuildContext context) {
    final style = _getStyle(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: style.background,
        borderRadius: BorderRadius.circular(100),
        border: style.border,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 10, color: style.foreground),
            const SizedBox(width: 4),
          ],
          Text(
            label,
            style: TextStyle(
              color: style.foreground,
              fontSize: 11,
              fontWeight: FontWeight.w600,
              height: 1,
            ),
          ),
        ],
      ),
    );
  }

  _BadgeStyle _getStyle(BuildContext context) {
    return switch (variant) {
      SmBadgeVariant.primary => _BadgeStyle(
          background: SmColors.primary,
          foreground: Colors.white,
        ),
      SmBadgeVariant.secondary => _BadgeStyle(
          background: SmColors.secondary,
          foreground: SmColors.primary,
        ),
      SmBadgeVariant.destructive => _BadgeStyle(
          background: SmColors.destructive,
          foreground: Colors.white,
        ),
      SmBadgeVariant.warning => _BadgeStyle(
          background: SmColors.accent.withValues(alpha: 0.15),
          foreground: SmColors.accentDark,
        ),
      SmBadgeVariant.outline => _BadgeStyle(
          background: Colors.transparent,
          foreground: SmColors.mutedForeground,
          border: Border.all(color: SmColors.border),
        ),
    };
  }
}

class _BadgeStyle {
  final Color background;
  final Color foreground;
  final BoxBorder? border;

  _BadgeStyle({
    required this.background,
    required this.foreground,
    this.border,
  });
}

// ─────────────────────────────────────────
// 13. SmDialog
//     → reemplaza <AlertDialog> shadcn
// ─────────────────────────────────────────
class SmDialog {
  static Future<bool?> confirm(
    BuildContext context, {
    required String title,
    required String description,
    String confirmLabel = 'Confirmar',
    String cancelLabel = 'Cancelar',
    bool destructive = false,
  }) {
    return showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: Text(title),
        content: Text(description,
            style: TextStyle(color: SmColors.mutedForeground)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(cancelLabel),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(
              backgroundColor:
                  destructive ? SmColors.destructive : SmColors.primary,
              foregroundColor: Colors.white,
            ),
            child: Text(confirmLabel),
          ),
        ],
      ),
    );
  }

  static Future<void> show(
    BuildContext context, {
    required String title,
    required Widget content,
    List<Widget>? actions,
    bool scrollable = false,
  }) {
    return showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: Text(title),
        content: content,
        scrollable: scrollable,
        actions: actions,
      ),
    );
  }
}

// ─────────────────────────────────────────
// 14. SmBottomSheet
//     → reemplaza <Sheet> shadcn (vaul drawer)
// ─────────────────────────────────────────
class SmBottomSheet {
  static Future<T?> show<T>(
    BuildContext context, {
    required Widget Function(BuildContext, ScrollController) builder,
    double initialSize = 0.5,
    double maxSize = 0.95,
    double minSize = 0.25,
    bool isDismissible = true,
  }) {
    return showModalBottomSheet<T>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      isDismissible: isDismissible,
      builder: (ctx) => DraggableScrollableSheet(
        initialChildSize: initialSize,
        maxChildSize: maxSize,
        minChildSize: minSize,
        builder: (_, controller) => Container(
          decoration: BoxDecoration(
            color: Theme.of(ctx).colorScheme.surface,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.1),
                blurRadius: 20,
                offset: const Offset(0, -4),
              ),
            ],
          ),
          child: Column(
            children: [
              // Handle
              Center(
                child: Container(
                  margin: const EdgeInsets.only(top: 12, bottom: 8),
                  width: 36,
                  height: 4,
                  decoration: BoxDecoration(
                    color: SmColors.border,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              Expanded(child: builder(ctx, controller)),
            ],
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────
// 15. SmTabs
//     → reemplaza <Tabs> shadcn
// ─────────────────────────────────────────
class SmTabs extends StatelessWidget {
  final List<String> labels;
  final List<Widget> children;
  final TabController controller;
  final bool scrollable;

  const SmTabs({
    super.key,
    required this.labels,
    required this.children,
    required this.controller,
    this.scrollable = false,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        TabBar(
          controller: controller,
          isScrollable: scrollable,
          tabs: labels.map((l) => Tab(text: l)).toList(),
        ),
        Expanded(
          child: TabBarView(
            controller: controller,
            children: children,
          ),
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────
// 16. SmAccordion
//     → reemplaza <Accordion> shadcn
// ─────────────────────────────────────────
class SmAccordionItem {
  final String title;
  final Widget content;
  final IconData? icon;
  const SmAccordionItem({
    required this.title,
    required this.content,
    this.icon,
  });
}

class SmAccordion extends StatelessWidget {
  final List<SmAccordionItem> items;
  final bool allowMultiple;

  const SmAccordion({
    super.key,
    required this.items,
    this.allowMultiple = false,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: items.map((item) => _SmAccordionTile(item: item)).toList(),
    );
  }
}

class _SmAccordionTile extends StatelessWidget {
  final SmAccordionItem item;
  const _SmAccordionTile({required this.item});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(color: SmColors.border, width: 1),
        ),
      ),
      child: ExpansionTile(
        leading: item.icon != null
            ? Icon(item.icon, color: SmColors.mutedForeground, size: 18)
            : null,
        title: Text(item.title, style: Theme.of(context).textTheme.titleSmall),
        iconColor: SmColors.primary,
        collapsedIconColor: SmColors.mutedForeground,
        childrenPadding: const EdgeInsets.only(left: 16, right: 16, bottom: 16),
        expandedAlignment: Alignment.topLeft,
        children: [item.content],
      ),
    );
  }
}

// ─────────────────────────────────────────
// 17. SmProgress
//     → reemplaza <Progress> shadcn
// ─────────────────────────────────────────
class SmProgress extends StatelessWidget {
  final double value; // 0.0 to 1.0
  final double height;
  final Color? color;
  final String? label;
  final bool showPercent;

  const SmProgress({
    super.key,
    required this.value,
    this.height = 8,
    this.color,
    this.label,
    this.showPercent = false,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (label != null || showPercent)
          Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                if (label != null)
                  Text(label!, style: Theme.of(context).textTheme.labelLarge),
                if (showPercent)
                  Text(
                    '${(value * 100).toInt()}%',
                    style: TextStyle(
                      color: color ?? SmColors.primary,
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
              ],
            ),
          ),
        ClipRRect(
          borderRadius: BorderRadius.circular(height / 2),
          child: LinearProgressIndicator(
            value: value.clamp(0.0, 1.0),
            minHeight: height,
            backgroundColor: SmColors.border,
            valueColor:
                AlwaysStoppedAnimation<Color>(color ?? SmColors.primary),
          ),
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────
// 18. SmTooltip wrapper
//     → reemplaza <Tooltip> shadcn
// ─────────────────────────────────────────
class SmTooltipWrapper extends StatelessWidget {
  final String message;
  final Widget child;

  const SmTooltipWrapper({
    super.key,
    required this.message,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: message,
      preferBelow: false,
      child: child,
    );
  }
}

// ─────────────────────────────────────────
// 19. SmSeparator
//     → reemplaza <Separator> shadcn
// ─────────────────────────────────────────
class SmSeparator extends StatelessWidget {
  final String? label;
  final Axis direction;
  final double thickness;

  const SmSeparator({
    super.key,
    this.label,
    this.direction = Axis.horizontal,
    this.thickness = 1,
  });

  @override
  Widget build(BuildContext context) {
    if (label != null && direction == Axis.horizontal) {
      return Row(
        children: [
          Expanded(child: Divider(thickness: thickness)),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Text(
              label!,
              style: TextStyle(fontSize: 12, color: SmColors.mutedForeground),
            ),
          ),
          Expanded(child: Divider(thickness: thickness)),
        ],
      );
    }
    return direction == Axis.horizontal
        ? Divider(thickness: thickness, color: SmColors.border)
        : VerticalDivider(thickness: thickness, color: SmColors.border);
  }
}

// ─────────────────────────────────────────
// 20. SmScrollArea
//     → reemplaza <ScrollArea> shadcn
// ─────────────────────────────────────────
class SmScrollArea extends StatelessWidget {
  final Widget child;
  final double? maxHeight;
  final Axis scrollDirection;
  final bool showScrollbar;

  const SmScrollArea({
    super.key,
    required this.child,
    this.maxHeight,
    this.scrollDirection = Axis.vertical,
    this.showScrollbar = true,
  });

  @override
  Widget build(BuildContext context) {
    Widget scrollable = SingleChildScrollView(
      scrollDirection: scrollDirection,
      child: child,
    );

    if (showScrollbar) {
      scrollable = Scrollbar(
        thumbVisibility: true,
        child: scrollable,
      );
    }

    if (maxHeight != null) {
      return ConstrainedBox(
        constraints: BoxConstraints(maxHeight: maxHeight!),
        child: scrollable,
      );
    }
    return scrollable;
  }
}

// ─────────────────────────────────────────
// 21. SmTable
//     → reemplaza <Table> shadcn (DataTable M3)
// ─────────────────────────────────────────
class SmTableColumn<T> {
  final String label;
  final Widget Function(T row) cellBuilder;
  final double? width;
  final bool numeric;

  const SmTableColumn({
    required this.label,
    required this.cellBuilder,
    this.width,
    this.numeric = false,
  });
}

class SmTable<T> extends StatelessWidget {
  final List<SmTableColumn<T>> columns;
  final List<T> rows;
  final void Function(T row)? onRowTap;
  final bool showCheckboxColumn;
  final Set<T>? selectedRows;
  final ValueChanged<bool?>? onSelectAll;

  const SmTable({
    super.key,
    required this.columns,
    required this.rows,
    this.onRowTap,
    this.showCheckboxColumn = false,
    this.selectedRows,
    this.onSelectAll,
  });

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: DataTable(
        showCheckboxColumn: showCheckboxColumn,
        headingRowColor: WidgetStatePropertyAll(SmColors.muted),
        dataRowColor: WidgetStateProperty.resolveWith((states) =>
            states.contains(WidgetState.selected)
                ? SmColors.primary.withValues(alpha: 0.05)
                : null),
        dividerThickness: 1,
        columns: columns
            .map((col) => DataColumn(
                  label: Text(col.label,
                      style: const TextStyle(fontWeight: FontWeight.w600)),
                  numeric: col.numeric,
                ))
            .toList(),
        rows: rows
            .map((row) => DataRow(
                  selected: selectedRows?.contains(row) ?? false,
                  onSelectChanged:
                      showCheckboxColumn ? (_) => onRowTap?.call(row) : null,
                  onLongPress: onRowTap != null ? () => onRowTap!(row) : null,
                  cells: columns
                      .map((col) => DataCell(
                            col.cellBuilder(row),
                            onTap:
                                onRowTap != null ? () => onRowTap!(row) : null,
                          ))
                      .toList(),
                ))
            .toList(),
      ),
    );
  }
}

// ─────────────────────────────────────────
// 22. SmLabel
//     → reemplaza <Label> shadcn
// ─────────────────────────────────────────
class SmLabel extends StatelessWidget {
  final String text;
  final bool required;
  final String? tooltip;

  const SmLabel({
    super.key,
    required this.text,
    this.required = false,
    this.tooltip,
  });

  @override
  Widget build(BuildContext context) {
    Widget label = Text.rich(
      TextSpan(
        text: text,
        style: Theme.of(context)
            .textTheme
            .labelLarge
            ?.copyWith(fontWeight: FontWeight.w500),
        children: required
            ? [
                TextSpan(
                  text: ' *',
                  style: TextStyle(color: SmColors.destructive),
                ),
              ]
            : null,
      ),
    );

    if (tooltip != null) {
      return SmTooltipWrapper(message: tooltip!, child: label);
    }
    return label;
  }
}

// ─────────────────────────────────────────
// 23. SmFeatureCard
//     → reemplaza FeatureCard.tsx (landing)
// ─────────────────────────────────────────
class SmFeatureCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String description;
  final Color? iconColor;
  final VoidCallback? onTap;

  const SmFeatureCard({
    super.key,
    required this.icon,
    required this.title,
    required this.description,
    this.iconColor,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final color = iconColor ?? SmColors.primary;
    return SmCard(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: color, size: 22),
          ),
          const SizedBox(height: 12),
          Text(title, style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 6),
          Text(
            description,
            style: Theme.of(context)
                .textTheme
                .bodySmall
                ?.copyWith(color: SmColors.mutedForeground, height: 1.5),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────
// 24. SmActivityTile
//     → reemplaza ActivityList items
// ─────────────────────────────────────────
class SmActivityTile extends StatelessWidget {
  final String title;
  final String subtitle;
  final String timeAgo;
  final IconData icon;
  final Color? iconColor;
  final VoidCallback? onTap;

  const SmActivityTile({
    super.key,
    required this.title,
    required this.subtitle,
    required this.timeAgo,
    required this.icon,
    this.iconColor,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final color = iconColor ?? SmColors.primary;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: color, size: 18),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      style: Theme.of(context)
                          .textTheme
                          .bodyMedium
                          ?.copyWith(fontWeight: FontWeight.w600)),
                  Text(subtitle,
                      style: Theme.of(context)
                          .textTheme
                          .bodySmall
                          ?.copyWith(color: SmColors.mutedForeground)),
                ],
              ),
            ),
            Text(timeAgo,
                style: Theme.of(context)
                    .textTheme
                    .labelSmall
                    ?.copyWith(color: SmColors.mutedForeground)),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────
// 25. SmQuickActionButton
//     → reemplaza QuickActions chips
// ─────────────────────────────────────────
class SmQuickAction extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color? color;
  final VoidCallback onTap;

  const SmQuickAction({
    super.key,
    required this.icon,
    required this.label,
    required this.onTap,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    final c = color ?? SmColors.primary;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: c.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: c.withValues(alpha: 0.2)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: c, size: 16),
            const SizedBox(width: 6),
            Text(label,
                style: TextStyle(
                    color: c, fontSize: 13, fontWeight: FontWeight.w600)),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────
// 26. SmEmptyState
//     → reemplaza EmptyDashboardState.tsx
// ─────────────────────────────────────────
class SmEmptyState extends StatelessWidget {
  final IconData icon;
  final String title;
  final String description;
  final String? actionLabel;
  final VoidCallback? onAction;

  const SmEmptyState({
    super.key,
    required this.icon,
    required this.title,
    required this.description,
    this.actionLabel,
    this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                color: SmColors.muted,
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: 32, color: SmColors.mutedForeground),
            ),
            const SizedBox(height: 20),
            Text(
              title,
              style: Theme.of(context).textTheme.titleLarge,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              description,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: SmColors.mutedForeground,
                    height: 1.6,
                  ),
              textAlign: TextAlign.center,
            ),
            if (actionLabel != null && onAction != null) ...[
              const SizedBox(height: 24),
              ElevatedButton.icon(
                onPressed: onAction,
                icon: const Icon(Icons.add, size: 16),
                label: Text(actionLabel!),
                style: ElevatedButton.styleFrom(
                  backgroundColor: SmColors.primary,
                  foregroundColor: Colors.white,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────
// 27. SmPagination
//     → reemplaza <Pagination> shadcn
// ─────────────────────────────────────────
class SmPagination extends StatelessWidget {
  final int currentPage;
  final int totalPages;
  final ValueChanged<int> onPageChanged;
  final int visiblePages;

  const SmPagination({
    super.key,
    required this.currentPage,
    required this.totalPages,
    required this.onPageChanged,
    this.visiblePages = 5,
  });

  List<int?> get _pages {
    if (totalPages <= visiblePages) {
      return List.generate(totalPages, (i) => i + 1);
    }
    final pages = <int?>[];
    final half = visiblePages ~/ 2;
    int start =
        (currentPage - half).clamp(1, (totalPages - visiblePages + 1).toInt());
    int end = (start + visiblePages - 1).clamp(1, totalPages);

    if (start > 1) {
      pages.add(1);
      if (start > 2) {
        pages.add(null);
      } // ellipsis
    }
    for (int i = start; i <= end; i++) {
      pages.add(i);
    }
    if (end < totalPages) {
      if (end < totalPages - 1) {
        pages.add(null);
      } // ellipsis
      pages.add(totalPages);
    }
    return pages;
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        _PageBtn(
          icon: Icons.chevron_left,
          enabled: currentPage > 1,
          onTap: () => onPageChanged(currentPage - 1),
        ),
        ..._pages.map((page) {
          if (page == null) {
            return const Padding(
              padding: EdgeInsets.symmetric(horizontal: 4),
              child: Text('...', style: TextStyle(color: Color(0xFF627D62))),
            );
          }
          final isActive = page == currentPage;
          return _PageNumberBtn(
            page: page,
            isActive: isActive,
            onTap: () => onPageChanged(page),
          );
        }),
        _PageBtn(
          icon: Icons.chevron_right,
          enabled: currentPage < totalPages,
          onTap: () => onPageChanged(currentPage + 1),
        ),
      ],
    );
  }
}

class _PageBtn extends StatelessWidget {
  final IconData icon;
  final bool enabled;
  final VoidCallback onTap;
  const _PageBtn(
      {required this.icon, required this.enabled, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return IconButton(
      icon: Icon(icon, size: 18),
      onPressed: enabled ? onTap : null,
      color: enabled ? SmColors.primary : SmColors.border,
      style: IconButton.styleFrom(
        minimumSize: const Size(36, 36),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
      ),
    );
  }
}

class _PageNumberBtn extends StatelessWidget {
  final int page;
  final bool isActive;
  final VoidCallback onTap;
  const _PageNumberBtn(
      {required this.page, required this.isActive, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 2),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(6),
        child: Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: isActive ? SmColors.primary : Colors.transparent,
            borderRadius: BorderRadius.circular(6),
            border: isActive ? null : Border.all(color: SmColors.border),
          ),
          alignment: Alignment.center,
          child: Text(
            '$page',
            style: TextStyle(
              color: isActive ? Colors.white : SmColors.foreground,
              fontWeight: isActive ? FontWeight.bold : FontWeight.normal,
              fontSize: 13,
            ),
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────
// 28. SmThemeToggle
//     → reemplaza ThemeToggle.tsx
// ─────────────────────────────────────────
class SmThemeToggle extends StatelessWidget {
  final ThemeMode currentMode;
  final ValueChanged<ThemeMode> onChanged;

  const SmThemeToggle({
    super.key,
    required this.currentMode,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return IconButton(
      icon: AnimatedSwitcher(
        duration: const Duration(milliseconds: 300),
        transitionBuilder: (child, anim) =>
            RotationTransition(turns: anim, child: child),
        child: Icon(
          currentMode == ThemeMode.dark
              ? Icons.light_mode_outlined
              : Icons.dark_mode_outlined,
          key: ValueKey(currentMode),
          color: Theme.of(context).colorScheme.onSurface,
        ),
      ),
      onPressed: () => onChanged(
        currentMode == ThemeMode.dark ? ThemeMode.light : ThemeMode.dark,
      ),
      tooltip: currentMode == ThemeMode.dark ? 'Modo claro' : 'Modo oscuro',
    );
  }
}
