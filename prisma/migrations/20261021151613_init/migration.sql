-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "imei" TEXT NOT NULL,
    "plate" TEXT,
    "brand" TEXT NOT NULL,
    "model" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "positions" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "speed" DOUBLE PRECISION NOT NULL,
    "heading" DOUBLE PRECISION NOT NULL,
    "altitude" DOUBLE PRECISION NOT NULL,
    "ignition" BOOLEAN NOT NULL,
    "odometer" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_states" (
    "vehicleId" TEXT NOT NULL,
    "lastLat" DOUBLE PRECISION NOT NULL,
    "lastLng" DOUBLE PRECISION NOT NULL,
    "lastSpeed" DOUBLE PRECISION NOT NULL,
    "lastIgnition" BOOLEAN NOT NULL,
    "odometer" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastTimestamp" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_states_pkey" PRIMARY KEY ("vehicleId")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processed_events" (
    "eventId" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_events_pkey" PRIMARY KEY ("eventId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_imei_key" ON "Vehicle"("imei");

-- CreateIndex
CREATE UNIQUE INDEX "positions_eventId_key" ON "positions"("eventId");

-- CreateIndex
CREATE INDEX "positions_vehicleId_capturedAt_idx" ON "positions"("vehicleId", "capturedAt" DESC);

-- CreateIndex
CREATE INDEX "events_vehicleId_occurredAt_idx" ON "events"("vehicleId", "occurredAt" DESC);

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_states" ADD CONSTRAINT "vehicle_states_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
