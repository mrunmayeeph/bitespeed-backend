import { prisma } from "../lib/prisma";
import { Contact, LinkPrecedence } from "@prisma/client";

export class IdentityService {
  static async reconcile(email?: string, phoneNumber?: string) {
    if (!email && !phoneNumber) {
      throw new Error("At least one of email or phoneNumber must be provided");
    }

    return await prisma.$transaction(async (tx) => {
      const conditions = [];
      if (email) conditions.push({ email });
      if (phoneNumber) conditions.push({ phoneNumber });

      const matches: Contact[] = await tx.contact.findMany({
        where: { OR: conditions },
        orderBy: { createdAt: "asc" },
      });

      // No matches → create primary
      if (matches.length === 0) {
        const newContact = await tx.contact.create({
          data: {
            email,
            phoneNumber,
            linkPrecedence: LinkPrecedence.primary,
          },
        });

        return this.formatResponse(newContact, []);
      }

      const primaryContact =
        matches.find((m) => m.linkPrecedence === LinkPrecedence.primary) ||
        matches[0];

      const cluster: Contact[] = await tx.contact.findMany({
        where: {
          OR: [
            { id: primaryContact.id },
            { linkedId: primaryContact.id },
          ],
        },
        orderBy: { createdAt: "asc" },
      });

      const emailExists = email
        ? cluster.some((c) => c.email === email)
        : true;

      const phoneExists = phoneNumber
        ? cluster.some((c) => c.phoneNumber === phoneNumber)
        : true;

      if (!emailExists || !phoneExists) {
        await tx.contact.create({
          data: {
            email,
            phoneNumber,
            linkedId: primaryContact.id,
            linkPrecedence: LinkPrecedence.secondary,
          },
        });
      }

      const finalCluster: Contact[] = await tx.contact.findMany({
        where: {
          OR: [
            { id: primaryContact.id },
            { linkedId: primaryContact.id },
          ],
        },
        orderBy: { createdAt: "asc" },
      });

      const primary = finalCluster.find(
        (c) => c.linkPrecedence === LinkPrecedence.primary
      )!;

      const secondaries = finalCluster.filter(
        (c) => c.linkPrecedence === LinkPrecedence.secondary
      );

      return this.formatResponse(primary, secondaries);
    });
  }

  private static formatResponse(primary: Contact, secondaries: Contact[]) {
    const emails = [
      primary.email,
      ...secondaries.map((s) => s.email),
    ].filter(Boolean);

    const phoneNumbers = [
      primary.phoneNumber,
      ...secondaries.map((s) => s.phoneNumber),
    ].filter(Boolean);

    return {
      contact: {
        primaryContactId: primary.id,
        emails: [...new Set(emails)],
        phoneNumbers: [...new Set(phoneNumbers)],
        secondaryContactIds: secondaries.map((s) => s.id),
      },
    };
  }
}