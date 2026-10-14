import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import { Link } from 'react-router-dom'

import {
  api,
  baht,
} from '../api'


// =====================================================
// ICONS
// =====================================================

function HomeIcon({ size = 25, active = false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M3 10.5L12 3L21 10.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 9.5V20H19V9.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 20V14H15V20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}


function ReceiptIcon({ size = 25 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M6 3.5C4.9 3.5 4 4.4 4 5.5V19C4 20.1 4.9 21 6 21H18C19.1 21 20 20.1 20 19V8L15.5 3.5H6Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 3.5V8H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 11H16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8 14.5H16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8 18H13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}


function ShoppingBagIcon({ size = 25 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M5 8H19L20 20H4L5 8Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 8V6C8 4.9 8.9 4 10 4H14C15.1 4 16 4.9 16 6V8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8 12C8 14.2 9.8 16 12 16C14.2 16 16 14.2 16 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}


function GiftIcon({ size = 25 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M4 10H20V20H4V10Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 7H21V10H3V7Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 7V20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 7H8.5C7.1 7 6 5.9 6 4.5C6 3.7 6.7 3 7.5 3C9.5 3 12 5.1 12 7Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 7H15.5C16.9 7 18 5.9 18 4.5C18 3.7 17.3 3 16.5 3C14.5 3 12 5.1 12 7Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}


function BuildingIcon({ size = 25 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M4 21V5L14 3V21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 9H20V21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 8H10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8 12H10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8 16H10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M17 13H18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M17 17H18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}


function TrashIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* หูจับ */}
      <path d="M9 5V4.5C9 3.7 9.7 3 10.5 3H13.5C14.3 3 15 3.7 15 4.5V5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      {/* ฝา */}
      <path d="M2.5 6.5H21.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      {/* ตัวถัง */}
      <path d="M5.5 9V19C5.5 20.1 6.4 21 7.5 21H16.5C17.6 21 18.5 20.1 18.5 19V9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      {/* ขีด 3 เส้น */}
      <path d="M9.5 12V17.5M12 12V17.5M14.5 12V17.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}


function EditIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* กระดาษ */}
      <path d="M11.5 21H6C4.3 21 3 19.7 3 18V6C3 4.3 4.3 3 6 3H15C16.7 3 18 4.3 18 6V9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      {/* เส้นข้อความ */}
      <path d="M7 8H14M7 11.5H14M7 15H10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      {/* ดินสอ */}
      <path d="M19.3 11.4L21.1 13.2C21.5 13.6 21.5 14.2 21.1 14.6L14.3 21.4L10.8 22.2L11.6 18.7L18.4 11.9C18.8 11.5 19 11.1 19.3 11.4Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}


// =====================================================
// CATEGORY LABEL
// =====================================================

function categoryLabel(category) {
  const map = {
    duck: 'เป็ดย่างเกลือ',
    chicken: 'ไก่หมุนขมิ้น',
    other: 'อื่น ๆ',
    sticky_rice: 'ข้าวเหนียว',
  }

  return (
    map[category] ||
    category ||
    '-'
  )
}


// =====================================================
// NUMBER
// =====================================================

function numberValue(value) {
  const n = Number(value)

  return Number.isFinite(n)
    ? n
    : 0
}


// =====================================================
// SHARED STYLES
// =====================================================

const labelStyle = {
  display: 'block',
  fontSize: 13,
  color: '#666',
  marginBottom: 5,
}

const inputStyle = (mb = 12, padding = '11px 12px') => ({
  width: '100%',
  boxSizing: 'border-box',
  padding,
  border: '1px solid #ddd',
  borderRadius: 9,
  marginBottom: mb,
})

const overlayStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.45)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
  zIndex: 4000,
}

const errorBoxStyle = {
  background: '#ffe8e8',
  border: '1px solid #ffbcbc',
  color: '#b00000',
  borderRadius: 12,
  padding: 14,
  marginBottom: 14,
}

const cardStyle = {
  background: '#fff',
  border: '1px solid #e5e5e5',
  borderRadius: 14,
  padding: 16,
}

const cancelBtnStyle = {
  border: '1px solid #ddd',
  background: '#fff',
  borderRadius: 9,
  padding: '11px',
  cursor: 'pointer',
}

const primaryBtnStyle = {
  border: 'none',
  background: '#ff1111',
  color: '#fff',
  borderRadius: 9,
  padding: '11px',
  cursor: 'pointer',
  fontWeight: 700,
}

const twoColStyle = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 8,
}

const iconBtnContent = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
}

const navLinkStyle = {
  textDecoration: 'none',
  color: '#fff',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
  fontSize: 11,
  fontWeight: 600,
}


// =====================================================
// ADMIN PRODUCTS PAGE
// =====================================================

export default function AdminProductsPage() {

  // ===================================================
  // TAB
  // ===================================================

  const [activeSection, setActiveSection] = useState('menu')


  // ===================================================
  // MENU DATA
  // ===================================================

  const [menus, setMenus] = useState([])
  const [loadingMenus, setLoadingMenus] = useState(true)
  const [menuError, setMenuError] = useState('')


  // ===================================================
  // COST / REFERENCE DATA
  // ===================================================

  const [rawMaterials, setRawMaterials] = useState([])
  const [prepItems, setPrepItems] = useState([])
  const [loadingCost, setLoadingCost] = useState(false)
  const [costError, setCostError] = useState('')


  // ===================================================
  // EDIT MENU
  // ===================================================

  const [editingMenu, setEditingMenu] = useState(null)

  const [menuForm, setMenuForm] = useState({
    name: '',
    price: '',
    cost: '',
    category: '',
    isActive: true,
  })

  const [savingMenu, setSavingMenu] = useState(false)


  // ===================================================
  // ADD MENU
  // ===================================================

  const [showAddMenu, setShowAddMenu] = useState(false)

  const [newMenu, setNewMenu] = useState({
    name: '',
    price: '',
    cost: '',
    category: 'duck',
    isActive: true,
  })

  const [addingMenu, setAddingMenu] = useState(false)


  // ===================================================
  // COST EDIT
  // ===================================================

  const [selectedCostMenu, setSelectedCostMenu] = useState(null)

  const [costForm, setCostForm] = useState({
    cost: '',
  })

  const [savingCost, setSavingCost] = useState(false)


  // ===================================================
  // RAW MATERIAL FORM
  // ===================================================

  const [selectedRawMaterial, setSelectedRawMaterial] = useState(null)
  const [rawQty, setRawQty] = useState('')
  const [rawAction, setRawAction] = useState('add')
  const [savingRaw, setSavingRaw] = useState(false)


  // ===================================================
  // LOAD MENUS
  // ===================================================

  async function loadMenus() {
    try {
      setLoadingMenus(true)
      setMenuError('')

      const result = await api.getMenus()

      const rows =
        Array.isArray(result)
          ? result
          : Array.isArray(result?.menus)
            ? result.menus
            : Array.isArray(result?.data)
              ? result.data
              : []

      setMenus(rows)

    } catch (err) {
      console.error('Admin Products:', err)

      setMenuError(
        err?.message ||
          'ไม่สามารถโหลดข้อมูลสินค้าได้'
      )

      setMenus([])

    } finally {
      setLoadingMenus(false)
    }
  }


  // ===================================================
  // LOAD COST DATA
  // ===================================================

  async function loadCostData() {
    try {
      setLoadingCost(true)
      setCostError('')

      const [
        rawResult,
        prepResult,
      ] = await Promise.all([
        api.getRawMaterials(),
        api.getPrepItems(),
      ])

      const rawRows =
        Array.isArray(rawResult)
          ? rawResult
          : Array.isArray(rawResult?.data)
            ? rawResult.data
            : Array.isArray(rawResult?.materials)
              ? rawResult.materials
              : []

      const prepRows =
        Array.isArray(prepResult)
          ? prepResult
          : Array.isArray(prepResult?.data)
            ? prepResult.data
            : Array.isArray(prepResult?.items)
              ? prepResult.items
              : []

      setRawMaterials(rawRows)
      setPrepItems(prepRows)

    } catch (err) {
      console.error('Cost Data:', err)

      setCostError(
        err?.message ||
          'ไม่สามารถโหลดข้อมูลต้นทุนได้'
      )

    } finally {
      setLoadingCost(false)
    }
  }


  // ===================================================
  // INITIAL LOAD
  // ===================================================

  useEffect(() => {
    loadMenus()
    loadCostData()
  }, [])


  // ===================================================
  // OPEN EDIT MENU
  // ===================================================

  function openEditMenu(menu) {
    setEditingMenu(menu)

    setMenuForm({
      name:
        menu?.name ||
        menu?.menu_name ||
        '',

      price:
        menu?.price ??
        menu?.selling_price ??
        '',

      cost:
        menu?.cost ??
        menu?.cost_price ??
        '',

      category:
        menu?.category ||
        'duck',

      isActive:
        menu?.isActive ??
        menu?.is_active ??
        true,
    })
  }


  // ===================================================
  // SAVE MENU
  // ===================================================

  async function saveMenu() {
    if (!editingMenu) {
      return
    }

    try {
      setSavingMenu(true)

      const id =
        editingMenu.id ||
        editingMenu.menuId ||
        editingMenu.menu_id

      await api.updateMenu(
        id,
        {
          name: menuForm.name.trim(),
          price: numberValue(menuForm.price),
          cost: numberValue(menuForm.cost),
          category: menuForm.category,
          isActive: menuForm.isActive,
          is_active: menuForm.isActive,
        }
      )

      setEditingMenu(null)

      await loadMenus()

      alert('บันทึกข้อมูลสินค้าเรียบร้อยแล้ว')

    } catch (err) {
      console.error('Save Menu:', err)

      alert(
        err?.message ||
          'ไม่สามารถบันทึกข้อมูลสินค้าได้'
      )

    } finally {
      setSavingMenu(false)
    }
  }


  // ===================================================
  // ADD MENU
  // ===================================================

  async function addMenu() {
    if (!newMenu.name.trim()) {
      alert('กรุณากรอกชื่อสินค้า')

      return
    }

    try {
      setAddingMenu(true)

      await api.createMenu({
        name: newMenu.name.trim(),
        price: numberValue(newMenu.price),
        cost: numberValue(newMenu.cost),
        category: newMenu.category,
        isActive: newMenu.isActive,
        is_active: newMenu.isActive,
      })

      setNewMenu({
        name: '',
        price: '',
        cost: '',
        category: 'duck',
        isActive: true,
      })

      setShowAddMenu(false)

      await loadMenus()

      alert('เพิ่มสินค้าเรียบร้อยแล้ว')

    } catch (err) {
      console.error('Add Menu:', err)

      alert(
        err?.message ||
          'ไม่สามารถเพิ่มสินค้าได้'
      )

    } finally {
      setAddingMenu(false)
    }
  }


  // ===================================================
  // DELETE MENU
  // ===================================================

  async function deleteMenu(menu) {
    const id =
      menu?.id ||
      menu?.menuId ||
      menu?.menu_id

    if (!id) {
      alert('ไม่พบรหัสสินค้า')

      return
    }

    const name =
      menu?.name ||
      menu?.menu_name ||
      'สินค้านี้'

    const confirmed =
      window.confirm(
        `ต้องการลบ "${name}" ใช่หรือไม่?`
      )

    if (!confirmed) {
      return
    }

    try {
      await api.deleteMenu(id)

      await loadMenus()

      alert('ลบสินค้าเรียบร้อยแล้ว')

    } catch (err) {
      console.error('Delete Menu:', err)

      alert(
        err?.message ||
          'ไม่สามารถลบสินค้าได้'
      )
    }
  }


  // ===================================================
  // TOGGLE ACTIVE
  // ===================================================

  async function toggleMenu(menu) {
    const id =
      menu?.id ||
      menu?.menuId ||
      menu?.menu_id

    if (!id) {
      return
    }

    const current =
      menu?.isActive ??
      menu?.is_active ??
      true

    try {
      await api.updateMenu(
        id,
        {
          isActive: !current,
          is_active: !current,
        }
      )

      await loadMenus()

    } catch (err) {
      console.error('Toggle Menu:', err)

      alert(
        err?.message ||
          'ไม่สามารถเปลี่ยนสถานะสินค้าได้'
      )
    }
  }


  // ===================================================
  // OPEN COST
  // ===================================================

  function openCost(menu) {
    setSelectedCostMenu(menu)

    setCostForm({
      cost:
        menu?.cost ??
        menu?.cost_price ??
        '',
    })
  }


  // ===================================================
  // SAVE COST
  // ===================================================

  async function saveCost() {
    if (!selectedCostMenu) {
      return
    }

    const id =
      selectedCostMenu.id ||
      selectedCostMenu.menuId ||
      selectedCostMenu.menu_id

    try {
      setSavingCost(true)

      await api.updateMenu(
        id,
        {
          cost: numberValue(costForm.cost),
          cost_price: numberValue(costForm.cost),
        }
      )

      setSelectedCostMenu(null)

      await loadMenus()

      alert('บันทึกต้นทุนเรียบร้อยแล้ว')

    } catch (err) {
      console.error('Save Cost:', err)

      alert(
        err?.message ||
          'ไม่สามารถบันทึกต้นทุนได้'
      )

    } finally {
      setSavingCost(false)
    }
  }


  // ===================================================
  // RAW MATERIAL
  // ===================================================

  async function updateRawStock() {
    if (!selectedRawMaterial) {
      return
    }

    const qty = numberValue(rawQty)

    if (qty <= 0) {
      alert('กรุณาระบุจำนวนที่มากกว่า 0')

      return
    }

    try {
      setSavingRaw(true)

      const rawId =
        selectedRawMaterial.id ||
        selectedRawMaterial.rawMaterialId ||
        selectedRawMaterial.raw_material_id

      await api.receiveRaw({
        rawMaterialId: rawId,
        raw_material_id: rawId,

        quantity:
          rawAction === 'remove'
            ? -qty
            : qty,

        qty:
          rawAction === 'remove'
            ? -qty
            : qty,

        action: rawAction,
      })

      setSelectedRawMaterial(null)

      setRawQty('')

      await loadCostData()

      alert(
        rawAction === 'add'
          ? 'เพิ่มวัตถุดิบเรียบร้อยแล้ว'
          : 'ลดวัตถุดิบเรียบร้อยแล้ว'
      )

    } catch (err) {
      console.error('Update Raw Stock:', err)

      alert(
        err?.message ||
          'ไม่สามารถปรับจำนวนวัตถุดิบได้'
      )

    } finally {
      setSavingRaw(false)
    }
  }


  // ===================================================
  // MENU LIST
  // ===================================================

  const menuList = useMemo(() => menus, [menus])


  // ===================================================
  // RENDER
  // ===================================================

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f7f7f7',
        paddingTop: 20,
        paddingLeft: 16,
        paddingRight: 16,
        paddingBottom: 110,
        boxSizing: 'border-box',
      }}
    >

      <div style={{ maxWidth: 1000, margin: '0 auto' }}>

        {/* =================================================
            HEADER
        ================================================= */}

        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 13, color: '#777', marginBottom: 4 }}>
            PoultryOS Admin
          </div>

          <h1 style={{ margin: 0, fontSize: 28 }}>
            แก้ไขสินค้า
          </h1>

          <div style={{ marginTop: 5, color: '#666', fontSize: 14 }}>
            จัดการเมนูขายและต้นทุนสินค้า
          </div>
        </div>


        {/* =================================================
            SECTION SWITCH
        ================================================= */}

        <div
          style={{
            background: '#fff',
            border: '1px solid #e5e5e5',
            borderRadius: 14,
            padding: 5,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 5,
            marginBottom: 16,
          }}
        >

          <button
            type="button"
            onClick={() => setActiveSection('menu')}
            style={{
              border: 'none',
              borderRadius: 10,
              padding: '12px 10px',
              background: activeSection === 'menu' ? '#ff1111' : '#fff',
              color: activeSection === 'menu' ? '#fff' : '#555',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            จัดการเมนูขาย
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('cost')}
            style={{
              border: 'none',
              borderRadius: 10,
              padding: '12px 10px',
              background: activeSection === 'cost' ? '#ff1111' : '#fff',
              color: activeSection === 'cost' ? '#fff' : '#555',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            จัดการต้นทุน
          </button>

        </div>


        {/* =================================================
            MENU SECTION
        ================================================= */}

        {activeSection === 'menu' && (
          <>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10,
                marginBottom: 12,
              }}
            >

              <div>
                <h2 style={{ margin: 0, fontSize: 21 }}>
                  เมนูขาย
                </h2>

                <div style={{ marginTop: 3, fontSize: 13, color: '#777' }}>
                  รายการนี้จะแสดงในหน้าขายของพนักงาน
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowAddMenu(true)}
                style={{
                  border: 'none',
                  borderRadius: 9,
                  background: '#222',
                  color: '#fff',
                  padding: '10px 14px',
                  cursor: 'pointer',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                }}
              >
                ＋ เพิ่มเมนู
              </button>

            </div>


            {menuError && (
              <div style={errorBoxStyle}>
                {menuError}
              </div>
            )}


            {loadingMenus ? (
              <div
                style={{
                  background: '#fff',
                  borderRadius: 14,
                  padding: 35,
                  textAlign: 'center',
                  color: '#777',
                }}
              >
                กำลังโหลดสินค้า...
              </div>

            ) : menuList.length === 0 ? (

              <div
                style={{
                  background: '#fff',
                  border: '1px solid #e5e5e5',
                  borderRadius: 14,
                  padding: 35,
                  textAlign: 'center',
                  color: '#777',
                }}
              >
                ยังไม่มีสินค้า
              </div>

            ) : (

              <div style={{ display: 'grid', gap: 12 }}>

                {menuList.map(menu => {

                  const id =
                    menu.id ||
                    menu.menuId ||
                    menu.menu_id

                  const name =
                    menu.name ||
                    menu.menu_name ||
                    'ไม่ระบุชื่อ'

                  const price =
                    numberValue(
                      menu.price ??
                      menu.selling_price
                    )

                  const cost =
                    numberValue(
                      menu.cost ??
                      menu.cost_price
                    )

                  const category =
                    menu.category ||
                    'other'

                  const isActive =
                    menu.isActive ??
                    menu.is_active ??
                    true

                  return (
                    <div key={id} style={cardStyle}>

                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          gap: 12,
                        }}
                      >

                        <div style={{ minWidth: 0 }}>

                          <div style={{ fontSize: 17, fontWeight: 700 }}>
                            {name}
                          </div>

                          <div style={{ fontSize: 12, color: '#888', marginTop: 3 }}>
                            {categoryLabel(category)}
                          </div>

                        </div>

                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            padding: '5px 9px',
                            borderRadius: 20,
                            background: isActive ? '#e5f7e9' : '#eee',
                            color: isActive ? '#218838' : '#777',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {isActive ? 'เปิดขาย' : 'ปิดขาย'}
                        </span>

                      </div>


                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: 10,
                          marginTop: 14,
                        }}
                      >

                        <div
                          style={{
                            background: '#f8f8f8',
                            borderRadius: 10,
                            padding: 11,
                          }}
                        >
                          <div style={{ fontSize: 12, color: '#777' }}>
                            ราคาขาย
                          </div>

                          <div style={{ fontWeight: 700, fontSize: 18, marginTop: 3 }}>
                            {baht(price)}
                          </div>
                        </div>

                        <div
                          style={{
                            background: '#fff5e8',
                            borderRadius: 10,
                            padding: 11,
                          }}
                        >
                          <div style={{ fontSize: 12, color: '#777' }}>
                            ต้นทุน
                          </div>

                          <div style={{ fontWeight: 700, fontSize: 18, marginTop: 3 }}>
                            {baht(cost)}
                          </div>
                        </div>

                      </div>


                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: 8,
                          marginTop: 12,
                        }}
                      >

                        <button
                          type="button"
                          onClick={() => openEditMenu(menu)}
                          style={{
                            border: '1px solid #ddd',
                            background: '#fff',
                            borderRadius: 9,
                            padding: '10px',
                            cursor: 'pointer',
                            fontWeight: 600,
                            ...iconBtnContent,
                          }}
                        >
                          <EditIcon size={18} />
                          แก้ไขเมนู
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleMenu(menu)}
                          style={{
                            border: '1px solid #ddd',
                            background: isActive ? '#fff' : '#e8f5e9',
                            borderRadius: 9,
                            padding: '10px',
                            cursor: 'pointer',
                            fontWeight: 600,
                          }}
                        >
                          {isActive
                            ? '⏸ ปิดการขาย'
                            : '▶️ เปิดการขาย'}
                        </button>

                      </div>


                      <button
                        type="button"
                        onClick={() => deleteMenu(menu)}
                        style={{
                          width: '100%',
                          marginTop: 8,
                          border: 'none',
                          background: '#fff0f0',
                          color: '#c62828',
                          borderRadius: 9,
                          padding: '9px',
                          cursor: 'pointer',
                          ...iconBtnContent,
                        }}
                      >
                        <TrashIcon size={18} />
                        ลบเมนู
                      </button>

                    </div>
                  )
                })}

              </div>
            )}

          </>
        )}


        {/* =================================================
            COST SECTION
        ================================================= */}

        {activeSection === 'cost' && (
          <>

            <div style={{ marginBottom: 14 }}>

              <h2 style={{ margin: 0, fontSize: 21 }}>
                จัดการต้นทุน
              </h2>

              <div style={{ marginTop: 4, fontSize: 13, color: '#777' }}>
                จัดการต้นทุน สูตร และวัตถุดิบของสินค้า
              </div>

            </div>


            {costError && (
              <div style={errorBoxStyle}>
                {costError}
              </div>
            )}


            {/* PRODUCT COST */}

            <div style={{ ...cardStyle, marginBottom: 16 }}>

              <h3 style={{ margin: '0 0 12px', fontSize: 18 }}>
                ต้นทุนสินค้า
              </h3>

              {loadingMenus ? (

                <div style={{ padding: 20, textAlign: 'center', color: '#777' }}>
                  กำลังโหลด...
                </div>

              ) : (

                <div style={{ display: 'grid', gap: 10 }}>

                  {menuList.map(menu => {

                    const id =
                      menu.id ||
                      menu.menuId ||
                      menu.menu_id

                    const name =
                      menu.name ||
                      menu.menu_name ||
                      'ไม่ระบุชื่อ'

                    const cost =
                      numberValue(
                        menu.cost ??
                        menu.cost_price
                      )

                    return (
                      <div
                        key={id}
                        style={{
                          border: '1px solid #eee',
                          borderRadius: 11,
                          padding: 13,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 10,
                        }}
                      >

                        <div>

                          <div style={{ fontWeight: 700 }}>
                            {name}
                          </div>

                          <div style={{ fontSize: 12, color: '#777', marginTop: 3 }}>
                            ต้นทุนปัจจุบัน{' '}
                            {baht(cost)}
                          </div>

                        </div>

                        <button
                          type="button"
                          onClick={() => openCost(menu)}
                          style={{
                            border: 'none',
                            background: '#ff1111',
                            color: '#fff',
                            borderRadius: 8,
                            padding: '9px 12px',
                            cursor: 'pointer',
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          แก้ต้นทุน
                        </button>

                      </div>
                    )
                  })}

                </div>
              )}

            </div>


            {/* RECIPES */}

            <div style={{ ...cardStyle, marginBottom: 16 }}>

              <h3 style={{ margin: '0 0 5px', fontSize: 18 }}>
                สูตรสินค้า
              </h3>

              <div style={{ fontSize: 13, color: '#777', marginBottom: 14 }}>
                สูตรใช้สำหรับคำนวณต้นทุนเป็ดย่างเกลือและไก่หมุนขมิ้น
              </div>

              {menuList
                .filter(
                  menu =>
                    menu.category === 'duck' ||
                    menu.category === 'chicken'
                )
                .map(menu => {

                  const name =
                    menu.name ||
                    menu.menu_name ||
                    'ไม่ระบุชื่อ'

                  const recipe =
                    menu.recipe ||
                    menu.formula ||
                    menu.ingredients ||
                    []

                  return (
                    <div
                      key={menu.id || menu.menuId}
                      style={{
                        border: '1px solid #eee',
                        borderRadius: 11,
                        padding: 13,
                        marginBottom: 10,
                      }}
                    >

                      <div style={{ fontWeight: 700, marginBottom: 8 }}>
                        {name}
                      </div>

                      {Array.isArray(recipe) && recipe.length > 0 ? (

                        recipe.map((ingredient, index) => (
                          <div
                            key={ingredient.id || index}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              padding: '6px 0',
                              borderTop:
                                index === 0
                                  ? 'none'
                                  : '1px solid #f1f1f1',
                              fontSize: 13,
                            }}
                          >

                            <span>
                              {ingredient.name ||
                                ingredient.material_name ||
                                'วัตถุดิบ'}
                            </span>

                            <span>
                              {ingredient.quantity ??
                                ingredient.qty ??
                                0}{' '}
                              {ingredient.unit || ''}
                            </span>

                          </div>
                        ))

                      ) : (

                        <div style={{ fontSize: 13, color: '#999' }}>
                          ยังไม่มีข้อมูลสูตร
                        </div>

                      )}

                      <button
                        type="button"
                        onClick={() => openEditMenu(menu)}
                        style={{
                          width: '100%',
                          marginTop: 10,
                          border: '1px solid #ddd',
                          background: '#fff',
                          borderRadius: 8,
                          padding: '8px',
                          cursor: 'pointer',
                          ...iconBtnContent,
                        }}
                      >
                        <EditIcon size={17} />
                        แก้ไขข้อมูลสูตร
                      </button>

                    </div>
                  )
                })}

            </div>


            {/* RAW MATERIAL */}

            <div style={cardStyle}>

              <h3 style={{ margin: '0 0 5px', fontSize: 18 }}>
                วัตถุดิบ
              </h3>

              <div style={{ fontSize: 13, color: '#777', marginBottom: 14 }}>
                เพิ่มหรือลดจำนวนวัตถุดิบที่ใช้ในการผลิต
              </div>

              {loadingCost ? (

                <div style={{ padding: 20, textAlign: 'center', color: '#777' }}>
                  กำลังโหลดวัตถุดิบ...
                </div>

              ) : rawMaterials.length === 0 ? (

                <div style={{ textAlign: 'center', color: '#999', padding: 20 }}>
                  ยังไม่มีข้อมูลวัตถุดิบ
                </div>

              ) : (

                <div style={{ display: 'grid', gap: 10 }}>

                  {rawMaterials.map(material => {

                    const id =
                      material.id ||
                      material.rawMaterialId ||
                      material.raw_material_id

                    const name =
                      material.name ||
                      material.material_name ||
                      material.raw_material_name ||
                      'วัตถุดิบ'

                    const qty =
                      numberValue(
                        material.quantity ??
                        material.qty ??
                        material.stock
                      )

                    const unit =
                      material.unit ||
                      material.unit_name ||
                      ''

                    const price =
                      numberValue(
                        material.price ??
                        material.cost ??
                        material.unit_price
                      )

                    return (
                      <div
                        key={id}
                        style={{
                          border: '1px solid #eee',
                          borderRadius: 11,
                          padding: 13,
                        }}
                      >

                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: 10,
                          }}
                        >

                          <div>

                            <div style={{ fontWeight: 700 }}>
                              {name}
                            </div>

                            <div style={{ fontSize: 12, color: '#777', marginTop: 3 }}>
                              คงเหลือ {qty}{' '}
                              {unit}
                            </div>

                            <div style={{ fontSize: 12, color: '#777', marginTop: 2 }}>
                              ราคาต้นทุน{' '}
                              {baht(price)}
                            </div>

                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedRawMaterial(material)
                              setRawQty('')
                              setRawAction('add')
                            }}
                            style={{
                              border: 'none',
                              background: '#ff1111',
                              color: '#fff',
                              borderRadius: 8,
                              padding: '8px 11px',
                              cursor: 'pointer',
                              fontWeight: 700,
                              height: 'fit-content',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            จัดการ
                          </button>

                        </div>

                      </div>
                    )
                  })}

                </div>
              )}

            </div>

          </>
        )}

      </div>


      {/* =================================================
          EDIT MENU MODAL
      ================================================= */}

      {editingMenu && (
        <div style={overlayStyle}>

          <div
            style={{
              width: '100%',
              maxWidth: 500,
              maxHeight: '90vh',
              overflowY: 'auto',
              background: '#fff',
              borderRadius: 16,
              padding: 20,
            }}
          >

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >

              <h2 style={{ margin: 0, fontSize: 21 }}>
                แก้ไขสินค้า
              </h2>

              <button
                type="button"
                onClick={() => setEditingMenu(null)}
                style={{
                  border: 'none',
                  background: '#eee',
                  borderRadius: 50,
                  width: 34,
                  height: 34,
                  cursor: 'pointer',
                  fontSize: 18,
                }}
              >
                ×
              </button>

            </div>

            <label style={labelStyle}>
              ชื่อสินค้า
            </label>

            <input
              value={menuForm.name}
              onChange={e =>
                setMenuForm({
                  ...menuForm,
                  name: e.target.value,
                })
              }
              style={inputStyle(12)}
            />

            <label style={labelStyle}>
              ราคาขาย
            </label>

            <input
              type="number"
              value={menuForm.price}
              onChange={e =>
                setMenuForm({
                  ...menuForm,
                  price: e.target.value,
                })
              }
              style={inputStyle(12)}
            />

            <label style={labelStyle}>
              ต้นทุน
            </label>

            <input
              type="number"
              value={menuForm.cost}
              onChange={e =>
                setMenuForm({
                  ...menuForm,
                  cost: e.target.value,
                })
              }
              style={inputStyle(12)}
            />

            <label style={labelStyle}>
              ประเภทสินค้า
            </label>

            <select
              value={menuForm.category}
              onChange={e =>
                setMenuForm({
                  ...menuForm,
                  category: e.target.value,
                })
              }
              style={inputStyle(14)}
            >
              <option value="duck">เป็ดย่างเกลือ</option>
              <option value="chicken">ไก่หมุนขมิ้น</option>
              <option value="other">อื่น ๆ</option>
            </select>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 14,
                marginBottom: 18,
              }}
            >
              <input
                type="checkbox"
                checked={menuForm.isActive}
                onChange={e =>
                  setMenuForm({
                    ...menuForm,
                    isActive: e.target.checked,
                  })
                }
              />

              เปิดขายสินค้านี้
            </label>

            <div style={twoColStyle}>

              <button
                type="button"
                onClick={() => setEditingMenu(null)}
                style={cancelBtnStyle}
              >
                ยกเลิก
              </button>

              <button
                type="button"
                onClick={saveMenu}
                disabled={savingMenu}
                style={primaryBtnStyle}
              >
                {savingMenu
                  ? 'กำลังบันทึก...'
                  : 'บันทึก'}
              </button>

            </div>

          </div>

        </div>
      )}


      {/* =================================================
          ADD MENU MODAL
      ================================================= */}

      {showAddMenu && (
        <div style={overlayStyle}>

          <div
            style={{
              width: '100%',
              maxWidth: 500,
              background: '#fff',
              borderRadius: 16,
              padding: 20,
            }}
          >

            <h2 style={{ margin: '0 0 16px', fontSize: 21 }}>
              เพิ่มเมนูใหม่
            </h2>

            <input
              placeholder="ชื่อสินค้า"
              value={newMenu.name}
              onChange={e =>
                setNewMenu({
                  ...newMenu,
                  name: e.target.value,
                })
              }
              style={inputStyle(10)}
            />

            <input
              type="number"
              placeholder="ราคาขาย"
              value={newMenu.price}
              onChange={e =>
                setNewMenu({
                  ...newMenu,
                  price: e.target.value,
                })
              }
              style={inputStyle(10)}
            />

            <input
              type="number"
              placeholder="ต้นทุน"
              value={newMenu.cost}
              onChange={e =>
                setNewMenu({
                  ...newMenu,
                  cost: e.target.value,
                })
              }
              style={inputStyle(10)}
            />

            <select
              value={newMenu.category}
              onChange={e =>
                setNewMenu({
                  ...newMenu,
                  category: e.target.value,
                })
              }
              style={inputStyle(14)}
            >
              <option value="duck">เป็ดย่างเกลือ</option>
              <option value="chicken">ไก่หมุนขมิ้น</option>
              <option value="other">อื่น ๆ</option>
            </select>

            <label
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                marginBottom: 18,
                fontSize: 14,
              }}
            >
              <input
                type="checkbox"
                checked={newMenu.isActive}
                onChange={e =>
                  setNewMenu({
                    ...newMenu,
                    isActive: e.target.checked,
                  })
                }
              />

              เปิดขายทันที
            </label>

            <div style={twoColStyle}>

              <button
                type="button"
                onClick={() => setShowAddMenu(false)}
                style={cancelBtnStyle}
              >
                ยกเลิก
              </button>

              <button
                type="button"
                onClick={addMenu}
                disabled={addingMenu}
                style={primaryBtnStyle}
              >
                {addingMenu
                  ? 'กำลังเพิ่ม...'
                  : 'เพิ่มสินค้า'}
              </button>

            </div>

          </div>

        </div>
      )}


      {/* =================================================
          COST MODAL
      ================================================= */}

      {selectedCostMenu && (
        <div style={overlayStyle}>

          <div
            style={{
              width: '100%',
              maxWidth: 420,
              background: '#fff',
              borderRadius: 16,
              padding: 20,
            }}
          >

            <h2 style={{ margin: '0 0 5px', fontSize: 21 }}>
              แก้ไขต้นทุน
            </h2>

            <div style={{ color: '#777', fontSize: 13, marginBottom: 15 }}>
              {selectedCostMenu.name ||
                selectedCostMenu.menu_name}
            </div>

            <label style={labelStyle}>
              ต้นทุน
            </label>

            <input
              type="number"
              value={costForm.cost}
              onChange={e =>
                setCostForm({
                  cost: e.target.value,
                })
              }
              style={{ ...inputStyle(18, '12px'), fontSize: 16 }}
            />

            <div style={twoColStyle}>

              <button
                type="button"
                onClick={() => setSelectedCostMenu(null)}
                style={cancelBtnStyle}
              >
                ยกเลิก
              </button>

              <button
                type="button"
                onClick={saveCost}
                disabled={savingCost}
                style={primaryBtnStyle}
              >
                {savingCost
                  ? 'กำลังบันทึก...'
                  : 'บันทึกต้นทุน'}
              </button>

            </div>

          </div>

        </div>
      )}


      {/* =================================================
          RAW MATERIAL MODAL
      ================================================= */}

      {selectedRawMaterial && (
        <div style={overlayStyle}>

          <div
            style={{
              width: '100%',
              maxWidth: 420,
              background: '#fff',
              borderRadius: 16,
              padding: 20,
            }}
          >

            <h2 style={{ margin: '0 0 5px', fontSize: 21 }}>
              จัดการวัตถุดิบ
            </h2>

            <div style={{ color: '#777', fontSize: 13, marginBottom: 15 }}>
              {selectedRawMaterial.name ||
                selectedRawMaterial.material_name ||
                selectedRawMaterial.raw_material_name}
            </div>

            <div style={{ ...twoColStyle, marginBottom: 12 }}>

              <button
                type="button"
                onClick={() => setRawAction('add')}
                style={{
                  border: 'none',
                  borderRadius: 9,
                  padding: '11px',
                  background: rawAction === 'add' ? '#2e7d32' : '#eee',
                  color: rawAction === 'add' ? '#fff' : '#555',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                ＋ เพิ่ม
              </button>

              <button
                type="button"
                onClick={() => setRawAction('remove')}
                style={{
                  border: 'none',
                  borderRadius: 9,
                  padding: '11px',
                  background: rawAction === 'remove' ? '#c62828' : '#eee',
                  color: rawAction === 'remove' ? '#fff' : '#555',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                − ลด
              </button>

            </div>

            <input
              type="number"
              min="0"
              placeholder="จำนวน"
              value={rawQty}
              onChange={e => setRawQty(e.target.value)}
              style={{ ...inputStyle(18, '12px'), fontSize: 16 }}
            />

            <div style={twoColStyle}>

              <button
                type="button"
                onClick={() => setSelectedRawMaterial(null)}
                style={cancelBtnStyle}
              >
                ยกเลิก
              </button>

              <button
                type="button"
                onClick={updateRawStock}
                disabled={savingRaw}
                style={primaryBtnStyle}
              >
                {savingRaw
                  ? 'กำลังบันทึก...'
                  : 'บันทึก'}
              </button>

            </div>

          </div>

        </div>
      )}


      {/* =====================================================
          ADMIN BOTTOM NAVIGATION
      ===================================================== */}

      <nav
        style={{
          position: 'fixed', left: 0, right: 0, bottom: 0,
          height: 74, background: '#ff1111', display: 'flex',
          justifyContent: 'center', zIndex: 3000,
          boxShadow: '0 -2px 10px rgba(0,0,0,0.12)',
        }}
      >
        <div
          style={{ width: '100%', maxWidth: 2000, display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)', alignItems: 'stretch' }}
        >
          <Link to="/admin" style={{ ...navLinkStyle, transition: 'background 0.2s' }}>
            <HomeIcon size={26} />
            <span>หน้าหลัก</span>
          </Link>

          <Link to="/admin/sales" style={navLinkStyle}>
            <ReceiptIcon size={27} />
            <span>ประวัติการขาย</span>
          </Link>

          <Link
            to="/admin/products"
            style={{
              ...navLinkStyle,
              fontWeight: 700,
              background: 'rgba(255,255,255,0.20)',
              borderRadius: '12px 12px 0 0',
              marginTop: 4,
            }}
          >
            <ShoppingBagIcon size={26} />
            <span>แก้ไขสินค้า</span>
          </Link>

          <Link to="/admin/promotions" style={navLinkStyle}>
            <GiftIcon size={26} />
            <span>โปรโมชั่น</span>
          </Link>

          <Link to="/admin/branches" style={navLinkStyle}>
            <BuildingIcon size={26} />
            <span>จัดการสาขา</span>
          </Link>
        </div>
      </nav>
    </div>
  )

}