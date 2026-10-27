import { Injectable, signal } from '@angular/core';
import { environment } from '../environments/environment';

export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
}

@Injectable({ providedIn: 'root' })
export class FirebaseRuntimeConfigService {
  private readonly configState = signal<FirebaseWebConfig | null>(null);

  readonly config = this.configState.asReadonly();
  readonly requiresCloud = environment.production;
  readonly isConfigured = (): boolean => this.configState() !== null;

  async load(): Promise<void> {
    try {
      const response = await fetch('/api/firebase-config', { cache: 'no-store' });
      if (response.ok) {
        const result: unknown = await response.json();
        if (this.isConfigResponse(result) && result.configured) {
          this.configState.set(result.firebase);
          return;
        }
        if (this.isConfigResponse(result) && !result.configured && environment.production) {
          return;
        }
      } else if (environment.production) {
        return;
      }
    } catch {
      if (environment.production) {
        return;
      }
    }

    const localConfig = environment.firebase;
    if (Object.values(localConfig).every((value) => value.length > 0)) {
      this.configState.set(localConfig);
    }
  }

  private isConfigResponse(value: unknown): value is {
    configured: boolean;
    firebase: FirebaseWebConfig;
  } {
    if (typeof value !== 'object' || value === null || !('configured' in value) || !('firebase' in value)) {
      return false;
    }
    const result = value as { configured: unknown; firebase: unknown };
    if (typeof result.configured !== 'boolean' || typeof result.firebase !== 'object' || result.firebase === null) {
      return false;
    }
    const config = result.firebase as Record<string, unknown>;
    return ['apiKey', 'authDomain', 'projectId', 'appId'].every(
      (key) => typeof config[key] === 'string',
    );
  }
}
