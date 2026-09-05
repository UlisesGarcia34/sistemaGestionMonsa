-- AlterTable
ALTER TABLE `shipment` ADD COLUMN `poCliente` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `CuentaPorCobrar` (
    `id` VARCHAR(191) NOT NULL,
    `facturaId` VARCHAR(191) NOT NULL,
    `clienteId` VARCHAR(191) NOT NULL,
    `monto` DECIMAL(14, 2) NOT NULL,
    `moneda` VARCHAR(191) NOT NULL DEFAULT 'USD',
    `montoCobrado` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `fechaEmision` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fechaVencimiento` DATETIME(3) NULL,
    `fechaCobro` DATETIME(3) NULL,
    `estatusCobro` ENUM('PENDIENTE', 'PARCIAL', 'COBRADA', 'VENCIDA') NOT NULL DEFAULT 'PENDIENTE',
    `comentarios` VARCHAR(191) NULL,

    UNIQUE INDEX `CuentaPorCobrar_facturaId_key`(`facturaId`),
    INDEX `CuentaPorCobrar_clienteId_idx`(`clienteId`),
    INDEX `CuentaPorCobrar_estatusCobro_idx`(`estatusCobro`),
    INDEX `CuentaPorCobrar_fechaVencimiento_idx`(`fechaVencimiento`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CuentaPorCobrar` ADD CONSTRAINT `CuentaPorCobrar_facturaId_fkey` FOREIGN KEY (`facturaId`) REFERENCES `Factura`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CuentaPorCobrar` ADD CONSTRAINT `CuentaPorCobrar_clienteId_fkey` FOREIGN KEY (`clienteId`) REFERENCES `Cliente`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
