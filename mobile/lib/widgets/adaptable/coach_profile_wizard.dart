// ============================================================
// SportMaps — CoachProfileWizard (multi-step form)
// Reemplaza: CoachProfileWizard.tsx (Stepper + PageView multi-step)
// ============================================================

import 'package:flutter/material.dart';

import '../../theme/sportmaps_theme.dart';

// ─────────────────────────────────────────
// MODELO del wizard
// ─────────────────────────────────────────

/// Datos del perfil del entrenador recopilados en 4 pasos.
class CoachProfileData {
  // Paso 1: Info personal
  String firstName;
  String lastName;
  String phone;
  DateTime? birthDate;
  String bio;

  // Paso 2: Especialización
  String sport;
  String category;
  int yearsExperience;
  List<String> certifications;

  // Paso 3: Ubicación
  String country;
  String city;
  String address;

  // Paso 4: Redes
  String? instagramUrl;
  String? linkedinUrl;
  String? websiteUrl;

  CoachProfileData({
    this.firstName = '',
    this.lastName = '',
    this.phone = '',
    this.birthDate,
    this.bio = '',
    this.sport = '',
    this.category = '',
    this.yearsExperience = 0,
    this.certifications = const [],
    this.country = '',
    this.city = '',
    this.address = '',
    this.instagramUrl,
    this.linkedinUrl,
    this.websiteUrl,
  });
}

// ─────────────────────────────────────────
// WIZARD PRINCIPAL
// ─────────────────────────────────────────

/// Formulario multi-pasos para completar el perfil de entrenador.
/// 4 pasos: Info personal → Especialización → Ubicación → Redes.
///
/// ```dart
/// CoachProfileWizard(
///   onComplete: (data) async {
///     await supabase.from('profiles').upsert({
///       'first_name': data.firstName,
///       'sport': data.sport,
///       // ...
///     });
///     context.go('/dashboard');
///   },
/// )
/// ```
class CoachProfileWizard extends StatefulWidget {
  final CoachProfileData? initialData;
  final Future<void> Function(CoachProfileData data) onComplete;

  const CoachProfileWizard({
    super.key,
    this.initialData,
    required this.onComplete,
  });

  @override
  State<CoachProfileWizard> createState() => _CoachProfileWizardState();
}

class _CoachProfileWizardState extends State<CoachProfileWizard> {
  final _pageController = PageController();
  int _currentStep = 0;
  bool _isSubmitting = false;

  late CoachProfileData _data;

  final _keys = List.generate(4, (_) => GlobalKey<FormState>());

  static const _stepTitles = [
    'Información personal',
    'Especialización deportiva',
    'Ubicación',
    'Redes y contacto',
  ];

  static const _stepIcons = [
    Icons.person_outline,
    Icons.sports_outlined,
    Icons.location_on_outlined,
    Icons.link_outlined,
  ];

  @override
  void initState() {
    super.initState();
    _data = widget.initialData ?? CoachProfileData();
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  void _nextStep() {
    if (!_keys[_currentStep].currentState!.validate()) {
      return;
    }
    _keys[_currentStep].currentState!.save();

    if (_currentStep < 3) {
      setState(() => _currentStep++);
      _pageController.nextPage(
        duration: const Duration(milliseconds: 350),
        curve: Curves.easeInOut,
      );
    } else {
      _submit();
    }
  }

  void _prevStep() {
    if (_currentStep > 0) {
      setState(() => _currentStep--);
      _pageController.previousPage(
        duration: const Duration(milliseconds: 350),
        curve: Curves.easeInOut,
      );
    }
  }

  Future<void> _submit() async {
    setState(() => _isSubmitting = true);
    try {
      await widget.onComplete(_data);
    } finally {
      if (mounted) {
        setState(() => _isSubmitting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Completar perfil'),
        leading: _currentStep > 0
            ? IconButton(
                icon: const Icon(Icons.arrow_back),
                onPressed: _prevStep,
              )
            : null,
      ),
      body: Column(
        children: [
          // ── Indicador de pasos ──
          _WizardStepIndicator(
            currentStep: _currentStep,
            totalSteps: 4,
            stepTitles: _stepTitles,
            stepIcons: _stepIcons,
          ),

          // ── Páginas del form ──
          Expanded(
            child: PageView(
              controller: _pageController,
              physics: const NeverScrollableScrollPhysics(),
              children: [
                _Step1PersonalInfo(formKey: _keys[0], data: _data),
                _Step2Specialization(formKey: _keys[1], data: _data),
                _Step3Location(formKey: _keys[2], data: _data),
                _Step4Social(formKey: _keys[3], data: _data),
              ],
            ),
          ),

          // ── Footer con botones ──
          _WizardFooter(
            currentStep: _currentStep,
            totalSteps: 4,
            isSubmitting: _isSubmitting,
            onNext: _nextStep,
            onPrev: _prevStep,
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────
// INDICADOR DE PASOS
// ─────────────────────────────────────────
class _WizardStepIndicator extends StatelessWidget {
  final int currentStep;
  final int totalSteps;
  final List<String> stepTitles;
  final List<IconData> stepIcons;

  const _WizardStepIndicator({
    required this.currentStep,
    required this.totalSteps,
    required this.stepTitles,
    required this.stepIcons,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Barra de progreso
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: (currentStep + 1) / totalSteps,
              minHeight: 4,
              backgroundColor: SmColors.border,
              valueColor: const AlwaysStoppedAnimation<Color>(SmColors.primary),
            ),
          ),
          const SizedBox(height: 16),
          // Paso actual
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: SmColors.primary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(
                  stepIcons[currentStep],
                  color: SmColors.primary,
                  size: 18,
                ),
              ),
              const SizedBox(width: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Paso ${currentStep + 1} de $totalSteps',
                    style: const TextStyle(
                        fontSize: 11,
                        color: SmColors.mutedForeground,
                        fontWeight: FontWeight.w500),
                  ),
                  Text(
                    stepTitles[currentStep],
                    style: const TextStyle(
                        fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 8),
          // Segmentos de pasos
          Row(
            children: List.generate(totalSteps, (i) {
              final isActive = i == currentStep;
              final isComplete = i < currentStep;
              return Expanded(
                child: Container(
                  margin: EdgeInsets.only(right: i < totalSteps - 1 ? 4 : 0),
                  height: 3,
                  decoration: BoxDecoration(
                    color: isComplete || isActive
                        ? SmColors.primary
                        : SmColors.border,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              );
            }),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────
// PASO 1: Información personal
// ─────────────────────────────────────────
class _Step1PersonalInfo extends StatelessWidget {
  final GlobalKey<FormState> formKey;
  final CoachProfileData data;

  const _Step1PersonalInfo({required this.formKey, required this.data});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Form(
        key: formKey,
        child: Column(
          children: [
            _SmFormField(
              label: 'Nombre',
              initialValue: data.firstName,
              hint: 'Carlos',
              validator: (v) =>
                  v == null || v.isEmpty ? 'Campo requerido' : null,
              onSaved: (v) => data.firstName = v ?? '',
            ),
            _SmFormField(
              label: 'Apellido',
              initialValue: data.lastName,
              hint: 'García',
              validator: (v) =>
                  v == null || v.isEmpty ? 'Campo requerido' : null,
              onSaved: (v) => data.lastName = v ?? '',
            ),
            _SmFormField(
              label: 'Teléfono',
              initialValue: data.phone,
              hint: '+57 300 000 0000',
              keyboardType: TextInputType.phone,
              validator: (v) =>
                  v == null || v.isEmpty ? 'Campo requerido' : null,
              onSaved: (v) => data.phone = v ?? '',
            ),
            _SmFormField(
              label: 'Biografía',
              initialValue: data.bio,
              hint: 'Cuéntanos sobre tu experiencia...',
              maxLines: 4,
              onSaved: (v) => data.bio = v ?? '',
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────
// PASO 2: Especialización
// ─────────────────────────────────────────
class _Step2Specialization extends StatefulWidget {
  final GlobalKey<FormState> formKey;
  final CoachProfileData data;

  const _Step2Specialization({required this.formKey, required this.data});

  @override
  State<_Step2Specialization> createState() => _Step2State();
}

class _Step2State extends State<_Step2Specialization> {
  static const _sports = [
    'Fútbol',
    'Baloncesto',
    'Natación',
    'Atletismo',
    'Tenis',
    'Voleibol',
    'Ciclismo',
    'Artes marciales',
  ];
  static const _categories = [
    'Sub-10',
    'Sub-12',
    'Sub-14',
    'Sub-16',
    'Sub-18',
    'Adultos',
  ];
  static const _certs = [
    'UEFA C',
    'UEFA B',
    'UEFA A',
    'UEFA Pro',
    'FIFA Diploma',
    'Nacional Nivel 1',
    'Nacional Nivel 2',
  ];

  String? _selectedSport;
  String? _selectedCategory;
  final Set<String> _selectedCerts = {};

  @override
  void initState() {
    super.initState();
    _selectedSport = widget.data.sport.isNotEmpty ? widget.data.sport : null;
    _selectedCategory =
        widget.data.category.isNotEmpty ? widget.data.category : null;
    _selectedCerts.addAll(widget.data.certifications);
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Form(
        key: widget.formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _SmDropdownField(
              label: 'Deporte principal',
              value: _selectedSport,
              items: _sports,
              validator: (v) => v == null ? 'Selecciona un deporte' : null,
              onChanged: (v) {
                setState(() => _selectedSport = v);
                widget.data.sport = v ?? '';
              },
            ),
            _SmDropdownField(
              label: 'Categoría',
              value: _selectedCategory,
              items: _categories,
              validator: (v) => v == null ? 'Selecciona una categoría' : null,
              onChanged: (v) {
                setState(() => _selectedCategory = v);
                widget.data.category = v ?? '';
              },
            ),
            _SmFormField(
              label: 'Años de experiencia',
              initialValue: widget.data.yearsExperience > 0
                  ? '${widget.data.yearsExperience}'
                  : '',
              hint: '5',
              keyboardType: TextInputType.number,
              onSaved: (v) =>
                  widget.data.yearsExperience = int.tryParse(v ?? '') ?? 0,
            ),
            const SizedBox(height: 8),
            const Text('Certificaciones',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _certs.map((cert) {
                final selected = _selectedCerts.contains(cert);
                return FilterChip(
                  label: Text(cert),
                  selected: selected,
                  onSelected: (val) {
                    setState(() {
                      val
                          ? _selectedCerts.add(cert)
                          : _selectedCerts.remove(cert);
                      widget.data.certifications = _selectedCerts.toList();
                    });
                  },
                  selectedColor: SmColors.primary.withValues(alpha: 0.1),
                  checkmarkColor: SmColors.primary,
                  labelStyle: TextStyle(
                    color:
                        selected ? SmColors.primary : SmColors.mutedForeground,
                    fontSize: 12,
                  ),
                  side: BorderSide(
                    color: selected ? SmColors.primary : SmColors.border,
                  ),
                );
              }).toList(),
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────
// PASO 3: Ubicación
// ─────────────────────────────────────────
class _Step3Location extends StatelessWidget {
  final GlobalKey<FormState> formKey;
  final CoachProfileData data;

  const _Step3Location({required this.formKey, required this.data});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Form(
        key: formKey,
        child: Column(
          children: [
            _SmFormField(
              label: 'País',
              initialValue: data.country,
              hint: 'Colombia',
              validator: (v) =>
                  v == null || v.isEmpty ? 'Campo requerido' : null,
              onSaved: (v) => data.country = v ?? '',
            ),
            _SmFormField(
              label: 'Ciudad',
              initialValue: data.city,
              hint: 'Bogotá',
              validator: (v) =>
                  v == null || v.isEmpty ? 'Campo requerido' : null,
              onSaved: (v) => data.city = v ?? '',
            ),
            _SmFormField(
              label: 'Dirección',
              initialValue: data.address,
              hint: 'Calle 100 #15-20',
              onSaved: (v) => data.address = v ?? '',
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────
// PASO 4: Redes sociales
// ─────────────────────────────────────────
class _Step4Social extends StatelessWidget {
  final GlobalKey<FormState> formKey;
  final CoachProfileData data;

  const _Step4Social({required this.formKey, required this.data});

  String? _urlValidator(String? v) {
    if (v != null && v.isNotEmpty && !v.startsWith('http')) {
      return 'Ingresa una URL válida';
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Form(
        key: formKey,
        child: Column(
          children: [
            _SmFormField(
              label: 'Instagram',
              initialValue: data.instagramUrl,
              hint: 'https://instagram.com/tu_usuario',
              prefixIcon: Icons.camera_alt_outlined,
              keyboardType: TextInputType.url,
              validator: _urlValidator,
              onSaved: (v) =>
                  data.instagramUrl = v?.isNotEmpty == true ? v : null,
            ),
            _SmFormField(
              label: 'LinkedIn',
              initialValue: data.linkedinUrl,
              hint: 'https://linkedin.com/in/tu_perfil',
              prefixIcon: Icons.work_outline,
              keyboardType: TextInputType.url,
              validator: _urlValidator,
              onSaved: (v) =>
                  data.linkedinUrl = v?.isNotEmpty == true ? v : null,
            ),
            _SmFormField(
              label: 'Sitio web',
              initialValue: data.websiteUrl,
              hint: 'https://mi-academia.com',
              prefixIcon: Icons.language_outlined,
              keyboardType: TextInputType.url,
              validator: _urlValidator,
              onSaved: (v) =>
                  data.websiteUrl = v?.isNotEmpty == true ? v : null,
            ),
            const SizedBox(height: 16),
            // Información pre-guardado
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: SmColors.primary.withValues(alpha: 0.05),
                borderRadius: BorderRadius.circular(12),
                border:
                    Border.all(color: SmColors.primary.withValues(alpha: 0.2)),
              ),
              child: const Row(
                children: [
                  Icon(Icons.check_circle_outline,
                      color: SmColors.primary, size: 20),
                  SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      'Al guardar, tu perfil estará visible para escuelas y atletas.',
                      style: TextStyle(
                          fontSize: 13, color: SmColors.mutedForeground),
                    ),
                  ),
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
// FOOTER del wizard
// ─────────────────────────────────────────
class _WizardFooter extends StatelessWidget {
  final int currentStep;
  final int totalSteps;
  final bool isSubmitting;
  final VoidCallback onNext;
  final VoidCallback onPrev;

  const _WizardFooter({
    required this.currentStep,
    required this.totalSteps,
    required this.isSubmitting,
    required this.onNext,
    required this.onPrev,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 10,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: Row(
        children: [
          if (currentStep > 0)
            Expanded(
              child: OutlinedButton(
                onPressed: isSubmitting ? null : onPrev,
                child: const Text('Atrás'),
              ),
            ),
          if (currentStep > 0) const SizedBox(width: 12),
          Expanded(
            flex: 2,
            child: ElevatedButton(
              onPressed: isSubmitting ? null : onNext,
              style: ElevatedButton.styleFrom(
                backgroundColor: SmColors.primary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
              child: isSubmitting
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                          color: Colors.white, strokeWidth: 2),
                    )
                  : Text(
                      currentStep == totalSteps - 1
                          ? 'Guardar perfil'
                          : 'Continuar',
                      style: const TextStyle(fontWeight: FontWeight.bold),
                    ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────
// HELPERS de formulario reutilizables
// ─────────────────────────────────────────
class _SmFormField extends StatelessWidget {
  final String label;
  final String? initialValue;
  final String hint;
  final int maxLines;
  final TextInputType keyboardType;
  final IconData? prefixIcon;
  final String? Function(String?)? validator;
  final void Function(String?)? onSaved;

  const _SmFormField({
    required this.label,
    this.initialValue,
    required this.hint,
    this.maxLines = 1,
    this.keyboardType = TextInputType.text,
    this.prefixIcon,
    this.validator,
    this.onSaved,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label,
              style:
                  const TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
          const SizedBox(height: 6),
          TextFormField(
            initialValue: initialValue,
            maxLines: maxLines,
            keyboardType: keyboardType,
            decoration: InputDecoration(
              hintText: hint,
              prefixIcon:
                  prefixIcon != null ? Icon(prefixIcon, size: 18) : null,
            ),
            validator: validator,
            onSaved: onSaved,
          ),
        ],
      ),
    );
  }
}

class _SmDropdownField extends StatelessWidget {
  final String label;
  final String? value;
  final List<String> items;
  final String? Function(String?)? validator;
  final void Function(String?) onChanged;

  const _SmDropdownField({
    required this.label,
    required this.value,
    required this.items,
    this.validator,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label,
              style:
                  const TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
          const SizedBox(height: 6),
          DropdownButtonFormField<String>(
            initialValue: value,
            decoration: const InputDecoration(),
            hint: const Text('Selecciona...',
                style: TextStyle(color: SmColors.mutedForeground)),
            items: items
                .map((i) => DropdownMenuItem(value: i, child: Text(i)))
                .toList(),
            validator: validator,
            onChanged: onChanged,
          ),
        ],
      ),
    );
  }
}
