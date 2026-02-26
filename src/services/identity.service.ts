import { prisma } from "../lib/prisma";
import {
  Contact,
  LinkPrecedence,
} from "@prisma/client";

export class IdentityService {
  static async reconcile(email?: string, phoneNumber?: string) {
    if (!email && !phoneNumber) {
      throw new Error(
        "At least one of email or phoneNumber must be provided"
      );
    }

    return await prisma.$transaction(async (tx) => {
      // Build dynamic search conditions
      const conditions = [];
      if (email) conditions.push({ email });
      if (phoneNumber) conditions.push({ phoneNumber });

      const matches: Contact[] = await tx.contact.findMany({
        where: { OR: conditions },
      });

      // If no matches → create new primary
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

      // Collect all related primary IDs
      const primaryIds = new Set<number>();

      for (const match of matches) {
        if (match.linkPrecedence === LinkPrecedence.primary) {
          primaryIds.add(match.id);
        } else if (match.linkedId) {
          primaryIds.add(match.linkedId);
        }
      }

      // Fetch entire cluster ordered by creation date
      const cluster: Contact[] = await tx.contact.findMany({
        where: {
          OR: [
            { id: { in: Array.from(primaryIds) } },
            { linkedId: { in: Array.from(primaryIds) } },
          ],
        },
        orderBy: { createdAt: "asc" },
      });

      // Oldest contact becomes primary
      const primaryContact = cluster[0];

      // Merge multiple primaries if needed
      const otherPrimaries = cluster.filter(
        (c) =>
          c.linkPrecedence === LinkPrecedence.primary &&
          c.id !== primaryContact.id
      );

      if (otherPrimaries.length > 0) {
        const otherPrimaryIds = otherPrimaries.map((p) => p.id);

        // Convert other primaries to secondary
        await tx.contact.updateMany({
          where: { id: { in: otherPrimaryIds } },
          data: {
            linkPrecedence: LinkPrecedence.secondary,
            linkedId: primaryContact.id,
          },
        });

        // Reassign their children to the oldest primary
        await tx.contact.updateMany({
          where: { linkedId: { in: otherPrimaryIds } },
          data: { linkedId: primaryContact.id },
        });
      }

      // Re-fetch updated cluster
      const updatedCluster: Contact[] = await tx.contact.findMany({
        where: {
          OR: [
            { id: primaryContact.id },
            { linkedId: primaryContact.id },
          ],
        },
      });

      // Check if new secondary needs to be created
      let shouldCreateSecondary = false;

        if (email !== undefined && email !== null) {
        const emailExists = updatedCluster.some(
            (c) => c.email === email
        );
        if (!emailExists) {
            shouldCreateSecondary = true;
        }
        }

        if (phoneNumber !== undefined && phoneNumber !== null) {
        const phoneExists = updatedCluster.some(
            (c) => c.phoneNumber === phoneNumber
        );
        if (!phoneExists) {
            shouldCreateSecondary = true;
        }
        }

        if (shouldCreateSecondary) {
        await tx.contact.create({
            data: {
            email: email ?? null,
            phoneNumber: phoneNumber ?? null,
            linkedId: primaryContact.id,
            linkPrecedence: LinkPrecedence.secondary,
            },
        });
        }

      //  Final fetch
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

  private static formatResponse(
    primary: Contact,
    secondaries: Contact[]
  ) {
    const emails = [
      primary.email,
      ...secondaries.map((s) => s.email),
    ]
      .filter(Boolean)
      .filter((v, i, arr) => arr.indexOf(v) === i);

    const phoneNumbers = [
      primary.phoneNumber,
      ...secondaries.map((s) => s.phoneNumber),
    ]
      .filter(Boolean)
      .filter((v, i, arr) => arr.indexOf(v) === i);

    return {
      contact: {
        primaryContactId: primary.id,
        emails,
        phoneNumbers,
        secondaryContactIds: secondaries.map((s) => s.id),
      },
    };
  }
}

