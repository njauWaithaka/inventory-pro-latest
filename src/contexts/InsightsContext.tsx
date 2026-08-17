/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useSettings } from './SettingsContext';
import {
  DynamicInsight,
  InsightElementId,
  InsightsSnapshot,
  getInsightsSnapshot,
  generateInsights,
  generateLocalFallbackInsights,
  groupInsightsByElement,
  getCachedInsights,
  setCachedInsights,
  getCachedInsightsTimestamp,
  ALL_INSIGHT_ELEMENT_IDS,
} from '../lib/dynamicInsightsService';

interface InsightsContextType {
  insights: Record<InsightElementId, DynamicInsight>;
  insightsByElement: Record<InsightElementId, DynamicInsight[]>;
  allInsights: DynamicInsight[];
  getInsight: (elementId: InsightElementId) => DynamicInsight;
  getInsightsList: (elementId: InsightElementId) => DynamicInsight[];
  isRegenerating: boolean;
  lastGeneratedAt: string | null;
  snapshot: InsightsSnapshot | null;
  regenerateInsights: () => Promise<void>;
}

const InsightsContext = createContext<InsightsContextType | undefined>(undefined);

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const DEBOUNCE_DELAY_MS = 2000; // 2 seconds

export function InsightsProvider({ children }: { children: React.ReactNode }) {
  const { profile, currency } = useSettings();
  const companyId = profile?.companyId;

  // Real-time Firestore state caches
  const [products, setProducts] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [stockMovements, setStockMovements] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);

  const [snapshot, setSnapshot] = useState<InsightsSnapshot | null>(null);

  // Raw insights list
  const [allInsights, setAllInsights] = useState<DynamicInsight[]>(() => {
    if (companyId) {
      const cached = getCachedInsights(companyId);
      if (cached && cached.length > 0) return cached;
    }
    const initSnapshot = getInsightsSnapshot({ products: [] });
    return generateLocalFallbackInsights(initSnapshot, currency || 'KSh');
  });

  const [isRegenerating, setIsRegenerating] = useState(false);
  const [lastGeneratedAt, setLastGeneratedAt] = useState<string | null>(null);

  // Grouped by element ID
  const insightsByElement = useMemo(() => {
    return groupInsightsByElement(allInsights);
  }, [allInsights]);

  // Single top insight record per element
  const insights = useMemo(() => {
    const map: Partial<Record<InsightElementId, DynamicInsight>> = {};
    ALL_INSIGHT_ELEMENT_IDS.forEach((id) => {
      const list = insightsByElement[id] || [];
      if (list.length > 0) {
        map[id] = list[0];
      } else {
        map[id] = {
          elementId: id,
          severity: 'neutral',
          text: 'Monitoring live inventory telemetry.',
          relatedSku: null,
        };
      }
    });
    return map as Record<InsightElementId, DynamicInsight>;
  }, [insightsByElement]);

  // Debounce ref
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isFirstMountRef = useRef(true);
  const prevFingerprintRef = useRef<string>('');

  // 1. Subscribe to Firestore data streams for the active company
  useEffect(() => {
    if (!companyId) return;

    // Load any existing cache for this company
    const cached = getCachedInsights(companyId);
    if (cached && cached.length > 0) {
      setAllInsights(cached);
    }

    const basePath = `companies/${companyId}`;
    const unsubs: Array<() => void> = [];

    unsubs.push(
      onSnapshot(collection(db, `${basePath}/products`), (snap) => {
        setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      })
    );

    unsubs.push(
      onSnapshot(collection(db, `${basePath}/invoices`), (snap) => {
        setInvoices(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      })
    );

    unsubs.push(
      onSnapshot(collection(db, `${basePath}/stockMovements`), (snap) => {
        setStockMovements(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      })
    );

    unsubs.push(
      onSnapshot(collection(db, `${basePath}/expenses`), (snap) => {
        setExpenses(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      })
    );

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [companyId]);

  // 2. Compute live data snapshot whenever underlying database data updates
  const currentSnapshot = useMemo(() => {
    return getInsightsSnapshot({
      products,
      invoices,
      stockMovements,
      expenses,
      currency: currency || 'KSh',
    });
  }, [products, invoices, stockMovements, expenses, currency]);

  useEffect(() => {
    setSnapshot(currentSnapshot);
    // Refresh deterministic multi-angle insights immediately when data changes
    const fallbackList = generateLocalFallbackInsights(currentSnapshot, currency || 'KSh');
    setAllInsights(fallbackList);
  }, [currentSnapshot, currency]);

  // 3. Execution trigger: regenerate insights with debouncing & TTL checks
  const executeGeneration = useCallback(
    async (targetSnapshot: InsightsSnapshot) => {
      if (!companyId) return;

      setIsRegenerating(true);
      try {
        const generatedList = await generateInsights(targetSnapshot, currency || 'KSh');
        setAllInsights(generatedList);
        setLastGeneratedAt(new Date().toISOString());
        setCachedInsights(companyId, generatedList);
      } catch (err) {
        console.warn('Insights background regeneration error handled gracefully:', err);
      } finally {
        setIsRegenerating(false);
      }
    },
    [companyId, currency]
  );

  // 4. Reactive Data Change Detection (with 2000ms debounce) and TTL 5min checks
  useEffect(() => {
    if (!companyId || products.length === 0) return;

    // Construct lightweight data fingerprint
    const fingerprint = `${products.length}-${products.reduce((acc, p) => acc + (Number(p.quantity) || 0), 0)}-${invoices.length}-${expenses.length}-${stockMovements.length}`;

    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      prevFingerprintRef.current = fingerprint;

      const cacheTs = getCachedInsightsTimestamp(companyId);
      const isCacheStale = Date.now() - cacheTs > CACHE_TTL_MS;

      if (isCacheStale || !getCachedInsights(companyId)) {
        executeGeneration(currentSnapshot);
      }
      return;
    }

    // If underlying data changed (sale recorded, stock adjusted, expense logged)
    if (fingerprint !== prevFingerprintRef.current) {
      prevFingerprintRef.current = fingerprint;

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Debounce rapid changes by 2 seconds
      debounceTimerRef.current = setTimeout(() => {
        executeGeneration(currentSnapshot);
      }, DEBOUNCE_DELAY_MS);
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [companyId, products, invoices, expenses, stockMovements, currentSnapshot, executeGeneration]);

  const getInsight = useCallback(
    (elementId: InsightElementId): DynamicInsight => {
      const list = insightsByElement[elementId] || [];
      if (list.length > 0) return list[0];

      const fallbackList = generateLocalFallbackInsights(
        currentSnapshot || getInsightsSnapshot({ products: [] }),
        currency || 'KSh'
      );
      const found = fallbackList.find((f) => f.elementId === elementId);
      return (
        found || {
          elementId,
          severity: 'neutral',
          text: 'Monitoring live inventory telemetry.',
          relatedSku: null,
        }
      );
    },
    [insightsByElement, currentSnapshot, currency]
  );

  const getInsightsList = useCallback(
    (elementId: InsightElementId): DynamicInsight[] => {
      const list = insightsByElement[elementId] || [];
      if (list.length > 0) return list;

      const fallbackList = generateLocalFallbackInsights(
        currentSnapshot || getInsightsSnapshot({ products: [] }),
        currency || 'KSh'
      );
      const found = fallbackList.filter((f) => f.elementId === elementId);
      return found.length > 0
        ? found
        : [
            {
              elementId,
              severity: 'neutral',
              text: 'Monitoring live inventory telemetry.',
              relatedSku: null,
            },
          ];
    },
    [insightsByElement, currentSnapshot, currency]
  );

  const regenerateInsights = useCallback(async () => {
    if (currentSnapshot) {
      await executeGeneration(currentSnapshot);
    }
  }, [currentSnapshot, executeGeneration]);

  return (
    <InsightsContext.Provider
      value={{
        insights,
        insightsByElement,
        allInsights,
        getInsight,
        getInsightsList,
        isRegenerating,
        lastGeneratedAt,
        snapshot,
        regenerateInsights,
      }}
    >
      {children}
    </InsightsContext.Provider>
  );
}

export function useDynamicInsights() {
  const context = useContext(InsightsContext);
  if (!context) {
    throw new Error('useDynamicInsights must be used within an InsightsProvider');
  }
  return context;
}
