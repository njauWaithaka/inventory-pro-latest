const LOCAL_STORAGE_KEY = 'inventory_pro_local_firestore';

export interface User {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

interface Listener {
  id: string;
  path: string;
  isQuery: boolean;
  constraints?: any[];
  onNext: (snap: any) => void;
  onError?: (err: any) => void;
}

const activeListeners = new Set<Listener>();

function readDB(): Record<string, any> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error("Local database read mismatch: ", e);
    return {};
  }
}

function writeDB(data: Record<string, any>) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
    setTimeout(() => {
      notifyListeners();
    }, 0);
  } catch (e) {
    console.error("Local database write limit exceeded: ", e);
  }
}

function notifyListeners() {
  const currentDB = readDB();
  activeListeners.forEach((listener) => {
    try {
      if (listener.isQuery) {
        const snapshot = getQuerySnapshotInternal(currentDB, listener.path, listener.constraints || []);
        listener.onNext(snapshot);
      } else {
        const snapshot = getDocSnapshotInternal(currentDB, listener.path);
        listener.onNext(snapshot);
      }
    } catch (err) {
      if (listener.onError) listener.onError(err);
    }
  });
}

function isImmediateChild(colPath: string, docPath: string): boolean {
  if (!docPath.startsWith(colPath + '/')) return false;
  const subPath = docPath.substring(colPath.length + 1);
  return subPath.length > 0 && !subPath.includes('/');
}

function getNestedValue(obj: any, path: string): any {
  if (!obj || !path) return undefined;
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current[part];
  }
  return current;
}

function matchesConstraint(docData: any, constraint: any): boolean {
  if (constraint.type !== 'where') return true;
  const { fieldPath, opStr, value } = constraint;
  const docVal = getNestedValue(docData, fieldPath);
  
  switch (opStr) {
    case '==':
      return docVal === value;
    case '!=':
      return docVal !== value;
    case '<':
      return docVal < value;
    case '<=':
      return docVal <= value;
    case '>':
      return docVal > value;
    case '>=':
      return docVal >= value;
    case 'array-contains':
      return Array.isArray(docVal) && docVal.includes(value);
    case 'in':
      return Array.isArray(value) && value.includes(docVal);
    case 'array-contains-any':
      return Array.isArray(docVal) && Array.isArray(value) && docVal.some((v: any) => value.includes(v));
    default:
      return true;
  }
}

function sortDocs(docs: any[], constraints: any[]): any[] {
  const orderByConstraints = constraints.filter(c => c.type === 'orderBy');
  if (orderByConstraints.length === 0) return docs;
  
  return [...docs].sort((a, b) => {
    for (const ob of orderByConstraints) {
      const { fieldPath, directionStr } = ob;
      const valA = getNestedValue(a.data, fieldPath);
      const valB = getNestedValue(b.data, fieldPath);
      
      if (valA === undefined && valB !== undefined) return 1;
      if (valA !== undefined && valB === undefined) return -1;
      if (valA === undefined && valB === undefined) continue;
      
      if (valA < valB) return directionStr === 'desc' ? 1 : -1;
      if (valA > valB) return directionStr === 'desc' ? -1 : 1;
    }
    return 0;
  });
}

export class MockDocumentSnapshot {
  id: string;
  ref: any;
  _data: any;
  constructor(id: string, ref: any, data: any) {
    this.id = id;
    this.ref = ref;
    this._data = data;
  }
  exists() {
    return this._data !== undefined && this._data !== null;
  }
  data() {
    return this._data ? JSON.parse(JSON.stringify(this._data)) : undefined;
  }
}

export class MockQuerySnapshot {
  docs: MockDocumentSnapshot[];
  constructor(docs: MockDocumentSnapshot[]) {
    this.docs = docs;
  }
  forEach(callback: (doc: MockDocumentSnapshot, index: number) => void) {
    this.docs.forEach(callback);
  }
  get empty() {
    return this.docs.length === 0;
  }
  get size() {
    return this.docs.length;
  }
}

function getDocSnapshotInternal(currentDB: Record<string, any>, path: string): MockDocumentSnapshot {
  const val = currentDB[path];
  const docRef = { type: 'doc', path, id: path.split('/').pop() || '' };
  return new MockDocumentSnapshot(docRef.id, docRef, val);
}

function getQuerySnapshotInternal(currentDB: Record<string, any>, colPath: string, constraints: any[]): MockQuerySnapshot {
  let docList: { id: string; path: string; data: any }[] = [];
  
  for (const key of Object.keys(currentDB)) {
    if (isImmediateChild(colPath, key)) {
      docList.push({
        id: key.split('/').pop() || '',
        path: key,
        data: currentDB[key]
      });
    }
  }
  
  const whereConstraints = constraints.filter(c => c.type === 'where');
  docList = docList.filter((docItem) => {
    return whereConstraints.every(constraint => matchesConstraint(docItem.data, constraint));
  });
  
  docList = sortDocs(docList, constraints);
  
  const snapshots = docList.map(docItem => {
    const docRef = { type: 'doc', path: docItem.path, id: docItem.id };
    return new MockDocumentSnapshot(docItem.id, docRef, docItem.data);
  });
  
  return new MockQuerySnapshot(snapshots);
}

export function getFirestore(app: any, databaseId?: string): any {
  return {
    type: 'db',
    databaseId: databaseId || '(default)'
  };
}

export function doc(dbOrColOrDoc: any, ...pathSegments: string[]): any {
  let basePath = '';
  if (dbOrColOrDoc && (dbOrColOrDoc.type === 'collection' || dbOrColOrDoc.type === 'doc')) {
    basePath = dbOrColOrDoc.path;
  }
  const joined = [basePath, ...pathSegments].filter(Boolean).map(s => s.replace(/^\/+|\/+$/g, '')).join('/');
  return {
    type: 'doc',
    path: joined,
    id: joined.split('/').pop() || '',
  };
}

export function collection(dbOrColOrDoc: any, ...pathSegments: string[]): any {
  let basePath = '';
  if (dbOrColOrDoc && (dbOrColOrDoc.type === 'collection' || dbOrColOrDoc.type === 'doc')) {
    basePath = dbOrColOrDoc.path;
  }
  const joined = [basePath, ...pathSegments].filter(Boolean).map(s => s.replace(/^\/+|\/+$/g, '')).join('/');
  return {
    type: 'collection',
    path: joined,
    id: joined.split('/').pop() || '',
  };
}

export function query(collectionRef: any, ...constraints: any[]): any {
  return {
    type: 'query',
    path: collectionRef.path,
    constraints,
  };
}

export function where(fieldPath: string, opStr: string, value: any) {
  return { type: 'where', fieldPath, opStr, value };
}

export function orderBy(fieldPath: string, directionStr: string = 'asc') {
  return { type: 'orderBy', fieldPath, directionStr };
}

export function increment(value: number) {
  return { __type: 'increment', value };
}

export function serverTimestamp() {
  return { __type: 'serverTimestamp' };
}

function processValue(val: any, existingVal: any): any {
  if (val && typeof val === 'object') {
    if (val.__type === 'increment') {
      const base = typeof existingVal === 'number' ? existingVal : 0;
      return base + val.value;
    }
    if (val.__type === 'serverTimestamp') {
      return new Date().toISOString();
    }
    if (Array.isArray(val)) {
      return val.map(item => processValue(item, undefined));
    }
    const resolved: any = {};
    for (const k of Object.keys(val)) {
      resolved[k] = processValue(val[k], existingVal ? existingVal[k] : undefined);
    }
    return resolved;
  }
  return val;
}

export function getDoc(docRef: any): Promise<MockDocumentSnapshot> {
  const currentDB = readDB();
  return Promise.resolve(getDocSnapshotInternal(currentDB, docRef.path));
}

export function getDocFromServer(docRef: any): Promise<MockDocumentSnapshot> {
  return getDoc(docRef);
}

export function getDocs(queryOrCol: any): Promise<MockQuerySnapshot> {
  const currentDB = readDB();
  const isQuery = queryOrCol && queryOrCol.type === 'query';
  const constraints = isQuery ? queryOrCol.constraints : [];
  const path = queryOrCol.path;
  return Promise.resolve(getQuerySnapshotInternal(currentDB, path, constraints));
}

export function setDoc(docRef: any, data: any, options?: { merge?: boolean }): Promise<void> {
  const currentDB = readDB();
  const path = docRef.path;
  const existing = currentDB[path];
  
  let finalData: any;
  if (options && options.merge && existing) {
    finalData = { ...existing };
    for (const key of Object.keys(data)) {
      finalData[key] = processValue(data[key], existing[key]);
    }
  } else {
    finalData = processValue(data, existing);
  }
  
  currentDB[path] = finalData;
  writeDB(currentDB);
  return Promise.resolve();
}

export function addDoc(collectionRef: any, data: any): Promise<any> {
  const colPath = collectionRef.path;
  const newId = 'doc_' + Math.random().toString(36).substr(2, 9);
  const docPath = colPath + '/' + newId;
  const docRef = { type: 'doc', path: docPath, id: newId };
  
  const currentDB = readDB();
  currentDB[docPath] = processValue(data, undefined);
  writeDB(currentDB);
  
  return Promise.resolve(docRef);
}

export function updateDoc(docRef: any, data: any): Promise<void> {
  const currentDB = readDB();
  const path = docRef.path;
  const existing = currentDB[path];
  
  if (!existing) {
    return Promise.reject(new Error(`Document not found: ${path}`));
  }
  
  const finalData = { ...existing };
  for (const key of Object.keys(data)) {
    if (key.includes('.')) {
      const parts = key.split('.');
      let currentObj = finalData;
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!currentObj[part] || typeof currentObj[part] !== 'object') {
          currentObj[part] = {};
        }
        currentObj[part] = { ...currentObj[part] };
        currentObj = currentObj[part];
      }
      const lastPart = parts[parts.length - 1];
      currentObj[lastPart] = processValue(data[key], currentObj[lastPart]);
    } else {
      finalData[key] = processValue(data[key], existing[key]);
    }
  }
  
  currentDB[path] = finalData;
  writeDB(currentDB);
  return Promise.resolve();
}

export function deleteDoc(docRef: any): Promise<void> {
  const currentDB = readDB();
  const path = docRef.path;
  if (currentDB[path] !== undefined) {
    delete currentDB[path];
    writeDB(currentDB);
  }
  return Promise.resolve();
}

export function onSnapshot(
  target: any,
  onNext: (snap: any) => void,
  onErrorOrComplete?: (err: any) => void
): () => void {
  const id = 'listener_' + Math.random().toString(36).substr(2, 9);
  const isQuery = target && (target.type === 'query' || target.type === 'collection');
  const path = target.path;
  const constraints = target.type === 'query' ? target.constraints : [];
  
  const listener: Listener = {
    id,
    path,
    isQuery,
    constraints,
    onNext,
    onError: typeof onErrorOrComplete === 'function' ? onErrorOrComplete : undefined
  };
  
  activeListeners.add(listener);
  
  try {
    const currentDB = readDB();
    if (isQuery) {
      onNext(getQuerySnapshotInternal(currentDB, path, constraints));
    } else {
      onNext(getDocSnapshotInternal(currentDB, path));
    }
  } catch (err) {
    if (typeof onErrorOrComplete === 'function') onErrorOrComplete(err);
  }
  
  return () => {
    activeListeners.delete(listener);
  };
}

export function writeBatch(db: any): any {
  let operations: { type: 'set' | 'update' | 'delete'; docRef: any; data?: any; options?: any }[] = [];
  return {
    set(docRef: any, data: any, options?: any) {
      operations.push({ type: 'set', docRef, data, options });
    },
    update(docRef: any, data: any) {
      operations.push({ type: 'update', docRef, data });
    },
    delete(docRef: any) {
      operations.push({ type: 'delete', docRef });
    },
    commit(): Promise<void> {
      const currentDB = readDB();
      for (const op of operations) {
        const path = op.docRef.path;
        const existing = currentDB[path];
        if (op.type === 'set') {
          let finalData: any;
          if (op.options && op.options.merge && existing) {
            finalData = { ...existing };
            for (const key of Object.keys(op.data)) {
              finalData[key] = processValue(op.data[key], existing[key]);
            }
          } else {
            finalData = processValue(op.data, existing);
          }
          currentDB[path] = finalData;
        } else if (op.type === 'update') {
          if (existing) {
            const finalData = { ...existing };
            for (const key of Object.keys(op.data)) {
              if (key.includes('.')) {
                const parts = key.split('.');
                let currentObj = finalData;
                for (let i = 0; i < parts.length - 1; i++) {
                  const part = parts[i];
                  if (!currentObj[part] || typeof currentObj[part] !== 'object') {
                    currentObj[part] = {};
                  }
                  currentObj[part] = { ...currentObj[part] };
                  currentObj = currentObj[part];
                }
                const lastPart = parts[parts.length - 1];
                currentObj[lastPart] = processValue(op.data[key], currentObj[lastPart]);
              } else {
                finalData[key] = processValue(op.data[key], existing[key]);
              }
            }
            currentDB[path] = finalData;
          }
        } else if (op.type === 'delete') {
          delete currentDB[path];
        }
      }
      writeDB(currentDB);
      return Promise.resolve();
    }
  };
}
