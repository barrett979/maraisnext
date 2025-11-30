export interface PipelineProduct {
  id: number;
  airtable_id: string;
  status: string | null;
  product_image: string | null;
  color_image: string | null;
  sku: string | null;
  supplier_sku: string | null;
  category: string | null;
  color: string | null;
  quantity: number;
  wholesale_price: number;
  product_title: string | null;
  size_set: string | null;
  heel_height: string | null;
  sole_height: string | null;
  upper_material: string | null;
  insole_material: string | null;
  sole_material: string | null;
  lining_material: string | null;
  notes: string | null;
}

export interface InvoiceInfo {
  filename: string;
  url: string;
  type?: string;
}

export interface PipelineOrderDetail {
  id: number;
  airtable_id: string;
  order_id: number;
  order_date: string | null;
  supplier_id: number | null;
  supplier_name: string | null;
  season: string | null;
  status: string | null;
  expected_delivery: string | null;
  gender: string | null;
  country: string | null;
  product: string | null;
  notes: string | null;
  invoices: string | null;
  archived: number;
  discount_percent: number | null;
  task_proforma: number;
  task_acconto: number;
  task_fullfilled: number;
  task_saldo: number;
  task_ritirato: number;
}

export interface PipelinePayment {
  id: number;
  payment_id: number;
  payment_date: string | null;
  amount_eur: number | null;
  payment_details: string | null;
}

export interface OrderTotals {
  productCount: number;
  totalQuantity: number;
  totalWholesale: number;
  totalPaid: number;
}

export interface Task {
  key: 'task_proforma' | 'task_acconto' | 'task_fullfilled' | 'task_saldo' | 'task_ritirato';
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  value: number;
}
