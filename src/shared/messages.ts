/**
 * Typed message protocol for TokenLayer.
 */

export type TokenResolvedType = 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN';

export interface TokenModeValue {
  modeId: string;
  modeName: string;
  value: string | number | boolean;
  formattedValue: string;
  isAlias: boolean;
  aliasTargetName?: string;
  aliasTargetCollection?: string;
  colorHex?: string;
  colorRgba?: string;
}

export interface TokenItem {
  id: string;
  name: string;
  description: string;
  resolvedType: TokenResolvedType;
  collectionId: string;
  collectionName: string;
  scopes: string[];
  valuesByMode: Record<string, TokenModeValue>;
}

export interface TokenCollection {
  id: string;
  name: string;
  defaultModeId: string;
  modes: Array<{
    modeId: string;
    name: string;
  }>;
  variableCount: number;
}

export type MigrationStatus = 'COMPLETED' | 'IN_PROGRESS' | 'FAILED' | 'NEEDS_ATTENTION';

export interface MigrationSummary {
  total: number;
  successful: number;
  updated: number;
  skipped: number;
  failed: number;
}

export interface MigrationTokenItemResult {
  id: string;
  name: string;
  leafName: string;
  groupPath: string;
  resolvedType: TokenResolvedType;
  status: 'SUCCESSFUL' | 'UPDATED' | 'SKIPPED' | 'FAILED';
  detail: string;
  sourceHex?: string;
  destHex?: string;
  sourceValue?: string;
  destValue?: string;
  errorReason?: string;
}

export interface MigrationRecord {
  id: string;
  sourceCollectionId?: string;
  sourceCollectionName: string;
  destinationCollectionId?: string;
  destinationCollectionName: string;
  status: MigrationStatus;
  startedAt: number;
  completedAt?: number;
  summary?: MigrationSummary;
  results?: MigrationTokenItemResult[];
  errorMessage?: string;
}

// Messages sent from UI -> Plugin Runtime
export type UIMessage =
  | { type: 'INIT' }
  | { type: 'LOAD_TOKENS' }
  | { type: 'GET_MIGRATION_HISTORY' }
  | { type: 'SAVE_MIGRATION_RECORD'; payload: MigrationRecord }
  | { type: 'CLEAR_MIGRATION_HISTORY' }
  | { type: 'RESIZE'; width: number; height: number }
  | { type: 'NOTIFY'; message: string }
  | { type: 'CLOSE_PLUGIN' }
  | {
      type: 'CREATE_COLLECTION';
      payload: {
        name: string;
        description?: string;
        sourceCollectionId?: string;
      };
    }
  | {
      type: 'EXECUTE_MIGRATION';
      payload: {
        migrationId?: string;
        sourceCollectionId: string;
        destinationCollectionId?: string;
        destinationName: string;
        preserveNestedGroups: boolean;
        tokenNaming: string;
        nameConflicts: string;
        tokenIds: string[];
      };
    };

// Messages sent from Plugin Runtime -> UI
export type PluginMessage =
  | {
      type: 'PLUGIN_READY';
      payload: {
        documentName?: string;
      };
    }
  | {
      type: 'TOKENS_LOADED';
      payload: {
        collections: TokenCollection[];
        tokens: TokenItem[];
      };
    }
  | {
      type: 'MIGRATION_HISTORY_LOADED';
      payload: {
        records: MigrationRecord[];
        error?: string;
      };
    }
  | {
      type: 'COLLECTION_CREATED';
      payload: {
        success: boolean;
        collection?: TokenCollection;
        error?: string;
      };
    }
  | {
      type: 'MIGRATION_RESULT';
      payload: {
        migrationId?: string;
        success: boolean;
        sourceCollectionName: string;
        destinationCollectionName: string;
        results: MigrationTokenItemResult[];
        error?: string;
      };
    }
  | {
      type: 'ERROR';
      payload: {
        message: string;
      };
    };

/**
 * Standard window message event structure from Figma plugin iframe.
 */
export interface FigmaPluginEvent {
  data: {
    pluginMessage?: PluginMessage;
    pluginId?: string;
  };
}
