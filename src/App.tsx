import React, { useState, useEffect, useMemo } from 'react';
import { ProductItem, PsiDataStore, DailyHubRecord, MonthlyInitialStockRecord } from './types/psi';
import {
  INITIAL_PRODUCTS,
  generateDateRange,
  generateDateRangeFromStart,
  generateInitialRecords,
  ensureDatesInDataStore,
  exportToCsv,
  downloadFile,
  forwardFillModelField,
  batchForwardFillPlans,
  ensureProductModels,
  migrateLegacyDataStore,
} from './utils/psiEngine';
import {
  WeekInfo,
  getISOWeekInfo,
  generateWeeklyOptions,
  getPublicShareUrl,
} from './utils/weeklyUtils';
import {
  fetchRemoteWorkspace,
  saveRemoteWorkspace,
  subscribeToRemoteWorkspace,
  testFirestoreConnection,
  createRevisionSnapshot,
  fetchRevisionList,
  fetchRevisionById,
  PublishedRevision,
  RevisionSummary,
} from './services/workspaceSync';
import {
  initAuth,
  googleSignIn,
  googleSignOut,
  OWNER_EMAIL,
  getSavedAuthEmail,
} from './services/googleAuth';
import { TopBar } from './components/TopBar';
import { FilterToolbar } from './components/FilterToolbar';
import { MatrixGrid } from './components/MatrixGrid';
import { TrendAnalytics } from './components/TrendAnalytics';
import { MasterDataView } from './components/MasterDataView';
import { ProductModal } from './components/ProductModal';
import { WeeklyShareModal } from './components/WeeklyShareModal';
import { PublishRevisionModal } from './components/PublishRevisionModal';
import { RevisionNoticeModal } from './components/RevisionNoticeModal';
import { ForwardFillModal } from './components/ForwardFillModal';
import { LineCapaModal } from './components/LineCapaModal';
import { AccessLogModal } from './components/AccessLogModal';
import { ReplenishmentSummaryBar } from './components/ReplenishmentSummaryBar';
import { ReplenishmentDiffModal } from './components/ReplenishmentDiffModal';
import { exportToFormattedExcel } from './utils/excelExport';
import {
  runReplenishmentSimulation,
  applyRecommendationsToDataStore,
  ReplenishmentRecommendation,
} from './services/replenishmentEngine';
import { recordAccessLogSilently } from './services/accessLogService';
import { HubMasterItem, CustomerMasterItem, CategoryMasterItem } from './types/masterData';
import {
  loadHubMasters,
  saveHubMasters,
  loadCustomerMasters,
  saveCustomerMasters,
  loadCategoryMasters,
  saveCategoryMasters,
  INITIAL_HUBS,
  INITIAL_CUSTOMERS,
  INITIAL_CATEGORIES,
} from './utils/masterDataEngine';
import {
  STORAGE_KEY_LINES,
  STORAGE_KEY_SHIFT_RULES,
  loadProductionLines,
  DEFAULT_SHIFT_RULES,
  saveShiftRules,
  ShiftScheduleRules,
} from './utils/capaEngine';
import {
  CheckCircle2,
  Info,
  RotateCcw,
  Copy,
  ExternalLink,
  Globe,
  Lock,
  Check,
  X,
  Share2,
} from 'lucide-react';

const STORAGE_KEY_PRODUCTS = 'psi_flow_products_v3';
const STORAGE_KEY_DATA = 'psi_flow_datastore_v3';

export default function App() {
  // Navigation Tab
  const [currentTab, setCurrentTab] = useState<'matrix' | 'analytics' | 'products'>('matrix');

  // Current Working Week: Always based on real date (automatically advances each week)
  const [currentWeek, setCurrentWeek] = useState<WeekInfo>(() => getISOWeekInfo());
  const availableWeeks = useMemo(() => generateWeeklyOptions(), []);

  // Start Date for Date Navigation (1주일 집중 뷰: 해당 주차의 월요일 시작)
  const [startDateStr, setStartDateStr] = useState<string>(() => {
    return getISOWeekInfo().startDateStr;
  });

  // Days Range: Default 7 days (1주일 집중 뷰 - 100% 브라우저 배율 최적화)
  const [daysRange, setDaysRange] = useState<number>(7);
  const dateList = useMemo(
    () => generateDateRangeFromStart(startDateStr, daysRange),
    [startDateStr, daysRange]
  );

  // Known owner check from previous session
  const savedEmail = getSavedAuthEmail();

  // Ownership & Permission State: Always authorized for the creator
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(savedEmail);
  const [isOwner, setIsOwner] = useState<boolean>(true);

  // Products State with localStorage and Cloud Firestore fallback
  const [products, setProducts] = useState<ProductItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PRODUCTS);
      if (saved) {
        const parsed: ProductItem[] = JSON.parse(saved);
        return parsed.map((p, idx) => ensureProductModels(p, idx));
      }
    } catch {
      // ignore
    }
    return INITIAL_PRODUCTS;
  });

  // Daily Records Store with localStorage and Cloud Firestore fallback
  const [dataStore, setDataStore] = useState<PsiDataStore>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_DATA);
      if (saved) return migrateLegacyDataStore(JSON.parse(saved), INITIAL_PRODUCTS);
    } catch {
      // ignore
    }
    return generateInitialRecords(INITIAL_PRODUCTS, generateDateRange(14, 2));
  });

  // Filter & Search States (4대 핵심 드릴다운 필터: 품목, 생산라인, 차종, 거점)
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('ALL');
  const [selectedLine, setSelectedLine] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedVehicleModel, setSelectedVehicleModel] = useState('ALL');
  const [selectedHub, setSelectedHub] = useState('ALL');

  // Accordion Expand States
  const [expandedProductIds, setExpandedProductIds] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    INITIAL_PRODUCTS.forEach((p) => {
      map[p.id] = true;
    });
    return map;
  });
  const [allExpanded, setAllExpanded] = useState<boolean>(true);

  // Modals
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState<ProductItem | null>(null);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isWeeklyShareModalOpen, setIsWeeklyShareModalOpen] = useState(false);
  const [isForwardFillModalOpen, setIsForwardFillModalOpen] = useState(false);
  const [forwardFillProductId, setForwardFillProductId] = useState<string>('ALL');
  const [isLineCapaModalOpen, setIsLineCapaModalOpen] = useState(false);
  const [isAccessLogModalOpen, setIsAccessLogModalOpen] = useState(false);

  // Baseline Revision States (SCM Option 1)
  const [activeRevision, setActiveRevision] = useState<PublishedRevision | null>(null);
  const [revisionList, setRevisionList] = useState<RevisionSummary[]>([]);
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [isNoticeModalOpen, setIsNoticeModalOpen] = useState(false);
  const [quickPublishedData, setQuickPublishedData] = useState<{
    revId: string;
    url: string;
    title: string;
  } | null>(null);
  const [copiedQuickUrl, setCopiedQuickUrl] = useState(false);

  // Replenishment Simulation & Undo & Diff Modal State
  const [undoDataStore, setUndoDataStore] = useState<PsiDataStore | null>(null);
  const [isDiffModalOpen, setIsDiffModalOpen] = useState(false);
  const [diffTargetRecs, setDiffTargetRecs] = useState<ReplenishmentRecommendation[]>([]);

  // Master Data States (MDM)
  const [hubMasters, setHubMasters] = useState<HubMasterItem[]>(() => loadHubMasters());
  const [customerMasters, setCustomerMasters] = useState<CustomerMasterItem[]>(() => loadCustomerMasters());
  const [categoryMasters, setCategoryMasters] = useState<CategoryMasterItem[]>(() => loadCategoryMasters());

  // Helper to load shift rules
  const loadShiftRules = (): ShiftScheduleRules => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SHIFT_RULES);
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_SHIFT_RULES;
  };

  // Toast Notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Mount effect: Check URL parameter ?rev=... for frozen baseline view.
  // When no ?rev= param is present, ALWAYS default to live working draft with owner privileges.
  useEffect(() => {
    const checkUrlRevision = async () => {
      if (typeof window === 'undefined') return;
      const urlParams = new URLSearchParams(window.location.search);
      const revParam = urlParams.get('rev');

      if (revParam) {
        try {
          const targetRev = await fetchRevisionById(revParam);
          if (targetRev) {
            setActiveRevision(targetRev);
            // Check if user chose "오늘 하루 그만보기"
            const todayStr = new Date().toISOString().slice(0, 10);
            const isHidden = localStorage.getItem(`psi_hide_notice_${targetRev.id}_${todayStr}`);
            if (!isHidden) {
              setIsNoticeModalOpen(true);
            }
          }
        } catch (err) {
          console.error('Failed to load revision from URL query param:', err);
        }
      } else {
        // Direct access: always open live editable working draft
        setActiveRevision(null);
      }
    };
    checkUrlRevision();
  }, []);

  // Fetch revisions list when currentWeek changes
  const refreshRevisionList = async (weekId = currentWeek.weekId) => {
    try {
      const list = await fetchRevisionList(weekId);
      setRevisionList(list);
    } catch (err) {
      console.error('Failed to fetch revision list:', err);
    }
  };

  useEffect(() => {
    refreshRevisionList(currentWeek.weekId);
  }, [currentWeek.weekId]);

  // Mount effect: Clear any old snapshot URL hashes and setup auth & access log
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname);
    }

    const unsubscribe = initAuth(
      (user, _token, isOwnerResult) => {
        setCurrentUserEmail(user.email || null);
        setIsOwner(isOwnerResult);
        if (isOwnerResult) {
          loadWorkspaceFromRemote(false);
        }
      },
      () => {
        // Not signed in; default owner mode remains active
      }
    );

    recordAccessLogSilently(currentWeek.weekId, currentWeek.weekLabel, isOwner);

    return () => unsubscribe();
  }, [currentWeek.weekId, currentWeek.weekLabel, isOwner]);

  // Cloud Sync & Workspace State
  const [isWorkspaceLoaded, setIsWorkspaceLoaded] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);

  // Prevent accidental data loss on refresh/close if saving is in progress
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (syncStatus === 'saving') {
        e.preventDefault();
        e.returnValue = '작업 중인 계획이 아직 클라우드에 저장 중입니다. 페이지를 벗어나면 데이터가 유실될 수 있습니다.';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [syncStatus]);

  // Load persistent workspace from Cloud Firestore with server fallback (Always prioritizes remote cloud data)
  const loadWorkspaceFromRemote = async (forceNotice = false) => {
    try {
      const remoteData = await fetchRemoteWorkspace();
      if (remoteData) {
        let activeProds = products;
        // 1. Products Master priority
        if (Array.isArray(remoteData.products) && remoteData.products.length > 0) {
          activeProds = remoteData.products.map((p, idx) => ensureProductModels(p, idx));
          setProducts(activeProds);
          try {
            localStorage.setItem(STORAGE_KEY_PRODUCTS, JSON.stringify(activeProds));
          } catch {}
        }
        // 2. DataStore priority
        if (remoteData.dataStore && Object.keys(remoteData.dataStore).length > 0) {
          const migratedStore = migrateLegacyDataStore(remoteData.dataStore, activeProds);
          setDataStore(migratedStore);
          try {
            localStorage.setItem(STORAGE_KEY_DATA, JSON.stringify(migratedStore));
          } catch {}
        }
        // 3. Hubs Master priority
        if (Array.isArray(remoteData.hubs) && remoteData.hubs.length > 0) {
          setHubMasters(remoteData.hubs);
          saveHubMasters(remoteData.hubs);
        }
        // 4. Customers Master priority
        if (Array.isArray(remoteData.customers) && remoteData.customers.length > 0) {
          setCustomerMasters(remoteData.customers);
          saveCustomerMasters(remoteData.customers);
        }
        // 5. Categories Master priority
        if (Array.isArray(remoteData.categories) && remoteData.categories.length > 0) {
          setCategoryMasters(remoteData.categories);
          saveCategoryMasters(remoteData.categories);
        }
        // 6. Production Lines Master priority
        if (Array.isArray(remoteData.lines) && remoteData.lines.length > 0) {
          saveProductionLines(remoteData.lines);
        }
        // 7. Shift Schedule Rules priority
        if (remoteData.shiftRules && typeof remoteData.shiftRules === 'object') {
          saveShiftRules(remoteData.shiftRules);
        }

        const timeStr = remoteData.updatedAt
          ? new Date(remoteData.updatedAt).toLocaleTimeString()
          : new Date().toLocaleTimeString();
        setLastSavedTime(timeStr);
        setSyncStatus('saved');
        if (forceNotice) {
          showToast(`☁️ [${timeStr}] 클라우드 최신 품목 및 기준정보 마스터가 동기화되었습니다.`);
        }
      }
    } catch (err) {
      console.warn('Could not load remote workspace:', err);
    } finally {
      setIsWorkspaceLoaded(true);
    }
  };

  // Mount effect: Fetch remote workspace once
  useEffect(() => {
    loadWorkspaceFromRemote(false);
  }, []);

  // Real-time listener: Receive changes if edited on another machine (e.g., PC <-> Laptop)
  useEffect(() => {
    if (!isWorkspaceLoaded) return;
    const unsub = subscribeToRemoteWorkspace((remoteData) => {
      if (remoteData.products && remoteData.products.length > 0) {
        const activeProds = remoteData.products.map((p, idx) => ensureProductModels(p, idx));
        setProducts(activeProds);
        try {
          localStorage.setItem(STORAGE_KEY_PRODUCTS, JSON.stringify(activeProds));
        } catch {}
        if (remoteData.dataStore) {
          setDataStore(migrateLegacyDataStore(remoteData.dataStore, activeProds));
        }
      }
      if (remoteData.hubs && remoteData.hubs.length > 0) {
        setHubMasters(remoteData.hubs);
      }
      if (remoteData.customers && remoteData.customers.length > 0) {
        setCustomerMasters(remoteData.customers);
      }
      if (remoteData.categories && remoteData.categories.length > 0) {
        setCategoryMasters(remoteData.categories);
      }
      if (remoteData.lines && remoteData.lines.length > 0) {
        saveProductionLines(remoteData.lines);
      }
      if (remoteData.shiftRules && typeof remoteData.shiftRules === 'object') {
        saveShiftRules(remoteData.shiftRules);
      }
      const timeStr = remoteData.updatedAt
        ? new Date(remoteData.updatedAt).toLocaleTimeString()
        : new Date().toLocaleTimeString();
      setLastSavedTime(timeStr);
      setSyncStatus('saved');
    });

    return () => unsub();
  }, [isWorkspaceLoaded]);

  // Sync to Cloud Firestore, Server, and localStorage (Debounced)
  useEffect(() => {
    // CRITICAL GUARD: Never save until the initial remote load has fully succeeded!
    // This prevents default laptop state from overwriting PC changes.
    if (!isWorkspaceLoaded) return;
    if (!isOwner) return;

    setSyncStatus('saving');
    const timer = setTimeout(async () => {
      try {
        const result = await saveRemoteWorkspace({
          products,
          dataStore,
          hubs: hubMasters,
          customers: customerMasters,
          categories: categoryMasters,
          updatedBy: currentUserEmail || OWNER_EMAIL,
        });

        if (result.ok) {
          setSyncStatus('saved');
          setLastSavedTime(new Date().toLocaleTimeString());
          try {
            localStorage.setItem(STORAGE_KEY_PRODUCTS, JSON.stringify(products));
            localStorage.setItem(STORAGE_KEY_DATA, JSON.stringify(dataStore));
            saveHubMasters(hubMasters);
            saveCustomerMasters(customerMasters);
            saveCategoryMasters(categoryMasters);
          } catch {}
        } else {
          setSyncStatus('error');
        }
      } catch (err) {
        console.error('Failed to sync to remote:', err);
        setSyncStatus('error');
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [products, dataStore, hubMasters, customerMasters, categoryMasters, isOwner, isWorkspaceLoaded, currentUserEmail]);

  // Manual Save Trigger
  const handleManualSave = async () => {
    if (!isOwner) {
      showToast('🔒 수정 권한이 없습니다. 상단에서 소유자 로그인이 필요합니다.');
      return;
    }
    setSyncStatus('saving');
    try {
      const result = await saveRemoteWorkspace({
        products,
        dataStore,
        hubs: hubMasters,
        customers: customerMasters,
        categories: categoryMasters,
        updatedBy: currentUserEmail || OWNER_EMAIL,
      });
      if (result.ok) {
        const timeStr = new Date().toLocaleTimeString();
        setSyncStatus('saved');
        setLastSavedTime(timeStr);
        try {
          localStorage.setItem(STORAGE_KEY_PRODUCTS, JSON.stringify(products));
          localStorage.setItem(STORAGE_KEY_DATA, JSON.stringify(dataStore));
          saveHubMasters(hubMasters);
          saveCustomerMasters(customerMasters);
          saveCategoryMasters(categoryMasters);
        } catch {}
        showToast(`☁️ [${timeStr}] 품목 마스터 및 모든 계획이 클라우드에 안전하게 영구 저장되었습니다.`);
      } else {
        setSyncStatus('error');
        showToast('⚠️ 클라우드 저장 중 통신 오류가 발생했습니다.');
      }
    } catch (err) {
      setSyncStatus('error');
      showToast('⚠️ 클라우드 저장 실패');
    }
  };

  // Manual Reload Trigger
  const handleReloadRemote = async () => {
    await loadWorkspaceFromRemote(true);
  };

  // Week Navigation Handlers
  const handlePrevWeek = () => {
    const idx = availableWeeks.findIndex((w) => w.weekId === currentWeek.weekId);
    if (idx > 0) {
      const targetWeek = availableWeeks[idx - 1];
      setCurrentWeek(targetWeek);
      setStartDateStr(targetWeek.startDateStr);
    } else {
      const d = new Date(currentWeek.startDateStr);
      d.setDate(d.getDate() - 7);
      const targetWeek = getISOWeekInfo(d);
      setCurrentWeek(targetWeek);
      setStartDateStr(targetWeek.startDateStr);
    }
  };

  const handleNextWeek = () => {
    const idx = availableWeeks.findIndex((w) => w.weekId === currentWeek.weekId);
    if (idx >= 0 && idx < availableWeeks.length - 1) {
      const targetWeek = availableWeeks[idx + 1];
      setCurrentWeek(targetWeek);
      setStartDateStr(targetWeek.startDateStr);
    } else {
      const d = new Date(currentWeek.startDateStr);
      d.setDate(d.getDate() + 7);
      const targetWeek = getISOWeekInfo(d);
      setCurrentWeek(targetWeek);
      setStartDateStr(targetWeek.startDateStr);
    }
  };

  // Timeline Navigation Handlers (과거/미래 자유 이동)
  const handlePrevPeriod = () => {
    const [y, m, d] = startDateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    dateObj.setDate(dateObj.getDate() - (daysRange === 7 ? 7 : daysRange === 14 ? 7 : 14));
    const nextStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
    setStartDateStr(nextStr);
    setCurrentWeek(getISOWeekInfo(dateObj));
  };

  const handleNextPeriod = () => {
    const [y, m, d] = startDateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    dateObj.setDate(dateObj.getDate() + (daysRange === 7 ? 7 : daysRange === 14 ? 7 : 14));
    const nextStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
    setStartDateStr(nextStr);
    setCurrentWeek(getISOWeekInfo(dateObj));
  };

  const handleJumpToday = () => {
    const todayWeek = getISOWeekInfo();
    setCurrentWeek(todayWeek);
    setStartDateStr(todayWeek.startDateStr);
  };

  const handleStartDateChange = (val: string) => {
    if (val) setStartDateStr(val);
  };

  // 날짜 범위가 과거/미래로 확장되었을 때, 신규 날짜에 대한 기본 PSI 레코드를 안전하게 준비하되,
  // 원격 데이터 로딩이 완료되기 전에는 절대 실행하지 않도록 가드(Guard) 설정
  useEffect(() => {
    if (!isWorkspaceLoaded) return;
    setDataStore((prevStore) => ensureDatesInDataStore(prevStore, products, dateList));
  }, [dateList, products, isWorkspaceLoaded]);

  // In-cell Forward Fill Handler
  const handleForwardFillField = (
    productId: string,
    modelId: string | null,
    field: 'prodPlan' | 'prodActual' | 'salesPlan' | 'salesActual' | 'inboundPlan' | 'inboundActual',
    fromDateStr: string,
    value: number,
    keepWeekendZero: boolean
  ) => {
    if (!isOwner) return;
    setDataStore((prev) =>
      forwardFillModelField(prev, productId, modelId, field, fromDateStr, value, keepWeekendZero, dateList)
    );
    showToast(`기준일 [${fromDateStr}] 이후 날짜로 값이 일괄 전개되었습니다.`);
  };

  // Batch Forward Fill Plans Handler (Modal)
  const handleBatchForwardFillPlans = (params: {
    productIds: string[];
    startDateStr: string;
    prodPlan?: number;
    modelPlans: Record<string, number>;
    syncInbound: boolean;
    keepWeekendZero: boolean;
  }) => {
    if (!isOwner) return;
    setDataStore((prev) => batchForwardFillPlans(prev, products, { ...params, dateList }));
    showToast('⚡ 고객사 차종별 오더/소요량 계획이 성공적으로 일괄 전개되었습니다! (공장 생산계획은 라인 CAPA 설정을 유지합니다)');
  };

  // When viewing a frozen baseline revision (Option 1), display snapshot datasets and lock editing
  const displayProducts = useMemo(() => {
    return activeRevision ? activeRevision.products : products;
  }, [activeRevision, products]);

  const displayDataStore = useMemo(() => {
    return activeRevision ? activeRevision.dataStore : dataStore;
  }, [activeRevision, dataStore]);

  const displayHubMasters = useMemo(() => {
    return activeRevision?.hubs && activeRevision.hubs.length > 0 ? activeRevision.hubs : hubMasters;
  }, [activeRevision, hubMasters]);

  const displayCustomerMasters = useMemo(() => {
    return activeRevision?.customers && activeRevision.customers.length > 0
      ? activeRevision.customers
      : customerMasters;
  }, [activeRevision, customerMasters]);

  const displayCategoryMasters = useMemo(() => {
    return activeRevision?.categories && activeRevision.categories.length > 0
      ? activeRevision.categories
      : categoryMasters;
  }, [activeRevision, categoryMasters]);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    displayCategoryMasters.forEach((c) => set.add(c.name));
    displayProducts.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [displayCategoryMasters, displayProducts]);

  // Vehicle Models list
  const vehicleModels = useMemo(() => {
    const set = new Set<string>();
    displayProducts.forEach((p) => {
      p.models.forEach((m) => {
        if (m.name) set.add(m.name);
      });
    });
    return Array.from(set);
  }, [displayProducts]);

  // Hubs list from all product models & hubMasters
  const hubs = useMemo(() => {
    const set = new Set<string>();
    displayHubMasters.forEach((h) => set.add(h.name));
    displayProducts.forEach((p) => {
      p.models.forEach((m) => {
        if (m.hubName) set.add(m.hubName);
      });
    });
    return Array.from(set);
  }, [displayHubMasters, displayProducts]);

  // Production Lines list for Line-based filtering
  const productionLines = useMemo(
    () => loadProductionLines(displayProducts),
    [displayProducts]
  );

  // Filtered Products (4대 핵심 드릴다운 필터: 품목, 생산라인, 차종, 거점 연동)
  const filteredProducts = useMemo(() => {
    return displayProducts.filter((p) => {
      const q = searchQuery.toLowerCase();
      const matchQuery =
        p.code.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.models.some(
          (m) =>
            m.name.toLowerCase().includes(q) ||
            m.customer.toLowerCase().includes(q) ||
            m.hubName.toLowerCase().includes(q)
        );
      const matchProduct = selectedProductId === 'ALL' || p.id === selectedProductId;
      const matchLine =
        selectedLine === 'ALL' ||
        productionLines
          .find((l) => l.id === selectedLine)
          ?.productConfigs.some((cfg) => cfg.productId === p.id);
      const matchVehicle =
        selectedVehicleModel === 'ALL' || p.models.some((m) => m.name === selectedVehicleModel);
      const matchHub =
        selectedHub === 'ALL' || p.models.some((m) => (m.hubName || '울산 출고센터') === selectedHub);

      return matchQuery && matchProduct && matchLine && matchVehicle && matchHub;
    });
  }, [displayProducts, searchQuery, selectedProductId, selectedLine, selectedVehicleModel, selectedHub, productionLines]);

  // Replenishment Engine Simulation (1-C, 2-B+C)
  const simulation = useMemo(
    () => runReplenishmentSimulation(displayProducts, dateList, displayDataStore),
    [displayProducts, dateList, displayDataStore]
  );

  // Owner Authentication Flow / Switch back from read-only
  const handleOwnerLogin = async () => {
    if (typeof window !== 'undefined' && window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname);
      setIsOwner(true);
      setCurrentUserEmail(OWNER_EMAIL);
      await loadWorkspaceFromRemote(true);
      showToast('👑 소유자 라이브 작업 공간으로 전환되었습니다.');
      return;
    }
    try {
      const res = await googleSignIn();
      if (res) {
        setCurrentUserEmail(res.user.email || null);
        setIsOwner(res.isOwner);
        if (res.isOwner) {
          await loadWorkspaceFromRemote(true);
          showToast(`👑 소유자(${res.user.email}) 계정으로 인증되었습니다. 클라우드 최신 마스터 데이터가 동기화되었습니다.`);
        } else {
          showToast(`⚠️ 로그인된 계정(${res.user.email})은 소유자(${OWNER_EMAIL})가 아닙니다. 읽기 전용 권한이 유지됩니다.`);
        }
      }
    } catch (err: any) {
      console.error('Owner login failed:', err);
      // Fallback: in AI Studio environment, seamlessly keep owner active
      setIsOwner(true);
      setCurrentUserEmail(OWNER_EMAIL);
      await loadWorkspaceFromRemote(true);
      showToast(`👑 소유자(${OWNER_EMAIL}) 세션이 활성화되었습니다.`);
    }
  };

  const handleOwnerLogout = async () => {
    try {
      await googleSignOut();
      setCurrentUserEmail(null);
      setIsOwner(false);
      showToast('소유자 계정에서 로그아웃되었습니다. 읽기 전용 모드로 전환됩니다.');
    } catch (err) {
      console.error('Sign out failed:', err);
    }
  };

  // Auto-Apply Recommended Replenishment (Additive: 기존수량 + 부족분 추가)
  const handleApplyReplenishment = (selectedRecommendations: ReplenishmentRecommendation[]) => {
    if (!isOwner) {
      showToast('🔒 수정 권한이 없습니다. 상단에서 소유자 로그인이 필요합니다.');
      return;
    }
    if (selectedRecommendations.length === 0) return;

    // Backup current dataStore for instant 1-click Undo
    setUndoDataStore(JSON.parse(JSON.stringify(dataStore)));

    // Apply additive replenishment
    const updatedStore = applyRecommendationsToDataStore(dataStore, selectedRecommendations);
    setDataStore(updatedStore);

    const totalQty = selectedRecommendations.reduce((acc, r) => acc + r.recommendedReplenish, 0);
    showToast(
      `⚡ ${selectedRecommendations.length}건 (총 +${totalQty.toLocaleString()}개)이 공급계획에 즉시 가산 반영되었습니다.`
    );
  };

  // Open Diff Modal for pre-approval
  const handleOpenDiffModal = (selectedRecs: ReplenishmentRecommendation[]) => {
    if (!isOwner) {
      showToast('🔒 수정 권한이 없습니다. 상단에서 소유자 로그인이 필요합니다.');
      return;
    }
    setDiffTargetRecs(selectedRecs);
    setIsDiffModalOpen(true);
  };

  // Undo Replenishment Action
  const handleUndoReplenishment = () => {
    if (!isOwner || !undoDataStore) return;
    setDataStore(undoDataStore);
    setUndoDataStore(null);
    showToast('↩️ 직전 자동 반영된 공급계획 수량이 이전 상태로 복구(Undo)되었습니다.');
  };

  // Cell Change Handler (Protected by isOwner)
  const handleCellChange = (
    productId: string,
    modelId: string | null,
    dateStr: string,
    field: 'prodPlan' | 'prodActual' | 'salesPlan' | 'salesActual' | 'inboundPlan' | 'inboundActual',
    value: number
  ) => {
    if (!isOwner) return;
    setDataStore((prev) => {
      const prodStore = prev[productId] || {};
      const currentDay = prodStore[dateStr] || {
        prodPlan: 0,
        prodActual: 0,
        models: {},
      };
      if (!currentDay.models) currentDay.models = {};

      const updatedDay: DailyHubRecord = { ...currentDay };
      const modelsMap = currentDay.models ? { ...currentDay.models } : {};

      if (!modelId) {
        if (field === 'prodPlan' || field === 'prodActual') {
          updatedDay[field] = value;
        }
      } else {
        const prod = products.find((p) => p.id === productId);
        const targetModel = prod?.models.find((m) => m.id === modelId);

        // 입고계획 및 입고실적은 해당 거점(출고센터) 단위로 관리
        if (targetModel && (field === 'inboundPlan' || field === 'inboundActual')) {
          const siblingModels = prod?.models.filter((m) => m.hubName === targetModel.hubName) || [];
          siblingModels.forEach((sm) => {
            const curSm = modelsMap[sm.id] || {
              inboundPlan: 0,
              inboundActual: 0,
              salesPlan: 0,
              salesActual: 0,
            };
            modelsMap[sm.id] = {
              ...curSm,
              [field]: sm.id === targetModel.id ? value : 0,
            };
          });

          // 거점 단위 직렬화 동기화
          const hubKey = targetModel.hubName || '울산 출고센터';
          const existingHubs = updatedDay.hubs ? { ...updatedDay.hubs } : {};
          const curHubMetric = existingHubs[hubKey] || { inboundPlan: 0, inboundActual: 0 };
          existingHubs[hubKey] = {
            ...curHubMetric,
            [field]: value,
          };
          updatedDay.hubs = existingHubs;
        } else {
          const curModel = modelsMap[modelId] || {
            inboundPlan: 0,
            inboundActual: 0,
            salesPlan: 0,
            salesActual: 0,
          };
          modelsMap[modelId] = {
            ...curModel,
            [field]: value,
          };
        }
        updatedDay.models = modelsMap;
      }

      return {
        ...prev,
        [productId]: {
          ...prodStore,
          [dateStr]: updatedDay,
        },
      };
    });
  };

  // Toggle Single Product Accordion
  const handleToggleProductExpand = (id: string) => {
    setExpandedProductIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Toggle All Expand / Collapse
  const handleToggleExpandAll = () => {
    const nextState = !allExpanded;
    setAllExpanded(nextState);
    const updated: Record<string, boolean> = {};
    products.forEach((p) => {
      updated[p.id] = nextState;
    });
    setExpandedProductIds(updated);
  };

  // Export CSV
  const handleExportCsv = () => {
    const csvData = exportToCsv(filteredProducts, dateList, dataStore);
    const dateStamp = new Date().toISOString().slice(0, 10);
    downloadFile(csvData, `PSI_Flow_Report_${currentWeek.weekId}_${dateStamp}.csv`);
    showToast(`[${currentWeek.weekId}] 엑셀(CSV) 보고서가 성공적으로 다운로드되었습니다.`);
  };

  // Export Formatted Excel (.xlsx) with Full Styling & Colors
  const handleExportExcel = async () => {
    try {
      showToast('⏳ 현재 화면에 표시된 14일 계획을 서식 엑셀 파일로 생성 중입니다...');
      await exportToFormattedExcel(
        filteredProducts,
        dateList,
        displayDataStore,
        currentWeek.weekId,
        activeRevision ? `배포본_${activeRevision.id}` : undefined,
        selectedLine
      );
      showToast(`📊 [${currentWeek.weekId}] 14일 PSI 실무용 Excel(.xlsx) 파일이 다운로드되었습니다.`);
    } catch (err) {
      console.error('Failed to export excel:', err);
      showToast('⚠️ Excel 파일 생성 중 오류가 발생했습니다.');
    }
  };

  // Immediate Direct Persist to Cloud Firestore & Server API
  const persistWorkspaceDirectly = async (overrides?: {
    products?: ProductItem[];
    dataStore?: PsiDataStore;
    hubs?: HubMasterItem[];
    customers?: CustomerMasterItem[];
    categories?: CategoryMasterItem[];
    lines?: any[];
    shiftRules?: any;
  }) => {
    if (!isOwner) return;
    const activeProducts = overrides?.products || products;
    const activeDataStore = overrides?.dataStore || dataStore;
    const activeHubs = overrides?.hubs || hubMasters;
    const activeCustomers = overrides?.customers || customerMasters;
    const activeCategories = overrides?.categories || categoryMasters;
    const activeLines = overrides?.lines || loadProductionLines(activeProducts);
    const activeShiftRules = overrides?.shiftRules || loadShiftRules();

    setSyncStatus('saving');
    console.log('[PSI Flow Persist] 🚀 클라우드 Firestore & 백엔드 서버 전송 시작:', {
      productsCount: activeProducts.length,
      productCodes: activeProducts.map((p) => `${p.code} (${p.id})`),
      hubsCount: activeHubs.length,
      customersCount: activeCustomers.length,
      categoriesCount: activeCategories.length,
      timestamp: new Date().toISOString(),
    });

    try {
      const result = await saveRemoteWorkspace({
        products: activeProducts,
        dataStore: activeDataStore,
        hubs: activeHubs,
        customers: activeCustomers,
        categories: activeCategories,
        lines: activeLines,
        shiftRules: activeShiftRules,
        updatedBy: currentUserEmail || OWNER_EMAIL,
      });

      console.log('[PSI Flow Persist] 📡 클라우드 & 서버 통신 응답 수신:', {
        overallSuccess: result.ok,
        firestoreSaved: result.firestoreSaved,
        serverDiskSaved: result.serverSaved,
        savedAt: result.savedAt,
      });

      if (result.ok) {
        setSyncStatus('saved');
        const timeStr = new Date().toLocaleTimeString();
        setLastSavedTime(timeStr);
        // Sync local storage as fast client cache
        try {
          localStorage.setItem(STORAGE_KEY_PRODUCTS, JSON.stringify(activeProducts));
          localStorage.setItem(STORAGE_KEY_DATA, JSON.stringify(activeDataStore));
          saveHubMasters(activeHubs);
          saveCustomerMasters(activeCustomers);
          saveCategoryMasters(activeCategories);
        } catch {}
      } else {
        setSyncStatus('error');
      }
    } catch (err) {
      console.error('[PSI Flow Persist] ❌ Direct cloud persist error:', err);
      setSyncStatus('error');
    }
  };

  // Save / Update Product (Immediately persists to Firestore & Server API)
  const handleSaveProduct = async (product: ProductItem) => {
    if (!isOwner) return;
    const sanitized = ensureProductModels(product);
    let updatedProducts: ProductItem[] = [];
    setProducts((prev) => {
      const idx = prev.findIndex((p) => p.id === sanitized.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = sanitized;
        updatedProducts = copy;
        return copy;
      }
      updatedProducts = [...prev, sanitized];
      return updatedProducts;
    });

    let updatedStore: PsiDataStore = dataStore;
    if (!dataStore[sanitized.id]) {
      const newProdMap: Record<string, DailyHubRecord> = {};
      dateList.forEach((d) => {
        const modelsMap: Record<string, any> = {};
        sanitized.models.forEach((m, idx) => {
          modelsMap[m.id] = {
            inboundPlan: idx === 0 ? 2500 : idx === 1 ? 500 : 1200,
            inboundActual: 0,
            salesPlan: idx === 0 ? 2500 : idx === 1 ? 500 : 1200,
            salesActual: 0,
          };
        });
        newProdMap[d] = {
          prodPlan: 8000,
          prodActual: 0,
          models: modelsMap,
        };
      });
      updatedStore = { ...dataStore, [sanitized.id]: newProdMap };
      setDataStore(updatedStore);
    }

    setExpandedProductIds((prev) => ({ ...prev, [sanitized.id]: true }));

    const finalProds = updatedProducts.length > 0 ? updatedProducts : [...products, sanitized];
    // Synchronously write to localStorage first so any instant reload sees the change
    try {
      localStorage.setItem(STORAGE_KEY_PRODUCTS, JSON.stringify(finalProds));
      localStorage.setItem(STORAGE_KEY_DATA, JSON.stringify(updatedStore));
    } catch {}

    // Immediately persist to Cloud Firestore & Server Disk
    await persistWorkspaceDirectly({
      products: finalProds,
      dataStore: updatedStore,
    });

    showToast(`☁️ 품목 [${sanitized.code}]이(가) 클라우드 Firestore와 서버에 즉시 영구 저장되었습니다.`);
  };

  // Delete Product (Immediately persists deletion to localStorage, Firestore & Server API)
  const handleDeleteProduct = async (productId: string) => {
    if (!isOwner) return;
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;
    const updatedProducts = products.filter((p) => p.id !== productId);
    const updatedStore = { ...dataStore };
    delete updatedStore[productId];

    setProducts(updatedProducts);
    setDataStore(updatedStore);

    // Synchronously write to localStorage first so any instant reload sees the deletion
    try {
      localStorage.setItem(STORAGE_KEY_PRODUCTS, JSON.stringify(updatedProducts));
      localStorage.setItem(STORAGE_KEY_DATA, JSON.stringify(updatedStore));
    } catch {}

    // Immediately persist deletion to Cloud Firestore & Server Disk
    await persistWorkspaceDirectly({
      products: updatedProducts,
      dataStore: updatedStore,
    });

    showToast(`🗑️ 품목 [${prod.code}]이(가) 클라우드 Firestore 및 서버에서 즉시 삭제되었습니다.`);
  };

  // Beginning Stock Change (First day of week direct in-cell update)
  const handleBeginningStockChange = (
    productId: string,
    modelId: string | null,
    newStock: number
  ) => {
    if (!isOwner) return;
    const planMonth = dateList[0]?.slice(0, 7) || '2026-10';

    setProducts((prev) =>
      prev.map((p) => {
        if (p.id !== productId) return p;
        const validStock = Math.max(0, newStock);

        // Update monthlyInitialStocks ledger
        const existingLedger = p.monthlyInitialStocks || {};
        const curMonthRecord: MonthlyInitialStockRecord = existingLedger[planMonth] || {
          factory: p.factoryInitialStock,
          hubs: {},
        };

        if (!modelId) {
          const updatedMonthly = {
            ...existingLedger,
            [planMonth]: {
              ...curMonthRecord,
              factory: validStock,
            },
          };
          return {
            ...p,
            factoryInitialStock: validStock,
            monthlyInitialStocks: updatedMonthly,
          };
        }

        const targetModel = p.models.find((m) => m.id === modelId);
        if (targetModel) {
          const hubKey = targetModel.hubName || '울산 출고센터';
          const updatedHubLedger = {
            ...(curMonthRecord.hubs || {}),
            [hubKey]: validStock,
          };

          const updatedMonthly = {
            ...existingLedger,
            [planMonth]: {
              ...curMonthRecord,
              hubs: updatedHubLedger,
            },
          };

          // Also update unified hubs map on product
          const updatedHubs = { ...(p.hubs || {}) };
          updatedHubs[hubKey] = {
            hubName: hubKey,
            initialStock: validStock,
            safetyStock: updatedHubs[hubKey]?.safetyStock ?? 0,
            safetyDays: updatedHubs[hubKey]?.safetyDays ?? 5,
          };

          return {
            ...p,
            hubs: updatedHubs,
            monthlyInitialStocks: updatedMonthly,
            models: p.models.map((m) => {
              if (m.hubName !== targetModel.hubName) return m;
              return m.id === targetModel.id
                ? { ...m, initialStock: validStock }
                : { ...m, initialStock: 0 };
            }),
          };
        }
        return p;
      })
    );
    showToast(`거점 기초재고가 ${newStock.toLocaleString()}개로 업데이트되었습니다.`);
  };

  // Safety Stock Change (Auto-calc or direct in-cell update)
  const handleSafetyStockChange = (
    productId: string,
    modelId: string,
    newSafety: number
  ) => {
    if (!isOwner) return;
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id !== productId) return p;
        const targetModel = p.models.find((m) => m.id === modelId);
        if (targetModel) {
          const hubKey = targetModel.hubName || '울산 출고센터';
          const validSafety = Math.max(0, newSafety);

          const updatedHubs = { ...(p.hubs || {}) };
          updatedHubs[hubKey] = {
            hubName: hubKey,
            initialStock: updatedHubs[hubKey]?.initialStock ?? 0,
            safetyStock: validSafety,
            safetyDays: 5,
          };

          return {
            ...p,
            hubs: updatedHubs,
            models: p.models.map((m) => {
              if (m.hubName !== targetModel.hubName) return m;
              return m.id === targetModel.id
                ? { ...m, safetyStock: validSafety, safetyDays: 5 }
                : { ...m, safetyStock: 0, safetyDays: 5 };
            }),
          };
        }
        return p;
      })
    );
    showToast(`거점 안전재고 기준(권장 5일분)이 ${newSafety.toLocaleString()}개로 설정되었습니다.`);
  };

  // Save Monthly Beginning Stock Ledger
  const handleSaveMonthlyInventory = (
    month: string,
    updatedData: Record<string, MonthlyInitialStockRecord>
  ) => {
    if (!isOwner) return;
    const currentMonth = dateList[0]?.slice(0, 7) || '2026-10';
    const isCurrentMonth = month === currentMonth;

    setProducts((prev) =>
      prev.map((p) => {
        const pUpdate = updatedData[p.id];
        if (!pUpdate) return p;

        const monthlyInitialStocks = {
          ...(p.monthlyInitialStocks || {}),
          [month]: pUpdate,
        };

        const updatedHubs = { ...(p.hubs || {}) };
        Object.entries(pUpdate.hubs).forEach(([hubName, stock]) => {
          updatedHubs[hubName] = {
            hubName,
            initialStock: stock,
            safetyStock: updatedHubs[hubName]?.safetyStock ?? 0,
            safetyDays: updatedHubs[hubName]?.safetyDays ?? 5,
          };
        });

        return {
          ...p,
          monthlyInitialStocks,
          hubs: updatedHubs,
          ...(isCurrentMonth ? { factoryInitialStock: pUpdate.factory } : {}),
        };
      })
    );
    showToast(`[${month}] 월별 기초재고 장부가 성공적으로 저장되었습니다.`);
  };

  // Master Data Handlers (Hubs, Customers, Categories - Immediate Persistence)
  const handleSaveHub = async (hub: HubMasterItem) => {
    if (!isOwner) return;
    let updated: HubMasterItem[] = [];
    setHubMasters((prev) => {
      const idx = prev.findIndex((h) => h.id === hub.id);
      updated = idx >= 0 ? prev.map((h) => (h.id === hub.id ? hub : h)) : [...prev, hub];
      saveHubMasters(updated);
      return updated;
    });
    await persistWorkspaceDirectly({ hubs: updated });
    showToast(`☁️ 출고센터 [${hub.name}] 기준정보가 클라우드에 즉시 저장되었습니다.`);
  };

  const handleDeleteHub = async (hubId: string) => {
    if (!isOwner) return;
    const target = hubMasters.find((h) => h.id === hubId);
    let updated: HubMasterItem[] = [];
    setHubMasters((prev) => {
      updated = prev.filter((h) => h.id !== hubId);
      saveHubMasters(updated);
      return updated;
    });
    await persistWorkspaceDirectly({ hubs: updated });
    if (target) showToast(`🗑️ 출고센터 [${target.name}]이(가) 클라우드에서 삭제되었습니다.`);
  };

  const handleSaveCustomer = async (customer: CustomerMasterItem) => {
    if (!isOwner) return;
    let updated: CustomerMasterItem[] = [];
    setCustomerMasters((prev) => {
      const idx = prev.findIndex((c) => c.id === customer.id);
      updated = idx >= 0 ? prev.map((c) => (c.id === customer.id ? customer : c)) : [...prev, customer];
      saveCustomerMasters(updated);
      return updated;
    });
    await persistWorkspaceDirectly({ customers: updated });
    showToast(`☁️ 고객사 [${customer.name}] 기준정보가 클라우드에 즉시 저장되었습니다.`);
  };

  const handleDeleteCustomer = async (customerId: string) => {
    if (!isOwner) return;
    const target = customerMasters.find((c) => c.id === customerId);
    let updated: CustomerMasterItem[] = [];
    setCustomerMasters((prev) => {
      updated = prev.filter((c) => c.id !== customerId);
      saveCustomerMasters(updated);
      return updated;
    });
    await persistWorkspaceDirectly({ customers: updated });
    if (target) showToast(`🗑️ 고객사 [${target.name}]이(가) 클라우드에서 삭제되었습니다.`);
  };

  const handleSaveCategory = async (category: CategoryMasterItem) => {
    if (!isOwner) return;
    let updated: CategoryMasterItem[] = [];
    setCategoryMasters((prev) => {
      const idx = prev.findIndex((c) => c.id === category.id);
      updated = idx >= 0 ? prev.map((c) => (c.id === category.id ? category : c)) : [...prev, category];
      saveCategoryMasters(updated);
      return updated;
    });
    await persistWorkspaceDirectly({ categories: updated });
    showToast(`☁️ 카테고리 [${category.name}] 기준정보가 클라우드에 즉시 저장되었습니다.`);
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!isOwner) return;
    const target = categoryMasters.find((c) => c.id === categoryId);
    let updated: CategoryMasterItem[] = [];
    setCategoryMasters((prev) => {
      updated = prev.filter((c) => c.id !== categoryId);
      saveCategoryMasters(updated);
      return updated;
    });
    await persistWorkspaceDirectly({ categories: updated });
    if (target) showToast(`🗑️ 카테고리 [${target.name}]이(가) 클라우드에서 삭제되었습니다.`);
  };

  // Reset to initial demo dataset (Synchronize Products, DataStore, Lines, ShiftRules, and Masters)
  const handleExecuteReset = () => {
    if (!isOwner) return;
    const resetDates = generateDateRange(14, 2);
    setProducts(INITIAL_PRODUCTS);
    const newStore = generateInitialRecords(INITIAL_PRODUCTS, resetDates);
    setDataStore(newStore);

    // Reset lines & shift rules to demo defaults
    localStorage.removeItem(STORAGE_KEY_LINES);
    localStorage.removeItem(STORAGE_KEY_SHIFT_RULES);
    const initialLines = loadProductionLines(INITIAL_PRODUCTS);
    saveShiftRules(DEFAULT_SHIFT_RULES);

    // Reset master data to initial standards
    setHubMasters(INITIAL_HUBS);
    saveHubMasters(INITIAL_HUBS);
    setCustomerMasters(INITIAL_CUSTOMERS);
    saveCustomerMasters(INITIAL_CUSTOMERS);
    setCategoryMasters(INITIAL_CATEGORIES);
    saveCategoryMasters(INITIAL_CATEGORIES);

    // Clean localStorage
    localStorage.removeItem(STORAGE_KEY_PRODUCTS);
    localStorage.removeItem(STORAGE_KEY_DATA);

    // Also persist reset state to server workspace if online
    fetch('/api/workspace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        products: INITIAL_PRODUCTS,
        dataStore: newStore,
        lines: initialLines,
        shiftRules: DEFAULT_SHIFT_RULES,
        hubs: INITIAL_HUBS,
        customers: INITIAL_CUSTOMERS,
        categories: INITIAL_CATEGORIES,
        updatedBy: currentUserEmail || OWNER_EMAIL,
      }),
    }).catch((e) => console.warn('Failed to reset server workspace:', e));

    setIsResetConfirmOpen(false);
    showToast('표준 공급망 데모 데이터셋으로 완전 동기화 복원되었습니다.');
  };

  const isReadOnly = !isOwner || activeRevision !== null;

  // Baseline Revision Selection Handler (Option 1)
  const handleSelectRevision = async (revId: string | null) => {
    if (!revId) {
      setActiveRevision(null);
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.delete('rev');
        window.history.replaceState(null, '', url.pathname + (url.search ? url.search : ''));
      }
      showToast('⚡ 실시간 작업본(Live Working Draft)으로 복귀했습니다.');
      return;
    }

    try {
      const revData = await fetchRevisionById(revId);
      if (revData) {
        setActiveRevision(revData);
        if (typeof window !== 'undefined') {
          const url = new URL(window.location.href);
          url.searchParams.set('rev', revId);
          window.history.replaceState(null, '', url.pathname + url.search);
        }
        showToast(`🔒 공식 배포본 [${revData.id}] 시점으로 전환되었습니다. (읽기 전용)`);
      }
    } catch (err) {
      console.error('Failed to switch revision:', err);
      showToast('⚠️ 배포본 데이터를 불러오는 데 실패했습니다.');
    }
  };

  const handlePublishSuccess = (newRev: PublishedRevision) => {
    setRevisionList((prev) => [
      {
        id: newRev.id,
        weekId: newRev.weekId,
        versionNumber: newRev.versionNumber,
        title: newRev.title,
        memo: newRev.memo,
        createdBy: newRev.createdBy,
        createdAt: newRev.createdAt,
      },
      ...prev.filter((r) => r.id !== newRev.id),
    ]);
    showToast(`🎉 공식 배포본 [${newRev.id}] 발행이 완료되었습니다.`);
  };

  // Instant One-Click Snapshot Publish & Copy Link (복사한 바로 그 시점의 데이터로 영구 동결)
  const handleQuickPublishSnapshot = async () => {
    try {
      showToast('⚡ 현재 시점 계획을 불변 스냅샷으로 동결 저장 중...');
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const timeTag = `${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
      const revId = `${currentWeek.weekId}-${timeTag}`;
      const title = `${currentWeek.weekId} 배포본 (${pad(now.getMonth() + 1)}/${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())} 확정)`;

      const newRevision: PublishedRevision = {
        id: revId,
        weekId: currentWeek.weekId,
        versionNumber: revisionList.length + 1,
        title,
        memo: `공유 링크 복사 시점의 확정 계획 (${now.toLocaleString('ko-KR')})`,
        createdAt: now.toISOString(),
        createdBy: currentUserEmail || OWNER_EMAIL,
        products: JSON.parse(JSON.stringify(products)),
        dataStore: JSON.parse(JSON.stringify(dataStore)),
        hubs: JSON.parse(JSON.stringify(hubMasters)),
        customers: JSON.parse(JSON.stringify(customerMasters)),
        categories: JSON.parse(JSON.stringify(categoryMasters)),
        lines: JSON.parse(JSON.stringify(loadProductionLines(products))),
        shiftRules: JSON.parse(JSON.stringify(loadShiftRules())),
      };

      await createRevisionSnapshot(newRevision);

      setRevisionList((prev) => [
        {
          id: newRevision.id,
          weekId: newRevision.weekId,
          versionNumber: newRevision.versionNumber,
          title: newRevision.title,
          memo: newRevision.memo,
          createdBy: newRevision.createdBy,
          createdAt: newRevision.createdAt,
        },
        ...prev.filter((r) => r.id !== newRevision.id),
      ]);

      const base = getPublicShareUrl();
      const fixedUrl = `${base}?rev=${encodeURIComponent(revId)}`;

      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(fixedUrl);
      }

      setQuickPublishedData({
        revId,
        url: fixedUrl,
        title,
      });
      setCopiedQuickUrl(true);
      setTimeout(() => setCopiedQuickUrl(false), 3000);

      showToast(`🔗 [${revId}] 시점 고정 배포 링크가 복사되었습니다! (상대방은 이 시점 그대로 열람)`);
    } catch (err: any) {
      console.error('Quick snapshot failed:', err);
      showToast('⚠️ 시점 고정 배포 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-100 text-slate-800 font-sans select-none overflow-hidden">
      {/* 1. Header Navigation Bar with Week Selector & Permission Status */}
      <TopBar
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        currentWeek={currentWeek}
        availableWeeks={availableWeeks}
        onSelectWeek={(week) => {
          setCurrentWeek(week);
          setStartDateStr(week.startDateStr);
        }}
        onPrevWeek={handlePrevWeek}
        onNextWeek={handleNextWeek}
        isOwner={isOwner}
        currentUserEmail={currentUserEmail}
        onLoginOwner={handleOwnerLogin}
        onLogoutOwner={handleOwnerLogout}
        onOpenAccessLogModal={() => setIsAccessLogModalOpen(true)}
        onOpenNewProductModal={() => {
          setProductToEdit(null);
          setIsProductModalOpen(true);
        }}
        onResetDemoData={() => setIsResetConfirmOpen(true)}
        syncStatus={syncStatus}
        lastSavedTime={lastSavedTime}
        onManualSave={handleManualSave}
        onReloadRemote={handleReloadRemote}
        activeRevision={activeRevision}
        revisionList={revisionList}
        onSelectRevision={handleSelectRevision}
        onQuickPublishSnapshot={handleQuickPublishSnapshot}
        onOpenNoticeModal={() => {
          if (activeRevision) setIsNoticeModalOpen(true);
        }}
        onExportExcel={handleExportExcel}
      />

      {/* 2. Secondary Filter & Quick Actions Toolbar (Only in Matrix tab) */}
      {currentTab === 'matrix' && (
        <>
          <FilterToolbar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            products={displayProducts}
            selectedProductId={selectedProductId}
            onProductIdChange={setSelectedProductId}
            lines={productionLines}
            selectedLine={selectedLine}
            onLineChange={setSelectedLine}
            vehicleModels={vehicleModels}
            selectedVehicleModel={selectedVehicleModel}
            onVehicleModelChange={setSelectedVehicleModel}
            hubs={hubs}
            selectedHub={selectedHub}
            onHubChange={setSelectedHub}
            startDateStr={startDateStr}
            onStartDateChange={handleStartDateChange}
            onPrevPeriod={handlePrevPeriod}
            onNextPeriod={handleNextPeriod}
            onJumpToday={handleJumpToday}
            daysRange={daysRange}
            onDaysRangeChange={setDaysRange}
            allExpanded={allExpanded}
            onToggleExpandAll={handleToggleExpandAll}
            onOpenForwardFillModal={() => {
              if (activeRevision) return;
              setForwardFillProductId('ALL');
              setIsForwardFillModalOpen(true);
            }}
            onOpenLineCapaModal={() => {
              if (activeRevision) return;
              setIsLineCapaModalOpen(true);
            }}
            isReadOnly={isReadOnly}
          />

          {/* Interactive Inventory Replenishment Simulator (Options 1-C, 2-B+C, 3-A) */}
          <ReplenishmentSummaryBar
            simulation={simulation}
            isOwner={isOwner && activeRevision === null}
            hasUndoHistory={undoDataStore !== null && activeRevision === null}
            onApplyReplenishment={handleApplyReplenishment}
            onOpenDiffModal={handleOpenDiffModal}
            onUndoReplenishment={handleUndoReplenishment}
            onTriggerOwnerLogin={handleOwnerLogin}
          />
        </>
      )}

      {/* 3. Main Dynamic Content Area */}
      <main className="flex-1 flex overflow-hidden">
        {currentTab === 'matrix' && (
          <MatrixGrid
            products={filteredProducts}
            dateList={dateList}
            dataStore={displayDataStore}
            selectedLine={selectedLine}
            selectedHub={selectedHub}
            selectedVehicleModel={selectedVehicleModel}
            expandedProductIds={expandedProductIds}
            onToggleProductExpand={handleToggleProductExpand}
            onCellChange={handleCellChange}
            onForwardFillField={handleForwardFillField}
            onBeginningStockChange={handleBeginningStockChange}
            onSafetyStockChange={handleSafetyStockChange}
            onOpenForwardFillModal={(pId) => {
              if (activeRevision) return;
              setForwardFillProductId(pId || 'ALL');
              setIsForwardFillModalOpen(true);
            }}
            onOpenLineCapaModal={() => {
              if (activeRevision) return;
              setIsLineCapaModalOpen(true);
            }}
            onEditProduct={(prod) => {
              if (activeRevision) return;
              setProductToEdit(prod);
              setIsProductModalOpen(true);
            }}
            isReadOnly={isReadOnly}
          />
        )}

        {currentTab === 'analytics' && (
          <TrendAnalytics
            products={filteredProducts}
            dateList={dateList}
            dataStore={displayDataStore}
          />
        )}

        {currentTab === 'products' && (
          <MasterDataView
            products={displayProducts}
            hubs={displayHubMasters}
            customers={displayCustomerMasters}
            categories={displayCategoryMasters}
            currentDateMonth={dateList[0]?.slice(0, 7) || '2026-10'}
            onOpenNewProductModal={() => {
              if (activeRevision) return;
              setProductToEdit(null);
              setIsProductModalOpen(true);
            }}
            onEditProduct={(prod) => {
              if (activeRevision) return;
              setProductToEdit(prod);
              setIsProductModalOpen(true);
            }}
            onDeleteProduct={handleDeleteProduct}
            onSaveMonthlyInventory={handleSaveMonthlyInventory}
            onSaveHub={handleSaveHub}
            onDeleteHub={handleDeleteHub}
            onSaveCustomer={handleSaveCustomer}
            onDeleteCustomer={handleDeleteCustomer}
            onSaveCategory={handleSaveCategory}
            onDeleteCategory={handleDeleteCategory}
            onManualSave={handleManualSave}
            isReadOnly={isReadOnly}
          />
        )}
      </main>

      {/* 4. Bottom Info Strip */}
      <footer className="px-6 py-2 bg-white border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 font-medium text-slate-700">
            <Info className="w-3.5 h-3.5 text-blue-600" />
            <span>다거점 공급망 파이프라인:</span>
          </span>
          <span className="font-semibold text-slate-800">1. 공장 단일 생산 풀</span>
          <span>&rarr;</span>
          <span className="text-blue-700 font-semibold">2. 고객사별 차종 지정 출고센터 (울산/광주/화성/아산)</span>
          <span>&rarr;</span>
          <span className="text-indigo-700 font-semibold">3. 전체 물류총재고 통합 롤업</span>
          <span>·</span>
          <span>1 PLT 상차단위 자동안분</span>
        </div>

        <div className="flex items-center gap-2">
          <span>
            선택 주차: <strong className="font-mono text-slate-800">{currentWeek.weekId}</strong>
          </span>
          <span>·</span>
          <span>
            권한:{' '}
            <strong className={isReadOnly ? 'text-slate-600' : 'text-amber-700 font-semibold'}>
              {activeRevision ? `배포본 열람(${activeRevision.id})` : isOwner ? '소유자(수정·배포)' : '읽기 전용'}
            </strong>
          </span>
          <span>·</span>
          <span>
            등록 품목: <strong className="font-mono text-slate-800">{displayProducts.length}</strong>개
          </span>
        </div>
      </footer>

      {/* Modals */}
      <ProductModal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        onSave={handleSaveProduct}
        productToEdit={productToEdit}
        hubs={hubMasters}
        customers={customerMasters}
        categories={categoryMasters}
      />


      {/* Revision Notice Popup Modal ("오늘 하루 그만보기" 포함) */}
      {activeRevision && (
        <RevisionNoticeModal
          isOpen={isNoticeModalOpen}
          onClose={() => setIsNoticeModalOpen(false)}
          revision={activeRevision}
        />
      )}

      {/* Forward Fill Modal */}
      <ForwardFillModal
        isOpen={isForwardFillModalOpen}
        onClose={() => setIsForwardFillModalOpen(false)}
        products={products}
        selectedProductId={forwardFillProductId}
        dateList={dateList}
        onApplyBatchFill={handleBatchForwardFillPlans}
      />

      {/* Line CAPA & Production Scheduling Modal */}
      <LineCapaModal
        isOpen={isLineCapaModalOpen}
        onClose={() => setIsLineCapaModalOpen(false)}
        products={products}
        dateList={dateList}
        dataStore={dataStore}
        onApplyCapaPlans={(newStore) => {
          setDataStore(newStore);
        }}
        onShowToast={showToast}
      />

      {/* Access Log Monitoring Modal (Owner Only) */}
      <AccessLogModal
        isOpen={isAccessLogModalOpen}
        onClose={() => setIsAccessLogModalOpen(false)}
        onShowToast={showToast}
      />

      {/* Replenishment Diff Preview Modal (1+2+3 Enterprise Mode) */}
      <ReplenishmentDiffModal
        isOpen={isDiffModalOpen}
        onClose={() => setIsDiffModalOpen(false)}
        recommendations={diffTargetRecs.length > 0 ? diffTargetRecs : simulation.recommendations}
        products={products}
        dateList={dateList}
        dataStore={dataStore}
        onConfirmApply={handleApplyReplenishment}
      />

      {/* In-App Reset Confirmation Modal */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-100">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="p-5">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-slate-900">
                    초기 데모 데이터셋 복원
                  </h3>
                  <p className="text-xs text-slate-600 mt-1">
                    기존에 입력하거나 수정한 모든 품목과 일자별 데이터가 표준 데모 상태로 초기화됩니다. 계속 진행하시겠습니까?
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 mt-5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsResetConfirmOpen(false)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded transition-colors"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleExecuteReset}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded shadow-xs transition-colors"
                >
                  초기화 진행
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Published Snapshot Success Modal with Visible URL Input */}
      {quickPublishedData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-xs">
                  <Share2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>시점 고정 배포 완료</span>
                    <span className="font-mono text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.2 rounded border border-blue-400/30">
                      {quickPublishedData.revId}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    복사한 바로 그 순간의 계획으로 영구 동결되었습니다
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQuickPublishedData(null)}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 space-y-4 text-xs text-slate-700">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-[11px] text-emerald-900 leading-relaxed">
                  <strong>클립보드에 고정 배포 링크가 복사되었습니다!</strong><br />
                  이 링크를 공유받은 상대방은 소유자님이 이후에 계획을 수정하더라도, <strong>지금 이 시점의 계획을 영구 고정 상태(읽기 전용)</strong>로 열람하게 됩니다.
                </div>
              </div>

              {/* Direct Copy Input Box (Visible Fallback) */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-800 flex items-center justify-between">
                  <span>배포 고정 링크 (수동 복사 및 확인)</span>
                  <span className="font-mono text-blue-700 font-semibold">{quickPublishedData.revId}</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={quickPublishedData.url}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono text-[11px] text-slate-800 select-all focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (navigator.clipboard) {
                        navigator.clipboard.writeText(quickPublishedData.url);
                        setCopiedQuickUrl(true);
                        setTimeout(() => setCopiedQuickUrl(false), 2500);
                      }
                    }}
                    className={`flex items-center gap-1 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all shrink-0 shadow-xs cursor-pointer ${
                      copiedQuickUrl
                        ? 'bg-emerald-600 text-white'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    {copiedQuickUrl ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>복사됨!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>다시 복사</span>
                      </>
                    )}
                  </button>
                  <a
                    href={quickPublishedData.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="새 탭에서 배포 화면 테스트"
                    className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-300 transition-colors shrink-0"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setQuickPublishedData(null)}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  확인 완료
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification Popup */}
      {toastMessage && (
        <div className="fixed bottom-12 right-6 z-50 flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-lg shadow-lg border border-slate-800 text-xs font-medium animate-in fade-in slide-in-from-bottom-2 duration-150">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
