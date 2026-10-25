// ที่อยู่ backend
// - ตั้งเองได้ที่ frontend/.env  เช่น VITE_API_URL=http://192.168.1.10:3001/api
// - ไม่ตั้ง = ใช้ชื่อเครื่องเดียวกับที่เปิดหน้าเว็บ + พอร์ต 3001
//   (เปิดจากมือถือด้วย http://IP-ของเครื่อง:5173 ก็ใช้ได้เลย)
const BASE_URL =
  import.meta.env.VITE_API_URL ||
  `${window.location.protocol}//${window.location.hostname}:3001/api`

// =====================================================
// AUTH
// =====================================================

export const getToken = () =>
  localStorage.getItem('token')

export const getStaff = () => {
  try {
    return JSON.parse(
      localStorage.getItem('staff') || 'null'
    )
  } catch {
    return null
  }
}

// ฝ่ายของผู้ใช้ที่เข้าสู่ระบบ: 'sales' | 'stock' | 'admin' | null
export const getDept = () => {
  const staff = getStaff()

  if (!staff) return null
  if (staff.dept) return staff.dept

  const position = String(staff.position || '').toLowerCase()

  return ['admin', 'administrator', 'owner', 'manager'].includes(position)
    ? 'admin'
    : null
}

// =====================================================
// BRANCH
// =====================================================

const SELECTED_BRANCH_KEY =
  'poultryos_selected_branch_id'

const BRANCH_CHANGED_EVENT =
  'poultryos:branch-changed'

export const getSelectedBranchId = () => {
  return localStorage.getItem(
    SELECTED_BRANCH_KEY
  )
}

export const setSelectedBranchId = (
  branchId
) => {
  if (
    branchId === undefined ||
    branchId === null ||
    branchId === ''
  ) {
    localStorage.removeItem(
      SELECTED_BRANCH_KEY
    )

    window.dispatchEvent(
      new CustomEvent(
        BRANCH_CHANGED_EVENT,
        {
          detail: {
            branchId: null,
          },
        }
      )
    )

    return
  }

  const id = String(branchId)

  localStorage.setItem(
    SELECTED_BRANCH_KEY,
    id
  )

  window.dispatchEvent(
    new CustomEvent(
      BRANCH_CHANGED_EVENT,
      {
        detail: {
          branchId: id,
        },
      }
    )
  )
}

export const onBranchChange = (
  callback
) => {
  const handleCustomEvent = (
    event
  ) => {
    callback(
      event?.detail?.branchId || null
    )
  }

  const handleStorageEvent = (
    event
  ) => {
    if (
      event.key ===
      SELECTED_BRANCH_KEY
    ) {
      callback(
        event.newValue || null
      )
    }
  }

  window.addEventListener(
    BRANCH_CHANGED_EVENT,
    handleCustomEvent
  )

  window.addEventListener(
    'storage',
    handleStorageEvent
  )

  return () => {
    window.removeEventListener(
      BRANCH_CHANGED_EVENT,
      handleCustomEvent
    )

    window.removeEventListener(
      'storage',
      handleStorageEvent
    )
  }
}

// =====================================================
// LOGOUT / SESSION
// =====================================================

export const clearSession = () => {
  localStorage.removeItem('token')
  localStorage.removeItem('staff')
}

// =====================================================
// API FETCH
// =====================================================

async function apiFetch(
  path,
  options = {}
) {
  const token = getToken()

  const res = await fetch(
    `${BASE_URL}${path}`,
    {
      ...options,

      headers: {
        ...(options.body
          ? {
              'Content-Type':
                'application/json',
            }
          : {}),

        ...(token
          ? {
              Authorization:
                `Bearer ${token}`,
            }
          : {}),

        ...(options.headers || {}),
      },
    }
  )

  const text =
    await res.text()

  let data = null

  try {
    data = text
      ? JSON.parse(text)
      : null
  } catch {
    data = text
  }

  // ===================================================
  // TOKEN หมดอายุ / ไม่ถูกต้อง
  // ===================================================

  // (ยกเว้นหน้า login/register: รหัสผิดไม่ควรล้างเซสชันเดิม)
  if (res.status === 401 && !path.startsWith('/auth/')) {
    clearSession()

    if (
      window.location.pathname !==
        '/login' &&
      window.location.pathname !==
        '/admin/login'
    ) {
      window.location.href =
        '/login'
    }

    throw new Error(
      'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่'
    )
  }

  // ===================================================
  // ERROR อื่น ๆ
  // ===================================================

  if (!res.ok) {
    throw new Error(
      data?.error ||
        data?.message ||
        `HTTP ${res.status}`
    )
  }

  return data
}

// =====================================================
// POST
// =====================================================

const post = (
  path,
  body
) =>
  apiFetch(
    path,
    {
      method: 'POST',
      body: JSON.stringify(
        body
      ),
    }
  )

// =====================================================
// API
// =====================================================

export const api = {

  // ===================================================
  // LOGIN พนักงาน
  // ===================================================

  // identifier = รหัสพนักงาน หรือ เบอร์โทร
  // department (ไม่บังคับ) = 'sales' | 'stock'
  //   ใช้ตอนเข้า "ส่วนของอีกฝ่าย" ต้องเป็นบัญชีของฝ่ายนั้น (หรือแอดมิน)
  login: async (
    identifier,
    pin,
    department
  ) => {
    const data =
      await post(
        '/auth/login',
        {
          identifier,
          pin,
          ...(department
            ? { department }
            : {}),
        }
      )

    if (data?.token) {
      localStorage.setItem(
        'token',
        data.token
      )
    }

    if (data?.staff) {
      localStorage.setItem(
        'staff',
        JSON.stringify(
          data.staff
        )
      )
    }

    return data
  },

  // ===================================================
  // ลงทะเบียนพนักงานใหม่
  // ===================================================

  register: (
    payload
  ) =>
    post(
      '/auth/register',
      payload
    ),

  // ===================================================
  // LOGIN ADMIN
  // ===================================================

  adminLogin: async (
    staffId,
    pin
  ) => {
    const data =
      await post(
        '/auth/admin-login',
        {
          staffId,
          pin,
        }
      )

    // เก็บ Token
    if (data?.token) {
      localStorage.setItem(
        'token',
        data.token
      )
    }

    // เก็บข้อมูล Admin
    if (data?.staff) {
      localStorage.setItem(
        'staff',
        JSON.stringify(
          data.staff
        )
      )
    }

    return data
  },

  // ===================================================
  // BRANCH
  // ===================================================

  // ---------------------------------------------------
  // GET /api/branches
  //
  // ใช้สำหรับดึงรายชื่อสาขาทั้งหมด
  // จาก Backend:
  //
  // router.get('/', ...)
  // ---------------------------------------------------

  getBranches: async () => {
    return apiFetch(
      '/branches'
    )
  },

  // ---------------------------------------------------
  // GET สาขาที่กำลังเลือกอยู่
  // ---------------------------------------------------

  getSelectedBranchId: () => {
    return getSelectedBranchId()
  },

  // ---------------------------------------------------
  // เปลี่ยนสาขา
  // ---------------------------------------------------

  setSelectedBranchId: (
    branchId
  ) => {
    setSelectedBranchId(
      branchId
    )
  },

  // ---------------------------------------------------
  // ฟังการเปลี่ยนสาขา
  // ---------------------------------------------------

  onBranchChange: (
    callback
  ) => {
    return onBranchChange(
      callback
    )
  },

  // ===================================================
  // BRANCH ADMIN
  // ===================================================
  //
  // สำหรับหน้า Admin > จัดการสาขา
  //
  // Backend (routes/branches.js):
  // GET    /api/branches
  // POST   /api/branches
  // PUT    /api/branches/:id
  // DELETE /api/branches/:id
  //
  // ===================================================

  // สต็อกพร้อมขายของสาขา (ต้องล็อกอิน)
  getMenuStock: (
    branchId
  ) =>
    apiFetch(
      `/menus/${branchId}/stock`
    ),

  // ---------- โอนสต็อกระหว่างสาขา / จุดแจ้งเตือน ----------
  transferStock: (
    payload
  ) =>
    post(
      '/stock/transfer',
      payload
    ),

  setReorderPoint: (
    payload
  ) =>
    apiFetch(
      '/stock/ready/reorder',
      {
        method: 'PUT',
        headers: {
          'Content-Type':
            'application/json',
        },
        body: JSON.stringify(
          payload
        ),
      }
    ),

  // ---------- กะการขาย ----------
  getCurrentShift: (
    branchId
  ) =>
    apiFetch(
      `/shifts/current?branchId=${branchId}`
    ),

  getRecentShifts: (
    branchId
  ) =>
    apiFetch(
      `/shifts/recent?branchId=${branchId}`
    ),

  openShift: (
    payload
  ) =>
    post(
      '/shifts/open',
      payload
    ),

  closeShift: (
    payload
  ) =>
    post(
      '/shifts/close',
      payload
    ),

  // ---------- ค่าใช้จ่ายรายวัน ----------
  getExpenses: (
    branchId,
    date
  ) =>
    apiFetch(
      `/expenses?branchId=${branchId}${
        date ? `&date=${date}` : ''
      }`
    ),

  addExpense: (
    payload
  ) =>
    post(
      '/expenses',
      payload
    ),

  deleteExpense: (
    id
  ) =>
    apiFetch(
      `/expenses/${id}`,
      {
        method: 'DELETE',
      }
    ),

  // ---------- จัดการพนักงาน (Admin) ----------
  updateAdminStaff: (
    id,
    payload
  ) =>
    apiFetch(
      `/admin/staff/${id}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type':
            'application/json',
        },
        body: JSON.stringify(
          payload
        ),
      }
    ),

  setAdminStaffActive: (
    id,
    active
  ) =>
    apiFetch(
      `/admin/staff/${id}/active`,
      {
        method: 'PUT',
        headers: {
          'Content-Type':
            'application/json',
        },
        body: JSON.stringify({
          active,
        }),
      }
    ),

  resetAdminStaffPassword: (
    id,
    password
  ) =>
    apiFetch(
      `/admin/staff/${id}/password`,
      {
        method: 'PUT',
        headers: {
          'Content-Type':
            'application/json',
        },
        body: JSON.stringify({
          password,
        }),
      }
    ),

  // รายชื่อผู้ใช้งานระบบ (Admin เท่านั้น)
  getAdminStaff: () =>
    apiFetch(
      '/admin/staff'
    ),

  getAdminBranches: () =>
    apiFetch(
      '/branches'
    ),

  createBranch: (
    payload
  ) =>
    post(
      '/branches',
      payload
    ),

  updateBranch: (
    id,
    payload
  ) =>
    apiFetch(
      `/branches/${id}`,
      {
        method: 'PUT',
        body:
          JSON.stringify(
            payload
          ),
      }
    ),

  deleteBranch: (
    id
  ) =>
    apiFetch(
      `/branches/${id}`,
      {
        method: 'DELETE',
      }
    ),

  // ===================================================
  // MENU
  // ===================================================
  //
  // ส่ง branchId ไปด้วยเพื่อให้ได้เมนูของสาขานั้น
  // (backend /menus ต้องรับ branchId ไปกรอง)
  //
  // ===================================================

  getMenus: (
    category,
    branchId
  ) => {
    const params =
      new URLSearchParams()

    if (category) {
      params.set(
        'category',
        category
      )
    }

    if (
      branchId !== undefined &&
      branchId !== null &&
      branchId !== ''
    ) {
      params.set(
        'branchId',
        String(branchId)
      )
    }

    const query =
      params.toString()

    return apiFetch(
      `/menus${
        query
          ? `?${query}`
          : ''
      }`
    )
  },

  // ===================================================
  // STOCK
  // ===================================================

  getStock: (
    branchId
  ) =>
    apiFetch(
      `/menus/${branchId}/stock`
    ),

  // ===================================================
  // PROMOTION
  // ===================================================

  getPromotions: (
    branchId
  ) =>
    apiFetch(
      `/promotions/active?branchId=${branchId}`
    ),

  // โปรโมชั่น/กิจกรรมที่แอดมินสร้าง (แสดงที่หน้าหลักพนักงาน)
  getShopPromotions: (
    branchId
  ) =>
    apiFetch(
      `/promotions/shop?branchId=${branchId}`
    ),

  // ตั้งค่า PromptPay สำหรับ QR ของพนักงาน
  getPaymentConfig: () => apiFetch('/public/config'),

  // ส่งภาพสลิปจากกล้องไปผูกกับออเดอร์ขายหน้าร้าน
  uploadStaffOrderSlip: async (orderId, blob) => {
    const token = getToken()
    const res = await fetch(`${BASE_URL}/orders/${Number(orderId)}/slip`, {
      method: 'POST',
      headers: {
        'Content-Type': blob?.type || 'image/jpeg',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: blob,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data?.error || 'ส่งสลิปไม่สำเร็จ')
    return data
  },

  // เรียก AI ตรวจสลิปของออเดอร์ขายหน้าร้าน
  checkStaffOrderSlip: async (orderId) => {
    const data = await post(`/orders/${Number(orderId)}/ai-check-slip`, {})
    return data?.result || data
  },

  // ===================================================
  // PROMOTION ADMIN
  // ===================================================

  getAdminPromotions: () =>
    apiFetch(
      '/admin/promotions'
    ),

  createPromotion: (
    payload
  ) =>
    post(
      '/admin/promotions',
      payload
    ),

  updatePromotion: (
    id,
    payload
  ) =>
    apiFetch(
      `/admin/promotions/${id}`,
      {
        method: 'PUT',
        body:
          JSON.stringify(
            payload
          ),
      }
    ),

  deletePromotion: (
    id
  ) =>
    apiFetch(
      `/admin/promotions/${id}`,
      {
        method: 'DELETE',
      }
    ),

  // ===================================================
  // ORDERS
  // ===================================================

  createOrder: (
    payload
  ) =>
    post(
      '/orders',
      payload
    ),

  cancelOrder: (
    id,
    reason
  ) =>
    post(
      `/orders/${id}/cancel`,
      {
        reason,
      }
    ),

  // ===================================================
  // ประวัติการขายของพนักงาน
  // ===================================================

  // date = 'YYYY-MM-DD' (ไม่ส่ง = วันนี้)
  // ส่งช่วงเวลาของวันนั้นตามเวลาเครื่องผู้ใช้ไปให้ backend
  getHistory: (
    branchId,
    date
  ) => {
    const base = date
      ? new Date(`${date}T00:00:00`)
      : new Date(new Date().setHours(0, 0, 0, 0))

    const next = new Date(base.getTime())
    next.setDate(next.getDate() + 1)

    const params = new URLSearchParams()

    params.set('branchId', String(branchId))
    params.set('from', base.toISOString())
    params.set('to', next.toISOString())

    return apiFetch(
      `/orders/history?${params.toString()}`
    )
  },

  // ===================================================
  // DASHBOARD พนักงาน
  // ===================================================

  getDashboard: (
    branchId,
    from,
    to
  ) => {
    let url =
      `/dashboard/summary?branchId=${branchId}`

    if (from) {
      url +=
        `&from=${encodeURIComponent(
          from
        )}`
    }

    if (to) {
      url +=
        `&to=${encodeURIComponent(
          to
        )}`
    }

    return apiFetch(url)
  },

  // ===================================================
  // ADMIN DASHBOARD
  // ===================================================
  //
  // รองรับ:
  // - วันที่เริ่มต้น
  // - วันที่สิ้นสุด
  // - สาขา
  //
  // ตัวอย่าง:
  //
  // /api/admin/dashboard
  //
  // /api/admin/dashboard?branchId=1
  //
  // /api/admin/dashboard?branchId=1
  // &startDate=2026-10-01
  // &endDate=2026-10-07
  //
  // ===================================================

  getAdminDashboard: (
    startDate,
    endDate,
    branchId
  ) => {

    const params =
      new URLSearchParams()

    if (
      startDate
    ) {
      params.set(
        'startDate',
        startDate
      )
    }

    if (
      endDate
    ) {
      params.set(
        'endDate',
        endDate
      )
    }

    if (
      branchId !== undefined &&
      branchId !== null &&
      branchId !== '' &&
      branchId !== 'all'
    ) {
      params.set(
        'branchId',
        String(branchId)
      )
    }

    const query =
      params.toString()

    return apiFetch(
      `/admin/dashboard${
        query
          ? `?${query}`
          : ''
      }`
    )
  },

  // ===================================================
  // ADMIN - ประวัติการขาย
  // ===================================================

  getAdminSales: (
    from,
    to,
    branchId,
    channel
  ) => {

    const params =
      new URLSearchParams()

    // วันที่เริ่มต้น
    if (from) {
      params.set(
        'from',
        from
      )
    }

    // วันที่สิ้นสุด
    if (to) {
      params.set(
        'to',
        to
      )
    }

    // สาขา
    if (
      branchId !== undefined &&
      branchId !== null &&
      branchId !== '' &&
      branchId !== 'all'
    ) {
      params.set(
        'branchId',
        String(branchId)
      )
    }

    // ช่องทางการชำระเงิน
    if (
      channel !== undefined &&
      channel !== null &&
      channel !== '' &&
      channel !== 'all'
    ) {
      params.set(
        'channel',
        String(channel)
      )
    }

    const query =
      params.toString()

    return apiFetch(
      `/admin/sales${
        query
          ? `?${query}`
          : ''
      }`
    )
  },

  // ===================================================
  // MENU ADMIN
  // ===================================================

  createMenu: (
    payload
  ) =>
    post(
      '/menus',
      payload
    ),

  updateMenu: (
    id,
    payload
  ) =>
    apiFetch(
      `/menus/${id}`,
      {
        method: 'PUT',
        body:
          JSON.stringify(
            payload
          ),
      }
    ),

  deleteMenu: (
    id
  ) =>
    apiFetch(
      `/menus/${id}`,
      {
        method: 'DELETE',
      }
    ),

  // ===================================================
  // REFERENCE
  // ===================================================

  getRawMaterials: (
    category = ''
  ) =>
    apiFetch(
      `/menus/reference/raw-materials?category=${encodeURIComponent(
        category
      )}`
    ),

  getPrepItems: (
    category = ''
  ) =>
    apiFetch(
      `/menus/reference/prep-items?category=${encodeURIComponent(
        category
      )}`
    ),

  // ===================================================
  // RAW STOCK
  // ===================================================

  getRawStock: (
    branchId,
    category = ''
  ) =>
    apiFetch(
      `/stock/raw/${branchId}?category=${encodeURIComponent(
        category
      )}`
    ),

  receiveRaw: (
    payload
  ) =>
    post(
      '/stock/raw/receive',
      payload
    ),

  // ---------- ล็อตวัตถุดิบ (FEFO/FIFO) ----------
  getRawLotSummary: (
    branchId,
    days = 3
  ) =>
    apiFetch(
      `/stock/lots/${branchId}/summary?days=${days}`
    ),

  getRawLots: (
    branchId,
    params = {}
  ) =>
    apiFetch(
      `/stock/lots/${branchId}?${new URLSearchParams(
        Object.entries(params).filter(([, v]) => v !== '' && v != null)
      )}`
    ),

  wasteRawLot: (
    payload
  ) =>
    post(
      '/stock/lots/waste',
      payload
    ),

  stocktakeRaw: (
    payload
  ) =>
    post(
      '/stock/lots/stocktake',
      payload
    ),

  // รอบ 15: แช่แข็ง / ละลาย  payload = { lotId, to: 'frozen'|'thawed', qty? }
  moveRawLot: (
    payload
  ) =>
    post(
      '/stock/lots/move',
      payload
    ),

  // รอบ 15: ตั้งอายุเก็บมาตรฐาน payload = { defaultStorage, chilledDays, frozenDays, thawedDays }
  setMaterialShelfLife: (
    materialId,
    payload
  ) =>
    apiFetch(
      `/stock/lots/material/${materialId}`,
      {
        method: 'PUT',
        body: JSON.stringify(
          payload
        ),
      }
    ),

  // ===================================================
  // PREP
  // ===================================================

  getPrepBatches: (
    branchId,
    category = ''
  ) =>
    apiFetch(
      `/stock/prep/${branchId}?category=${encodeURIComponent(
        category
      )}`
    ),

  getPrepRecipes: () =>
    apiFetch('/stock/prep-recipes'),

  discardPrepBatch: (
    id,
    payload = {}
  ) =>
    post(
      `/stock/prep/${id}/discard`,
      payload
    ),

  startPrep: (
    payload
  ) =>
    post(
      '/stock/prep/start',
      payload
    ),

  // ===================================================
  // READY STOCK
  // ===================================================

  produceReady: (
    payload
  ) =>
    post(
      '/stock/ready/produce',
      payload
    ),

  // ===================================================
  // ข้าวเหนียว (พนักงานขายบันทึกเอง)
  // ===================================================

  getStickyRice: branchId =>
    apiFetch(`/sticky-rice/${encodeURIComponent(branchId)}`),

  // { branchId, kgBought, price, bagsMade }
  recordStickyRice: payload =>
    post('/sticky-rice/record', payload),
}

// =====================================================
// CART
// =====================================================

export const loadCart = () => {
  try {
    const value =
      JSON.parse(
        localStorage.getItem(
          'cart'
        ) || '[]'
      )

    return Array.isArray(value)
      ? value
      : []
  } catch {
    return []
  }
}

export const saveCart = (
  cart
) => {
  localStorage.setItem(
    'cart',
    JSON.stringify(
      cart || []
    )
  )
}

export const clearCart =
  () =>
    localStorage.removeItem(
      'cart'
    )

// =====================================================
// PENDING ORDER
// =====================================================

export const savePendingOrder = (
  order
) => {
  localStorage.setItem(
    'pendingOrder',
    JSON.stringify(
      order
    )
  )
}

export const loadPendingOrder =
  () => {
    try {
      return JSON.parse(
        localStorage.getItem(
          'pendingOrder'
        ) || 'null'
      )
    } catch {
      return null
    }
  }

export const clearPendingOrder =
  () =>
    localStorage.removeItem(
      'pendingOrder'
    )

// =====================================================
// PRICE
// =====================================================

export const linePrice = (
  item
) => {

  const price =
    Number(
      item?.price ??
        item?.menu?.price ??
        0
    )

  const qty =
    Number(
      item?.qty ?? 0
    )

  const unit =
    item?.size === 'half'
      ? price / 2
      : price

  return unit * qty
}

export const cartTotal = (
  cart = []
) =>
  cart.reduce(
    (
      sum,
      item
    ) =>
      sum +
      linePrice(item),
    0
  )

export const cartQty = (
  cart = []
) =>
  cart.reduce(
    (
      sum,
      item
    ) =>
      sum +
      Number(
        item?.qty || 0
      ),
    0
  )

// =====================================================
// BAHT
// =====================================================

export const baht = (
  n
) =>
  '฿' +
  Number(
    n || 0
  ).toLocaleString(
    'th-TH',
    {
      maximumFractionDigits: 0,
    }
  )

// =====================================================
// STOCK DISPLAY
// =====================================================

export const fmtStock = (
  q,
  hasHalf
) =>
  hasHalf
    ? `${Math.floor(
        Number(q || 0) / 2
      )} ตัว${
        Number(q || 0) % 2
          ? ' + ครึ่งตัว'
          : ''
      }`
    : `${Number(
        q || 0
      )}`

// =====================================================
// PAYMENT LABEL
// =====================================================

export const PAY_LABEL = {
  cash: 'เงินสด',
  qr: 'QR Code',
  transfer: 'โอนเงิน',
  card: 'delivery',
  other: 'อื่น ๆ',
}


// =====================================================
// ออเดอร์/การจองของลูกค้า (ฝั่งพนักงาน) — /api/customer
// =====================================================

const patch = (path, body) =>
  apiFetch(path, { method: 'PATCH', body: JSON.stringify(body) })

// โหลดรูปสลิป (ต้องแนบ token ล็อกอิน จึงโหลดเป็น blob แล้วสร้างลิงก์ชั่วคราวให้ <img>)
export async function fetchSlipUrl(path) {
  const token = getToken()

  const res = await fetch(`${BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })

  if (!res.ok) {
    let message = `โหลดสลิปไม่สำเร็จ (${res.status})`

    try {
      const data = await res.json()
      if (data?.error) message = data.error
    } catch {
      // ใช้ข้อความเริ่มต้น
    }

    throw new Error(message)
  }

  return URL.createObjectURL(await res.blob())
}

export const customerApi = {
  // ออเดอร์/การจองที่ลูกค้าแนบสลิปแล้ว รอพนักงานตรวจสลิป
  inbox: branchId =>
    apiFetch(`/customer/inbox?branchId=${encodeURIComponent(branchId)}`),

  confirmOrder: (id, bankReference) =>
    post(`/customer/orders/${id}/confirm-payment`, { bankReference }),

  // ไม่รับออเดอร์ = ยกเลิก (ต้องมี reason หรือ calledCustomer: true อย่างใดอย่างหนึ่ง)
  rejectOrder: (id, reason, calledCustomer = false) =>
    post(`/customer/orders/${id}/reject`, { reason, calledCustomer }),

  // ออเดอร์ที่ลูกค้ายังไม่โอน/ยังไม่แนบสลิป
  unpaid: branchId =>
    apiFetch(`/customer/unpaid?branchId=${encodeURIComponent(branchId)}`),

  cancelOrder: (id, reason, calledCustomer = false) =>
    post(`/customer/orders/${id}/cancel`, { reason, calledCustomer }),

  // ออเดอร์ที่ยกเลิกแล้ว (7 วันล่าสุด) + ลบออกจากระบบ
  cancelledOrders: branchId =>
    apiFetch(`/customer/cancelled?branchId=${encodeURIComponent(branchId)}`),

  deleteOrder: id =>
    apiFetch(`/customer/orders/${id}`, { method: 'DELETE' }),

  confirmDeposit: (id, bankReference) =>
    post(`/customer/reservations/${id}/confirm-deposit`, { bankReference }),

  rejectReservation: (id, reason, calledCustomer = false) =>
    post(`/customer/reservations/${id}/reject`, { reason, calledCustomer }),

  orderSlipPath: id => `/customer/orders/${id}/slip`,
  reservationSlipPath: id => `/customer/reservations/${id}/slip`,

  // AI ตรวจสลิป (ตัวช่วยคัดกรอง — พนักงานยังต้องกดยืนยันเอง)
  aiStatus: () => apiFetch('/customer/ai-status'),
  aiCheckOrder: id => post(`/customer/orders/${id}/ai-check-slip`, {}),
  aiCheckReservation: id => post(`/customer/reservations/${id}/ai-check-slip`, {}),

  orders: branchId =>
    apiFetch(`/customer/orders?branchId=${encodeURIComponent(branchId)}`),

  setOrderStatus: (id, status) =>
    patch(`/customer/orders/${id}/status`, { status }),

  reservations: (branchId, scope = 'active') =>
    apiFetch(
      `/customer/reservations?branchId=${encodeURIComponent(branchId)}&scope=${scope}`
    ),

  reservationReady: id => post(`/customer/reservations/${id}/ready`, {}),

  reservationCollect: (id, body) =>
    post(`/customer/reservations/${id}/collect`, body),

  reservationCancel: (id, body) =>
    post(`/customer/reservations/${id}/cancel`, body),
}

// =====================================================
// กล่องออเดอร์/การจองจากลูกค้าบนหน้า Admin — /api/admin
// =====================================================

export const adminCustomerApi = {
  orderSlipPath: id => `/admin/customer-orders/${id}/slip`,
  reservationSlipPath: id => `/admin/customer-reservations/${id}/slip`,

  reviews: branchId =>
    apiFetch(
      `/admin/customer-reviews${
        branchId ? `?branchId=${encodeURIComponent(branchId)}` : ''
      }`
    ),

  inbox: branchId =>
    apiFetch(
      `/admin/customer-inbox${
        branchId ? `?branchId=${encodeURIComponent(branchId)}` : ''
      }`
    ),

  confirmOrder: (id, bankReference) =>
    post(`/admin/customer-orders/${id}/confirm-payment`, { bankReference }),

  rejectOrder: (id, reason) =>
    post(`/admin/customer-orders/${id}/reject`, { reason }),

  confirmDeposit: (id, bankReference) =>
    post(`/admin/customer-reservations/${id}/confirm-deposit`, { bankReference }),

  rejectReservation: (id, reason) =>
    post(`/admin/customer-reservations/${id}/reject`, { reason }),
}


// =====================================================
// วันหยุดร้าน (Admin) — /api/admin/closures
// =====================================================

export const adminClosuresApi = {
  list: () => apiFetch('/admin/closures'),

  // หยุดเป็นช่วงวัน (วันเดียว = startDate เท่ากับ endDate หรือไม่ส่ง endDate)
  addRange: ({ branchId, startDate, endDate, reason }) =>
    post('/admin/closures', { kind: 'range', branchId: branchId || null, startDate, endDate, reason }),

  // หยุดประจำทุกสัปดาห์ (weekday 0 = อาทิตย์ ... 6 = เสาร์)
  addWeekly: ({ branchId, weekday, reason }) =>
    post('/admin/closures', { kind: 'weekly', branchId: branchId || null, weekday, reason }),

  remove: id => apiFetch(`/admin/closures/${id}`, { method: 'DELETE' }),
}


// =====================================================
// ประวัติสต็อก (Admin) — /api/admin/stock-history
//   kind = 'raw' (วัตถุดิบแบบล็อต) | 'menu' (สินค้าพร้อมขาย)
// =====================================================

const qs = params =>
  Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&')

export const adminStockHistoryApi = {
  calendar: ({ branchId, month, kind }) =>
    apiFetch(`/admin/stock-history/calendar?${qs({ branchId, month, kind })}`),

  day: ({ branchId, date, kind }) =>
    apiFetch(`/admin/stock-history/day?${qs({ branchId, date, kind })}`),

  lots: ({ branchId, materialId, status, q, limit }) =>
    apiFetch(`/admin/stock-history/lots?${qs({ branchId, materialId, status, q, limit })}`),

  lot: id => apiFetch(`/admin/stock-history/lots/${id}`),
}