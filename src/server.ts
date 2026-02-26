import express from "express";
import routes from "./routes";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
  res.status(200).json({
    message: "Bitespeed Identity Reconciliation API is running smoothly",
    endpoint: "/identify",
    method: "POST"
  });
});

app.use("/", routes);