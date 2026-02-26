import { Request, Response } from "express";
import { IdentityService } from "../services/identity.service";

export const identify = async (req: Request, res: Response) => {
  const { email, phoneNumber } = req.body;
  
  // Requirement: Either email or phone will be present
  if (!email && !phoneNumber) {
    return res.status(400).json({ message: "Email or Phone required" });
  }

  try {
    const result = await IdentityService.reconcile(email, phoneNumber?.toString());
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};