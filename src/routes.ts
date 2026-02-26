import { Router } from "express";
import { identify } from "./controllers/contact.controller";

const router = Router();
router.post("/identify", identify);

export default router;