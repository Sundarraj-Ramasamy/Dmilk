import { defaultRates, products, zeroQuantities, type DailyRow, type Dashboard, type Quantities, type Rates, type Shop, type Totals } from './types'

const DATABASE_KEY = 'milkroute-local-db-v1'
export const DEMO_EMAIL = 'admin@milkroute.local'
export const DEMO_PASSWORD = 'MilkRoute!2026'

type StoredEntry = {
  id: string
  shopId: string
  date: string
  quantities: Quantities
  rates: Rates
  billAmount: number
  openingBalance: number
  openingBalanceNote: string
  paidAmount: number
  paymentMethod: 'cash' | 'upi' | 'mixed'
  closingBalance: number
  delivered: boolean
}

type LocalDatabase = {
  version: 1
  shops: Shop[]
  entries: StoredEntry[]
}

const sampleShops: Shop[] = [
  { id: 'shop-aavin-new-tup', name: 'Aavin New Tup', route: 'Town route', phone: '', creditLimit: 5000, rates: { ...defaultRates(), fcmRate: 63 }, active: true },
  { id: 'shop-cotton-blossom', name: 'Cotton Blossom', route: 'Town route', phone: '', creditLimit: 8000, rates: { ...defaultRates(), fcmRate: 65 }, active: true },
  { id: 'shop-sendhur-coffee-bar', name: 'Sendhur Coffee Bar', route: 'Market route', phone: '', creditLimit: 4000, rates: { ...defaultRates(), fcmRate: 66 }, active: true },
  { id: 'shop-new-royal', name: 'New Royal', route: 'Market route', phone: '', creditLimit: 10000, rates: { ...defaultRates(), fcmRate: 68 }, active: true },
]

function readDatabase(): LocalDatabase {
  let serialized: string | null
  try {
    serialized = localStorage.getItem(DATABASE_KEY)
  } catch {
    throw new Error('MilkRoute cannot access browser storage. Check your browser privacy settings.')
  }
  if (!serialized) {
    const initial: LocalDatabase = { version: 1, shops: sampleShops, entries: [] }
    writeDatabase(initial)
    return initial
  }
  try {
    const value: unknown = JSON.parse(serialized)
    if (
      typeof value !== 'object' || value === null
      || !('version' in value) || value.version !== 1
      || !('shops' in value) || !Array.isArray(value.shops)
      || !('entries' in value) || !Array.isArray(value.entries)
    ) {
      throw new Error('Stored data has an unexpected format.')
    }
    return value as LocalDatabase
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('Saved MilkRoute data could not be read. Export or back up your browser data before clearing it.')
    }
    throw error
  }
}

function writeDatabase(database: LocalDatabase) {
  try {
    localStorage.setItem(DATABASE_KEY, JSON.stringify(database))
  } catch (error) {
    if (error instanceof DOMException && (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
      throw new Error('Browser storage is full. Export your ledger before removing old browser data.')
    }
    throw new Error('MilkRoute could not save to browser storage. Check your browser privacy settings.')
  }
}

function makeId(prefix: string) {
  return `${prefix}-${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`}`
}

function calculateBill(quantities: Quantities, rates: Rates) {
  return products.reduce((total, { key }) => total + quantities[key] * rates[`${key}Rate` as keyof Rates], 0)
}

function getDailyRows(database: LocalDatabase, date: string): DailyRow[] {
  const activeShops = database.shops
    .filter((shop) => shop.active)
    .sort((a, b) => a.route.localeCompare(b.route) || a.name.localeCompare(b.name))

  return activeShops.map((shop) => {
    const entry = database.entries.find((item) => item.shopId === shop.id && item.date === date)
    const previous = database.entries
      .filter((item) => item.shopId === shop.id && item.date < date)
      .sort((a, b) => b.date.localeCompare(a.date))[0]
    const openingBalance = entry?.openingBalance ?? previous?.closingBalance ?? 0
    const quantities = entry?.quantities ?? zeroQuantities()
    const billAmount = entry?.billAmount ?? 0
    return {
      shop,
      entryId: entry?.id ?? null,
      date,
      quantities,
      rates: entry?.rates ?? shop.rates,
      billAmount,
      openingBalance,
      openingBalanceNote: entry?.openingBalanceNote ?? '',
      totalAmount: openingBalance + billAmount,
      paidAmount: entry?.paidAmount ?? 0,
      closingBalance: entry?.closingBalance ?? openingBalance,
      delivered: entry?.delivered ?? false,
    }
  })
}

function sumRows(rows: DailyRow[]): Totals {
  return rows.reduce((totals, row) => {
    for (const { key } of products) totals.quantities[key] += row.quantities[key]
    totals.billAmount += row.billAmount
    totals.openingBalance += row.openingBalance
    totals.totalAmount += row.totalAmount
    totals.paidAmount += row.paidAmount
    totals.closingBalance += row.closingBalance
    return totals
  }, {
    quantities: zeroQuantities(),
    billAmount: 0,
    openingBalance: 0,
    totalAmount: 0,
    paidAmount: 0,
    closingBalance: 0,
  })
}

function makeDashboard(database: LocalDatabase, date: string): Dashboard {
  const rows = getDailyRows(database, date)
  const totals = sumRows(rows)
  const overdue = rows.map((row) => {
    const entry = database.entries
      .filter((item) => item.shopId === row.shop.id && item.date <= date)
      .sort((a, b) => b.date.localeCompare(a.date))[0]
    return {
      shop: row.shop,
      closingBalance: row.closingBalance,
      lastEntryDate: entry?.date ?? null,
      exceedsCreditLimit: Boolean(row.shop.creditLimit && row.closingBalance > row.shop.creditLimit),
    }
  }).sort((a, b) => b.closingBalance - a.closingBalance)
  const totalOutstanding = overdue.reduce((sum, item) => sum + item.closingBalance, 0)
  return {
    totals,
    totalOutstanding,
    collectionRate: totals.totalAmount > 0 ? Math.min(100, (totals.paidAmount / totals.totalAmount) * 100) : 0,
    overdue,
  }
}

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
}

function monthlyReport(database: LocalDatabase, date: string) {
  const monthStart = `${date.slice(0, 7)}-01`
  const nextMonth = new Date(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)), 1)).toISOString().slice(0, 10)
  const entries = database.entries.filter((entry) => entry.date >= monthStart && entry.date < nextMonth)
  const grouped = new Map<string, {
    shop: Shop
    quantities: Quantities
    billAmount: number
    openingBalance: number
    totalAmount: number
    paidAmount: number
    closingBalance: number
    daysDelivered: number
  }>()

  for (const entry of entries) {
    const shop = database.shops.find((item) => item.id === entry.shopId)
    if (!shop) continue
    let row = grouped.get(entry.shopId)
    if (!row) {
      row = {
        shop,
        quantities: zeroQuantities(),
        billAmount: 0,
        openingBalance: entry.openingBalance,
        totalAmount: 0,
        paidAmount: 0,
        closingBalance: entry.closingBalance,
        daysDelivered: 0,
      }
      grouped.set(entry.shopId, row)
    }
    for (const { key } of products) row.quantities[key] += entry.quantities[key]
    row.billAmount += entry.billAmount
    row.totalAmount += entry.billAmount
    row.paidAmount += entry.paidAmount
    row.closingBalance = entry.closingBalance
    if (entry.delivered) row.daysDelivered += 1
  }

  const rows = [...grouped.values()].sort((a, b) => a.shop.name.localeCompare(b.shop.name))
  const totals = rows.reduce((result, row) => {
    for (const { key } of products) result.quantities[key] += row.quantities[key]
    result.billAmount += row.billAmount
    result.openingBalance += row.openingBalance
    result.totalAmount += row.totalAmount
    result.paidAmount += row.paidAmount
    result.closingBalance += row.closingBalance
    return result
  }, { quantities: zeroQuantities(), billAmount: 0, openingBalance: 0, totalAmount: 0, paidAmount: 0, closingBalance: 0 })
  return { period: 'monthly', date, rows, totals }
}

export async function api<T>(path: string, _token?: string | null, options: RequestInit = {}): Promise<T> {
  const method = options.method ?? 'GET'
  const body = options.body ? JSON.parse(String(options.body)) as Record<string, unknown> : {}

  if (path === '/auth/login' && method === 'POST') {
    const email = String(body.email ?? '').trim().toLowerCase()
    const password = String(body.password ?? '')
    if (email !== DEMO_EMAIL || password !== DEMO_PASSWORD) {
      throw new Error('Use the demo email and password shown below the sign-in form.')
    }
    return { token: 'local-admin-session', admin: { email } } as T
  }

  if (path.startsWith('/entries/') && method === 'GET') {
    const date = path.slice('/entries/'.length)
    if (!isValidDate(date)) throw new Error('Choose a valid date.')
    const database = readDatabase()
    const rows = getDailyRows(database, date)
    return { rows, totals: sumRows(rows) } as T
  }

  const entryMatch = path.match(/^\/entries\/(\d{4}-\d{2}-\d{2})\/([^/]+)$/)
  if (entryMatch && method === 'PUT') {
    const [, date, shopId] = entryMatch
    if (!isValidDate(date)) throw new Error('Choose a valid date.')
    const database = readDatabase()
    const shop = database.shops.find((item) => item.id === shopId && item.active)
    if (!shop) throw new Error('Active shop not found.')
    const existing = database.entries.find((entry) => entry.shopId === shopId && entry.date === date)
    const previous = database.entries
      .filter((entry) => entry.shopId === shopId && entry.date < date)
      .sort((a, b) => b.date.localeCompare(a.date))[0]
    const expectedOpening = existing?.openingBalance ?? previous?.closingBalance ?? 0
    const openingBalance = typeof body.openingBalance === 'number' ? body.openingBalance : expectedOpening
    const openingBalanceNote = String(body.openingBalanceNote ?? '').trim()
    if (openingBalance !== expectedOpening && !openingBalanceNote) {
      throw new Error('Add an audit note when changing the opening balance.')
    }
    const inputQuantities = (body.quantities ?? {}) as Partial<Quantities>
    const quantities = Object.fromEntries(products.map(({ key }) => {
      const value = Number(inputQuantities[key] ?? 0)
      return [key, Number.isFinite(value) && value >= 0 ? value : 0]
    })) as Quantities
    const rates = existing?.rates ?? shop.rates
    const billAmount = calculateBill(quantities, rates)
    const paidAmount = Math.max(0, Number(body.paidAmount) || 0)
    const paymentMethod = body.paymentMethod === 'upi' || body.paymentMethod === 'mixed' ? body.paymentMethod : 'cash'
    const entry: StoredEntry = {
      id: existing?.id ?? makeId('entry'),
      shopId,
      date,
      quantities,
      rates,
      billAmount,
      openingBalance,
      openingBalanceNote: openingBalance !== expectedOpening ? openingBalanceNote : existing?.openingBalanceNote ?? '',
      paidAmount,
      paymentMethod,
      closingBalance: openingBalance + billAmount - paidAmount,
      delivered: Boolean(body.delivered),
    }
    database.entries = database.entries.filter((item) => !(item.shopId === shopId && item.date === date))
    database.entries.push(entry)
    let carriedClosing = entry.closingBalance
    const laterEntries = database.entries
      .filter((item) => item.shopId === shopId && item.date > date)
      .sort((a, b) => a.date.localeCompare(b.date))
    for (const laterEntry of laterEntries) {
      if (!laterEntry.openingBalanceNote) laterEntry.openingBalance = carriedClosing
      laterEntry.closingBalance = laterEntry.openingBalance + laterEntry.billAmount - laterEntry.paidAmount
      carriedClosing = laterEntry.closingBalance
    }
    writeDatabase(database)
    return entry as T
  }

  if (path === '/shops' && method === 'GET') {
    return readDatabase().shops.sort((a, b) => Number(b.active) - Number(a.active) || a.route.localeCompare(b.route) || a.name.localeCompare(b.name)) as T
  }

  if (path === '/shops' && method === 'POST') {
    const database = readDatabase()
    const name = String(body.name ?? '').trim()
    if (!name) throw new Error('Shop name is required.')
    if (database.shops.some((shop) => shop.name.toLowerCase() === name.toLowerCase())) {
      throw new Error('A shop with this name already exists.')
    }
    const shop: Shop = {
      id: makeId('shop'),
      name,
      phone: String(body.phone ?? '').trim(),
      route: String(body.route ?? '').trim(),
      creditLimit: Math.max(0, Number(body.creditLimit) || 0),
      rates: normalizeRates(body.rates),
      active: true,
    }
    database.shops.push(shop)
    writeDatabase(database)
    return shop as T
  }

  const shopMatch = path.match(/^\/shops\/([^/]+)$/)
  if (shopMatch && method === 'PUT') {
    const database = readDatabase()
    const shop = database.shops.find((item) => item.id === shopMatch[1])
    if (!shop) throw new Error('Shop not found.')
    const name = String(body.name ?? shop.name).trim()
    if (database.shops.some((item) => item.id !== shop.id && item.name.toLowerCase() === name.toLowerCase())) {
      throw new Error('A shop with this name already exists.')
    }
    Object.assign(shop, {
      name,
      phone: String(body.phone ?? '').trim(),
      route: String(body.route ?? '').trim(),
      creditLimit: Math.max(0, Number(body.creditLimit) || 0),
      rates: normalizeRates(body.rates ?? shop.rates),
      active: typeof body.active === 'boolean' ? body.active : shop.active,
    })
    writeDatabase(database)
    return shop as T
  }

  if (path.startsWith('/dashboard?')) {
    const date = new URLSearchParams(path.slice(path.indexOf('?') + 1)).get('date') ?? ''
    if (!isValidDate(date)) throw new Error('Choose a valid date.')
    return makeDashboard(readDatabase(), date) as T
  }

  const ledgerMatch = path.match(/^\/dashboard\/shops\/([^/]+)\/ledger$/)
  if (ledgerMatch) {
    const database = readDatabase()
    const shop = database.shops.find((item) => item.id === ledgerMatch[1])
    if (!shop) throw new Error('Shop not found.')
    return {
      shop,
      entries: database.entries.filter((entry) => entry.shopId === shop.id).sort((a, b) => b.date.localeCompare(a.date)),
    } as T
  }

  if (path.startsWith('/reports?')) {
    const query = new URLSearchParams(path.slice(path.indexOf('?') + 1))
    const date = query.get('date') ?? ''
    if (!isValidDate(date)) throw new Error('Choose a valid date.')
    const database = readDatabase()
    if (query.get('period') === 'monthly') return monthlyReport(database, date) as T
    const rows = getDailyRows(database, date)
    return { period: 'daily', date, rows, totals: sumRows(rows) } as T
  }

  throw new Error(`Unsupported local data operation: ${method} ${path}`)
}

function normalizeRates(value: unknown): Rates {
  const rates = typeof value === 'object' && value !== null ? value as Partial<Rates> : {}
  const defaults = defaultRates()
  return {
    fcmRate: positiveRate(rates.fcmRate, defaults.fcmRate),
    tonedCurdRate: positiveRate(rates.tonedCurdRate, defaults.tonedCurdRate),
    dtcCurdRate: positiveRate(rates.dtcCurdRate, defaults.dtcCurdRate),
    pack10Rate: positiveRate(rates.pack10Rate, defaults.pack10Rate),
    fcm500Rate: positiveRate(rates.fcm500Rate, defaults.fcm500Rate),
  }
}

function positiveRate(value: number | undefined, fallback: number) {
  const rate = Number(value)
  return Number.isFinite(rate) && rate > 0 ? rate : fallback
}
