CREATE TABLE "SiteStats" (
    "id" TEXT NOT NULL,
    "productsInstalled" INTEGER NOT NULL,
    "kmDriven" INTEGER NOT NULL,
    "ordersCompleted" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SiteStats_pkey" PRIMARY KEY ("id")
);
