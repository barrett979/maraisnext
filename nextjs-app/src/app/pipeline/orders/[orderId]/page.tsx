'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ImageZoom } from '@/components/image-zoom';
import {
  ArrowLeft,
  FileText,
  Wallet,
  ClipboardCheck,
  CreditCard,
  Truck,
  Package,
  Clock,
  CheckCircle,
  X,
  Loader2,
  Trash2,
  Paperclip,
  ExternalLink,
  Upload,
  List,
  TrendingUp,
  Calendar,
  CalendarIcon,
  Plus,
  Pencil,
  MapPin,
  Tag,
  Percent,
  Info,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n';

interface PipelineProduct {
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

interface InvoiceInfo {
  filename: string;
  url: string;
  type?: string;
}

interface PipelineOrderDetail {
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

interface PipelinePayment {
  id: number;
  payment_id: number;
  payment_date: string | null;
  amount_eur: number | null;
  payment_details: string | null;
}

interface OrderTotals {
  productCount: number;
  totalQuantity: number;
  totalWholesale: number;
  totalPaid: number;
}

function formatDate(dateStr: string | null, locale: string): string {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getStatusBadge(status: string | null, t: (key: string) => string) {
  if (!status) return <Badge variant="secondary">-</Badge>;

  switch (status) {
    case 'в работе':
      return <Badge className="bg-blue-500 hover:bg-blue-600">{t('pipeline.inProgress')}</Badge>;
    case 'завершён':
      return <Badge className="bg-green-500 hover:bg-green-600">{t('pipeline.completed')}</Badge>;
    case 'отменён':
      return <Badge variant="destructive">{t('pipeline.canceled')}</Badge>;
    case 'internal':
      return <Badge variant="secondary">Internal</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function getProductStatusBadge(status: string | null) {
  if (!status) return null;

  const config: Record<string, { color: string; icon: typeof Package }> = {
    'in stock': { color: 'bg-green-500', icon: Package },
    'waiting': { color: 'bg-yellow-500', icon: Clock },
    'canceled': { color: 'bg-red-500', icon: X },
    'ready': { color: 'bg-blue-500', icon: CheckCircle },
    'shipped': { color: 'bg-purple-500', icon: Truck },
  };

  const cfg = config[status];
  if (!cfg) return <Badge variant="secondary">{status}</Badge>;

  const Icon = cfg.icon;
  return (
    <Badge className={`${cfg.color} hover:${cfg.color}`}>
      <Icon className="h-3 w-3 mr-1" />
      {status}
    </Badge>
  );
}

// Progress Widget Component
function ProgressWidget({
  label,
  current,
  total,
  currentLabel,
  totalLabel,
  color = 'bg-primary',
  formatValue = (v: number) => String(v),
}: {
  label: string;
  current: number;
  total: number;
  currentLabel: string;
  totalLabel: string;
  color?: string;
  showPercentage?: boolean;
  formatValue?: (value: number) => string;
}) {
  const percentage = total > 0 ? Math.min((current / total) * 100, 100) : 0;
  const isComplete = current >= total && total > 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className={`text-xs font-medium ${isComplete ? 'text-green-500' : 'text-muted-foreground'}`}>
          {percentage.toFixed(0)}%
        </span>
      </div>
      <div className="relative">
        <Progress
          value={percentage}
          className={`h-3 ${isComplete ? '[&>div]:bg-green-500' : `[&>div]:${color}`}`}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{currentLabel}: <span className="font-medium text-foreground">{formatValue(current)}</span></span>
        <span>{totalLabel}: <span className="font-medium text-foreground">{formatValue(total)}</span></span>
      </div>
    </div>
  );
}

export default function OrderDetailPage() {
  const params = useParams();
  const orderId = params.orderId as string;
  const { t, locale } = useI18n();

  const [order, setOrder] = useState<PipelineOrderDetail | null>(null);
  const [products, setProducts] = useState<PipelineProduct[]>([]);
  const [payments, setPayments] = useState<PipelinePayment[]>([]);
  const [totals, setTotals] = useState<OrderTotals | null>(null);
  const [loading, setLoading] = useState(true);

  // Selection and bulk actions
  const [selectedProducts, setSelectedProducts] = useState<Set<number>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [updatingTasks, setUpdatingTasks] = useState<Set<string>>(new Set());
  const [uploadingInvoice, setUploadingInvoice] = useState(false);
  const [invoices, setInvoices] = useState<InvoiceInfo[]>([]);

  // Payment form state
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentDate, setPaymentDate] = useState<Date | undefined>(new Date());
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDetails, setPaymentDetails] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);

  // Order edit form state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editSeason, setEditSeason] = useState('');
  const [editOrderDate, setEditOrderDate] = useState<Date | undefined>();
  const [editExpectedDelivery, setEditExpectedDelivery] = useState<Date | undefined>();
  const [editCountry, setEditCountry] = useState('');
  const [editGender, setEditGender] = useState('');
  const [editProduct, setEditProduct] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editDiscount, setEditDiscount] = useState('');
  const [savingOrder, setSavingOrder] = useState(false);

  const fetchOrder = useCallback(async () => {
    if (!orderId) return;

    try {
      const res = await fetch(`/api/pipeline/orders/${orderId}`);
      if (res.ok) {
        const data = await res.json();
        setOrder(data.order);
        setProducts(data.products);
        setPayments(data.payments || []);
        setTotals(data.totals);
        if (data.order?.invoices) {
          try {
            setInvoices(JSON.parse(data.order.invoices));
          } catch {
            setInvoices([]);
          }
        }
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  // Calculate fulfillment stats
  const fulfillmentStats = useMemo(() => {
    // "Ritirati" = shipped or in stock
    const fulfilledProducts = products.filter(p => p.status === 'shipped' || p.status === 'in stock');
    const fulfilledCount = fulfilledProducts.length;
    const fulfilledQty = fulfilledProducts.reduce((sum, p) => sum + (p.quantity || 0), 0);
    const totalQty = products.reduce((sum, p) => sum + (p.quantity || 0), 0);

    return {
      fulfilledCount,
      fulfilledQty,
      totalCount: products.length,
      totalQty,
    };
  }, [products]);

  // Calculate payment stats with discount
  const paymentStats = useMemo(() => {
    if (!totals || !order) return { paid: 0, total: 0, remaining: 0, discountAmount: 0, discountPercent: 0 };

    const discountPercent = order.discount_percent || 0;
    const discountAmount = (totals.totalWholesale * discountPercent) / 100;
    const totalAfterDiscount = totals.totalWholesale - discountAmount;
    const remaining = Math.max(0, totalAfterDiscount - totals.totalPaid);

    return {
      paid: totals.totalPaid,
      total: totalAfterDiscount,
      remaining,
      discountAmount,
      discountPercent,
    };
  }, [totals, order]);

  // Check if any product has color_image
  const hasAnyColorImage = useMemo(() => {
    return products.some(p => p.color_image);
  }, [products]);

  // Product selection handlers
  const toggleProduct = (productId: number) => {
    setSelectedProducts(prev => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const toggleAllProducts = () => {
    if (selectedProducts.size === products.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(products.map(p => p.id)));
    }
  };

  const clearSelection = () => {
    setSelectedProducts(new Set());
  };

  // Bulk status update
  const updateProductsStatus = async (status: string) => {
    if (selectedProducts.size === 0) return;

    setBulkLoading(true);
    try {
      const res = await fetch('/api/pipeline/products/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productIds: Array.from(selectedProducts),
          status,
        }),
      });

      if (res.ok) {
        setProducts(prev =>
          prev.map(p =>
            selectedProducts.has(p.id) ? { ...p, status } : p
          )
        );
        clearSelection();
      }
    } catch {
      // Ignore
    } finally {
      setBulkLoading(false);
    }
  };

  // Delete products
  const deleteProducts = async () => {
    if (selectedProducts.size === 0) return;

    setBulkLoading(true);
    try {
      const res = await fetch('/api/pipeline/products/bulk', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productIds: Array.from(selectedProducts),
        }),
      });

      if (res.ok) {
        setProducts(prev => prev.filter(p => !selectedProducts.has(p.id)));
        if (totals) {
          const deletedProducts = products.filter(p => selectedProducts.has(p.id));
          const deletedQty = deletedProducts.reduce((sum, p) => sum + (p.quantity || 0), 0);
          const deletedValue = deletedProducts.reduce((sum, p) => sum + (p.wholesale_price || 0) * (p.quantity || 0), 0);
          setTotals({
            productCount: totals.productCount - deletedProducts.length,
            totalQuantity: totals.totalQuantity - deletedQty,
            totalWholesale: totals.totalWholesale - deletedValue,
            totalPaid: totals.totalPaid,
          });
        }
        clearSelection();
      }
    } catch {
      // Ignore
    } finally {
      setBulkLoading(false);
      setDeleteDialogOpen(false);
    }
  };

  // Task toggle handler
  const toggleTask = async (taskKey: keyof PipelineOrderDetail, currentValue: number) => {
    if (!order) return;

    setUpdatingTasks(prev => new Set(prev).add(taskKey));

    try {
      const res = await fetch(`/api/pipeline/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [taskKey]: currentValue ? 0 : 1,
        }),
      });

      if (res.ok) {
        setOrder(prev => prev ? { ...prev, [taskKey]: currentValue ? 0 : 1 } : null);
      }
    } catch {
      // Ignore
    } finally {
      setUpdatingTasks(prev => {
        const next = new Set(prev);
        next.delete(taskKey);
        return next;
      });
    }
  };

  // Upload invoice handler
  const handleUploadInvoice = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !orderId) return;

    setUploadingInvoice(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`/api/pipeline/orders/${orderId}/invoices`, {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setInvoices(data.invoices);
      }
    } catch {
      // Ignore
    } finally {
      setUploadingInvoice(false);
      event.target.value = '';
    }
  };

  // Delete invoice handler
  const handleDeleteInvoice = async (filename: string) => {
    if (!orderId) return;

    try {
      const res = await fetch(`/api/pipeline/orders/${orderId}/invoices`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename }),
      });

      if (res.ok) {
        const data = await res.json();
        setInvoices(data.invoices);
      }
    } catch {
      // Ignore
    }
  };

  // Add payment handler
  const handleAddPayment = async () => {
    if (!orderId || !paymentDate || !paymentAmount) return;

    const amount = parseFloat(paymentAmount.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) return;

    setSavingPayment(true);
    try {
      const res = await fetch(`/api/pipeline/orders/${orderId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_date: paymentDate.toISOString().split('T')[0],
          amount_eur: amount,
          payment_details: paymentDetails || null,
        }),
      });

      if (res.ok) {
        const newPayment = await res.json();
        setPayments(prev => [newPayment, ...prev]);
        if (totals) {
          setTotals({ ...totals, totalPaid: totals.totalPaid + amount });
        }
        // Reset form
        setPaymentDialogOpen(false);
        setPaymentDate(new Date());
        setPaymentAmount('');
        setPaymentDetails('');
      }
    } catch {
      // Ignore
    } finally {
      setSavingPayment(false);
    }
  };

  // Open edit dialog with current values
  const openEditDialog = () => {
    if (!order) return;
    setEditSeason(order.season || '');
    setEditOrderDate(order.order_date ? new Date(order.order_date) : undefined);
    setEditExpectedDelivery(order.expected_delivery ? new Date(order.expected_delivery) : undefined);
    setEditCountry(order.country || '');
    setEditGender(order.gender || '');
    setEditProduct(order.product || '');
    setEditNotes(order.notes || '');
    setEditDiscount(order.discount_percent ? String(order.discount_percent) : '');
    setEditDialogOpen(true);
  };

  // Save order edits
  const handleSaveOrder = async () => {
    if (!orderId) return;

    setSavingOrder(true);
    try {
      const res = await fetch(`/api/pipeline/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          season: editSeason || null,
          order_date: editOrderDate ? editOrderDate.toISOString().split('T')[0] : null,
          expected_delivery: editExpectedDelivery ? editExpectedDelivery.toISOString().split('T')[0] : null,
          country: editCountry || null,
          gender: editGender || null,
          product: editProduct || null,
          notes: editNotes || null,
          discount_percent: editDiscount ? parseFloat(editDiscount.replace(',', '.')) : null,
        }),
      });

      if (res.ok) {
        // Update local state
        setOrder(prev => prev ? {
          ...prev,
          season: editSeason || null,
          order_date: editOrderDate ? editOrderDate.toISOString().split('T')[0] : null,
          expected_delivery: editExpectedDelivery ? editExpectedDelivery.toISOString().split('T')[0] : null,
          country: editCountry || null,
          gender: editGender || null,
          product: editProduct || null,
          notes: editNotes || null,
          discount_percent: editDiscount ? parseFloat(editDiscount.replace(',', '.')) : null,
        } : null);
        setEditDialogOpen(false);
      }
    } catch {
      // Ignore
    } finally {
      setSavingOrder(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <SidebarTrigger />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <SidebarTrigger />
          <Link href="/pipeline/orders">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('yandexDirect.previous')}
            </Button>
          </Link>
        </div>
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            Order not found
          </CardContent>
        </Card>
      </div>
    );
  }

  const tasks = [
    { key: 'task_proforma' as const, label: t('pipeline.taskProforma'), icon: FileText, value: order.task_proforma },
    { key: 'task_acconto' as const, label: t('pipeline.taskAcconto'), icon: Wallet, value: order.task_acconto },
    { key: 'task_fullfilled' as const, label: t('pipeline.taskFullfilled'), icon: ClipboardCheck, value: order.task_fullfilled },
    { key: 'task_saldo' as const, label: t('pipeline.taskSaldo'), icon: CreditCard, value: order.task_saldo },
    { key: 'task_ritirato' as const, label: t('pipeline.taskRitirato'), icon: Truck, value: order.task_ritirato },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <SidebarTrigger />
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">
                {t('pipeline.orderId')} #{order.order_id}
              </h1>
              {getStatusBadge(order.status, t)}
            </div>
            {order.supplier_name && (
              <p className="text-muted-foreground">{order.supplier_name}</p>
            )}
          </div>
        </div>
        <Link href="/pipeline/orders">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('yandexDirect.back')}
          </Button>
        </Link>
      </div>

      {/* Main Stats - Progress Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Products Progress */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4" />
              {t('pipeline.products')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ProgressWidget
              label={t('pipeline.fulfillment')}
              current={fulfillmentStats.fulfilledCount}
              total={fulfillmentStats.totalCount}
              currentLabel={t('pipeline.fulfilled')}
              totalLabel={t('pipeline.total')}
              color="bg-green-500"
            />
            <Separator />
            <ProgressWidget
              label={t('pipeline.quantity')}
              current={fulfillmentStats.fulfilledQty}
              total={fulfillmentStats.totalQty}
              currentLabel={t('pipeline.fulfilled')}
              totalLabel={t('pipeline.total')}
              color="bg-blue-500"
            />
          </CardContent>
        </Card>

        {/* Payment Progress with Tabs */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                {t('pipeline.payments')}
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setPaymentDialogOpen(true)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <Tabs defaultValue="progress" className="w-full">
              <TabsList className="grid w-full grid-cols-2 h-8">
                <TabsTrigger value="progress" className="text-xs gap-1">
                  <TrendingUp className="h-3 w-3" />
                  {t('pipeline.progress')}
                </TabsTrigger>
                <TabsTrigger value="history" className="text-xs gap-1">
                  <List className="h-3 w-3" />
                  {t('pipeline.history')} ({payments.length})
                </TabsTrigger>
              </TabsList>
              <TabsContent value="progress" className="mt-4 space-y-4">
                <ProgressWidget
                  label={t('pipeline.paymentProgress')}
                  current={paymentStats.paid}
                  total={paymentStats.total}
                  currentLabel={t('pipeline.totalPaid')}
                  totalLabel={t('pipeline.total')}
                  color="bg-emerald-500"
                  formatValue={formatCurrency}
                />
                {paymentStats.discountPercent > 0 && (
                  <div className="flex items-center justify-between text-xs bg-muted/50 rounded-md p-2">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Percent className="h-3 w-3" />
                      {t('pipeline.discount')} ({paymentStats.discountPercent}%)
                    </span>
                    <span className="font-medium text-green-500">-{formatCurrency(paymentStats.discountAmount)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">{t('pipeline.remaining')}</span>
                  <span className={`text-lg font-bold ${paymentStats.remaining === 0 ? 'text-green-500' : 'text-orange-500'}`}>
                    {formatCurrency(paymentStats.remaining)}
                  </span>
                </div>
              </TabsContent>
              <TabsContent value="history" className="mt-4">
                {payments.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {t('common.noData')}
                  </p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {payments.map((payment) => (
                      <div
                        key={payment.id}
                        className="flex items-center justify-between p-2 rounded-md border bg-muted/30 text-sm"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="font-medium shrink-0">
                            {formatDate(payment.payment_date, locale)}
                          </span>
                          {payment.payment_details && (
                            <span className="text-muted-foreground truncate" title={payment.payment_details}>
                              {payment.payment_details}
                            </span>
                          )}
                        </div>
                        <span className="font-medium text-green-500 shrink-0 ml-2">
                          +{formatCurrency(payment.amount_eur || 0)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Tasks */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              {t('pipeline.tasks')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {tasks.map((task) => {
                const Icon = task.icon;
                const isUpdating = updatingTasks.has(task.key);
                return (
                  <button
                    key={task.key}
                    onClick={() => toggleTask(task.key, task.value)}
                    disabled={isUpdating}
                    className={`w-full flex items-center gap-2 p-2 rounded-md border transition-colors text-sm ${
                      task.value
                        ? 'bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400'
                        : 'bg-muted/30 border-transparent hover:bg-muted/50'
                    } disabled:opacity-50`}
                  >
                    {isUpdating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : task.value ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className={task.value ? 'font-medium' : 'text-muted-foreground'}>
                      {task.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Order Details Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Order Info */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Info className="h-4 w-4" />
                {t('catalog.info')}
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={openEditDialog}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-muted-foreground" />
                <div>
                  <span className="text-muted-foreground">{t('pipeline.season')}</span>
                  <p className="font-medium">{order.season || '-'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <span className="text-muted-foreground">{t('pipeline.orderDate')}</span>
                  <p className="font-medium">{formatDate(order.order_date, locale)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <div>
                  <span className="text-muted-foreground">{t('pipeline.country')}</span>
                  <p className="font-medium">{order.country || '-'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <span className="text-muted-foreground">{t('pipeline.expectedDelivery')}</span>
                  <p className="font-medium">{formatDate(order.expected_delivery, locale)}</p>
                </div>
              </div>
              {order.gender && (
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <span className="text-muted-foreground">{t('pipeline.gender')}</span>
                    <p className="font-medium">{order.gender}</p>
                  </div>
                </div>
              )}
              {order.product && (
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <span className="text-muted-foreground">{t('pipeline.productType')}</span>
                    <p className="font-medium">{order.product}</p>
                  </div>
                </div>
              )}
            </div>

            {order.notes && (
              <>
                <Separator className="my-3" />
                <div>
                  <span className="text-sm text-muted-foreground">{t('pipeline.notes')}</span>
                  <p className="text-sm whitespace-pre-wrap mt-1">{order.notes}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Invoices/Attachments */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Paperclip className="h-4 w-4" />
                {t('pipeline.invoices')} ({invoices.length})
              </CardTitle>
              <div className="relative">
                <input
                  type="file"
                  id="invoice-upload"
                  className="sr-only"
                  onChange={handleUploadInvoice}
                  accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx"
                  disabled={uploadingInvoice}
                />
                <label htmlFor="invoice-upload">
                  <Button
                    variant="outline"
                    size="sm"
                    className="cursor-pointer"
                    disabled={uploadingInvoice}
                    asChild
                  >
                    <span>
                      {uploadingInvoice ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                    </span>
                  </Button>
                </label>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {invoices.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                {t('common.noData')}
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
                {invoices.map((invoice, idx) => {
                  const isPdf = invoice.type?.includes('pdf') || invoice.filename.toLowerCase().endsWith('.pdf');
                  const isImage = invoice.type?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(invoice.filename);

                  return (
                    <div
                      key={idx}
                      className="flex items-center gap-2 p-2 rounded-md border bg-muted/30 hover:bg-muted/50 transition-colors group"
                    >
                      {isImage ? (
                        <ImageZoom
                          src={invoice.url}
                          alt={invoice.filename}
                          thumbnailClassName="w-8 h-8 object-cover rounded"
                          thumbnailSize={32}
                        />
                      ) : (
                        <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <span className="flex-1 text-sm truncate" title={invoice.filename}>
                        {invoice.filename}
                      </span>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <a
                              href={invoice.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 rounded hover:bg-muted transition-colors"
                            >
                              <ExternalLink className="h-3 w-3 text-muted-foreground" />
                            </a>
                          </TooltipTrigger>
                          <TooltipContent>{t('catalog.openOnSite')}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <button
                        onClick={() => handleDeleteInvoice(invoice.filename)}
                        className="p-1 rounded hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Products */}
      {products.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4" />
                {t('pipeline.products')} ({products.length})
              </CardTitle>
              {/* Status product counts */}
              <div className="flex items-center gap-3 text-sm">
                {(() => {
                  const statusCounts = products.reduce((acc, p) => {
                    const s = p.status || 'unknown';
                    acc[s] = (acc[s] || 0) + 1;
                    return acc;
                  }, {} as Record<string, number>);

                  const statusConfig: Record<string, { icon: typeof Package; color: string }> = {
                    'in stock': { icon: Package, color: 'text-green-500' },
                    'waiting': { icon: Clock, color: 'text-yellow-500' },
                    'canceled': { icon: X, color: 'text-red-500' },
                    'ready': { icon: CheckCircle, color: 'text-blue-500' },
                    'shipped': { icon: Truck, color: 'text-purple-500' },
                  };

                  return Object.entries(statusCounts).map(([status, count]) => {
                    const config = statusConfig[status];
                    if (!config) return null;
                    const IconComp = config.icon;
                    return (
                      <span key={status} className={`flex items-center gap-1 ${config.color}`}>
                        <IconComp className="h-4 w-4" />
                        <span>{count}</span>
                      </span>
                    );
                  });
                })()}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Bulk actions toolbar */}
            {selectedProducts.size > 0 && (
              <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-muted/50 border sticky top-0 z-10">
                <span className="text-sm text-muted-foreground">
                  {selectedProducts.size} {t('pipeline.selected')}
                </span>
                <div className="flex-1" />
                {bulkLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateProductsStatus('ready')}
                    >
                      <CheckCircle className="h-4 w-4 mr-1 text-blue-500" />
                      {t('pipeline.markAsReady')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateProductsStatus('shipped')}
                    >
                      <Truck className="h-4 w-4 mr-1 text-purple-500" />
                      {t('pipeline.markAsShipped')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateProductsStatus('in stock')}
                    >
                      <Package className="h-4 w-4 mr-1 text-green-500" />
                      {t('pipeline.markAsInStock')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteDialogOpen(true)}
                    >
                      <Trash2 className="h-4 w-4 mr-1 text-red-500" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearSelection}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            )}

            {/* Products table */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={selectedProducts.size === products.length && products.length > 0}
                        onCheckedChange={toggleAllProducts}
                      />
                    </TableHead>
                    <TableHead className="w-8"></TableHead>
                    <TableHead className="w-14"></TableHead>
                    {hasAnyColorImage && <TableHead className="w-14"></TableHead>}
                    <TableHead>{t('catalog.sku')}</TableHead>
                    <TableHead className="text-right">{t('pipeline.quantity')}</TableHead>
                    <TableHead className="text-right">{t('catalog.price')}</TableHead>
                    <TableHead className="text-right">{t('pipeline.total')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => (
                    <TableRow
                      key={product.id}
                      className={selectedProducts.has(product.id) ? 'bg-muted/50' : ''}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedProducts.has(product.id)}
                          onCheckedChange={() => toggleProduct(product.id)}
                        />
                      </TableCell>
                      <TableCell>
                        {getProductStatusBadge(product.status)}
                      </TableCell>
                      <TableCell>
                        {product.product_image ? (
                          <ImageZoom
                            src={product.product_image}
                            alt={product.supplier_sku || 'Product'}
                            thumbnailClassName="rounded"
                            thumbnailSize={48}
                          />
                        ) : (
                          <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">
                            <Package className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                      </TableCell>
                      {hasAnyColorImage && (
                        <TableCell>
                          {product.color_image ? (
                            <ImageZoom
                              src={product.color_image}
                              alt={product.color || 'Color'}
                              thumbnailClassName="rounded"
                              thumbnailSize={48}
                            />
                          ) : (
                            <div className="w-12 h-12" />
                          )}
                        </TableCell>
                      )}
                      <TableCell className="font-mono text-sm">
                        {product.supplier_sku || '-'}
                      </TableCell>
                      <TableCell className="text-right">{product.quantity}</TableCell>
                      <TableCell className="text-right text-sm">
                        {formatCurrency(product.wholesale_price)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(product.wholesale_price * product.quantity)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('pipeline.confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('pipeline.confirmDeleteDescription').replace('{count}', String(selectedProducts.size))}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteProducts}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('pipeline.deleteProducts')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add payment dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('pipeline.addPayment')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Date picker */}
            <div className="space-y-2">
              <Label>{t('pipeline.paymentDate')}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {paymentDate ? formatDate(paymentDate.toISOString().split('T')[0], locale) : t('pipeline.selectDate')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={paymentDate}
                    onSelect={setPaymentDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <Label>{t('pipeline.amount')} (€)</Label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
              />
            </div>

            {/* Details/Causale */}
            <div className="space-y-2">
              <Label>{t('pipeline.paymentDetails')}</Label>
              <Input
                type="text"
                placeholder={t('pipeline.paymentDetailsPlaceholder')}
                value={paymentDetails}
                onChange={(e) => setPaymentDetails(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleAddPayment}
              disabled={savingPayment || !paymentDate || !paymentAmount}
            >
              {savingPayment ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit order dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('pipeline.editOrder')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Season */}
            <div className="space-y-2">
              <Label>{t('pipeline.season')}</Label>
              <Input
                type="text"
                placeholder="FW25, SS25..."
                value={editSeason}
                onChange={(e) => setEditSeason(e.target.value)}
              />
            </div>

            {/* Order Date */}
            <div className="space-y-2">
              <Label>{t('pipeline.orderDate')}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {editOrderDate ? formatDate(editOrderDate.toISOString().split('T')[0], locale) : t('pipeline.selectDate')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={editOrderDate}
                    onSelect={setEditOrderDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Expected Delivery */}
            <div className="space-y-2">
              <Label>{t('pipeline.expectedDelivery')}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {editExpectedDelivery ? formatDate(editExpectedDelivery.toISOString().split('T')[0], locale) : t('pipeline.selectDate')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={editExpectedDelivery}
                    onSelect={setEditExpectedDelivery}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Country */}
            <div className="space-y-2">
              <Label>{t('pipeline.country')}</Label>
              <Input
                type="text"
                placeholder="Italia, Cina..."
                value={editCountry}
                onChange={(e) => setEditCountry(e.target.value)}
              />
            </div>

            {/* Gender */}
            <div className="space-y-2">
              <Label>{t('pipeline.gender')}</Label>
              <Input
                type="text"
                placeholder="Donna, Uomo..."
                value={editGender}
                onChange={(e) => setEditGender(e.target.value)}
              />
            </div>

            {/* Product Type */}
            <div className="space-y-2">
              <Label>{t('pipeline.productType')}</Label>
              <Input
                type="text"
                placeholder="Scarpe, Borse..."
                value={editProduct}
                onChange={(e) => setEditProduct(e.target.value)}
              />
            </div>

            {/* Discount */}
            <div className="space-y-2">
              <Label>{t('pipeline.discount')} (%)</Label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0"
                value={editDiscount}
                onChange={(e) => setEditDiscount(e.target.value)}
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>{t('pipeline.notes')}</Label>
              <Input
                type="text"
                placeholder={t('pipeline.notesPlaceholder')}
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleSaveOrder}
              disabled={savingOrder}
            >
              {savingOrder ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
