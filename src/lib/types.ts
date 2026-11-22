export type SkuKey = 'fcm' | 'tonedCurd' | 'dtcCurd' | 'pack10' | 'fcm500'

export const products: { key: SkuKey; label: string; short: string; unit: string }[] = [
  { key: 'fcm', label: 'FCM (1L)', short: 'FCM', unit: 'L' },
  { key: 'tonedCurd', label: 'Toned Curd', short: 'Toned', unit: 'cups' },
  { key: 'dtcCurd', label: 'DTC Curd', short: 'DTC', unit: 'cups' },
  { key: 'pack10', label: '10 Rs Pack', short: 'Pack', unit: 'packs' },
  { key: 'fcm500', label: 'FCM 500 (500ml)', short: 'FCM 500', unit: 'bottles' },
]

export type Rates = {
  fcmRate: number
  tonedCurdRate: number
  dtcCurdRate: number
  pack10Rate: number
  fcm500Rate: number
}

export type Quantities = Record<SkuKey, number>

export type Shop = {
  id?: string
  _id?: string
  name: string
  phone: string
  route: string
  creditLimit: number
  rates: Rates
  active: boolean
}

export type DailyRow = {
  shop: Shop
  entryId: string | null
  date: string
  quantities: Quantities
  rates: Rates
  billAmount: number
  openingBalance: number
  openingBalanceNote: string
  totalAmount: number
  paidAmount: number
  closingBalance: number
  delivered: boolean
}

export type Totals = {
  quantities: Quantities
  billAmount: number
  openingBalance: number
  totalAmount: number
  paidAmount: number
  closingBalance: number
}

export type Dashboard = {
  totals: Totals
  totalOutstanding: number
  collectionRate: number
  overdue: { shop: Shop; closingBalance: number; lastEntryDate: string | null; exceedsCreditLimit: boolean }[]
}

export const zeroQuantities = (): Quantities => ({
  fcm: 0,
  tonedCurd: 0,
  dtcCurd: 0,
  pack10: 0,
  fcm500: 0,
})

export const defaultRates = (): Rates => ({
  fcmRate: 65,
  tonedCurdRate: 65,
  dtcCurdRate: 60,
  pack10Rate: 8.5,
  fcm500Rate: 34,
})
