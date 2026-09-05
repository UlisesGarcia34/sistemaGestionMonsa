ALTER TABLE `Shipment`
  ADD COLUMN `version` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `motivoCancelacion` TEXT NULL,
  ADD COLUMN `canceladoEn` DATETIME(3) NULL,
  ADD COLUMN `canceladoPorId` VARCHAR(191) NULL;
CREATE TABLE `ConsecutivoShipment` (
  `serie` VARCHAR(191) NOT NULL,
  `ultimo` INTEGER NOT NULL,
  PRIMARY KEY (`serie`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE `AuditoriaShipment` (
  `id` VARCHAR(191) NOT NULL,
  `shipmentId` VARCHAR(191) NOT NULL,
  `accion` VARCHAR(191) NOT NULL,
  `autorId` VARCHAR(191) NULL,
  `antes` JSON NULL,
  `despues` JSON NOT NULL,
  `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `AuditoriaShipment_shipmentId_creadoEn_idx` (`shipmentId`, `creadoEn`),
  CONSTRAINT `AuditoriaShipment_shipmentId_fkey` FOREIGN KEY (`shipmentId`) REFERENCES `Shipment` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE INDEX `Shipment_status_eta_idx` ON `Shipment` (`status`, `eta`);
CREATE INDEX `Shipment_tipoOperacion_modalidad_creadoEn_idx` ON `Shipment` (`tipoOperacion`, `modalidad`, `creadoEn`);
