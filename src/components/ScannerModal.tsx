import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { 
  Camera, X, Check, Search, Package, ArrowUpRight, ArrowDownLeft, 
  AlertCircle, RefreshCcw, Flashlight, Volume2, Sparkles, CheckCircle2 
} from 'lucide-react';
import { Product } from '../types';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface ScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onScanResult: (product: Product, actionType: 'check-in' | 'check-out' | 'view', quantity: number, notes?: string) => Promise<void>;
  currency: string;
}

export function ScannerModal({
  isOpen,
  onClose,
  products,
  onScanResult,
  currency
}: ScannerModalProps) {
  const [scannerActive, setScannerActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [scannedProduct, setScannedProduct] = useState<Product | null>(null);
  const [actionType, setActionType] = useState<'check-in' | 'check-out' | 'view'>('check-in');
  const [adjustQty, setAdjustQty] = useState<number>(1);
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);
  const regionId = 'qr-reader-viewport';

  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      setScannedProduct(null);
      setManualCode('');
      setSuccessMsg(null);
      return;
    }

    // Auto start scanner when opened
    startScanner();

    return () => {
      stopScanner();
    };
  }, [isOpen]);

  const startScanner = async () => {
    setCameraError(null);
    setScannerActive(true);

    try {
      if (!html5QrcodeRef.current) {
        html5QrcodeRef.current = new Html5Qrcode(regionId);
      }

      await html5QrcodeRef.current.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          handleCodeDetected(decodedText);
        },
        () => {
          // silent scan failure during continuous frames
        }
      );
    } catch (err: any) {
      console.warn('Camera initialization notice:', err);
      setScannerActive(false);
      setCameraError(
        typeof err === 'string'
          ? err
          : err?.message || 'Camera access not permitted or device has no active video feed. You can use manual SKU / Barcode lookup below.'
      );
    }
  };

  const stopScanner = async () => {
    if (html5QrcodeRef.current && html5QrcodeRef.current.isScanning) {
      try {
        await html5QrcodeRef.current.stop();
      } catch (err) {
        console.warn('Scanner stop error:', err);
      }
    }
    setScannerActive(false);
  };

  const handleCodeDetected = (code: string) => {
    const trimmed = code.trim().toLowerCase();
    // Search products by barcode, SKU, or ID
    const found = products.find(
      (p) =>
        (p.barcode && p.barcode.toLowerCase() === trimmed) ||
        (p.sku && p.sku.toLowerCase() === trimmed) ||
        p.id.toLowerCase() === trimmed ||
        p.name.toLowerCase().includes(trimmed)
    );

    if (found) {
      setScannedProduct(found);
      setSuccessMsg(`Match Found: ${found.name}`);
      // Play soft audio feedback beep if supported
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 880;
        gain.gain.value = 0.1;
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
      } catch (e) {
        // audio context optional
      }
    } else {
      setCameraError(`No inventory item matched barcode / SKU "${code}".`);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleCodeDetected(manualCode);
  };

  const handleExecuteAction = async () => {
    if (!scannedProduct || adjustQty <= 0) return;
    setIsSubmitting(true);
    try {
      await onScanResult(scannedProduct, actionType, adjustQty, notes);
      setSuccessMsg(`Successfully ${actionType === 'check-in' ? 'checked in' : 'checked out'} ${adjustQty} units of ${scannedProduct.name}`);
      setTimeout(() => {
        setScannedProduct(null);
        setSuccessMsg(null);
        setNotes('');
        setAdjustQty(1);
      }, 1500);
    } catch (error) {
      console.error('Scan action failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 w-full max-w-xl overflow-hidden my-8"
        >
          {/* Header */}
          <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-400/30 flex items-center justify-center">
                <Camera className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="font-black text-base tracking-tight">QR / Barcode Inventory Scanner</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Fast camera check-in & check-out</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white flex items-center justify-center transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Viewport Scanner Box */}
            {!scannedProduct && (
              <div className="space-y-4">
                <div className="relative rounded-2xl overflow-hidden bg-slate-900 border-2 border-indigo-500/30 aspect-video flex flex-col items-center justify-center">
                  <div id={regionId} className="w-full h-full object-cover" />

                  {/* Target Crosshair & Laser animation */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-48 h-48 border-2 border-dashed border-indigo-400 rounded-2xl relative flex items-center justify-center">
                      <div className="w-full h-0.5 bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)] animate-bounce" />
                    </div>
                  </div>

                  {!scannerActive && (
                    <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center p-4 text-center">
                      <Camera className="w-10 h-10 text-slate-500 mb-2" />
                      <p className="text-xs font-bold text-slate-300">Camera scanner inactive</p>
                      <button
                        onClick={startScanner}
                        className="mt-3 px-4 py-2 bg-indigo-600 text-white font-extrabold text-[10px] uppercase tracking-wider rounded-xl hover:bg-indigo-500 transition-all"
                      >
                        Activate Camera Stream
                      </button>
                    </div>
                  )}
                </div>

                {cameraError && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2.5 text-xs text-amber-800 font-medium">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>{cameraError}</span>
                  </div>
                )}

                {/* Manual Barcode / SKU input */}
                <form onSubmit={handleManualSubmit} className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Enter SKU or Barcode manually..."
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value)}
                      className="w-full h-11 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-5 h-11 bg-indigo-600 text-white font-extrabold text-xs rounded-xl hover:bg-indigo-500 transition-all uppercase tracking-wider"
                  >
                    Match Item
                  </button>
                </form>
              </div>
            )}

            {/* Matched Product Details & Quick Check-In / Check-Out Actions */}
            {scannedProduct && (
              <div className="p-5 bg-slate-50 border border-indigo-100 rounded-3xl space-y-5 animate-in fade-in duration-300">
                {successMsg && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2 text-xs font-extrabold text-emerald-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{successMsg}</span>
                  </div>
                )}

                <div className="flex items-start justify-between gap-4 border-b border-slate-200/60 pb-4">
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
                      SKU: {scannedProduct.sku || 'N/A'}
                    </span>
                    <h4 className="text-lg font-black text-slate-900 mt-1">{scannedProduct.name}</h4>
                    <p className="text-xs text-slate-500 font-bold mt-0.5">{scannedProduct.category || 'General'} • Barcode: {scannedProduct.barcode || 'N/A'}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] text-slate-400 font-bold uppercase block">Current Stock</span>
                    <span className="text-2xl font-black text-slate-900">{scannedProduct.quantity} units</span>
                  </div>
                </div>

                {/* Mode Selector */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setActionType('check-in')}
                    className={cn(
                      "p-3 rounded-2xl border flex items-center justify-center gap-2 text-xs font-extrabold uppercase tracking-wider transition-all",
                      actionType === 'check-in'
                        ? "bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-600/20"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    <ArrowDownLeft className="w-4 h-4" />
                    Quick Check-In (+ Stock)
                  </button>

                  <button
                    type="button"
                    onClick={() => setActionType('check-out')}
                    className={cn(
                      "p-3 rounded-2xl border flex items-center justify-center gap-2 text-xs font-extrabold uppercase tracking-wider transition-all",
                      actionType === 'check-out'
                        ? "bg-rose-600 border-rose-600 text-white shadow-md shadow-rose-600/20"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    <ArrowUpRight className="w-4 h-4" />
                    Quick Check-Out (- Stock)
                  </button>
                </div>

                {/* Adjustment Quantity & Reference Notes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Quantity</label>
                    <input
                      type="number"
                      min="1"
                      value={adjustQty}
                      onChange={(e) => setAdjustQty(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl text-sm font-black text-slate-900 focus:border-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Reference / Location Note</label>
                    <input
                      type="text"
                      placeholder="e.g. Rack A-4, Delivery receipt..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:border-indigo-500 outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={handleExecuteAction}
                    disabled={isSubmitting}
                    className={cn(
                      "flex-1 h-12 text-white font-extrabold text-xs uppercase tracking-wider rounded-2xl transition-all shadow-md flex items-center justify-center gap-2",
                      actionType === 'check-in' ? "bg-emerald-600 hover:bg-emerald-500" : "bg-rose-600 hover:bg-rose-500"
                    )}
                  >
                    {isSubmitting ? (
                      <RefreshCcw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    Confirm {actionType === 'check-in' ? 'Check-In' : 'Check-Out'}
                  </button>

                  <button
                    onClick={() => setScannedProduct(null)}
                    className="px-5 h-12 bg-slate-200 text-slate-700 font-extrabold text-xs uppercase tracking-wider rounded-2xl hover:bg-slate-300 transition-all"
                  >
                    Scan Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
