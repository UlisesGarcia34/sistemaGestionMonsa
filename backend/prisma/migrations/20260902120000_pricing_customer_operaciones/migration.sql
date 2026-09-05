-- DropForeignKey (se recrea abajo; el indice unico que lo respalda cambia de forma)
ALTER TABLE `factura` DROP FOREIGN KEY `Factura_shipmentId_fkey`;

-- DropIndex
DROP INDEX `Factura_shipmentId_key` ON `factura`;

-- AlterTable
ALTER TABLE `cliente` ADD COLUMN `requiereRoutingOrder` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `documento` DROP COLUMN `emisionHbl`,
    DROP COLUMN `emisionMbl`,
    ADD COLUMN `estatusEmisionHbl` ENUM('DRAFT', 'FINAL') NULL,
    ADD COLUMN `estatusEmisionMbl` ENUM('DRAFT', 'FINAL') NULL;

-- AlterTable
ALTER TABLE `factura` ADD COLUMN `tipo` ENUM('PROFORMA', 'FINAL') NOT NULL DEFAULT 'FINAL';

-- AlterTable
ALTER TABLE `shipment` ADD COLUMN `blEndosadoEnviado` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `expedienteFisico` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `fechaBlEndosadoEnviado` DATETIME(3) NULL,
    ADD COLUMN `fechaRevalidacionNaviera` DATETIME(3) NULL,
    ADD COLUMN `valorizacionCompra` DECIMAL(14, 2) NULL,
    ADD COLUMN `valorizacionConfirmada` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `valorizacionConfirmadaEn` DATETIME(3) NULL,
    ADD COLUMN `valorizacionVenta` DECIMAL(14, 2) NULL;

-- AlterTable
ALTER TABLE `tarifa` ADD COLUMN `tipo` ENUM('CONTRATO', 'SPOT', 'BASKET') NOT NULL DEFAULT 'CONTRATO';

-- CreateTable
CREATE TABLE `RoutingOrder` (
    `id` VARCHAR(191) NOT NULL,
    `cotizacionId` VARCHAR(191) NOT NULL,
    `status` ENUM('SOLICITADO', 'RECIBIDO') NOT NULL DEFAULT 'SOLICITADO',
    `shipperNombre` VARCHAR(191) NULL,
    `shipperDireccion` VARCHAR(191) NULL,
    `pol` VARCHAR(191) NULL,
    `pod` VARCHAR(191) NULL,
    `destinoFinal` VARCHAR(191) NULL,
    `tipoServicioEntrega` ENUM('CY_PUERTO', 'DENTRO_BL_RAIL', 'DENTRO_BL_TRUCK', 'FUERA_BL_CAMION', 'RAM') NULL,
    `especificaciones` TEXT NULL,
    `agenteId` VARCHAR(191) NULL,
    `fechaSolicitud` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fechaRecibido` DATETIME(3) NULL,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actualizadoEn` DATETIME(3) NOT NULL,

    UNIQUE INDEX `RoutingOrder_cotizacionId_key`(`cotizacionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NotificacionEnviada` (
    `id` VARCHAR(191) NOT NULL,
    `shipmentId` VARCHAR(191) NOT NULL,
    `tipo` ENUM('CUTOFF_DOCUMENTAL', 'CUTOFF_CONTENEDOR', 'ETD', 'ETA', 'AVISO_ARRIBO', 'SOLICITUD_FACTURA', 'OTRO') NOT NULL,
    `fechaEnviada` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `enviadoPorId` VARCHAR(191) NULL,
    `comentario` TEXT NULL,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `NotificacionEnviada_shipmentId_idx`(`shipmentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `Factura_shipmentId_tipo_key` ON `Factura`(`shipmentId`, `tipo`);

-- RedoForeignKey (Factura -> Shipment, ahora respaldado por el indice compuesto)
ALTER TABLE `factura` ADD CONSTRAINT `Factura_shipmentId_fkey` FOREIGN KEY (`shipmentId`) REFERENCES `Shipment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RoutingOrder` ADD CONSTRAINT `RoutingOrder_cotizacionId_fkey` FOREIGN KEY (`cotizacionId`) REFERENCES `Cotizacion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RoutingOrder` ADD CONSTRAINT `RoutingOrder_agenteId_fkey` FOREIGN KEY (`agenteId`) REFERENCES `Proveedor`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NotificacionEnviada` ADD CONSTRAINT `NotificacionEnviada_shipmentId_fkey` FOREIGN KEY (`shipmentId`) REFERENCES `Shipment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NotificacionEnviada` ADD CONSTRAINT `NotificacionEnviada_enviadoPorId_fkey` FOREIGN KEY (`enviadoPorId`) REFERENCES `Usuario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

