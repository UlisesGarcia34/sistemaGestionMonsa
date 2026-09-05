-- CreateTable
CREATE TABLE `Usuario` (
    `id` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `rol` ENUM('VENTAS', 'OPERACIONES', 'CUSTOMER_SERVICE', 'FINANZAS', 'CONTABILIDAD', 'ADMIN') NOT NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Usuario_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Cliente` (
    `id` VARCHAR(191) NOT NULL,
    `razonSocial` VARCHAR(191) NOT NULL,
    `alias` VARCHAR(191) NULL,
    `rfc` VARCHAR(191) NULL,
    `estatus` ENUM('PROSPECTO', 'EN_VALIDACION_KYC', 'ACTIVO', 'SUSPENDIDO') NOT NULL DEFAULT 'PROSPECTO',
    `limiteCredito` DECIMAL(14, 2) NULL,
    `diasCredito` INTEGER NULL,
    `contactoNombre` VARCHAR(191) NULL,
    `contactoEmail` VARCHAR(191) NULL,
    `contactoTel` VARCHAR(191) NULL,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actualizadoEn` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Cliente_rfc_key`(`rfc`),
    INDEX `Cliente_estatus_idx`(`estatus`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Proveedor` (
    `id` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `tipo` ENUM('NAVIERA', 'AEROLINEA', 'COLOADER', 'AGENTE_ADUANAL', 'TRANSPORTISTA', 'ALMACEN', 'SEGURO', 'OTRO') NOT NULL,
    `estatus` ENUM('EN_HOMOLOGACION', 'ACTIVO', 'SUSPENDIDO') NOT NULL DEFAULT 'EN_HOMOLOGACION',
    `contactoNombre` VARCHAR(191) NULL,
    `contactoEmail` VARCHAR(191) NULL,
    `contactoTel` VARCHAR(191) NULL,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Proveedor_tipo_estatus_idx`(`tipo`, `estatus`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Tarifa` (
    `id` VARCHAR(191) NOT NULL,
    `proveedorId` VARCHAR(191) NOT NULL,
    `origen` VARCHAR(191) NOT NULL,
    `destino` VARCHAR(191) NOT NULL,
    `modalidad` ENUM('FCL', 'LCL', 'AEREO', 'TERRESTRE', 'FTL', 'LTL', 'SEGURO') NOT NULL,
    `montoCompra` DECIMAL(14, 2) NOT NULL,
    `moneda` VARCHAR(191) NOT NULL DEFAULT 'USD',
    `vigenteDesde` DATETIME(3) NOT NULL,
    `vigenteHasta` DATETIME(3) NULL,

    INDEX `Tarifa_proveedorId_modalidad_idx`(`proveedorId`, `modalidad`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Cotizacion` (
    `id` VARCHAR(191) NOT NULL,
    `folio` VARCHAR(191) NOT NULL,
    `clienteId` VARCHAR(191) NOT NULL,
    `vendedorId` VARCHAR(191) NOT NULL,
    `incoterm` VARCHAR(191) NOT NULL,
    `modalidad` ENUM('FCL', 'LCL', 'AEREO', 'TERRESTRE', 'FTL', 'LTL', 'SEGURO') NOT NULL,
    `origen` VARCHAR(191) NOT NULL,
    `destino` VARCHAR(191) NOT NULL,
    `montoVenta` DECIMAL(14, 2) NOT NULL,
    `montoCompra` DECIMAL(14, 2) NOT NULL,
    `moneda` VARCHAR(191) NOT NULL DEFAULT 'USD',
    `status` ENUM('BORRADOR', 'ENVIADA', 'ACEPTADA', 'RECHAZADA', 'EXPIRADA') NOT NULL DEFAULT 'BORRADOR',
    `validaHasta` DATETIME(3) NULL,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Cotizacion_folio_key`(`folio`),
    INDEX `Cotizacion_clienteId_status_idx`(`clienteId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Booking` (
    `id` VARCHAR(191) NOT NULL,
    `cotizacionId` VARCHAR(191) NOT NULL,
    `proveedorId` VARCHAR(191) NOT NULL,
    `referencia` VARCHAR(191) NULL,
    `status` ENUM('SOLICITADO', 'CONFIRMADO', 'CANCELADO') NOT NULL DEFAULT 'SOLICITADO',
    `confirmadoEn` DATETIME(3) NULL,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Booking_cotizacionId_key`(`cotizacionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Shipment` (
    `id` VARCHAR(191) NOT NULL,
    `folio` VARCHAR(191) NOT NULL,
    `bookingId` VARCHAR(191) NOT NULL,
    `tipoOperacion` ENUM('IMPORTACION', 'EXPORTACION', 'TERRESTRE') NOT NULL,
    `modalidad` ENUM('FCL', 'LCL', 'AEREO', 'TERRESTRE', 'FTL', 'LTL', 'SEGURO') NOT NULL,
    `status` ENUM('NUEVO_EMBARQUE', 'BOOKING_CONFIRMED', 'PARA_CERRAR', 'PARA_FACTURAR', 'FACTURADO', 'CANCELADO', 'TERMINADO') NOT NULL DEFAULT 'NUEVO_EMBARQUE',
    `estatusMaterial` VARCHAR(191) NULL,
    `consigneeId` VARCHAR(191) NOT NULL,
    `shipperNombre` VARCHAR(191) NOT NULL,
    `customerServiceId` VARCHAR(191) NULL,
    `incoterm` VARCHAR(191) NULL,
    `vessel` VARCHAR(191) NULL,
    `voyage` VARCHAR(191) NULL,
    `puertoOrigen` VARCHAR(191) NULL,
    `paisOrigen` VARCHAR(191) NULL,
    `puertoDestino` VARCHAR(191) NULL,
    `destinoFinal` VARCHAR(191) NULL,
    `etd` DATETIME(3) NULL,
    `eta` DATETIME(3) NULL,
    `fechaArriboReal` DATETIME(3) NULL,
    `fechaLiberacion` DATETIME(3) NULL,
    `grossWeight` DECIMAL(12, 2) NULL,
    `cbm` DECIMAL(12, 3) NULL,
    `totalItems` INTEGER NULL,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actualizadoEn` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Shipment_folio_key`(`folio`),
    UNIQUE INDEX `Shipment_bookingId_key`(`bookingId`),
    INDEX `Shipment_status_idx`(`status`),
    INDEX `Shipment_modalidad_idx`(`modalidad`),
    INDEX `Shipment_eta_idx`(`eta`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Documento` (
    `id` VARCHAR(191) NOT NULL,
    `shipmentId` VARCHAR(191) NOT NULL,
    `mbl` VARCHAR(191) NULL,
    `hbl` VARCHAR(191) NULL,
    `manifiesto` VARCHAR(191) NULL,
    `emisionHbl` VARCHAR(191) NULL,
    `emisionMbl` VARCHAR(191) NULL,
    `cartaInstruccionesUrl` VARCHAR(191) NULL,

    UNIQUE INDEX `Documento_shipmentId_key`(`shipmentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Contenedor` (
    `id` VARCHAR(191) NOT NULL,
    `shipmentId` VARCHAR(191) NOT NULL,
    `numero` VARCHAR(191) NULL,
    `tipo` VARCHAR(191) NULL,
    `sello` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CostoDemora` (
    `id` VARCHAR(191) NOT NULL,
    `shipmentId` VARCHAR(191) NOT NULL,
    `diasDemora` INTEGER NOT NULL DEFAULT 0,
    `costoDemora` DECIMAL(14, 2) NULL,
    `ventaDemoraSinIva` DECIMAL(14, 2) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CuentaPorPagar` (
    `id` VARCHAR(191) NOT NULL,
    `shipmentId` VARCHAR(191) NULL,
    `proveedorId` VARCHAR(191) NOT NULL,
    `numeroFactura` VARCHAR(191) NULL,
    `monto` DECIMAL(14, 2) NOT NULL,
    `moneda` VARCHAR(191) NOT NULL DEFAULT 'MXN',
    `fechaSolicitud` DATETIME(3) NULL,
    `fechaLimitePago` DATETIME(3) NULL,
    `fechaPagoConfirmado` DATETIME(3) NULL,
    `esGarantia` BOOLEAN NOT NULL DEFAULT false,
    `comentarios` VARCHAR(191) NULL,

    INDEX `CuentaPorPagar_proveedorId_idx`(`proveedorId`),
    INDEX `CuentaPorPagar_fechaLimitePago_idx`(`fechaLimitePago`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Factura` (
    `id` VARCHAR(191) NOT NULL,
    `shipmentId` VARCHAR(191) NOT NULL,
    `numeroFactura` VARCHAR(191) NOT NULL,
    `cfdiUuid` VARCHAR(191) NULL,
    `montoSinIva` DECIMAL(14, 2) NOT NULL,
    `moneda` VARCHAR(191) NOT NULL DEFAULT 'USD',
    `estatusPac` VARCHAR(191) NULL,
    `fechaTimbrado` DATETIME(3) NULL,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Factura_shipmentId_key`(`shipmentId`),
    UNIQUE INDEX `Factura_numeroFactura_key`(`numeroFactura`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Tarifa` ADD CONSTRAINT `Tarifa_proveedorId_fkey` FOREIGN KEY (`proveedorId`) REFERENCES `Proveedor`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Cotizacion` ADD CONSTRAINT `Cotizacion_clienteId_fkey` FOREIGN KEY (`clienteId`) REFERENCES `Cliente`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Cotizacion` ADD CONSTRAINT `Cotizacion_vendedorId_fkey` FOREIGN KEY (`vendedorId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Booking` ADD CONSTRAINT `Booking_cotizacionId_fkey` FOREIGN KEY (`cotizacionId`) REFERENCES `Cotizacion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Booking` ADD CONSTRAINT `Booking_proveedorId_fkey` FOREIGN KEY (`proveedorId`) REFERENCES `Proveedor`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Shipment` ADD CONSTRAINT `Shipment_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `Booking`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Shipment` ADD CONSTRAINT `Shipment_consigneeId_fkey` FOREIGN KEY (`consigneeId`) REFERENCES `Cliente`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Shipment` ADD CONSTRAINT `Shipment_customerServiceId_fkey` FOREIGN KEY (`customerServiceId`) REFERENCES `Usuario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Documento` ADD CONSTRAINT `Documento_shipmentId_fkey` FOREIGN KEY (`shipmentId`) REFERENCES `Shipment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Contenedor` ADD CONSTRAINT `Contenedor_shipmentId_fkey` FOREIGN KEY (`shipmentId`) REFERENCES `Shipment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CostoDemora` ADD CONSTRAINT `CostoDemora_shipmentId_fkey` FOREIGN KEY (`shipmentId`) REFERENCES `Shipment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CuentaPorPagar` ADD CONSTRAINT `CuentaPorPagar_shipmentId_fkey` FOREIGN KEY (`shipmentId`) REFERENCES `Shipment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CuentaPorPagar` ADD CONSTRAINT `CuentaPorPagar_proveedorId_fkey` FOREIGN KEY (`proveedorId`) REFERENCES `Proveedor`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Factura` ADD CONSTRAINT `Factura_shipmentId_fkey` FOREIGN KEY (`shipmentId`) REFERENCES `Shipment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
