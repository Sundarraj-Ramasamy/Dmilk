import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  ArrowDownRight, ArrowUpRight, Boxes, Check, ChevronDown, ChevronRight, CircleDollarSign,
  ClipboardList, CreditCard, Download, LogOut, Milk, Plus, Search,
  Send, ShieldCheck, Store, Truck, Wallet, X,
} from 'lucide-react'
import { api } from './lib/api'
import { currency, displayDate, number, todayString } from './lib/format'
import {
  defaultRates, products, zeroQuantities,
  type DailyRow, type Dashboard, type Quantities, type Rates, type Shop, type SkuKey, type Totals,
} from './lib/types'
import { Button, Card, Dialog, DialogContent } from './components/ui'
import './App.css'

type View = 'delivery' | 'shops' | 'credit' | 'reconcile'
type EntryInput = {
  quantities: Quantities
  paidAmount: number
  paymentMethod: 'cash' | 'upi' | 'mixed'
  delivered: boolean
  openingBalance: number
  openingBalanceNote: string
}

const viewTitles: Record<View, string> = {
  delivery: 'Morning delivery',
  shops: 'Shop master',
  credit: 'Credit & collections',
  reconcile: 'Daily reconciliation',
}

function getId(shop: Shop) {
  return shop.id ?? shop._id ?? ''
}

function billFor(quantities: Quantities, rates: Rates) {
  return quantities.fcm * rates.fcmRate
    + quantities.tonedCurd * rates.tonedCurdRate
    + quantities.dtcCurd * rates.dtcCurdRate
    + quantities.pack10 * rates.pack10Rate
    + quantities.fcm500 * rates.fcm500Rate
}

function Login({ onLogin }: { onLogin: (email: string, password: string) => Promise<void> }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await onLogin(email, password)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Sign in failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="login-page">
      <div className="login-card">
        <div className="brand-mark"><Milk size={25} strokeWidth={2.2} /></div>
        <p className="eyebrow">MILKROUTE • DISTRIBUTION</p>
        <h1>Your daily route, in control.</h1>
        <p className="login-copy">Sign in with the administrator account configured for your MilkRoute server.</p>
        <form className="login-form" onSubmit={submit}>
          <label>Email address<input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@example.com" required /></label>
          <label>Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" required /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <Button type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}<ChevronRight size={17} /></Button>
        </form>
        <div className="login-safe"><ShieldCheck size={15} /> Secure administrator sign-in</div>
        <div className="demo-credentials">Delivery records and shop details are stored in the connected MongoDB database.</div>
      </div>
      <div className="login-side-note">A little more clarity<br />on every delivery.</div>
    </main>
  )
}

function QuantityField({
  label, rate, value, onChange,
}: { label: string; rate: number; value: number; onChange: (value: number) => void }) {
  return (
    <label className="quantity-field">
      <span>{label}</span>
      <small>{currency(rate)} / unit</small>
      <input inputMode="decimal" type="number" min="0" step="any" value={value || ''} placeholder="0" onChange={(event) => onChange(event.target.value === '' ? 0 : Math.max(0, Number(event.target.value) || 0))} />
    </label>
  )
}

function DeliveryCard({
  row, onSave, saving,
}: { row: DailyRow; onSave: (input: EntryInput) => void; saving: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const [quantities, setQuantities] = useState<Quantities>(row.quantities ?? zeroQuantities())
  const [paidAmount, setPaidAmount] = useState(row.paidAmount)
  const [paymentMethod, setPaymentMethod] = useState<EntryInput['paymentMethod']>('cash')
  const [openingBalance, setOpeningBalance] = useState(row.openingBalance)
  const [openingBalanceNote, setOpeningBalanceNote] = useState(row.openingBalanceNote)
  const [delivered, setDelivered] = useState(row.delivered)
  const [validation, setValidation] = useState('')

  const billAmount = billFor(quantities, row.rates)
  const totalAmount = billAmount + openingBalance
  const closingBalance = totalAmount - paidAmount
  const hasBalance = row.closingBalance > 0

  function updateQuantity(key: SkuKey, value: number) {
    setQuantities((current) => ({ ...current, [key]: value }))
  }

  function save() {
    if (openingBalance !== row.openingBalance && !openingBalanceNote.trim()) {
      setValidation('Add a short audit note to change the opening balance.')
      return
    }
    setValidation('')
    onSave({ quantities, paidAmount, paymentMethod, delivered, openingBalance, openingBalanceNote })
  }

  function sendWhatsApp() {
    const items = products
      .filter(({ key }) => quantities[key] > 0)
      .map(({ key, label }) => `${label}: ${number(quantities[key])} × ${currency(row.rates[`${key}Rate` as keyof Rates])}`)
    const message = [
      `Hello ${row.shop.name},`,
      `Milk delivery bill for ${displayDate(row.date)}`,
      ...(items.length ? items : ['No items delivered']),
      `Bill amount: ${currency(billAmount)}`,
      `Opening balance: ${currency(openingBalance)}`,
      `Total due: ${currency(totalAmount)}`,
      `Paid (${paymentMethod.toUpperCase()}): ${currency(paidAmount)}`,
      `Closing balance: ${currency(closingBalance)}`,
      'Thank you!',
    ].join('\n')
    const digits = row.shop.phone.replace(/\D/g, '')
    const phone = digits.length === 10 ? `91${digits}` : digits
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <Card className={`delivery-card ${expanded ? 'delivery-card-open' : ''}`}>
      <button type="button" className="delivery-card-head" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>
        <span className={`shop-avatar ${row.delivered ? 'avatar-delivered' : ''}`}>{row.shop.name.slice(0, 1).toUpperCase()}</span>
        <span className="shop-heading">
          <strong>{row.shop.name}</strong>
          <span>{row.shop.route || 'No route'}{row.shop.phone ? ` · ${row.shop.phone}` : ''}</span>
        </span>
        <span className="delivery-card-meta">
          {hasBalance && <b className="balance-badge">{currency(row.closingBalance)}</b>}
          <span className={`status-badge ${row.delivered ? 'status-done' : 'status-pending'}`}>{row.delivered ? 'Delivered' : 'Pending'}</span>
        </span>
        {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
      </button>
      {expanded && (
        <div className="entry-editor">
          <div className="form-section-title"><span>Delivery quantities</span><span className="muted">Rates from this shop's card</span></div>
          <div className="quantity-grid">
            {products.map(({ key, label }) => (
              <QuantityField key={key} label={label} rate={row.rates[`${key}Rate` as keyof Rates]} value={quantities[key]} onChange={(value) => updateQuantity(key, value)} />
            ))}
          </div>
          <div className="entry-two-col">
            <label className="input-field">
              <span>Opening balance</span>
              <input inputMode="decimal" type="number" min="0" step="any" value={openingBalance} onChange={(event) => setOpeningBalance(event.target.value === '' ? 0 : Number(event.target.value) || 0)} />
              {openingBalance !== row.openingBalance && <small className="warning-help">Changing from {currency(row.openingBalance)} needs an audit note.</small>}
            </label>
            <label className="input-field">
              <span>Paid today</span>
              <input inputMode="decimal" type="number" min="0" step="any" value={paidAmount || ''} placeholder="0" onChange={(event) => setPaidAmount(event.target.value === '' ? 0 : Math.max(0, Number(event.target.value) || 0))} />
            </label>
          </div>
          {openingBalance !== row.openingBalance && (
            <label className="input-field note-field">
              <span>Opening balance audit note</span>
              <input value={openingBalanceNote} onChange={(event) => setOpeningBalanceNote(event.target.value)} placeholder="e.g. Corrected after checking yesterday's ledger" />
            </label>
          )}
          <div className="entry-controls">
            <label className="input-field payment-select">
              <span>Payment mode</span>
              <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as EntryInput['paymentMethod'])}>
                <option value="cash">Cash</option><option value="upi">UPI</option><option value="mixed">Cash + UPI</option>
              </select>
            </label>
            <label className="delivered-toggle">
              <input type="checkbox" checked={delivered} onChange={(event) => setDelivered(event.target.checked)} />
              <span className="toggle-check"><Check size={13} /></span> Mark delivered
            </label>
          </div>
          <div className="live-totals">
            <div><span>Bill amount</span><strong>{currency(billAmount)}</strong></div>
            <div><span>Total due</span><strong>{currency(totalAmount)}</strong></div>
            <div><span>New closing</span><strong className={closingBalance > 0 ? 'text-amber' : 'text-green'}>{currency(closingBalance)}</strong></div>
          </div>
          {validation && <p className="form-error" role="alert">{validation}</p>}
          <div className="entry-actions">
            <Button type="button" variant="outline" onClick={sendWhatsApp}><Send size={15} /> WhatsApp bill</Button>
            <Button type="button" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save entry'}<Check size={16} /></Button>
          </div>
        </div>
      )}
    </Card>
  )
}

type ShopForm = {
  name: string
  phone: string
  route: string
  creditLimit: number
  rates: Rates
}

function ShopMaster({
  shops, saving, onSave, onToggle,
}: { shops: Shop[]; saving: boolean; onSave: (form: ShopForm, id?: string) => void; onToggle: (shop: Shop) => void }) {
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<Shop | null>(null)
  const [query, setQuery] = useState('')
  const [form, setForm] = useState<ShopForm>({ name: '', phone: '', route: '', creditLimit: 0, rates: defaultRates() })

  function openEditor(shop?: Shop) {
    setEditing(shop ?? null)
    setForm(shop ? {
      name: shop.name,
      phone: shop.phone ?? '',
      route: shop.route ?? '',
      creditLimit: shop.creditLimit ?? 0,
      rates: shop.rates,
    } : { name: '', phone: '', route: '', creditLimit: 0, rates: defaultRates() })
    setEditorOpen(true)
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    onSave(form, editing ? getId(editing) : undefined)
    setEditorOpen(false)
  }

  const visibleShops = shops.filter((shop) => `${shop.name} ${shop.route}`.toLowerCase().includes(query.toLowerCase()))

  return (
    <section className="page-section">
      <div className="page-heading-row">
        <div><p className="eyebrow">YOUR CUSTOMER NETWORK</p><h1>Shop master</h1><p className="page-subtitle">Keep routes, credit limits and shop-specific prices up to date.</p></div>
        <Button onClick={() => openEditor()}><Plus size={17} /> Add shop</Button>
      </div>
      <Card className="shop-list-card">
        <div className="list-toolbar">
          <div><strong>{shops.filter((shop) => shop.active).length} active shops</strong><span> · {shops.length} total</span></div>
          <label className="search-box"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search shops or routes" /></label>
        </div>
        <div className="shop-table-wrap">
          <table className="data-table">
            <thead><tr><th>Shop</th><th>Route / area</th><th>Phone</th><th>FCM rate</th><th>Credit limit</th><th>Status</th><th /></tr></thead>
            <tbody>{visibleShops.map((shop) => (
              <tr key={getId(shop)} className={!shop.active ? 'inactive-row' : ''}>
                <td><div className="table-shop"><span className="shop-avatar">{shop.name.slice(0, 1).toUpperCase()}</span><strong>{shop.name}</strong></div></td>
                <td>{shop.route || '—'}</td><td>{shop.phone || '—'}</td><td className="rate-value">{currency(shop.rates.fcmRate)}</td><td>{currency(shop.creditLimit)}</td>
                <td><span className={`status-badge ${shop.active ? 'status-done' : 'status-inactive'}`}>{shop.active ? 'Active' : 'Inactive'}</span></td>
                <td><div className="row-actions"><Button type="button" variant="ghost" size="sm" onClick={() => openEditor(shop)}>Edit</Button><Button type="button" variant="ghost" size="sm" onClick={() => onToggle(shop)}>{shop.active ? 'Deactivate' : 'Activate'}</Button></div></td>
              </tr>
            ))}</tbody>
          </table>
          {!visibleShops.length && <div className="empty-state">No shops match that search.</div>}
        </div>
      </Card>
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="shop-dialog">
          <p className="eyebrow">{editing ? 'EDIT SHOP DETAILS' : 'NEW CUSTOMER'}</p><h2>{editing ? 'Update shop' : 'Add a shop'}</h2>
          <form className="shop-form" onSubmit={submit}>
            <div className="shop-form-grid">
              <label className="input-field"><span>Shop name</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
              <label className="input-field"><span>Phone / WhatsApp</span><input inputMode="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
              <label className="input-field"><span>Route / area</span><input value={form.route} onChange={(event) => setForm({ ...form, route: event.target.value })} /></label>
              <label className="input-field"><span>Credit limit (₹)</span><input inputMode="decimal" type="number" min="0" value={form.creditLimit || ''} placeholder="0" onChange={(event) => setForm({ ...form, creditLimit: event.target.value === '' ? 0 : Number(event.target.value) || 0 })} /></label>
            </div>
            <div className="form-section-title"><span>Custom rate card</span><span className="muted">₹ per unit</span></div>
            <div className="rate-grid">{products.map(({ key, label }) => {
              const rateKey = `${key}Rate` as keyof Rates
              return <label className="input-field" key={key}><span>{label}</span><input inputMode="decimal" type="number" min="0" step="any" value={form.rates[rateKey]} onChange={(event) => setForm({ ...form, rates: { ...form.rates, [rateKey]: event.target.value === '' ? 0 : Number(event.target.value) || 0 } })} required /></label>
            })}</div>
            <div className="dialog-actions"><Button type="button" variant="outline" onClick={() => setEditorOpen(false)}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Create shop'}</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  )
}

function KpiCard({
  title, value, hint, icon, tone,
}: { title: string; value: string; hint: string; icon: React.ReactNode; tone: string }) {
  return <Card className={`kpi-card kpi-${tone}`}><div className="kpi-top"><span>{title}</span><i>{icon}</i></div><strong>{value}</strong><small>{hint}</small></Card>
}

function CreditDashboard({
  dashboard, date, onOpenLedger,
}: { dashboard: Dashboard | null; date: string; onOpenLedger: (shop: Shop) => void }) {
  const overdue = dashboard?.overdue ?? []
  const totalSales = dashboard?.totals.billAmount ?? 0
  const cashCollected = dashboard?.totals.paidAmount ?? 0
  return (
    <section className="page-section">
      <div className="page-heading-row">
        <div><p className="eyebrow">KEEP A CLOSE EYE ON CREDIT</p><h1>Credit & collections</h1><p className="page-subtitle">Live balances across every active shop.</p></div>
        <span className="date-pill"><CircleDollarSign size={15} /> As of {displayDate(date)}</span>
      </div>
      <div className="kpi-grid">
        <KpiCard title="Today's total sales" value={currency(totalSales)} hint="Bills from today's deliveries" icon={<ArrowUpRight size={17} />} tone="green" />
        <KpiCard title="Collected today" value={currency(cashCollected)} hint="Cash and UPI received" icon={<Wallet size={17} />} tone="blue" />
        <KpiCard title="Outstanding receivables" value={currency(dashboard?.totalOutstanding ?? 0)} hint="Latest closing balances" icon={<CreditCard size={17} />} tone="amber" />
        <KpiCard title="Collection rate" value={`${(dashboard?.collectionRate ?? 0).toFixed(1)}%`} hint="Collected against today's due" icon={<ArrowDownRight size={17} />} tone="violet" />
      </div>
      <Card className="overdue-card">
        <div className="card-title-row"><div><h2>Accounts to follow up</h2><p>Sorted by highest closing balance</p></div><span className="count-pill">{overdue.filter((item) => item.closingBalance > 0).length} with balance</span></div>
        <div className="shop-table-wrap">
          <table className="data-table">
            <thead><tr><th>Shop</th><th>Last entry</th><th>Credit limit</th><th>Closing balance</th><th>Credit status</th><th /></tr></thead>
            <tbody>{overdue.map((item) => (
              <tr key={getId(item.shop)} className={item.exceedsCreditLimit ? 'credit-alert-row' : ''} onClick={() => onOpenLedger(item.shop)}>
                <td><div className="table-shop"><span className="shop-avatar">{item.shop.name.slice(0, 1).toUpperCase()}</span><strong>{item.shop.name}</strong></div></td>
                <td>{item.lastEntryDate ? displayDate(item.lastEntryDate) : 'No entries yet'}</td>
                <td>{item.shop.creditLimit ? currency(item.shop.creditLimit) : 'Not set'}</td>
                <td className={`amount-strong ${item.closingBalance > 0 ? 'text-amber' : 'text-green'}`}>{currency(item.closingBalance)}</td>
                <td>{item.exceedsCreditLimit ? <span className="status-badge status-alert">Over limit</span> : item.closingBalance > 0 ? <span className="status-badge status-pending">Outstanding</span> : <span className="status-badge status-done">Clear</span>}</td>
                <td><Button type="button" variant="ghost" size="sm" onClick={(event) => { event.stopPropagation(); onOpenLedger(item.shop) }}>View ledger<ChevronRight size={15} /></Button></td>
              </tr>
            ))}</tbody>
          </table>
          {!overdue.length && <div className="empty-state">Add shops to start tracking collections.</div>}
        </div>
      </Card>
    </section>
  )
}

function LedgerDialog({ shop, onClose }: { shop: Shop | null; onClose: () => void }) {
  const [ledger, setLedger] = useState<{ shopId: string; shop: Shop; entries: Record<string, unknown>[] } | null>(null)
  const [error, setError] = useState<{ shopId: string; message: string } | null>(null)
  const token = localStorage.getItem('milkroute-token')
  const shopId = shop ? getId(shop) : ''
  const currentLedger = ledger?.shopId === shopId ? ledger : null
  const currentError = error?.shopId === shopId ? error.message : ''
  useEffect(() => {
    if (!shopId) return
    let active = true
    api<{ shop: Shop; entries: Record<string, unknown>[] }>(`/dashboard/shops/${shopId}/ledger`, token)
      .then((result) => { if (active) setLedger({ ...result, shopId }) })
      .catch((reason: unknown) => { if (active) setError({ shopId, message: reason instanceof Error ? reason.message : 'Could not load ledger.' }) })
    return () => { active = false }
  }, [shopId, token])

  return (
    <Dialog open={Boolean(shop)} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="ledger-dialog">
        <p className="eyebrow">SHOP LEDGER</p><h2>{shop?.name ?? 'Account history'}</h2>
        <p className="page-subtitle">{shop?.route || 'No route'}{shop?.phone ? ` · ${shop.phone}` : ''}</p>
        <div className="ledger-content">
          {currentError ? <p className="form-error">{currentError}</p> : !currentLedger ? <p className="muted">Loading entries…</p> : currentLedger.entries.length ? currentLedger.entries.map((entry, index) => {
            const quantities = entry.quantities as Quantities
            return <div className="ledger-row" key={String(entry._id ?? index)}>
              <div><strong>{displayDate(String(entry.date))}</strong><small>{products.filter(({ key }) => quantities[key] > 0).map(({ short, key }) => `${short} ${number(quantities[key])}`).join(' · ') || 'No items'}{entry.openingBalanceNote ? ` · Note: ${String(entry.openingBalanceNote)}` : ''}</small></div>
              <div className="ledger-amounts"><span>Bill {currency(Number(entry.billAmount))}</span><span>Paid {currency(Number(entry.paidAmount))}</span><strong>Balance {currency(Number(entry.closingBalance))}</strong></div>
            </div>
          }) : <div className="empty-state">No daily entries for this shop yet.</div>}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Reconciliation({ date, rows, totals, onMessage }: { date: string; rows: DailyRow[]; totals: Totals; onMessage: (message: string) => void }) {
  const [period, setPeriod] = useState<'daily' | 'monthly'>('daily')
  const [format, setFormat] = useState<'xlsx' | 'csv'>('xlsx')
  const [downloading, setDownloading] = useState(false)
  const quantityTotals = products.map(({ key }) => rows.reduce((sum, row) => sum + row.quantities[key], 0))

  async function exportLedger() {
    setDownloading(true)
    try {
      const XLSX = await import('xlsx')
      const report = await api<{ rows: Record<string, unknown>[]; totals: Totals }>(`/reports?period=${period}&date=${date}`, localStorage.getItem('milkroute-token'))
      const output = report.rows.map((row) => {
        const shop = row.shop as Shop
        const quantities = row.quantities as Quantities
        return {
          Date: period === 'daily' ? date : date.slice(0, 7),
          Shop: shop.name,
          Route: shop.route,
          ...Object.fromEntries(products.map(({ key, label }) => [label, quantities[key]])),
          'Bill Amount': row.billAmount,
          'Opening Balance': row.openingBalance,
          'Total Due': row.totalAmount,
          'Paid Amount': row.paidAmount,
          'Closing Balance': row.closingBalance,
          ...(period === 'monthly' ? { 'Days Delivered': row.daysDelivered } : {}),
        }
      })
      const sheet = XLSX.utils.json_to_sheet(output)
      sheet['!cols'] = [{ wch: 14 }, { wch: 28 }, { wch: 20 }, ...products.map(() => ({ wch: 14 })), ...Array.from({ length: 5 }, () => ({ wch: 18 }))]
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, sheet, period === 'daily' ? 'Daily Ledger' : 'Monthly Ledger')
      XLSX.writeFile(workbook, `milkroute-${period}-${date.slice(0, 10)}.${format}`, { bookType: format })
      onMessage(`${period === 'daily' ? 'Daily' : 'Monthly'} ledger exported as ${format.toUpperCase()}.`)
    } catch (reason) {
      onMessage(reason instanceof Error ? reason.message : 'Export failed.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <section className="page-section">
      <div className="page-heading-row">
        <div><p className="eyebrow">SUPPLIER RECONCILIATION</p><h1>Daily reconciliation</h1><p className="page-subtitle">Match total units delivered against your morning supplier invoice.</p></div>
        <div className="export-controls">
          <select aria-label="Export period" value={period} onChange={(event) => setPeriod(event.target.value as 'daily' | 'monthly')}><option value="daily">Daily ledger</option><option value="monthly">Monthly ledger</option></select>
          <select aria-label="Export file format" value={format} onChange={(event) => setFormat(event.target.value as 'xlsx' | 'csv')}><option value="xlsx">Excel (.xlsx)</option><option value="csv">CSV</option></select>
          <Button onClick={exportLedger} disabled={downloading}><Download size={16} />{downloading ? 'Preparing…' : 'Export'}</Button>
        </div>
      </div>
      <Card className="reconcile-card">
        <div className="card-title-row"><div><h2>Units delivered</h2><p>{displayDate(date)} · all active shops</p></div><span className="date-pill"><Boxes size={16} /> Five SKUs</span></div>
        <div className="reconcile-product-grid">{products.map(({ key, label }, index) => (
          <div className="reconcile-product" key={key}><span className="product-dot" /><span>{label}</span><strong>{number(quantityTotals[index])}</strong><small>units</small></div>
        ))}</div>
        <div className="supplier-note"><Milk size={17} /><span>Use these unit totals to reconcile with the bulk supplier invoice.</span><strong>{rows.filter((row) => row.delivered).length} shops delivered</strong></div>
      </Card>
      <Card className="financial-summary">
        <div className="card-title-row"><div><h2>Financial summary</h2><p>Aggregated across all active shops — including zero-quantity days.</p></div><ClipboardList size={19} className="muted-icon" /></div>
        <div className="financial-grid">
          <div><span>Total billed</span><strong>{currency(totals.billAmount)}</strong></div>
          <div><span>Total opening balance</span><strong>{currency(totals.openingBalance)}</strong></div>
          <div><span>Total collectible</span><strong>{currency(totals.totalAmount)}</strong></div>
          <div><span>Total paid</span><strong className="text-green">{currency(totals.paidAmount)}</strong></div>
          <div><span>Net closing balance</span><strong className={totals.closingBalance > 0 ? 'text-amber' : 'text-green'}>{currency(totals.closingBalance)}</strong></div>
        </div>
      </Card>
    </section>
  )
}

function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('milkroute-token'))
  const [view, setView] = useState<View>('delivery')
  const [date, setDate] = useState(todayString)
  const [rows, setRows] = useState<DailyRow[]>([])
  const [shops, setShops] = useState<Shop[]>([])
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [selectedLedger, setSelectedLedger] = useState<Shop | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'pending' | 'delivered' | 'balance'>('all')
  const [loading, setLoading] = useState(false)
  const [savingShop, setSavingShop] = useState(false)
  const [savingEntry, setSavingEntry] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const [loadError, setLoadError] = useState('')
  const loadSequence = useRef(0)

  const loadDay = useCallback(async () => {
    const requestId = ++loadSequence.current
    if (!token) return
    await Promise.resolve()
    if (requestId !== loadSequence.current) return
    setLoading(true)
    setLoadError('')
    try {
      const [daily, metrics, shopList] = await Promise.all([
        api<{ rows: DailyRow[]; totals: Totals }>(`/entries/${date}`, token),
        api<Dashboard>(`/dashboard?date=${date}`, token),
        api<Shop[]>('/shops', token),
      ])
      if (requestId !== loadSequence.current) return
      setRows(daily.rows)
      setDashboard(metrics)
      setShops(shopList)
    } catch (reason) {
      if (requestId !== loadSequence.current) return
      const message = reason instanceof Error ? reason.message : 'Unable to load your data.'
      setLoadError(message)
      if (message.toLowerCase().includes('session has expired')) {
        localStorage.removeItem('milkroute-token')
        setToken(null)
      }
    } finally {
      if (requestId === loadSequence.current) setLoading(false)
    }
  }, [date, token])

  useEffect(() => {
    const task = window.setTimeout(() => { void loadDay() }, 0)
    return () => window.clearTimeout(task)
  }, [loadDay])
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 3500)
    return () => window.clearTimeout(timer)
  }, [toast])

  async function login(email: string, password: string) {
    const result = await api<{ token: string }>('/auth/login', null, { method: 'POST', body: JSON.stringify({ email, password }) })
    localStorage.setItem('milkroute-token', result.token)
    setToken(result.token)
  }

  function logout() {
    localStorage.removeItem('milkroute-token')
    setToken(null)
    setRows([])
    setShops([])
  }

  async function saveEntry(shopId: string, input: EntryInput) {
    setSavingEntry(shopId)
    setLoadError('')
    try {
      await api(`/entries/${date}/${shopId}`, token, { method: 'PUT', body: JSON.stringify(input) })
      await loadDay()
      setToast('Delivery and collection saved.')
    } catch (reason) {
      setLoadError(reason instanceof Error ? reason.message : 'Could not save this entry.')
    } finally {
      setSavingEntry(null)
    }
  }

  async function saveShop(form: ShopForm, id?: string) {
    setSavingShop(true)
    try {
      await api(`/shops${id ? `/${id}` : ''}`, token, {
        method: id ? 'PUT' : 'POST',
        body: JSON.stringify(form),
      })
      await loadDay()
      setToast(id ? 'Shop details updated.' : 'Shop added to the route.')
    } catch (reason) {
      setLoadError(reason instanceof Error ? reason.message : 'Could not save shop.')
    } finally {
      setSavingShop(false)
    }
  }

  async function toggleShop(shop: Shop) {
    try {
      await api(`/shops/${getId(shop)}`, token, {
        method: 'PUT',
        body: JSON.stringify({ ...shop, active: !shop.active }),
      })
      await loadDay()
      setToast(shop.active ? `${shop.name} deactivated.` : `${shop.name} reactivated.`)
    } catch (reason) {
      setLoadError(reason instanceof Error ? reason.message : 'Could not update shop status.')
    }
  }

  const filteredRows = useMemo(() => rows.filter((row) => {
    const matchesText = `${row.shop.name} ${row.shop.route}`.toLowerCase().includes(search.toLowerCase())
    const matchesFilter = filter === 'all'
      || (filter === 'pending' && !row.delivered)
      || (filter === 'delivered' && row.delivered)
      || (filter === 'balance' && row.closingBalance > 0)
    return matchesText && matchesFilter
  }), [filter, rows, search])

  if (!token) return <Login onLogin={login} />

  const tabs: { id: View; label: string; icon: typeof Truck }[] = [
    { id: 'delivery', label: 'Delivery', icon: Truck },
    { id: 'shops', label: 'Shops', icon: Store },
    { id: 'credit', label: 'Credit', icon: CircleDollarSign },
    { id: 'reconcile', label: 'Reconcile', icon: ClipboardList },
  ]

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand"><span className="brand-mark"><Milk size={22} /></span><span><strong>MilkRoute</strong><small>DAILY DISTRIBUTION</small></span></div>
        <div className="sidebar-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          {tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" className={view === id ? 'nav-item nav-item-active' : 'nav-item'} onClick={() => setView(id)}><Icon size={18} /><span>{label}</span>{id === 'delivery' && <span className="nav-counter">{rows.filter((row) => !row.delivered).length}</span>}</button>)}
        </nav>
        <div className="sidebar-bottom">
          <div className="admin-chip"><span className="admin-avatar">A</span><span><strong>Administrator</strong><small>Route manager</small></span></div>
          <Button variant="ghost" className="logout-button" onClick={logout}><LogOut size={16} /> Sign out</Button>
          <p className="sidebar-version">MilkRoute workspace · v1.0</p>
        </div>
      </aside>
      <main className="main-panel">
        <header className="topbar">
          <div className="mobile-brand"><span className="brand-mark"><Milk size={19} /></span><strong>MilkRoute</strong></div>
          <div className="breadcrumbs"><span>Workspace</span><ChevronRight size={14} /><strong>{viewTitles[view]}</strong></div>
          <div className="topbar-actions"><label className="topbar-date"><span>Date</span><input type="date" value={date} onChange={(event) => setDate(event.target.value || todayString())} /></label><button className="user-button" aria-label="Sign out" onClick={logout}>A</button></div>
        </header>
        <div className="page-content">
          {loadError && <div className="error-banner" role="alert"><span>{loadError}</span><button aria-label="Dismiss error" onClick={() => setLoadError('')}><X size={16} /></button></div>}
          {loading && !rows.length && view !== 'shops' ? <div className="loading-state"><div className="loader" />Loading your route…</div> : null}
          {view === 'delivery' && (
            <section className="page-section">
              <div className="page-heading-row">
                <div><p className="eyebrow">YOUR ROUTE, AT A GLANCE</p><h1>Morning delivery</h1><p className="page-subtitle">Enter quantities and collections as you move through the route.</p></div>
                <div className="delivery-summary"><span><Truck size={16} /> {rows.filter((row) => row.delivered).length} / {rows.length} delivered</span><span><Wallet size={16} /> {currency(rows.reduce((sum, row) => sum + row.paidAmount, 0))} collected</span></div>
              </div>
              <Card className="delivery-toolbar">
                <label className="search-box route-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a shop or route" /></label>
                <div className="filter-pills" role="group" aria-label="Filter shops">
                  {([{ id: 'all', label: `All shops (${rows.length})` }, { id: 'pending', label: `Pending (${rows.filter((row) => !row.delivered).length})` }, { id: 'delivered', label: 'Delivered' }, { id: 'balance', label: 'Has balance' }] as const).map((item) => <button key={item.id} type="button" className={filter === item.id ? 'filter-pill filter-pill-active' : 'filter-pill'} onClick={() => setFilter(item.id)}>{item.label}</button>)}
                </div>
              </Card>
              {filteredRows.length ? <div className="delivery-list">{filteredRows.map((row) => <DeliveryCard key={`${row.date}:${getId(row.shop)}`} row={row} saving={savingEntry === getId(row.shop)} onSave={(input) => void saveEntry(getId(row.shop), input)} />)}</div> : <Card className="empty-state empty-route"><Truck size={22} /><strong>{rows.length ? 'No shops in this view' : 'Your route is ready'}</strong><span>{rows.length ? 'Try another filter or search.' : 'Add your first shop to start recording deliveries.'}</span>{!rows.length && <Button onClick={() => setView('shops')}><Plus size={16} /> Add a shop</Button>}</Card>}
            </section>
          )}
          {view === 'shops' && <ShopMaster shops={shops} saving={savingShop} onSave={(form, id) => void saveShop(form, id)} onToggle={(shop) => void toggleShop(shop)} />}
          {view === 'credit' && <CreditDashboard dashboard={dashboard} date={date} onOpenLedger={setSelectedLedger} />}
          {view === 'reconcile' && <Reconciliation date={date} rows={rows} totals={dashboard?.totals ?? { quantities: zeroQuantities(), billAmount: 0, openingBalance: 0, totalAmount: 0, paidAmount: 0, closingBalance: 0 }} onMessage={setToast} />}
        </div>
        <footer className="mobile-bottom-nav" aria-label="Main navigation">
          {tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" className={view === id ? 'mobile-nav-item mobile-nav-active' : 'mobile-nav-item'} onClick={() => setView(id)}><Icon size={19} /><span>{label}</span></button>)}
        </footer>
      </main>
      <LedgerDialog shop={selectedLedger} onClose={() => setSelectedLedger(null)} />
      {toast && <div className="toast-message" role="status"><Check size={16} />{toast}<button aria-label="Dismiss" onClick={() => setToast('')}><X size={15} /></button></div>}
    </div>
  )
}

export default App
