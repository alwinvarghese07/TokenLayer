import type {
  UIMessage,
  PluginMessage,
  TokenCollection,
  TokenItem,
  TokenModeValue,
  TokenResolvedType,
} from '../shared/messages';

// Launch UI with spacious dimensions suitable for token browsing
figma.showUI(__html__, {
  width: 500,
  height: 700,
  themeColors: true,
});

function postToUI(msg: PluginMessage): void {
  figma.ui.postMessage(msg);
}

function rgbToHex(r: number, g: number, b: number, a: number = 1): string {
  const toHex = (n: number) => {
    const val = Math.max(0, Math.min(255, Math.round(n * 255)));
    return val.toString(16).padStart(2, '0').toUpperCase();
  };
  const base = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  if (a !== undefined && a < 0.999) {
    return `${base}${toHex(a)}`;
  }
  return base;
}

function formatColorRgba(r: number, g: number, b: number, a: number = 1): string {
  const round = (n: number) => Math.max(0, Math.min(255, Math.round(n * 255)));
  const alpha = Math.round(a * 100) / 100;
  return `rgba(${round(r)}, ${round(g)}, ${round(b)}, ${alpha})`;
}

async function loadTokens(): Promise<void> {
  try {
    const [rawCollections, rawVariables] = await Promise.all([
      figma.variables.getLocalVariableCollectionsAsync(),
      figma.variables.getLocalVariablesAsync(),
    ]);

    // Build lookup maps for collections and variables to quickly resolve aliases
    const collectionMap = new Map<string, VariableCollection>();
    rawCollections.forEach((col) => collectionMap.set(col.id, col));

    const variableMap = new Map<string, Variable>();
    rawVariables.forEach((v) => variableMap.set(v.id, v));

    // Serialize collections
    const collections: TokenCollection[] = rawCollections.map((col) => ({
      id: col.id,
      name: col.name,
      defaultModeId: col.defaultModeId,
      modes: col.modes.map((m) => ({
        modeId: m.modeId,
        name: m.name,
      })),
      variableCount: col.variableIds.length,
    }));

    // Serialize tokens
    const tokens: TokenItem[] = [];

    for (const v of rawVariables) {
      const parentCol = collectionMap.get(v.variableCollectionId);
      const colName = parentCol ? parentCol.name : 'Unknown';
      const modesList = parentCol ? parentCol.modes : [];

      const valuesByMode: Record<string, TokenModeValue> = {};

      for (const mode of modesList) {
        const rawVal = v.valuesByMode[mode.modeId];
        let formattedValue = '';
        let isAlias = false;
        let aliasTargetName: string | undefined;
        let aliasTargetCollection: string | undefined;
        let colorHex: string | undefined;
        let colorRgba: string | undefined;
        let scalarVal: string | number | boolean = '';

        if (rawVal && typeof rawVal === 'object' && 'type' in rawVal && rawVal.type === 'VARIABLE_ALIAS') {
          isAlias = true;
          const targetVar = variableMap.get(rawVal.id) || (await figma.variables.getVariableByIdAsync(rawVal.id));
          if (targetVar) {
            aliasTargetName = targetVar.name;
            const targetCol = collectionMap.get(targetVar.variableCollectionId);
            aliasTargetCollection = targetCol?.name;
            formattedValue = `{${targetVar.name}}`;
            scalarVal = targetVar.name;

            // Resolve color if target or variable is a color
            if (v.resolvedType === 'COLOR' || targetVar.resolvedType === 'COLOR') {
              let currentTarget: Variable | null = targetVar;
              let currentVal = currentTarget.valuesByMode[mode.modeId] ?? Object.values(currentTarget.valuesByMode)[0];
              let depth = 0;
              while (currentVal && typeof currentVal === 'object' && 'type' in currentVal && currentVal.type === 'VARIABLE_ALIAS' && depth < 5) {
                depth++;
                currentTarget = variableMap.get(currentVal.id) || (await figma.variables.getVariableByIdAsync(currentVal.id));
                if (!currentTarget) break;
                currentVal = currentTarget.valuesByMode[mode.modeId] ?? Object.values(currentTarget.valuesByMode)[0];
              }
              if (currentVal && typeof currentVal === 'object' && 'r' in currentVal) {
                const r = (currentVal as RGBA).r ?? 0;
                const g = (currentVal as RGBA).g ?? 0;
                const b = (currentVal as RGBA).b ?? 0;
                const a = (currentVal as RGBA).a !== undefined ? (currentVal as RGBA).a : 1;
                colorHex = rgbToHex(r, g, b, a);
                colorRgba = formatColorRgba(r, g, b, a);
              }
            }
          } else {
            aliasTargetName = 'Unknown Variable';
            formattedValue = '{unknown}';
            scalarVal = rawVal.id;
          }
        } else if (v.resolvedType === 'COLOR' && rawVal && typeof rawVal === 'object' && 'r' in rawVal) {
          const r = (rawVal as RGBA).r ?? 0;
          const g = (rawVal as RGBA).g ?? 0;
          const b = (rawVal as RGBA).b ?? 0;
          const a = (rawVal as RGBA).a !== undefined ? (rawVal as RGBA).a : 1;
          colorHex = rgbToHex(r, g, b, a);
          colorRgba = formatColorRgba(r, g, b, a);
          formattedValue = colorHex;
          scalarVal = colorHex;
        } else if (typeof rawVal === 'number' || typeof rawVal === 'string' || typeof rawVal === 'boolean') {
          formattedValue = String(rawVal);
          scalarVal = rawVal;
        } else {
          formattedValue = rawVal ? JSON.stringify(rawVal) : 'null';
          scalarVal = formattedValue;
        }

        valuesByMode[mode.modeId] = {
          modeId: mode.modeId,
          modeName: mode.name,
          value: scalarVal,
          formattedValue,
          isAlias,
          aliasTargetName,
          aliasTargetCollection,
          colorHex,
          colorRgba,
        };
      }

      tokens.push({
        id: v.id,
        name: v.name,
        description: v.description || '',
        resolvedType: v.resolvedType as TokenResolvedType,
        collectionId: v.variableCollectionId,
        collectionName: colName,
        scopes: v.scopes as string[],
        valuesByMode,
      });
    }

    postToUI({
      type: 'TOKENS_LOADED',
      payload: {
        collections,
        tokens,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load tokens from document';
    postToUI({
      type: 'ERROR',
      payload: { message },
    });
  }
}

// Initial connection handshake
postToUI({
  type: 'PLUGIN_READY',
  payload: {
    userName: figma.currentUser?.name,
    documentName: figma.root.name,
  },
});

// Load tokens immediately on launch
loadTokens();

function hexToFigmaRgb(hex: string): RGBA {
  const clean = hex.replace('#', '').trim();
  let r = 0, g = 0, b = 0, a = 1;
  if (clean.length === 3) {
    r = parseInt(clean[0] + clean[0], 16) / 255;
    g = parseInt(clean[1] + clean[1], 16) / 255;
    b = parseInt(clean[2] + clean[2], 16) / 255;
  } else if (clean.length === 6) {
    r = parseInt(clean.substring(0, 2), 16) / 255;
    g = parseInt(clean.substring(2, 4), 16) / 255;
    b = parseInt(clean.substring(4, 6), 16) / 255;
  } else if (clean.length === 8) {
    r = parseInt(clean.substring(0, 2), 16) / 255;
    g = parseInt(clean.substring(2, 4), 16) / 255;
    b = parseInt(clean.substring(4, 6), 16) / 255;
    a = parseInt(clean.substring(6, 8), 16) / 255;
  }
  return { r, g, b, a };
}

figma.ui.onmessage = async (msg: UIMessage) => {
  if (!msg || typeof msg !== 'object') {
    return;
  }

  switch (msg.type) {
    case 'INIT': {
      postToUI({
        type: 'PLUGIN_READY',
        payload: {
          userName: figma.currentUser?.name,
          documentName: figma.root.name,
        },
      });
      await loadTokens();
      break;
    }

    case 'LOAD_TOKENS': {
      await loadTokens();
      break;
    }

    case 'CREATE_COLLECTION': {
      try {
        const { name, sourceCollectionId } = msg.payload;
        const trimmed = name.trim();
        const existingCols = await figma.variables.getLocalVariableCollectionsAsync();
        const dup = existingCols.find((c) => c.name.toLowerCase() === trimmed.toLowerCase());
        if (dup) {
          postToUI({
            type: 'COLLECTION_CREATED',
            payload: {
              success: false,
              error: `A collection named "${trimmed}" already exists in this Figma file.`,
            },
          });
          break;
        }

        // Create the real variable collection in the Figma file!
        const newCol = figma.variables.createVariableCollection(trimmed);

        // Copy / setup modes if sourceCollectionId is provided
        if (sourceCollectionId) {
          const srcCol = existingCols.find((c) => c.id === sourceCollectionId);
          if (srcCol && srcCol.modes.length > 0) {
            // Rename first default mode
            newCol.renameMode(newCol.modes[0].modeId, srcCol.modes[0].name);
            // Add remaining modes
            for (let i = 1; i < srcCol.modes.length; i++) {
              newCol.addMode(srcCol.modes[i].name);
            }
          }
        }

        // Reload all tokens in the document so UI is fresh
        await loadTokens();

        postToUI({
          type: 'COLLECTION_CREATED',
          payload: {
            success: true,
            collection: {
              id: newCol.id,
              name: newCol.name,
              defaultModeId: newCol.defaultModeId,
              modes: newCol.modes.map((m) => ({ modeId: m.modeId, name: m.name })),
              variableCount: 0,
            },
          },
        });
      } catch (err: any) {
        postToUI({
          type: 'COLLECTION_CREATED',
          payload: {
            success: false,
            error: err?.message || 'Failed to create collection in Figma.',
          },
        });
      }
      break;
    }

    case 'EXECUTE_MIGRATION': {
      try {
        const {
          sourceCollectionId,
          destinationCollectionId,
          destinationName,
          preserveNestedGroups,
          tokenNaming,
          nameConflicts,
          tokenIds,
        } = msg.payload;

        const allCols = await figma.variables.getLocalVariableCollectionsAsync();
        const allVars = await figma.variables.getLocalVariablesAsync();

        // 1. Resolve source collection
        const srcCol = allCols.find((c) => c.id === sourceCollectionId);
        if (!srcCol) {
          throw new Error('Source collection not found in document.');
        }

        // 2. Resolve or create destination collection in Figma
        let destCol: VariableCollection | undefined;
        if (destinationCollectionId) {
          destCol = allCols.find((c) => c.id === destinationCollectionId);
        }
        if (!destCol) {
          destCol = allCols.find(
            (c) => c.name.toLowerCase() === destinationName.trim().toLowerCase()
          );
        }
        if (!destCol) {
          // Create real collection in Figma!
          destCol = figma.variables.createVariableCollection(destinationName.trim());
        }

        // 3. Ensure modes exist in destination collection matching source collection
        const srcModes = srcCol.modes;
        const destModes = destCol.modes;

        // If destCol was just created and has only default mode, rename it to match source first mode
        if (
          destModes.length === 1 &&
          srcModes.length > 0 &&
          destModes[0].name !== srcModes[0].name
        ) {
          destCol.renameMode(destModes[0].modeId, srcModes[0].name);
        }

        // Add any missing modes from source into destination
        for (const sMode of srcModes) {
          const hasMode = destCol.modes.some(
            (dm) => dm.name.toLowerCase() === sMode.name.toLowerCase()
          );
          if (!hasMode) {
            try {
              destCol.addMode(sMode.name);
            } catch (e) {
              console.warn('Could not add mode to collection in Figma', e);
            }
          }
        }

        // Build mode mapping by name: srcModeId -> destModeId
        const modeIdMap = new Map<string, string>();
        for (const sMode of srcCol.modes) {
          const matchedDestMode =
            destCol.modes.find((dm) => dm.name.toLowerCase() === sMode.name.toLowerCase()) ||
            destCol.modes[0];
          if (matchedDestMode) {
            modeIdMap.set(sMode.modeId, matchedDestMode.modeId);
          }
        }

        // 4. Map of existing variables in destination collection
        const existingDestVars = allVars.filter((v) => v.variableCollectionId === destCol!.id);
        const destVarMap = new Map<string, Variable>();
        existingDestVars.forEach((v) => destVarMap.set(v.name, v));

        // 5. Source variables to migrate
        const varsToMigrate = allVars.filter((v) => tokenIds.includes(v.id));

        const results: Array<{
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
        }> = [];

        for (const v of varsToMigrate) {
          const pathParts = v.name
            .replace(/\\/g, '/')
            .split('/')
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
          const leafName = pathParts.length > 0 ? pathParts[pathParts.length - 1] : v.name;
          const groupPath = pathParts.length > 1 ? pathParts.slice(0, -1).join('/') : '';

          // Target name construction
          let targetName = preserveNestedGroups ? v.name : leafName;
          if (tokenNaming === 'Prefix with collection') {
            targetName = `${srcCol.name}/${targetName}`;
          } else if (tokenNaming === 'Add v2 suffix') {
            targetName = `${targetName}-v2`;
          } else if (tokenNaming === 'Lowercase with hyphens') {
            targetName = targetName.toLowerCase().replace(/[\/\s]+/g, '-');
          }

          // Read source values
          const firstSrcMode = srcCol.modes[0];
          const rawSrcVal = v.valuesByMode[firstSrcMode.modeId];
          let srcHex: string | undefined;
          let srcValStr = '';
          if (
            v.resolvedType === 'COLOR' &&
            rawSrcVal &&
            typeof rawSrcVal === 'object' &&
            'r' in rawSrcVal
          ) {
            const c = rawSrcVal as RGBA;
            srcHex = rgbToHex(c.r, c.g, c.b, c.a !== undefined ? c.a : 1);
            srcValStr = srcHex;
          } else {
            srcValStr = String(rawSrcVal ?? '');
          }

          const existingVar = destVarMap.get(targetName);

          if (existingVar) {
            // Read dest values
            const firstDestMode = destCol.modes[0];
            const rawDestVal = existingVar.valuesByMode[firstDestMode.modeId];
            let destHex: string | undefined;
            if (
              existingVar.resolvedType === 'COLOR' &&
              rawDestVal &&
              typeof rawDestVal === 'object' &&
              'r' in rawDestVal
            ) {
              const dc = rawDestVal as RGBA;
              destHex = rgbToHex(dc.r, dc.g, dc.b, dc.a !== undefined ? dc.a : 1);
            }

            if (nameConflicts === 'Skip existing tokens') {
              results.push({
                id: v.id,
                name: targetName,
                leafName,
                groupPath,
                resolvedType: v.resolvedType as TokenResolvedType,
                status: 'SKIPPED',
                detail: 'Skipped · Variable already exists in destination',
                sourceHex: srcHex,
                destHex,
                sourceValue: srcValStr,
              });
              continue;
            } else if (nameConflicts === 'Overwrite existing') {
              try {
                // Overwrite values for each mode in Figma
                for (const sMode of srcCol.modes) {
                  const dModeId = modeIdMap.get(sMode.modeId);
                  if (!dModeId) continue;
                  const sVal = v.valuesByMode[sMode.modeId];
                  if (v.resolvedType === 'COLOR') {
                    if (sVal && typeof sVal === 'object' && 'r' in sVal) {
                      existingVar.setValueForMode(dModeId, sVal);
                    }
                  } else if (
                    typeof sVal === 'number' ||
                    typeof sVal === 'string' ||
                    typeof sVal === 'boolean'
                  ) {
                    existingVar.setValueForMode(dModeId, sVal);
                  }
                }
                results.push({
                  id: v.id,
                  name: targetName,
                  leafName,
                  groupPath,
                  resolvedType: v.resolvedType as TokenResolvedType,
                  status: 'UPDATED',
                  detail: 'Updated existing variable in destination',
                  sourceHex: srcHex,
                  destHex,
                  sourceValue: srcValStr,
                });
              } catch (e: any) {
                results.push({
                  id: v.id,
                  name: targetName,
                  leafName,
                  groupPath,
                  resolvedType: v.resolvedType as TokenResolvedType,
                  status: 'FAILED',
                  detail: 'Failed to overwrite variable in Figma',
                  errorReason: e?.message || 'Error updating values in Figma',
                  sourceHex: srcHex,
                });
              }
              continue;
            } else if (nameConflicts === 'Rename with suffix') {
              let counter = 1;
              let suffixedName = `${targetName}-${counter}`;
              while (destVarMap.has(suffixedName)) {
                counter++;
                suffixedName = `${targetName}-${counter}`;
              }
              targetName = suffixedName;
            }
          }

          // Create real new variable in destination collection in Figma
          try {
            const newVar = figma.variables.createVariable(
              targetName,
              destCol,
              v.resolvedType as VariableResolvedDataType
            );
            if (v.description) {
              newVar.description = v.description;
            }

            // Set values for each mode in Figma
            for (const sMode of srcCol.modes) {
              const dModeId = modeIdMap.get(sMode.modeId);
              if (!dModeId) continue;
              const sVal = v.valuesByMode[sMode.modeId];
              if (v.resolvedType === 'COLOR') {
                if (sVal && typeof sVal === 'object' && 'r' in sVal) {
                  newVar.setValueForMode(dModeId, sVal);
                } else if (typeof sVal === 'string' && sVal.startsWith('#')) {
                  newVar.setValueForMode(dModeId, hexToFigmaRgb(sVal));
                }
              } else if (
                typeof sVal === 'number' ||
                typeof sVal === 'string' ||
                typeof sVal === 'boolean'
              ) {
                newVar.setValueForMode(dModeId, sVal);
              }
            }

            destVarMap.set(targetName, newVar);

            results.push({
              id: v.id,
              name: targetName,
              leafName,
              groupPath,
              resolvedType: v.resolvedType as TokenResolvedType,
              status: 'SUCCESSFUL',
              detail: `Created in ${destCol.name}`,
              sourceHex: srcHex,
              sourceValue: srcValStr,
            });
          } catch (e: any) {
            results.push({
              id: v.id,
              name: targetName,
              leafName,
              groupPath,
              resolvedType: v.resolvedType as TokenResolvedType,
              status: 'FAILED',
              detail: 'Failed to create variable in Figma',
              errorReason: e?.message || 'Figma API error writing variable',
              sourceHex: srcHex,
            });
          }
        }

        // Reload all tokens in the document so the new collection and variables appear everywhere in TokenLayer!
        await loadTokens();

        postToUI({
          type: 'MIGRATION_RESULT',
          payload: {
            success: true,
            sourceCollectionName: srcCol.name,
            destinationCollectionName: destCol.name,
            results,
          },
        });
      } catch (err: any) {
        postToUI({
          type: 'MIGRATION_RESULT',
          payload: {
            success: false,
            sourceCollectionName: 'Source',
            destinationCollectionName: 'Destination',
            results: [],
            error: err?.message || 'Migration failed.',
          },
        });
      }
      break;
    }

    case 'NOTIFY': {
      figma.notify(msg.message);
      break;
    }

    case 'RESIZE': {
      const width = Math.max(340, Math.min(1000, Math.round(msg.width)));
      const height = Math.max(460, Math.min(1200, Math.round(msg.height)));
      figma.ui.resize(width, height);
      break;
    }

    case 'CLOSE_PLUGIN': {
      figma.closePlugin();
      break;
    }

    default:
      break;
  }
};
