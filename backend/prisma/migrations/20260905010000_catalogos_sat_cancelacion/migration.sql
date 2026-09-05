-- AlterTable
ALTER TABLE `complementopago` ADD COLUMN `fechaCancelacion` DATETIME(3) NULL,
    ADD COLUMN `folioSustitucionUuid` VARCHAR(191) NULL,
    ADD COLUMN `motivoCancelacion` VARCHAR(191) NULL,
    MODIFY `estatus` ENUM('BORRADOR', 'PENDIENTE_TIMBRADO', 'TIMBRADA', 'CANCELADA') NOT NULL DEFAULT 'BORRADOR';

-- AlterTable
ALTER TABLE `factura` ADD COLUMN `fechaCancelacion` DATETIME(3) NULL,
    ADD COLUMN `folioSustitucionUuid` VARCHAR(191) NULL,
    ADD COLUMN `motivoCancelacion` VARCHAR(191) NULL,
    MODIFY `estatus` ENUM('BORRADOR', 'PENDIENTE_TIMBRADO', 'TIMBRADA', 'CANCELADA') NOT NULL DEFAULT 'BORRADOR';

-- CreateTable
CREATE TABLE `SatClaveProdServ` (
    `clave` VARCHAR(191) NOT NULL,
    `descripcion` TEXT NOT NULL,
    `palabrasSimilares` TEXT NULL,

    INDEX `SatClaveProdServ_descripcion_idx`(`descripcion`(100)),
    PRIMARY KEY (`clave`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SatClaveUnidad` (
    `clave` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `simbolo` VARCHAR(191) NULL,

    PRIMARY KEY (`clave`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SatRegimenFiscal` (
    `clave` VARCHAR(191) NOT NULL,
    `descripcion` VARCHAR(191) NOT NULL,
    `aplicaFisica` BOOLEAN NOT NULL DEFAULT true,
    `aplicaMoral` BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY (`clave`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SatUsoCfdi` (
    `clave` VARCHAR(191) NOT NULL,
    `descripcion` VARCHAR(191) NOT NULL,
    `aplicaFisica` BOOLEAN NOT NULL DEFAULT true,
    `aplicaMoral` BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY (`clave`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SatFormaPago` (
    `clave` VARCHAR(191) NOT NULL,
    `descripcion` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`clave`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SatMoneda` (
    `clave` VARCHAR(191) NOT NULL,
    `descripcion` VARCHAR(191) NOT NULL,
    `decimales` INTEGER NOT NULL DEFAULT 2,

    PRIMARY KEY (`clave`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SatObjetoImp` (
    `clave` VARCHAR(191) NOT NULL,
    `descripcion` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`clave`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SatMotivoCancelacion` (
    `clave` VARCHAR(191) NOT NULL,
    `descripcion` VARCHAR(191) NOT NULL,
    `requiereFolioSustitucion` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`clave`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

