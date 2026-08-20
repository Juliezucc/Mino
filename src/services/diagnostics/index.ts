import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { ReportContext } from '@/domain/diagnostics';
import { getSupabaseClient } from '@/data/supabaseRepository';

import { DiagnosticsService } from './DiagnosticsService';
import { LocalDiagnosticsService } from './LocalDiagnosticsService';
import { SupabaseDiagnosticsService } from './SupabaseDiagnosticsService';

export * from './DiagnosticsService';
export { LocalDiagnosticsService, SupabaseDiagnosticsService };

let instance: DiagnosticsService | null = null;

export function getDiagnosticsService(): DiagnosticsService {
  if (!instance) {
    const client = getSupabaseClient();
    instance = client ? new SupabaseDiagnosticsService(client) : new LocalDiagnosticsService();
  }
  return instance;
}

/** Test hook. */
export function setDiagnosticsService(service: DiagnosticsService | null) {
  instance = service;
}

/**
 * Le contexte technique, rassemblé au même endroit.
 *
 * Rassemblé ici et pas dans l'écran, pour que le rapport d'un plantage — écrit
 * par personne, au pire moment — contienne exactement les mêmes informations
 * que celui qu'un parent rédige tranquillement.
 */
export function deviceContext(extra: Partial<ReportContext> = {}): ReportContext {
  return {
    appVersion: Constants.expoConfig?.version ?? '0.0.0',
    platform: Platform.OS,
    osVersion: String(Platform.Version ?? ''),
    ...extra,
  };
}
