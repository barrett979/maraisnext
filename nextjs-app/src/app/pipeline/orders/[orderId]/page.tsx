'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { ArrowLeft, FileText, Wallet, ClipboardCheck, CreditCard, Truck } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

import {
  type PipelineProduct,
  type PipelineOrderDetail,
  type PipelinePayment,
  type OrderTotals,
  type InvoiceInfo,
  type Task,
  OrderStatusBadge,
  OrderSkeleton,
  FulfillmentCard,
  PaymentsCard,
  TasksCard,
  OrderInfoCard,
  InvoicesCard,
  ProductsCard,
  PaymentDialog,
  EditOrderDialog,
  DeleteDialog,
} from './_components';

export default function OrderDetailPage() {
  const params = useParams();
  const orderId = params.orderId as string;
  const { t, locale } = useI18n();

  // Data state
  const [order, setOrder] = useState<PipelineOrderDetail | null>(null);
  const [products, setProducts] = useState<PipelineProduct[]>([]);
  const [payments, setPayments] = useState<PipelinePayment[]>([]);
  const [totals, setTotals] = useState<OrderTotals | null>(null);
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<InvoiceInfo[]>([]);

  // UI state
  const [selectedProducts, setSelectedProducts] = useState<Set<number>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [updatingTasks, setUpdatingTasks] = useState<Set<string>>(new Set());
  const [uploadingInvoice, setUploadingInvoice] = useState(false);

  // Payment dialog state
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentDate, setPaymentDate] = useState<Date | undefined>(new Date());
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDetails, setPaymentDetails] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);

  // Order edit dialog state
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

  // Fetch order data
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

  // Computed stats
  const fulfillmentStats = useMemo(() => {
    const fulfilledProducts = products.filter(p => p.status === 'shipped' || p.status === 'in stock');
    return {
      fulfilledCount: fulfilledProducts.length,
      fulfilledQty: fulfilledProducts.reduce((sum, p) => sum + (p.quantity || 0), 0),
      totalCount: products.length,
      totalQty: products.reduce((sum, p) => sum + (p.quantity || 0), 0),
    };
  }, [products]);

  const paymentStats = useMemo(() => {
    if (!totals || !order) return { paid: 0, total: 0, remaining: 0, discountAmount: 0, discountPercent: 0 };

    const discountPercent = order.discount_percent || 0;
    const discountAmount = (totals.totalWholesale * discountPercent) / 100;
    const totalAfterDiscount = totals.totalWholesale - discountAmount;
    const remaining = Math.max(0, totalAfterDiscount - totals.totalPaid);

    return { paid: totals.totalPaid, total: totalAfterDiscount, remaining, discountAmount, discountPercent };
  }, [totals, order]);

  // Product selection handlers
  const toggleProduct = (productId: number) => {
    setSelectedProducts(prev => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  const toggleAllProducts = () => {
    if (selectedProducts.size === products.length) setSelectedProducts(new Set());
    else setSelectedProducts(new Set(products.map(p => p.id)));
  };

  const clearSelection = () => setSelectedProducts(new Set());

  // Bulk actions
  const updateProductsStatus = async (status: string) => {
    if (selectedProducts.size === 0) return;
    setBulkLoading(true);
    try {
      const res = await fetch('/api/pipeline/products/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds: Array.from(selectedProducts), status }),
      });
      if (res.ok) {
        setProducts(prev => prev.map(p => selectedProducts.has(p.id) ? { ...p, status } : p));
        clearSelection();
      }
    } catch {
      // Ignore
    } finally {
      setBulkLoading(false);
    }
  };

  const deleteProducts = async () => {
    if (selectedProducts.size === 0) return;
    setBulkLoading(true);
    try {
      const res = await fetch('/api/pipeline/products/bulk', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds: Array.from(selectedProducts) }),
      });
      if (res.ok) {
        const deletedProducts = products.filter(p => selectedProducts.has(p.id));
        setProducts(prev => prev.filter(p => !selectedProducts.has(p.id)));
        if (totals) {
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

  // Task toggle
  const toggleTask = async (taskKey: Task['key'], currentValue: number) => {
    if (!order) return;
    setUpdatingTasks(prev => new Set(prev).add(taskKey));
    try {
      const res = await fetch(`/api/pipeline/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [taskKey]: currentValue ? 0 : 1 }),
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

  // Invoice handlers
  const handleUploadInvoice = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !orderId) return;
    setUploadingInvoice(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/pipeline/orders/${orderId}/invoices`, { method: 'POST', body: formData });
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

  // Payment handlers
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
        if (totals) setTotals({ ...totals, totalPaid: totals.totalPaid + amount });
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

  // Order edit handlers
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

  // Loading state
  if (loading) return <OrderSkeleton />;

  // Not found state
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

  // Tasks config
  const tasks: Task[] = [
    { key: 'task_proforma', label: t('pipeline.taskProforma'), icon: FileText, value: order.task_proforma },
    { key: 'task_acconto', label: t('pipeline.taskAcconto'), icon: Wallet, value: order.task_acconto },
    { key: 'task_fullfilled', label: t('pipeline.taskFullfilled'), icon: ClipboardCheck, value: order.task_fullfilled },
    { key: 'task_saldo', label: t('pipeline.taskSaldo'), icon: CreditCard, value: order.task_saldo },
    { key: 'task_ritirato', label: t('pipeline.taskRitirato'), icon: Truck, value: order.task_ritirato },
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
              <OrderStatusBadge status={order.status} t={t} />
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

      {/* Progress Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <FulfillmentCard stats={fulfillmentStats} t={t} />
        <PaymentsCard
          payments={payments}
          paymentStats={paymentStats}
          locale={locale}
          onAddPayment={() => setPaymentDialogOpen(true)}
          t={t}
        />
        <TasksCard
          tasks={tasks}
          updatingTasks={updatingTasks}
          onToggle={toggleTask}
          t={t}
        />
      </div>

      {/* Info Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <OrderInfoCard order={order} locale={locale} onEdit={openEditDialog} t={t} />
        <InvoicesCard
          invoices={invoices}
          uploadingInvoice={uploadingInvoice}
          onUpload={handleUploadInvoice}
          onDelete={handleDeleteInvoice}
          t={t}
        />
      </div>

      {/* Products */}
      <ProductsCard
        products={products}
        selectedProducts={selectedProducts}
        bulkLoading={bulkLoading}
        onToggleProduct={toggleProduct}
        onToggleAll={toggleAllProducts}
        onClearSelection={clearSelection}
        onUpdateStatus={updateProductsStatus}
        onDeleteClick={() => setDeleteDialogOpen(true)}
        t={t}
      />

      {/* Dialogs */}
      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        selectedCount={selectedProducts.size}
        onConfirm={deleteProducts}
        t={t}
      />

      <PaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        paymentDate={paymentDate}
        onPaymentDateChange={setPaymentDate}
        paymentAmount={paymentAmount}
        onPaymentAmountChange={setPaymentAmount}
        paymentDetails={paymentDetails}
        onPaymentDetailsChange={setPaymentDetails}
        saving={savingPayment}
        onSave={handleAddPayment}
        locale={locale}
        t={t}
      />

      <EditOrderDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        season={editSeason}
        onSeasonChange={setEditSeason}
        orderDate={editOrderDate}
        onOrderDateChange={setEditOrderDate}
        expectedDelivery={editExpectedDelivery}
        onExpectedDeliveryChange={setEditExpectedDelivery}
        country={editCountry}
        onCountryChange={setEditCountry}
        gender={editGender}
        onGenderChange={setEditGender}
        product={editProduct}
        onProductChange={setEditProduct}
        discount={editDiscount}
        onDiscountChange={setEditDiscount}
        notes={editNotes}
        onNotesChange={setEditNotes}
        saving={savingOrder}
        onSave={handleSaveOrder}
        locale={locale}
        t={t}
      />
    </div>
  );
}
