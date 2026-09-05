-- AlterTable
ALTER TABLE `cliente` ADD COLUMN `codigoPostal` VARCHAR(191) NULL,
    ADD COLUMN `regimenFiscal` VARCHAR(191) NULL,
    ADD COLUMN `usoCfdi` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `factura` DROP COLUMN `estatusPac`,
    ADD COLUMN `codigoPostalReceptor` VARCHAR(191) NULL,
    ADD COLUMN `condicionesPago` VARCHAR(191) NULL,
    ADD COLUMN `estatus` ENUM('BORRADOR', 'PENDIENTE_TIMBRADO', 'TIMBRADA') NOT NULL DEFAULT 'BORRADOR',
    ADD COLUMN `formaPago` VARCHAR(191) NULL,
    ADD COLUMN `metodoPago` ENUM('PUE', 'PPD') NOT NULL DEFAULT 'PUE',
    ADD COLUMN `regimenFiscalReceptor` VARCHAR(191) NULL,
    ADD COLUMN `retencionIsrTasa` DECIMAL(5, 2) NULL,
    ADD COLUMN `retencionIvaTasa` DECIMAL(5, 2) NULL,
    ADD COLUMN `tipoCambio` DECIMAL(10, 4) NULL,
    ADD COLUMN `usoCfdi` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `ConceptoFactura` (
    `id` VARCHAR(191) NOT NULL,
    `facturaId` VARCHAR(191) NOT NULL,
    `claveProdServ` VARCHAR(191) NOT NULL,
    `claveUnidad` VARCHAR(191) NOT NULL,
    `unidad` VARCHAR(191) NULL,
    `cantidad` DECIMAL(12, 3) NOT NULL DEFAULT 1,
    `descripcion` TEXT NOT NULL,
    `valorUnitario` DECIMAL(14, 2) NOT NULL,
    `importe` DECIMAL(14, 2) NOT NULL,
    `objetoImpuesto` VARCHAR(191) NOT NULL DEFAULT '02',
    `ivaTasa` DECIMAL(5, 2) NOT NULL DEFAULT 16,
    `ivaImporte` DECIMAL(14, 2) NOT NULL,

    INDEX `ConceptoFactura_facturaId_idx`(`facturaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ComplementoPago` (
    `id` VARCHAR(191) NOT NULL,
    `facturaId` VARCHAR(191) NOT NULL,
    `folio` VARCHAR(191) NOT NULL,
    `fechaPago` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `monto` DECIMAL(14, 2) NOT NULL,
    `moneda` VARCHAR(191) NOT NULL DEFAULT 'USD',
    `tipoCambio` DECIMAL(10, 4) NULL,
    `formaPago` VARCHAR(191) NOT NULL,
    `numOperacion` VARCHAR(191) NULL,
    `saldoAnterior` DECIMAL(14, 2) NOT NULL,
    `saldoInsoluto` DECIMAL(14, 2) NOT NULL,
    `estatus` ENUM('BORRADOR', 'PENDIENTE_TIMBRADO', 'TIMBRADA') NOT NULL DEFAULT 'BORRADOR',
    `cfdiUuid` VARCHAR(191) NULL,
    `fechaTimbrado` DATETIME(3) NULL,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ComplementoPago_folio_key`(`folio`),
    INDEX `ComplementoPago_facturaId_idx`(`facturaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ConceptoFactura` ADD CONSTRAINT `ConceptoFactura_facturaId_fkey` FOREIGN KEY (`facturaId`) REFERENCES `Factura`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ComplementoPago` ADD CONSTRAINT `ComplementoPago_facturaId_fkey` FOREIGN KEY (`facturaId`) REFERENCES `Factura`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

