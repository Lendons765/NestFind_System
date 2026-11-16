import express from "express";
import cors from "cors";
import { listingsRouter } from "./routes/listings";
import { inquiriesRouter } from "./routes/inquiries";
import "dotenv/config";
import { authRouter } from "./routes/auth";
import { ownerRouter } from "./routes/owner";
import { adminRouter } from "./routes/admin";
import { locationsRouter } from "./routes/locations";
import path from "node:path";
import { passwordRouter } from "./routes/passwords";
import { listingEditingRouter } from "./routes/listingEditing";
import { listingMediaRouter } from "./routes/listingMedia";

const app = express();
app.use(cors({
  origin: ["http://localhost:5173", "http://localhost:5174", "http://127.0.0.1:5173"],
}));
app.use(express.json());

app.use("/api/listings/:id/inquiries", inquiriesRouter);
app.use("/api/auth", authRouter);
app.use("/api/owner", ownerRouter);
app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api/listings", listingsRouter);
app.use("/api/admin", adminRouter);
app.use("/api/locations", locationsRouter);
app.use("/uploads", express.static(path.resolve("uploads")));
app.use("/api/auth/password", passwordRouter);
app.use("/api/owner/listings", listingEditingRouter);
app.use("/api/listings", listingMediaRouter);
const port = Number(process.env.PORT) || 4000;
app.listen(port, () => console.log(`API running on http://localhost:${port}`));