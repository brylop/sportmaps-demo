import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

// Provider principal que expone el cliente de Supabase
final supabaseProvider = Provider<SupabaseClient>((ref) {
  return Supabase.instance.client;
});
