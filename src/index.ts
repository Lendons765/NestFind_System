import express from "express";
import cors from "cors";
import { listingsRouter } from "./routes/listings.js";
import { inquiriesRouter } from "./routes/inquiries.js";
import "dotenv/config";
import { authRouter } from "./routes/auth.js";
import { ownerRouter } from "./routes/owner.js";
import { locationsRouter } from "./routes/locations.js";
import path from "node:path";
import { passwordRouter } from "./routes/passwords.js";
import { listingEditingRouter } from "./routes/listingEditing.js";
import { listingMediaRouter } from "./routes/listingMedia.js";
import { leasingRouter } from "./routes/leasing.js";
import { tenantRouter } from "./routes/tenant.js";
import { dashboardRouter } from "./routes/dashboard.js";

const app = express();
app.use(cors({
  origin: process.env.CLIENT_URL?.split(",") || [
    "http://localhost:5173"
  ],
}));
app.use(express.json());

app.use("/api/listings/:id/inquiries", inquiriesRouter);
app.use("/api/auth", authRouter);
app.use("/api/owner", ownerRouter);
app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api/listings", listingsRouter);
app.use("/api", leasingRouter);
app.use("/api/locations", locationsRouter);
app.use("/uploads", express.static(path.resolve("uploads")));
app.use("/api/auth/password", passwordRouter);
app.use("/api/owner/listings", listingEditingRouter);
app.use("/api/listings", listingMediaRouter);
app.use("/api/tenant", tenantRouter);
app.use("/api/dashboard", dashboardRouter);
const port = Number(process.env.PORT) || 4000;

app.listen(port, "0.0.0.0", () => {
  console.log(`API running on port ${port}`);
});