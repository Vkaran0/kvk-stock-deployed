export interface StockItem {
  id: string;
  name: string;
  itemCode: string;
  description: string;
  category: string;
  buyPrice: number;
  sellPrice: number;
  quantity: number;
  minStock: number;
  imageUrl: string;
  inDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  role: 'admin' | 'staff';
  username: string;
  password: string;
  photo: string;
  joinDate: string;
  isActive: boolean;
}

export interface BillItem {
  stockId: string;
  name: string;
  itemCode: string;
  quantity: number;
  price: number;
  total: number;
}

export interface Bill {
  id: string;
  billNumber: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  items: BillItem[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMode: 'cash' | 'online';
  staffId: string;
  staffName: string;
  createdAt: string;
}

export interface DailyStock {
  date: string;
  openingStock: number;
  closingStock: number;
  totalSales: number;
  totalRevenue: number;
}
