# Arquitectura de Reportes y Business Intelligence

## PUNTO 1 — Estado del Modelo de Datos

### 1.1 Modelos existentes que YA cubren los reportes

El schema actual (62 modelos) ya cubre ~85% de lo necesario. Estas tablas ya existen y no requieren cambios:

| Categoría | Modelos existentes | Cubre |
|-----------|-------------------|-------|
| **Ventas** | `Sale`, `SaleItem`, `SalePayment`, `SaleDiscount` | Ticket, pagos, descuentos, méthodos de pago, propinas |
| **Pedidos web** | `Order`, `OrderItem`, `OrderStatusHistory`, `OrderPreparation`, `OrderPreparationItem` | Lifecycle del pedido, pickup/delivery, tiempos |
| **Productos** | `Product`, `ProductVariant`, `Category`, `UnitOfMeasure`, `ProductOption/Value` | Catálogo completo |
| **Combos** | `ProductCombo`, `ComboItem` | Bundles y precios especiales |
| **Inventario** | `Inventory`, `InventoryMovement`, `VariantPriceHistory` | Stock por ubicación, movimientos, historial de precios |
| **Revisiones** | `InventoryRevision`, `InventoryRevisionItem` | Conteo cíclico, mermas |
| **Clientes** | `Customer`, `CustomerAddress`, `CustomerPaymentMethod`, `CustomerFavorite` | Perfil, direcciones, métodos de pago |
| **Lealtad** | `LoyaltyTransaction` | Acumulación, redención, ajustes de puntos |
| **Crédito** | `CustomerCredit`, `CreditTransaction`, `CreditPolicy` | Límite, saldo, pagos, mora |
| **Promociones** | `Promotion`, `PromotionTarget`, `Coupon` | Reglas, cupones, usos |
| **Caja** | `CashSession`, `CashRegister` | Apertura, cierre, arqueo |
| **Empleados** | `Employee`, `EmployeePosition` | Personal, puestos |
| **Sucursales** | `Location`, `Cedi` | Tiendas + almacén central |
| **Devoluciones** | `SaleReturn`, `SaleReturnItem` | Reembolso, cupón, puntos, cambio |
| **Mesas** | `Table`, `TableSession` | Servicio a mesa (food_service) |
| **Notificaciones** | `Notification`, `PushSubscription` | Alertas push |
| **Publicaciones** | `Publication` | Marketing content |

### 1.2 Modelos NUEVOS necesarios para BI

Estas tablas faltan y son requeridas para los reportes del prompt:

```prisma
// ══════════════════════════════════════════════════════════════════════════
// AGREGADOS DIARIOS — Pre-cálculos para reportes rápidos
// Se llenan con un cron job cada día a las 00:00 (o al cerrar caja)
// ══════════════════════════════════════════════════════════════════════════

model DailySalesSummary {
  id             String   @id @default(cuid())
  organizationId String
  locationId     String
  date           DateTime @db.Date

  // Ventas
  salesCount       Int      @default(0)  // Número de transacciones
  grossSales       Decimal  @default(0) @db.Decimal(14, 2) // Ventas brutas (antes de devoluciones)
  returnsTotal     Decimal  @default(0) @db.Decimal(14, 2) // Total de devoluciones
  netSales         Decimal  @default(0) @db.Decimal(14, 2) // grossSales - returnsTotal
  discountTotal    Decimal  @default(0) @db.Decimal(14, 2) // Descuentos de promociones
  taxTotal         Decimal  @default(0) @db.Decimal(14, 2) // Impuestos cobrados
  tipTotal         Decimal  @default(0) @db.Decimal(14, 2) // Propinas

  // Por canal
  posSales         Decimal  @default(0) @db.Decimal(14, 2) // Venta física (POS)
  portalSales      Decimal  @default(0) @db.Decimal(14, 2) // Venta web (portal)
  pickupSales      Decimal  @default(0) @db.Decimal(14, 2) // Pedidos pickup
  deliverySales    Decimal  @default(0) @db.Decimal(14, 2) // Pedidos delivery

  // Pagos
  cashPayments     Decimal  @default(0) @db.Decimal(14, 2)
  cardPayments     Decimal  @default(0) @db.Decimal(14, 2)
  creditPayments   Decimal  @default(0) @db.Decimal(14, 2) // Ventas a crédito
  onlinePayments   Decimal  @default(0) @db.Decimal(14, 2)

  // Tickets
  ticketAverage    Decimal  @default(0) @db.Decimal(14, 2) // netSales / salesCount
  totalItems       Int      @default(0)  // Unidades vendidas
  upt              Decimal  @default(0) @db.Decimal(8, 2)  // Units Per Ticket

  // Lealtad
  pointsEarned     Int      @default(0)
  pointsRedeemed   Int      @default(0)
  pointsRedemptionValue Decimal @default(0) @db.Decimal(14, 2)

  // Clientes
  uniqueCustomers  Int      @default(0)  // Clientes únicos que compraron
  newCustomers     Int      @default(0)  // Clientes que compraron por primera vez

  createdAt        DateTime @default(now())

  organization Organization @relation(fields: [organizationId], references: [id])
  location     Location     @relation(fields: [locationId], references: [id])

  @@unique([organizationId, locationId, date])
  @@index([organizationId, date])
  @@map("daily_sales_summaries")
}

model HourlySalesSnapshot {
  id             String   @id @default(cuid())
  organizationId String
  locationId     String
  date           DateTime @db.Date
  hour           Int      // 0-23

  salesCount  Int     @default(0)
  netSales    Decimal @default(0) @db.Decimal(14, 2)
  totalItems  Int     @default(0)

  organization Organization @relation(fields: [organizationId], references: [id])
  location     Location     @relation(fields: [locationId], references: [id])

  @@unique([organizationId, locationId, date, hour])
  @@map("hourly_sales_snapshots")
}

// ══════════════════════════════════════════════════════════════════════════
// PRODUCTOS MÁS VENDIDOS JUNTOS (Market Basket Analysis)
// Se actualiza periódicamente con un job
// ══════════════════════════════════════════════════════════════════════════

model ProductPair {
  id             String   @id @default(cuid())
  organizationId String
  productIdA     String   // Producto menor ID
  productIdB     String   // Producto mayor ID
  coOccurrences  Int      @default(0) // Veces que se vendieron juntos
  lastSeenAt     DateTime @default(now())

  organization Organization @relation(fields: [organizationId], references: [id])
  productA     Product      @relation("PairA", fields: [productIdA], references: [id])
  productB     Product      @relation("PairB", fields: [productIdB], references: [id])

  @@unique([organizationId, productIdA, productIdB])
  @@index([organizationId, coOccurrences(sort: Desc)])
  @@map("product_pairs")
}

// ══════════════════════════════════════════════════════════════════════════
// SNAPSHOT DE INVENTARIO DIARIO (para tendencias y valoración)
// ══════════════════════════════════════════════════════════════════════════

model InventorySnapshot {
  id             String   @id @default(cuid())
  organizationId String
  locationId     String
  productId      String
  variantId      String?
  date           DateTime @db.Date

  quantityAtCost   Decimal @default(0) @db.Decimal(14, 4) // Cantidad
  valueAtCost      Decimal @default(0) @db.Decimal(14, 2) // Valor a costo
  valueAtRetail    Decimal @default(0) @db.Decimal(14, 2) // Valor a precio venta

  organization Organization @relation(fields: [organizationId], references: [id])
  location     Location     @relation(fields: [locationId], references: [id])
  product      Product      @relation(fields: [productId], references: [id])

  @@unique([organizationId, locationId, productId, variantId, date])
  @@index([organizationId, date])
  @@map("inventory_snapshots")
}

// ══════════════════════════════════════════════════════════════════════════
// TRANSFERENCIAS ENTRE UBICACIONES
// ══════════════════════════════════════════════════════════════════════════

model Transfer {
  id             String         @id @default(cuid())
  organizationId String
  fromLocationId String         // CEDIS o sucursal origen
  toLocationId   String         // Sucursal destino
  status         TransferStatus @default(pending)
  notes          String?
  createdAt      DateTime       @default(now())
  completedAt    DateTime?

  organization Organization @relation(fields: [organizationId], references: [id])
  fromLocation Location     @relation("TransferFrom", fields: [fromLocationId], references: [id])
  toLocation   Location     @relation("TransferTo", fields: [toLocationId], references: [id])
  items        TransferItem[]

  @@index([organizationId, status])
  @@map("transfers")
}

model TransferItem {
  id         String   @id @default(cuid())
  transferId String
  productId  String
  variantId  String?
  quantity   Decimal  @db.Decimal(14, 4)
  receivedQty Decimal? @db.Decimal(14, 4) // Cantidad efectivamente recibida

  transfer Transfer @relation(fields: [transferId], references: [id])
  product  Product  @relation(fields: [productId], references: [id])

  @@map("transfer_items")
}

enum TransferStatus {
  pending
  in_transit
  received
  cancelled
}

// ══════════════════════════════════════════════════════════════════════════
// COMISIONES DE EMPLEADOS
// ══════════════════════════════════════════════════════════════════════════

model EmployeeCommission {
  id             String   @id @default(cuid())
  organizationId String
  employeeId     String
  saleId         String?
  period         DateTime @db.Date // Primer día del mes
  baseSalary     Decimal  @default(0) @db.Decimal(14, 2)
  commissionRate Decimal  @default(0) @db.Decimal(5, 2) // Porcentaje
  commissionAmt  Decimal  @default(0) @db.Decimal(14, 2)
  salesTotal     Decimal  @default(0) @db.Decimal(14, 2)
  status         CommissionStatus @default(pending)
  createdAt      DateTime @default(now())

  organization Organization @relation(fields: [organizationId], references: [id])
  employee     Employee     @relation(fields: [employeeId], references: [id])
  sale         Sale?        @relation(fields: [saleId], references: [id])

  @@unique([organizationId, employeeId, saleId])
  @@index([organizationId, period])
  @@map("employee_commissions")
}

enum CommissionStatus {
  pending
  approved
  paid
}

// ══════════════════════════════════════════════════════════════════════════
// SEGMENTACIÓN DE CLIENTES
// ══════════════════════════════════════════════════════════════════════════

model CustomerSegment {
  id             String   @id @default(cuid())
  organizationId String
  customerId     String
  segment        CustomerSegmentType
  score          Int      @default(0) // 0-100
  assignedAt     DateTime @default(now())
  expiresAt      DateTime?

  organization Organization @relation(fields: [organizationId], references: [id])
  customer     Customer     @relation(fields: [customerId], references: [id])

  @@unique([organizationId, customerId, segment])
  @@map("customer_segments")
}

enum CustomerSegmentType {
  vip             // Top 20% por gasto
  regular         // Compra frecuente
  at_risk         // No compra en 30-60 días
  dormant         // No compra en 60+ días
  new             // Primera compra < 30 días
  coupon_hunter   // Solo compra con cupón/descuento
}
```

### 1.3 Relaciones nuevas con modelos existentes

```prisma
// Agregar a modelos existentes:

model Product {
  // ... campos existentes ...
  pairsA         ProductPair[] @relation("PairA")
  pairsB         ProductPair[] @relation("PairB")
  snapshots      InventorySnapshot[]
}

model Location {
  // ... campos existientes ...
  dailySummaries DailySalesSummary[]
  hourlySnapshots HourlySalesSnapshot[]
  inventorySnapshots InventorySnapshot[]
  transfersFrom  Transfer[] @relation("TransferFrom")
  transfersTo    Transfer[] @relation("TransferTo")
}

model Employee {
  // ... campos existientes ...
  commissions    EmployeeCommission[]
}

model Customer {
  // ... campos existientes ...
  segments       CustomerSegment[]
}

model Organization {
  // ... campos existientes ...
  dailySummaries DailySalesSummary[]
  hourlySnapshots HourlySalesSnapshot[]
  productPairs   ProductPair[]
  inventorySnapshots InventorySnapshot[]
  transfers      Transfer[]
  employeeCommissions EmployeeCommission[]
  customerSegments CustomerSegment[]
}
```

### 1.4 Resumen de cambios al schema

| Acción | Modelos |
|--------|---------|
| **Nuevos** (8) | `DailySalesSummary`, `HourlySalesSnapshot`, `ProductPair`, `InventorySnapshot`, `Transfer`, `TransferItem`, `EmployeeCommission`, `CustomerSegment` |
| **Nuevos enums** (2) | `TransferStatus`, `CommissionStatus`, `CustomerSegmentType` |
| **Modificados** (5) | `Product`, `Location`, `Employee`, `Customer`, `Organization` (solo relations) |
| **Sin cambios** (57) | Todos los demás |

---

## PUNTO 2 — Diccionario de KPIs

### 2.1 VENTAS

| KPI | Fórmula | Fuente | Notas |
|-----|---------|--------|-------|
| **Venta Bruta** | `SUM(Sale.total)` en período | `Sale` | Antes de devoluciones |
| **Venta Neta** | `Venta Bruta - SUM(SaleReturn.total)` | `Sale` + `SaleReturn` | Lo que realmente se quedó |
| **Venta por Canal** | POS: `Sale` · Web: `Order.total` (status=paid) | `Sale` + `Order` | Para métricas omnicanal |
| **Ticket Promedio** | `Venta Neta / N° transacciones` | `DailySalesSummary` | Por día, semana, mes |
| **Ticket Promedio por Canal** | Mismo, filtrado por source | `DailySalesSummary` | POS vs Portal |
| **UPT** (Unidades por Ticket) | `SUM(SaleItem.quantity) / N° transacciones` | `SaleItem` | Mide eficiencia del cajero |
| **AOV** (Average Order Value) | `SUM(Order.total) / N° pedidos web` | `Order` | Solo portal |
| **Venta neta por empleado** | `SUM(Sale.total) WHERE cashierId = X` | `Sale` | Para ranking de vendedores |
| **Venta por hora** | `SUM(netSales) GROUP BY hour` | `HourlySalesSnapshot` | Heatmap de actividad |
| **Venta por día de semana** | `SUM(netSales) GROUP BY dayOfWeek` | `DailySalesSummary` | Patrones de demanda |
| **Crecimiento Mes a Mes** | `(Venta Mes Actual - Venta Mes Anterior) / Venta Mes Anterior × 100` | `DailySalesSummary` | Tendencia |
| **Venta por categoría** | `SUM(SaleItem.lineTotal) GROUP BY Category` | `SaleItem` + `Product` | Mix de ventas |
| **Venta por sucursal** | `SUM(netSales) GROUP BY locationId` | `DailySalesSummary` | Ranking de sucursales |
| **Venta neta devuelta** | `SUM(SaleReturn.total) / Venta Bruta × 100` | `SaleReturn` | Tasa de devolución |
| **Venta neta por tipo de entrega** | `SUM(Order.total) GROUP BY deliveryMethod` | `Order` | Pickup vs Delivery |

### 2.2 PRODUCTOS

| KPI | Fórmula | Fuente | Notas |
|-----|---------|--------|-------|
| **Top productos por unidades** | `SUM(SaleItem.quantity) ORDER BY total DESC LIMIT N` | `SaleItem` | Para reposición |
| **Top productos por ingreso** | `SUM(SaleItem.lineTotal) ORDER BY total DESC LIMIT N` | `SaleItem` | Para rentabilidad |
| **Top productos por margen** | `SUM((unitPrice - cost) × quantity) ORDER BY margin DESC` | `SaleItem` + `Product.costPrice` | Requiere `costPrice` en Product |
| **Bottom 10 (huesos)** | Los 10 menos vendidos en 90 días | `SaleItem` | Para clearance |
| **Canasta de mercado** | `ProductPair.coOccurrences` ORDER BY frecuencia | `ProductPair` | Productos que se venden juntos |
| **Tasa de merma** | `(Stock Inicial - Stock Final - Ventas) / Stock Inicial × 100` | `Inventory` + `InventoryMovement` | Pérdidas no explicadas |
| **Rotación de inventario** | `Costo de Mercancía Vendida / Inventario Promedio a costo` | `SaleItem` + `Inventory` | Cuántas veces se renueva el stock |
| **Días de inventario** | `365 / Rotación de Inventario` | Calculado | Cuántos días dura el stock |
| **Sell-through rate** | `Unidades vendidas / (Unidades vendidas + Stock actual) × 100` | `SaleItem` + `Inventory` | Eficiencia de venta |
| **Products per transaction** | `COUNT(DISTINCT saleItemId) / N° transacciones` | `SaleItem` | Diversidad de compra |

### 2.3 INVENTARIO

| KPI | Fórmula | Fuente | Notas |
|-----|---------|--------|-------|
| **Stock total por ubicación** | `SUM(Inventory.quantity)` GROUP BY locationId | `Inventory` | Vista en tiempo real |
| **Valor de inventario a costo** | `SUM(quantity × costPrice)` | `Inventory` + `Product` | Para balance general |
| **Valor de inventario a precio venta** | `SUM(quantity × retailPrice)` | `Inventory` + `Product` | Para potencial de venta |
| **Productos con stock bajo** | `Inventory.quantity <= Product.minStock` | `Inventory` + `Product` | Alerta de quiebre |
| **Productos sin stock** | `Inventory.quantity <= 0` | `Inventory` | Urgente |
| **Sobre-stock** | `Inventory.quantity > Product.maxStock` | `Inventory` + `Product` | Capital estancado |
| **Fill Rate del CEDIS** | `TransferItems.receivedQty / TransferItems.quantity × 100` | `TransferItem` | % de pedidos completados |
| **Tiempo promedio de surtido** | `AVG(Transfer.completedAt - Transfer.createdAt)` | `Transfer` | Eficiencia logística |
| **Productos más transferidos** | `SUM(TransferItem.quantity) GROUP BY productId` | `TransferItem` | Demanda real |
| **Días sin movimiento** | `DATEDIFF(NOW(), MAX(InventoryMovement.createdAt))` | `InventoryMovement` | Productos obsoletos |

### 2.4 CLIENTES Y LEALTAD

| KPI | Fórmula | Fuente | Notas |
|-----|---------|--------|-------|
| **Clientes activos** | `COUNT(DISTINCT customerId)` con compra en últimos 30 días | `Sale` + `Order` | Base de clientes viva |
| **Clientes VIP (top 20%)** | Top 20% por gasto acumulado | `Sale` + `Order` | Segmentación ABC |
| **Clientes en riesgo** | Sin compra en 30-60 días | `Sale` + `Order` | Para campaña de reactivación |
| **Clientes dormidos** | Sin compra en 60+ días | `Sale` + `Order` | Urgente reactivar |
| **Nuevos clientes** | Primera compra en el período | `Sale` + `Order` | Crecimiento de base |
| **Tasa de retención** | `(Clientes recurrentes / Clientes totales del período anterior) × 100` | `Sale` + `Order` | Mes a mes |
| **Tasa de redención de puntos** | `Puntos redimidos / Puntos emitidos × 100` | `LoyaltyTransaction` | Salud del programa |
| **CLV** (Customer Lifetime Value) | `Ticket promedio × Frecuencia × Vida promedio del cliente` | `Sale` + `Order` | Por cliente o segmento |
| **Frecuencia de compra** | `N° transacciones / meses activos` | `Sale` + `Order` | Cuántas veces compra al mes |
| **Recencia** | `Días desde última compra` | `Sale` + `Order` | Para segmentación RFM |
| **Cross-channel rate** | `Clientes con compra en AMBOS canales / Total clientes` | `Sale` + `Order` | Fidelización omnicanal |
| **Tasa de canje por cupón** | `Cupones canjeados / Cupones emitidos × 100` | `Coupon` | Efectividad de cupones |

### 2.5 CRÉDITO

| KPI | Fórmula | Fuente | Notas |
|-----|---------|--------|-------|
| **Cartera total** | `SUM(CustomerCredit.currentBalance)` | `CustomerCredit` | Total por cobrar |
| **Cartera vencida** | `SUM(balance) WHERE dueDate < NOW()` | `CustomerCredit` + `CreditPolicy` | Riesgo |
| **DSO** (Days Sales Outstanding) | `Cartera total / (Venta neta anual / 365)` | `CustomerCredit` + `Sale` | Días promedio de cobro |
| **Clientes sobre límite** | `currentBalance > creditLimit` | `CustomerCredit` | Alerta de riesgo |
| **Tasa de mora** | `Clientes con balance vencido / Total clientes con crédito × 100` | `CustomerCredit` | Salud de cartera |
| **Pago promedio** | `SUM(CreditTransaction.amount) / N° transacciones` | `CreditTransaction` | Comportamiento de pago |
| **Antigüedad de saldos** | `DATEDIFF(NOW(), CreditTransaction.createdAt)` por transacción | `CreditTransaction` | Aging de cartera |
| **Crédito utilizado** | `SUM(currentBalance) / SUM(creditLimit) × 100` | `CustomerCredit` | Uso del límite |
| **Ingresos por crédito** | `SUM(Sale.total WHERE paymentMethod = 'credit')` | `Sale` | Volumen a crédito |

### 2.6 EMPLEADOS

| KPI | Fórmula | Fuente | Notas |
|-----|---------|--------|-------|
| **Ventas por empleado** | `SUM(Sale.total) GROUP BY cashierId` | `Sale` | Ranking |
| **Ticket promedio por empleado** | `SUM(Sale.total) / COUNT(Sale.id) GROUP BY cashierId` | `Sale` | Calidad de venta |
| **UPT por empleado** | `SUM(SaleItem.quantity) / COUNT(Sale.id) GROUP BY cashierId` | `SaleItem` | Habilidad de upselling |
| **Devoluciones por empleado** | `COUNT(SaleReturn) GROUP BY employeeId` | `SaleReturn` | Calidad de atención |
| **Faltantes en caja** | `CashSession.closingCash - CashSession.systemCash` WHERE < 0 | `CashSession` | Honestidad |
| **Horas trabajadas** | `SUM(CashSession.closedAt - CashSession.openedAt)` | `CashSession` | Productividad |
| **Ventas por hora trabajada** | `Venta total / Horas trabajadas` | `CashSession` + `Sale` | Eficiencia |
| **Tasa de comisión** | `SUM(EmployeeCommission.commissionAmt)` | `EmployeeCommission` | Costo de nómina variable |

### 2.7 PROMOCIONES

| KPI | Fórmula | Fuente | Notas |
|-----|---------|--------|-------|
| **Usos de promoción** | `Promotion.usesCount` | `Promotion` | Popularidad |
| **Ingreso incremental** | `Venta con promo - Venta base estimada` | `Sale` + `SaleDiscount` | ROI de la promo |
| **Costo de descuento** | `SUM(SaleDiscount.amount)` | `SaleDiscount` | Pérdida de margen |
| **ROI de promoción** | `(Ingreso incremental - Costo de descuento) / Costo de descuento × 100` | Calculado | Rentabilidad |
| **Tasa de canibalización** | `Venta de otros productos durante promo / Venta normal` | `Sale` | Si la promo restó ventas |
| **Cupones emitidos vs canjeados** | `COUNT(Coupon) GROUP BY status` | `Coupon` | Efectividad |
| **Promo más rentable** | `ROI por promoción ORDER BY ROI DESC` | Calculado | Cuál deja más dinero |

### 2.8 OMNICANAL

| KPI | Fórmula | Fuente | Notas |
|-----|---------|--------|-------|
| **% de ventas web** | `Portal Sales / Total Sales × 100` | `DailySalesSummary` | Penetración digital |
| **Tiempo promedio de preparación (pickup)** | `AVG(OrderPreparation.completedAt - OrderPreparation.startedAt)` | `OrderPreparation` | Eficiencia operativa |
| **Tiempo promedio de entrega** | `AVG(Order.deliveredAt - Order.createdAt)` | `Order` | SLA de delivery |
| **Costo de delivery** | `SUM(Order.deliveryFee)` vs `SUM(Order.deliveryCost)` | `Order` | Margen por envío |
| **Tasa de cancelación web** | `Orders cancelados / Total Orders × 100` | `Order` | Problemas de fulfillment |
| **Tasa de no recogido (pickup)** | `Pickup orders not collected en 48h / Total pickup × 100` | `Order` | Pérdidas |
| **Stock visibility accuracy** | `Ventas web sin overstock / Total ventas web × 100` | `Order` + `Inventory` | Integridad de datos |
| **Satisfacción por canal** | `Rating del pedido GROUP BY deliveryMethod` | `Order` (futuro: rating) | Calidad percibida |

### 2.9 FINANCIERO

| KPI | Fórmula | Fuente | Notas |
|-----|---------|--------|-------|
| **Margen bruto** | `(Venta Neta - Costo de mercancía vendida) / Venta Neta × 100` | `SaleItem` + `Product.costPrice` | Salud del negocio |
| **Margen neto** | `(Venta Neta - Costos fijos - Devoluciones - Descuentos) / Venta Neta × 100` | Múltiples | Rentabilidad real |
| **Ganancia por sucursal** | `Venta Neta - Costo inventario - Comisiones - Costos operativos` | Múltiples | P&L por ubicación |
| **Flujo de caja proyectado** | `Próximos 30 días: Ventas esperadas - Cobros de crédito pendientes` | `DailySalesSummary` + `CreditTransaction` | Previsión |
| **Costo de devolución** | `SUM(SaleReturn.total) + Costo de re-estacionamiento` | `SaleReturn` | Impacto de devoluciones |
| **ROI del programa de lealtad** | `(Venta incremental de clientes con puntos - Costo de puntos) / Costo de puntos × 100` | `LoyaltyTransaction` + `Sale` | ¿Vale la pena? |

### 2.10 FIDELIZACIÓN / COHORTES

| KPI | Fórmula | Fuente | Notas |
|-----|---------|--------|-------|
| **Retención de cohortes** | `Clientes del mes M que compraron en mes M+N / Total clientes del mes M` | `Sale` + `Order` | Curva de retención |
| **Churn rate** | `Clientes que no compraron en 90 días / Total clientes activos` | `Sale` + `Order` | Pérdida de clientes |
| **吸附 por promo** | `Clientes nuevos que vinieron por promo Y compraron después / Total nuevos por promo` | `Sale` + `Coupon` | ¿La promo fidelizó? |
| **LTV por canal de adquisición** | `CLV GROUP BY firstPurchaseChannel` | `Sale` + `Order` | ¿Qué canal trae mejores clientes? |
| **Tasa de recompra** | `Clientes con 2+ compras / Total clientes en período` | `Sale` + `Order` | Fidelización básica |
| **Tiempo medio entre compras** | `AVG(días entre compras consecutivas)` | `Sale` + `Order` | Frecuencia de ciclo |

---

## Notas de implementación

### Prioridad de modelos nuevos

| Prioridad | Modelo | Razón |
|-----------|--------|-------|
| **P0** | `DailySalesSummary` | Base de TODO el dashboard. Se llena con cron job diario. |
| **P0** | `Transfer` + `TransferItem` | Sin esto no hay reportes de inventario CEDIS↔Sucursal. |
| **P1** | `HourlySalesSnapshot` | Heatmap de ventas por hora. Se llena en el mismo job que P0. |
| **P1** | `InventorySnapshot` | Tendencias de inventario y valoración. Job diario. |
| **P1** | `ProductPair` | Market basket. Se calcula semanalmente. |
| **P2** | `EmployeeCommission` | Ranking de empleados + comisiones. |
| **P2** | `CustomerSegment` | Segmentación VIP/at-risk. Se recalcula mensualmente. |

### Cron jobs requeridos

| Job | Frecuencia | Qué hace |
|-----|------------|----------|
| `aggregate-daily-sales` | Diario 00:00 | Calcula `DailySalesSummary` y `HourlySalesSnapshot` del día anterior |
| `snapshot-inventory` | Diario 00:05 | Toma foto del inventario de todas las ubicaciones |
| `compute-product-pairs` | Semanal dom 02:00 | Analiza transacciones y actualiza `ProductPair` |
| `compute-customer-segments` | Mensual día 1 03:00 | Recalcula VIP, at_risk, dormant |
| `compute-commissions` | Mensual día 1 04:00 | Calcula comisiones del mes anterior |

---

## PUNTO 3 — Catálogo de 25 Reportes

Cada reporte tiene: nombre técnico/comercial, objetivo, KPIs, columnas del grid, visualización, drill-down, filtros, frecuencia y rol.

### Existentes (6) — Ya implementados

| # | Reporte | Objetivo | Drill-down | Rol |
|---|---------|----------|------------|-----|
| 1 | **Ventas** (`sales`) | Detalle de cada venta en período | → Ticket original | Gerente |
| 2 | **Corte de caja** (`cash`) | Arqueo físico vs sistema | → Sesión de caja | Gerente, Cajero |
| 3 | **Pedidos web** (`orders`) | Seguimiento de pedidos portal | → Pedido → Timeline | Gerente |
| 4 | **Clientes** (`customers`) | Ranking de clientes por gasto | → Historial de compras | Gerente |
| 5 | **Cartera crédito** (`credit`) | Cuentas por cobrar y mora | → Cliente → Transacciones | Dueño, Gerente |
| 6 | **Dashboard** (`dashboard`) | KPIs del día y período | → Reportes específicos | Todos |

### Nuevos — Por implementar

| # | Reporte técnico | Nombre comercial | Objetivo | KPIs clave | Visualización | Drill-down | Filtros | Rol |
|---|----------------|-----------------|----------|------------|---------------|------------|---------|-----|
| 7 | `omnichannel-sales` | **Ventas Omnicanal** | Comparar ventas POS vs Portal por período | % canal, AOV por canal, cross-channel rate | Barras apiladas (POS/Portal) + tabla | → Sucursal → Venta | Período, sucursal | Dueño |
| 8 | `hourly-heatmap` | **Heatmap por Hora** | Identificar horas pico y valle | Venta/hora, transacciones/hora | Mapa de calor (7×24) | → Hora → Transacciones | Semana, sucursal | Gerente |
| 9 | `inventory-valuation` | **Inventario Valorado** | Valor total del stock a costo y precio venta | Valor costo, valor venta, rotación, días inventario | Gauge + tabla por categoría | → Producto → Movimientos | Sucursal, categoría | Dueño, Gerente |
| 10 | `stock-alerts` | **Alertas de Stock** | Productos con stock bajo/sobre-stock | Quiebres, sobre-stock, días sin movimiento | Lista semáforo (🔴🟡🟢) | → Producto → Historial | Sucursal | Gerente |
| 11 | `product-ranking` | **Ranking de Productos** | Top/bottom productos por unidades, ingreso, margen | Top 10, bottom 10, sell-through, rotación | Tabla ordenable + barras horizontales | → Producto → Ventas por día | Período, categoría | Gerente |
| 12 | `market-basket` | **Canasta de Mercado** | Productos que se venden juntos | Co-ocurrencias, lift, confianza | Grafo/ bubbles + tabla | → Par → Transacciones | Período, sucursal | Dueño, Marketing |
| 13 | `customer-cohorts` | **Retención de Clientes** | Curva de retención mes a mes | Retención %, churn rate, LTV | Tabla cohort (matriz) + línea | → Cohort → Clientes | Mes inicial | Dueño |
| 14 | `customer-segmentation` | **Segmentación RFM** | Segmentar clientes por Recencia-Frecuencia-Monetary | VIP, regular, at-risk, dormant | Scatter plot + tabla | → Segmento → Clientes | Período | Dueño, Marketing |
| 15 | `employee-performance` | **Performance de Empleados** | Ranking de vendedores | Ticket promedio, UPT, ventas/hora, devoluciones | Tabla ranking + comparativo | → Empleado → Ventas | Período, sucursal | Gerente |
| 16 | `promotion-roi` | **ROI de Promociones** | Efectividad de cada promoción | Usos, ingreso incremental, costo descuento, ROI | Tabla + gráfico ROI | → Promo → Ventas | Período | Dueño, Marketing |
| 17 | `credit-aging` | **Aging de Crédito** | Antigüedad de saldos por vencimiento | 0-30, 31-60, 61-90, 90+ días | Pirámide de aging + tabla | → Cliente → Transacciones | Período | Dueño |
| 18 | `delivery-performance` | **Performance de Delivery** | Tiempos y costos de entrega | Tiempo prep, tiempo entrega, costo/envío, cancelaciones | Línea de tiempo + KPI cards | → Pedido → Timeline | Período, sucursal | Gerente |
| 19 | `margin-analysis` | **Análisis de Margen** | Margen bruto por producto/categoría/sucursal | Margen %, contribución, tendencia | Treemap + tabla | → Categoría → Productos | Período | Dueño |
| 20 | `cash-flow` | **Flujo de Caja** | Proyección de ingresos vs cobros | Ingresos esperados, cobros crédito, neto | Línea (30 días) + gauge | → Día → Detalle | Mes | Dueño |
| 21 | `loyalty-roi` | **ROI del Programa de Lealtad** | ¿Vale la pena el programa? | Puntos emitidos, redimidos, venta incremental | KPI cards + línea temporal | → Período → Clientes | Mes | Dueño |
| 22 | `returns-analysis` | **Análisis de Devoluciones** | Motivos y tendencia de devoluciones | Tasa devolución, por tipo, por producto, por empleado | Tabla + tendencia | → Devolución → Ticket | Período | Gerente |
| 23 | `transfers-report` | **Transferencias CEDIS** | Eficiencia de surtido CEDIS→Sucursal | Fill rate, tiempo surtido, productos transferidos | Tabla + timeline | → Transferencia → Items | Período | Gerente, Almacén |
| 24 | `commission-report` | **Comisiones de Empleados** | Calcular y pagar comisiones | Ventas/empleado, comisión, total a pagar | Tabla + aprobación | → Empleado → Ventas | Mes | Dueño |
| 25 | `product-pairs-detail` | **Análisis de Canasta Detallado** | Pares con mayor lift y confianza | Lift, confianza, soporte, margen combinado | Grafo force-directed + tabla | → Par → Transacciones | Período | Marketing |

### PUNTO 4 — UI/UX de los 5 reportes prioritarios

#### 7. Ventas Omnicanal
```
┌─────────────────────────────────────────────────────────┐
│ 🏪 Ventas Omnicanal          [Filtros] [📊 PDF] [📋 Excel]│
├─────────────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│ │ Venta     │ │ % Portal │ │ AOV POS  │ │ Cross-   │   │
│ │ Total     │ │ Web      │ │ vs Web   │ │ Channel  │   │
│ │ $125,400  │ │ 23%      │ │ $340/$280│ │ 15%      │   │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
│                                                         │
│  ┌─ Barras apiladas: POS vs Portal por día ──────────┐ │
│  │ ████ POS    ░░░░ Portal                            │ │
│  │ Lun  ████░░░░                                       │ │
│  │ Mar  █████░░░                                        │ │
│  │ ...                                                  │ │
│  └──────────────────────────────────────────────────────┘ │
│  ┌─ Tabla detallada ─────────────────────────────────┐  │
│  │ Sucursal │ POS     │ Portal  │ Total   │ % Web   │  │
│  │ Centro   │ $45,000 │ $12,000 │ $57,000 │ 21%  [→]│  │
│  │ Norte    │ $38,000 │ $15,400 │ $53,400 │ 29%  [→]│  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

#### 8. Heatmap por Hora
```
┌─────────────────────────────────────────────────────────┐
│ ⏰ Heatmap de Ventas por Hora                           │
├─────────────────────────────────────────────────────────┤
│  Hora→  6  7  8  9 10 11 12 13 14 15 16 17 18 19 20  │
│  Lun    ░░ ░░ ▒▒ ▓▓ ██ ██ ██ ▓▓ ▒▒ ▒▒ ▓▓ ██ ▓▓ ░░  │
│  Mar    ░░ ░░ ▒▒ ▓▓ ██ ██ ██ ▓▓ ▒▒ ▒▒ ▓▓ ██ ▓▓ ░░  │
│  Mié    ░░ ░░ ▒▒ ▓▓ ██ ██ ██ ▓▓ ▒▒ ▒▒ ▓▓ ██ ▓▓ ░░  │
│  Jue    ░░ ░░ ▒▒ ▓▓ ██ ██ ██ ▓▓ ▒▒ ▒▒ ▓▓ ██ ▓▓ ░░  │
│  Vie    ░░ ░░ ▒▒ ▓▓ ██ ██ ██ ▓▓ ▒▒ ▓▓ ██ ██ ██ ▓▓  │
│  Sáb    ░░ ░░ ▒▒ ▓▓ ██ ██ ██ ██ ██ ▓▓ ██ ██ ██ ▓▓  │
│  Dom    ░░ ░░ ░░ ▒▒ ▒▒ ▓▓ ██ ██ ▓▓ ▒▒ ▒▒ ▓▓ ▓▓ ░░  │
│  Colores: ░ $0-500  ▒ $500-2k  ▓ $2k-5k  █ $5k+      │
│  Click en celda → transacciones de esa hora             │
└─────────────────────────────────────────────────────────┘
```

#### 9. Inventario Valorado
```
┌─────────────────────────────────────────────────────────┐
│ 📦 Inventario Valorado                                  │
├─────────────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│ │ Valor    │ │ Rotación │ │ Días de  │ │ Productos│   │
│ │ Total    │ │ Promedio │ │ Inventario│ │ Sin Stock│   │
│ │ $845,200 │ │ 8.2x     │ │ 44 días  │ │ 12 🔴    │   │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
│  ┌─ Gauge: Valor a costo vs precio venta ──────────┐   │
│  │   $620K (costo) ←──────→ $845K (venta)          │   │
│  └─────────────────────────────────────────────────────┘ │
│  ┌─ Tabla por categoría ─────────────────────────────┐  │
│  │ Categoría   │ Valor Costo │ Valor Venta │ Rotación│  │
│  │ Bebidas     │ $120,000    │ $180,000    │ 12.1x [→]│  │
│  │ Snacks      │ $85,000     │ $127,500    │ 9.3x  [→]│  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

#### 11. Ranking de Productos
```
┌─────────────────────────────────────────────────────────┐
│ 🏆 Ranking de Productos           [Top 10 ▾] [↕ Inverso]│
├─────────────────────────────────────────────────────────┤
│ ┌─ Tabs: Unidades | Ingreso | Margen ────────────────┐ │
│ │                                                     │ │
│ │  1. ████████████████████ Refresco Cola 600ml  342u │ │
│  │  2. ██████████████ Papas Fritas 150g          287u │ │
│  │  3. ████████████ Galletas Oreo                 234u │ │
│  │  ...                                               │ │
│  │  ─── Bottom 10 (huesos) ───                       │ │
│  │  91. █ Pan Molido 500g                          2u │ │
│  │  92. █ Atún 200g                                1u │ │
│  │  ...                                               │ │
│  └─────────────────────────────────────────────────────┘ │
│  Click en producto → ventas por día del producto         │
└─────────────────────────────────────────────────────────┘
```

#### 13. Retención de Clientes (Cohortes)
```
┌─────────────────────────────────────────────────────────┐
│ 👥 Retención de Clientes — Cohortes                     │
├─────────────────────────────────────────────────────────┤
│ ┌─ Matriz de cohortes ──────────────────────────────┐  │
│ │ Cohort    │ Mes 0 │ Mes 1 │ Mes 2 │ Mes 3 │ ... │  │
│ │ Ene 2026   │ 100%  │ 45%   │ 32%   │ 28%   │     │  │
│ │ Feb 2026   │ 100%  │ 52%   │ 38%   │       │     │  │
│ │ Mar 2026   │ 100%  │ 48%   │       │       │     │  │
│ └──────────────────────────────────────────────────────┘ │
│ ┌─ Churn rate mensual ──────────────────────────────┐   │
│ │ Ene ▓▓ 12%   Feb ▓▓▓ 15%   Mar ▓▓ 11%   ...      │   │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### PUNTO 5 — Automatizaciones

| Trigger | Acción | Frecuencia |
|---------|--------|------------|
| Stock ≤ minStock | Notificación push al gerente + email | Tiempo real |
| Stock = 0 | Alerta roja en dashboard + sugerencia de transferencia | Tiempo real |
| Cliente > límite crédito | Bloquear venta a crédito + notificación | Tiempo real |
| Cartera vencida >30 días | Email recordatorio automático al cliente | Semanal |
| Devolución aprobada | Notificar al cajero para proceso | Tiempo real |
| Pedido web listo | Push notification al cliente | Tiempo real |
| Día cerrado (00:00) | Calcular DailySalesSummary | Diario |
| Semana cerrada (dom 02:00) | Calcular ProductPairs | Semanal |
| Mes cerrado (día 1 03:00) | Calcular CustomerSegments + Comisiones | Mensual |
| Ticket Promedio < promedio-20% | Alerta al gerente (posible problema) | Diario |
| Devolución > 5% de ventas | Alerta al dueño | Diario |
