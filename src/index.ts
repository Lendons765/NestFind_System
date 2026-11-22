import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import { listingsRouter } from "./routes/listings.js";
import { inquiriesRouter } from "./routes/inquiries.js";
import { authRouter } from "./routes/auth.js";
import { ownerRouter } from "./routes/owner.js";
import { locationsRouter } from "./routes/locations.js";
import { passwordRouter } from "./routes/passwords.js";
import { listingEditingRouter } from "./routes/listingEditing.js";
import { listingMediaRouter } from "./routes/listingMedia.js";
import { leasingRouter } from "./routes/leasing.js";
import { tenantRouter } from "./routes/tenant.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { tenantExtrasRouter } from "./routes/tenantExtras.js";
import { ownerExtrasRouter } from "./routes/ownerExtras.js";
import { codesRouter } from "./routes/codes.js";

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL?.split(",") || ["http://localhost:5173"],
  })
);
app.use(express.json());

// Uploaded photos. This must point to the same folder the upload route writes to.
const UPLOAD_DIR = path.resolve("uploads");
console.log(`Serving uploads from: ${UPLOAD_DIR}`);
app.use("/uploads", express.static(UPLOAD_DIR));

app.get("/health", (_req, res) => res.json({ status: "ok" }));

// Specific routes first, so they aren't caught by broader mounts.
app.use("/api/auth/codes", codesRouter);
app.use("/api/auth/password", passwordRouter);
app.use("/api/auth", authRouter);

app.use("/api/listings/:id/inquiries", inquiriesRouter);
app.use("/api/listings", listingsRouter);
app.use("/api/listings", listingMediaRouter);
app.use("/api/locations", locationsRouter);

app.use("/api/owner/listings", listingEditingRouter);
app.use("/api/owner/extras", ownerExtrasRouter);
app.use("/api/owner", ownerRouter);

app.use("/api/tenant", tenantExtrasRouter);
app.use("/api/tenant", tenantRouter);

app.use("/api/dashboard", dashboardRouter);
app.use("/api", leasingRouter);

const port = Number(process.env.PORT) || 4000;

app.listen(port, "0.0.0.0", () => {
  console.log(`API running on port ${port}`);
});