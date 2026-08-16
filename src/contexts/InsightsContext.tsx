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
  getCachedInsights,
  setCachedInsights,
  getCachedInsightsTimestamp,
  ALL_INSIGHT_ELEMENT_IDS,
} from '../lib/dynamicInsightsService';

interface InsightsContextType {
  insights: Record<InsightElementId, DynamicInsight>;
  getInsight: (elementId: InsightElementId) => DynamicInsight;
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
  const [insights, setInsights] = useState<Record<InsightElementId, DynamicInsight>>(() => {
    if (companyId) {
      const cached = getCachedInsights(companyId);
      if (cached) return cached;
    }
    // Initialize default fallback
    const initSnapshot = getInsightsSnapshot({ products: [] });
    const fallbacks = generateLocalFallbackInsights(initSnapshot, currency || 'KSh');
    const map: Record<string, DynamicInsight> = {};
    fallbacks.forEach((f) => {
      map[f.elementId] = f;
    });
    return map as Record<InsightElementId, DynamicInsight>;
  });

  const [isRegenerating, setIsRegenerating] = useState(false);
  const [lastGeneratedAt, setLastGeneratedAt] = useState<string | null>(null);

  // Debounce ref
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isFirstMountRef = useRef(true);
  const prevFingerprintRef = useRef<string>('');

  // 1. Subscribe to Firestore data streams for the active company
  useEffect(() => {
    if (!companyId) return;

    // Load any existing cache for this company
    const cached = getCachedInsights(companyId);
    if (cached) {
      setInsights(cached);
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
  }, [currentSnapshot]);

  // 3. Execution trigger: regenerate insights via Gemini API with debouncing & TTL checks
  const executeGeneration = useCallback(
    async (targetSnapshot: InsightsSnapshot) => {
      if (!companyId) return;

      setIsRegenerating(true);
      try {
        const generatedList = await generateInsights(targetSnapshot, currency || 'KSh');
        const nextMap: Record<string, DynamicInsight> = {};

        generatedList.forEach((ins) => {
          nextMap[ins.elementId] = ins;
        });

        // Ensure all 16 fixed elements exist
        ALL_INSIGHT_ELEMENT_IDS.forEach((id) => {
          if (!nextMap[id]) {
            const fallback = generateLocalFallbackInsights(targetSnapshot, currency || 'KSh').find(
              (f) => f.elementId === id
            );
            if (fallback) nextMap[id] = fallback;
          }
        });

        const finalRecord = nextMap as Record<InsightElementId, DynamicInsight>;
        setInsights(finalRecord);
        setLastGeneratedAt(new Date().toISOString());
        setCachedInsights(companyId, finalRecord);
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
      if (insights[elementId]) {
        return insights[elementId];
      }
      // Fallback
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
    [insights, currentSnapshot, currency]
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
        getInsight,
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
