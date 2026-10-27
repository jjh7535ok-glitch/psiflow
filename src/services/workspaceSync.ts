import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  query,
  where,
  onSnapshot,
  getDocFromServer,
  Firestore,
} from 'firebase/firestore';
import { auth } from './googleAuth';
import firebaseConfig from '../../firebase-applet-config.json';
import { ProductItem, PsiDataStore } from '../types/psi';
import { HubMasterItem, CustomerMasterItem, CategoryMasterItem } from '../types/masterData';
import { ProductionLine, ShiftScheduleRules } from '../types/lineCapa';
import { ensureProductModels, migrateLegacyDataStore } from '../utils/psiEngine';

export interface WorkspacePayload {
  products: ProductItem[];
  dataStore: PsiDataStore;
  hubs?: HubMasterItem[];
  customers?: CustomerMasterItem[];
  categories?: CategoryMasterItem[];
  lines?: ProductionLine[];
  shiftRules?: ShiftScheduleRules;
  updatedAt?: string;
  updatedBy?: string;
}

// Initialize Firestore singleton
let db: Firestore | null = null;
try {
  const dbId = (firebaseConfig as any).firestoreDatabaseId;
  db = dbId ? getFirestore(auth.app, dbId) : getFirestore(auth.app);
} catch (err) {
  console.warn('Failed to initialize Firestore instance:', err);
  try {
    db = getFirestore(auth.app);
  } catch (e2) {
    console.error('Fallback getFirestore failed:', e2);
  }
}

const WORKSPACE_DOC_ID = 'main';

/**
 * Quick connection check as recommended by Firebase guide
 */
export async function testFirestoreConnection(): Promise<boolean> {
  if (!db) return false;
  try {
    await getDocFromServer(doc(db, 'workspaces', 'ping'));
    return true;
  } catch {
    return false;
  }
}

/**
 * Fetch workspace from Cloud Firestore with server API fallback.
 * Prioritizes the most recent update timestamp.
 */
export async function fetchRemoteWorkspace(): Promise<WorkspacePayload | null> {
  let firestoreData: WorkspacePayload | null = null;
  let serverData: WorkspacePayload | null = null;

  // 1. Try Firestore first
  if (db) {
    try {
      const snap = await getDoc(doc(db, 'workspaces', WORKSPACE_DOC_ID));
      if (snap.exists()) {
        const raw = snap.data() as any;
        if (raw && Array.isArray(raw.products) && raw.products.length > 0) {
          firestoreData = {
            products: raw.products.map((p: any, idx: number) => ensureProductModels(p, idx)),
            dataStore: raw.dataStore || {},
            hubs: raw.hubs,
            customers: raw.customers,
            categories: raw.categories,
            lines: raw.lines,
            shiftRules: raw.shiftRules,
            updatedAt: raw.updatedAt,
            updatedBy: raw.updatedBy,
          };
        }
      }
    } catch (err) {
      console.warn('Firestore fetch failed, checking server API:', err);
    }
  }

  // 2. Try Server API (/api/workspace)
  try {
    const res = await fetch('/api/workspace');
    if (res.ok) {
      const json = await res.json();
      if (json.ok && json.data) {
        const raw = json.data;
        if (Array.isArray(raw.products) && raw.products.length > 0) {
          serverData = {
            products: raw.products.map((p: any, idx: number) => ensureProductModels(p, idx)),
            dataStore: raw.dataStore || {},
            hubs: raw.hubs,
            customers: raw.customers,
            categories: raw.categories,
            lines: raw.lines,
            shiftRules: raw.shiftRules,
            updatedAt: raw.updatedAt,
            updatedBy: raw.updatedBy,
          };
        }
      }
    }
  } catch (err) {
    console.warn('Server API fetch failed:', err);
  }

  // If both exist, choose the newer one; prefer serverData on tie as it represents direct host state
  if (firestoreData && serverData) {
    const fTime = new Date(firestoreData.updatedAt || 0).getTime();
    const sTime = new Date(serverData.updatedAt || 0).getTime();
    return sTime >= fTime ? serverData : firestoreData;
  }

  return serverData || firestoreData || null;
}

/**
 * Save workspace to Cloud Firestore AND Server API.
 */
export async function saveRemoteWorkspace(
  payload: WorkspacePayload
): Promise<{ ok: boolean; savedAt: string; firestoreSaved: boolean; serverSaved: boolean }> {
  const savedAt = new Date().toISOString();
  const record = {
    id: WORKSPACE_DOC_ID,
    products: payload.products,
    dataStore: payload.dataStore,
    hubs: payload.hubs || [],
    customers: payload.customers || [],
    categories: payload.categories || [],
    lines: payload.lines || [],
    shiftRules: payload.shiftRules || {},
    updatedAt: savedAt,
    updatedBy: payload.updatedBy || 'owner',
  };

  let firestoreSaved = false;
  let serverSaved = false;

  // 1. Save to Cloud Firestore (Full overwrite without merge so deleted products are truly gone)
  if (db) {
    try {
      await setDoc(doc(db, 'workspaces', WORKSPACE_DOC_ID), record);
      firestoreSaved = true;
    } catch (err) {
      console.warn('Failed to save to Firestore directly:', err);
    }
  }

  // 2. Save to Server Disk API
  try {
    const res = await fetch('/api/workspace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    });
    if (res.ok) {
      serverSaved = true;
    }
  } catch (err) {
    console.warn('Failed to save to /api/workspace:', err);
  }

  return {
    ok: firestoreSaved || serverSaved,
    savedAt,
    firestoreSaved,
    serverSaved,
  };
}

/**
 * Subscribe to real-time changes on Cloud Firestore so changes on PC reflect on Laptop automatically!
 */
export function subscribeToRemoteWorkspace(
  onUpdate: (data: WorkspacePayload) => void
): () => void {
  if (!db) return () => {};
  try {
    const unsub = onSnapshot(
      doc(db, 'workspaces', WORKSPACE_DOC_ID),
      (snap) => {
        if (snap.exists()) {
          const raw = snap.data() as any;
          if (raw && Array.isArray(raw.products) && raw.products.length > 0) {
            onUpdate({
              products: raw.products.map((p: any, idx: number) => ensureProductModels(p, idx)),
              dataStore: raw.dataStore || {},
              hubs: raw.hubs,
              customers: raw.customers,
              categories: raw.categories,
              lines: raw.lines,
              shiftRules: raw.shiftRules,
              updatedAt: raw.updatedAt,
              updatedBy: raw.updatedBy,
            });
          }
        }
      },
      (err) => {
        console.warn('Firestore subscription error:', err);
      }
    );
    return unsub;
  } catch (err) {
    console.warn('Could not subscribe to Firestore workspace:', err);
    return () => {};
  }
}

export interface RevisionSummary {
  id: string;              // e.g. "2026-W43-v1"
  weekId: string;          // e.g. "2026-W43"
  versionNumber: number;   // e.g. 1, 2, 3
  title: string;           // e.g. "2026년 W43차 공식 배포 (1차)"
  memo: string;            // Release notes / reason for change
  createdAt: string;       // ISO string
  createdBy: string;       // Email
}

export interface PublishedRevision extends RevisionSummary {
  products: ProductItem[];
  dataStore: PsiDataStore;
  hubs?: HubMasterItem[];
  customers?: CustomerMasterItem[];
  categories?: CategoryMasterItem[];
  lines?: ProductionLine[];
  shiftRules?: ShiftScheduleRules;
}

/**
 * Save an immutable revision baseline snapshot to Firestore and server disk
 */
export async function createRevisionSnapshot(
  revision: PublishedRevision
): Promise<{ ok: boolean; id: string }> {
  // 1. Save to Cloud Firestore
  if (db) {
    try {
      await setDoc(doc(db, 'revisions', revision.id), revision);
    } catch (err) {
      console.warn('Failed to save revision to Firestore directly:', err);
    }
  }

  // 2. Save to Server Disk API
  try {
    await fetch('/api/revisions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(revision),
    });
  } catch (err) {
    console.warn('Failed to save revision to /api/revisions:', err);
  }

  return { ok: true, id: revision.id };
}

/**
 * Fetch all published revisions (summary list)
 */
export async function fetchRevisionList(weekId?: string): Promise<RevisionSummary[]> {
  // Try server first for quick list
  try {
    const url = weekId ? `/api/revisions?weekId=${encodeURIComponent(weekId)}` : '/api/revisions';
    const res = await fetch(url);
    if (res.ok) {
      const json = await res.json();
      if (json.ok && Array.isArray(json.revisions)) {
        return json.revisions;
      }
    }
  } catch (err) {
    console.warn('Failed to fetch revisions from server:', err);
  }

  // Fallback to Firestore
  if (db) {
    try {
      const q = weekId
        ? query(collection(db, 'revisions'), where('weekId', '==', weekId))
        : collection(db, 'revisions');
      const snap = await getDocs(q);
      const list: RevisionSummary[] = [];
      snap.forEach((d) => {
        const raw = d.data() as any;
        list.push({
          id: raw.id || d.id,
          weekId: raw.weekId,
          versionNumber: raw.versionNumber || 1,
          title: raw.title || '',
          memo: raw.memo || '',
          createdAt: raw.createdAt || '',
          createdBy: raw.createdBy || '',
        });
      });
      return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (err) {
      console.warn('Failed to fetch revisions from Firestore:', err);
    }
  }

  return [];
}

/**
 * Fetch a single immutable published revision by ID
 */
export async function fetchRevisionById(revId: string): Promise<PublishedRevision | null> {
  // 1. Try Firestore first
  if (db) {
    try {
      const snap = await getDoc(doc(db, 'revisions', revId));
      if (snap.exists()) {
        const raw = snap.data() as any;
        return {
          id: raw.id || snap.id,
          weekId: raw.weekId,
          versionNumber: raw.versionNumber,
          title: raw.title,
          memo: raw.memo || '',
          createdAt: raw.createdAt,
          createdBy: raw.createdBy,
          products: (raw.products || []).map((p: any, idx: number) => ensureProductModels(p, idx)),
          dataStore: raw.dataStore || {},
          hubs: raw.hubs,
          customers: raw.customers,
          categories: raw.categories,
          lines: raw.lines,
          shiftRules: raw.shiftRules,
        };
      }
    } catch (err) {
      console.warn('Failed to fetch revision from Firestore:', err);
    }
  }

  // 2. Try Server API
  try {
    const res = await fetch(`/api/revisions/${encodeURIComponent(revId)}`);
    if (res.ok) {
      const json = await res.json();
      if (json.ok && json.revision) {
        const raw = json.revision;
        return {
          id: raw.id,
          weekId: raw.weekId,
          versionNumber: raw.versionNumber,
          title: raw.title,
          memo: raw.memo || '',
          createdAt: raw.createdAt,
          createdBy: raw.createdBy,
          products: (raw.products || []).map((p: any, idx: number) => ensureProductModels(p, idx)),
          dataStore: raw.dataStore || {},
          hubs: raw.hubs,
          customers: raw.customers,
          categories: raw.categories,
          lines: raw.lines,
          shiftRules: raw.shiftRules,
        };
      }
    }
  } catch (err) {
    console.warn('Failed to fetch revision from server API:', err);
  }

  return null;
}
