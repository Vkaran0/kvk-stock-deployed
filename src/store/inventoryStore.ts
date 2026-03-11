import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { StockItem, StaffMember, Bill } from '@/types/inventory';

interface InventoryStore {
  // Auth
  currentUser: StaffMember | null;
  login: (username: string, password: string) => boolean;
  logout: () => void;

  // Stock
  stock: StockItem[];
  addStock: (item: Omit<StockItem, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateStock: (id: string, item: Partial<StockItem>) => void;
  deleteStock: (id: string) => void;

  // Staff
  staff: StaffMember[];
  addStaff: (member: Omit<StaffMember, 'id'>) => void;
  updateStaff: (id: string, member: Partial<StaffMember>) => void;
  deleteStaff: (id: string) => void;

  // Bills
  bills: Bill[];
  addBill: (bill: Omit<Bill, 'id' | 'billNumber' | 'createdAt'>) => void;
}

const generateId = () => Math.random().toString(36).substring(2, 15);
const generateBillNumber = () => `INV-${Date.now().toString(36).toUpperCase()}`;

const defaultAdmin: StaffMember = {
  id: 'admin-1',
  name: 'Admin',
  email: 'admin@shop.com',
  phone: '9999999999',
  address: 'Shop Address',
  role: 'admin',
  username: 'admin',
  password: 'admin123',
  photo: '',
  joinDate: new Date().toISOString().split('T')[0],
  isActive: true,
};

const sampleStock: StockItem[] = [
  {
    id: 's1', name: 'iPhone 15 Back Cover', itemCode: 'ACC-001', description: 'Premium silicone back cover for iPhone 15', category: 'Covers', buyPrice: 150, sellPrice: 350, quantity: 50, minStock: 10, imageUrl: '', inDate: '2026-03-01', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: 's2', name: 'Type-C Fast Charger', itemCode: 'CHG-001', description: '65W Type-C Fast Charger', category: 'Chargers', buyPrice: 400, sellPrice: 799, quantity: 30, minStock: 5, imageUrl: '', inDate: '2026-03-01', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: 's3', name: 'Bluetooth Earbuds', itemCode: 'AUD-001', description: 'TWS Wireless Earbuds with Noise Cancellation', category: 'Audio', buyPrice: 500, sellPrice: 1299, quantity: 20, minStock: 5, imageUrl: '', inDate: '2026-03-02', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: 's4', name: 'Tempered Glass Samsung S24', itemCode: 'TG-001', description: '9H Hardness Tempered Glass Screen Protector', category: 'Screen Protectors', buyPrice: 30, sellPrice: 150, quantity: 100, minStock: 20, imageUrl: '', inDate: '2026-03-01', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
];

export const useInventoryStore = create<InventoryStore>()(
  persist(
    (set, get) => ({
      currentUser: null,
      stock: sampleStock,
      staff: [defaultAdmin],
      bills: [],

      login: (username, password) => {
        const allUsers = get().staff;
        const user = allUsers.find(s => s.username === username && s.password === password && s.isActive);
        if (user) {
          set({ currentUser: user });
          return true;
        }
        return false;
      },

      logout: () => set({ currentUser: null }),

      addStock: (item) => set((state) => ({
        stock: [...state.stock, { ...item, id: generateId(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }],
      })),

      updateStock: (id, updates) => set((state) => ({
        stock: state.stock.map(s => s.id === id ? { ...s, ...updates, updatedAt: new Date().toISOString() } : s),
      })),

      deleteStock: (id) => set((state) => ({
        stock: state.stock.filter(s => s.id !== id),
      })),

      addStaff: (member) => set((state) => ({
        staff: [...state.staff, { ...member, id: generateId() }],
      })),

      updateStaff: (id, updates) => set((state) => ({
        staff: state.staff.map(s => s.id === id ? { ...s, ...updates } : s),
      })),

      deleteStaff: (id) => set((state) => ({
        staff: state.staff.filter(s => s.id !== id),
      })),

      addBill: (bill) => {
        const newBill: Bill = {
          ...bill,
          id: generateId(),
          billNumber: generateBillNumber(),
          createdAt: new Date().toISOString(),
        };
        // Reduce stock quantities
        set((state) => {
          const updatedStock = state.stock.map(s => {
            const billItem = bill.items.find(bi => bi.stockId === s.id);
            if (billItem) {
              return { ...s, quantity: Math.max(0, s.quantity - billItem.quantity), updatedAt: new Date().toISOString() };
            }
            return s;
          });
          return { bills: [...state.bills, newBill], stock: updatedStock };
        });
      },
    }),
    { name: 'inventory-store' }
  )
);
