import {
  BranchStatus,
  BusinessStatus,
  BusinessType,
  DocumentStatus,
  DocumentType,
  GuaranteeType,
  InvitationStatus,
  SubscriptionStatus,
  WorkerAvailability,
} from "../../generated/prisma";
import type {
  Branch,
  Business,
  BusinessDocument,
  Plan,
  Prisma,
  PrismaClient,
  Subscription,
  Worker,
} from "../../generated/prisma";
import type { SeededUsers } from "./users";

export type SeedBusinessesInput = {
  users: Pick<
    SeededUsers,
    "admin" | "garciaOwner" | "voltaOwner" | "climaOwner"
  >;
  standardPlan: Plan;
};

export type SeededBusinesses = {
  garcia: Business;
  volta: Business;
  clima: Business;
  branches: {
    centro: Branch;
    campestre: Branch;
    zonaDorada: Branch;
  };
  workers: {
    plumber: Worker;
    courier: Worker;
  };
  subscriptions: {
    garcia: Subscription;
    clima: Subscription;
  };
  documents: readonly BusinessDocument[];
};

export async function seedBusinesses(
  prisma: PrismaClient,
  { users, standardPlan }: SeedBusinessesInput,
): Promise<SeededBusinesses> {
  const businessData = [
    {
      id: "seed-business-garcia",
      name: "Plomería García",
      type: BusinessType.SERVICES,
      status: BusinessStatus.ACTIVE,
      guaranteeType: GuaranteeType.COMBINED,
      guaranteeNotes: "Depósito y póliza de responsabilidad civil vigentes.",
      statusReason: null,
      ownerId: users.garciaOwner.id,
      stripeAccountId: null,
    },
    {
      id: "seed-business-volta",
      name: "Eléctrica Volta",
      type: BusinessType.SERVICES,
      status: BusinessStatus.PENDING,
      guaranteeType: GuaranteeType.DEPOSIT,
      guaranteeNotes: "Documentación en revisión.",
      statusReason: null,
      ownerId: users.voltaOwner.id,
      stripeAccountId: null,
    },
    {
      id: "seed-business-clima",
      name: "Clima Norte MX",
      type: BusinessType.MIXED,
      status: BusinessStatus.SUSPENDED,
      guaranteeType: GuaranteeType.INSURANCE_PER_SERVICE,
      guaranteeNotes: "Póliza requerida por cada servicio especializado.",
      statusReason: "Verificación documental pendiente de actualización.",
      ownerId: users.climaOwner.id,
      stripeAccountId: null,
    },
  ] satisfies readonly Prisma.BusinessUncheckedCreateInput[];

  const [garcia, volta, clima] = await Promise.all(
    businessData.map(({ id, ownerId, ...values }) =>
      prisma.business.upsert({
        where: { ownerId },
        create: { id, ownerId, ...values },
        update: values,
      }),
    ),
  );

  if (!garcia || !volta || !clima) {
    throw new Error("Seed businesses could not be created");
  }

  const branchData = [
    {
      id: "seed-branch-centro",
      name: "Centro",
      address: "Av. Independencia 1201, Centro, Chihuahua, Chih.",
      managerName: "Roberto García",
      coverageRadiusKm: 10,
      status: BranchStatus.ACTIVE,
      businessId: garcia.id,
    },
    {
      id: "seed-branch-campestre",
      name: "Campestre",
      address: "Perif. de la Juventud 3501, Campestre, Chihuahua, Chih.",
      managerName: "Elena García",
      coverageRadiusKm: 12,
      status: BranchStatus.ACTIVE,
      businessId: garcia.id,
    },
    {
      id: "seed-branch-zona-dorada",
      name: "Zona Dorada",
      address: "Av. Teófilo Borunda 9100, Zona Dorada, Chihuahua, Chih.",
      managerName: "Javier García",
      coverageRadiusKm: 15,
      status: BranchStatus.ACTIVE,
      businessId: garcia.id,
    },
  ] satisfies readonly Prisma.BranchUncheckedCreateInput[];

  const branches = await Promise.all(
    branchData.map(({ id, ...values }) =>
      prisma.branch.upsert({
        where: { id },
        create: { id, ...values },
        update: values,
      }),
    ),
  );

  const [centro, campestre, zonaDorada] = branches;
  if (!centro || !campestre || !zonaDorada) {
    throw new Error("Seed branches could not be created");
  }

  const workerData = [
    {
      id: "seed-worker-01",
      userId: null,
      fullName: "Jorge Salas",
      businessId: garcia.id,
      branchId: centro.id,
      specialty: "Plomero",
      availability: WorkerAvailability.AVAILABLE,
      ratingAvg: 4.8,
      invitedEmail: null,
      invitationStatus: InvitationStatus.ACCEPTED,
    },
    {
      id: "seed-worker-02",
      userId: null,
      fullName: "Diego Luna",
      businessId: garcia.id,
      branchId: campestre.id,
      specialty: "Repartidor",
      availability: WorkerAvailability.ON_SERVICE,
      ratingAvg: null,
      invitedEmail: "diego.luna@example.com",
      invitationStatus: InvitationStatus.PENDING,
    },
  ] satisfies readonly Prisma.WorkerUncheckedCreateInput[];

  const workers = await Promise.all(
    workerData.map(({ id, ...values }) =>
      prisma.worker.upsert({
        where: { id },
        create: { id, ...values },
        update: values,
      }),
    ),
  );

  const [plumber, courier] = workers;
  if (!plumber || !courier) {
    throw new Error("Seed workers could not be created");
  }

  const renewsAt = new Date();
  renewsAt.setUTCDate(renewsAt.getUTCDate() + 30);

  const subscriptionData = [
    {
      id: "seed-subscription-garcia",
      businessId: garcia.id,
      planId: standardPlan.id,
      status: SubscriptionStatus.ACTIVE,
      renewsAt,
      stripeSubscriptionId: null,
    },
    {
      id: "seed-subscription-clima",
      businessId: clima.id,
      planId: standardPlan.id,
      status: SubscriptionStatus.ACTIVE,
      renewsAt,
      stripeSubscriptionId: null,
    },
  ] satisfies readonly Prisma.SubscriptionUncheckedCreateInput[];

  const subscriptions = await Promise.all(
    subscriptionData.map(({ id, businessId, ...values }) =>
      prisma.subscription.upsert({
        where: { businessId },
        create: { id, businessId, ...values },
        update: values,
      }),
    ),
  );

  const [garciaSubscription, climaSubscription] = subscriptions;
  if (!garciaSubscription || !climaSubscription) {
    throw new Error("Seed subscriptions could not be created");
  }

  const reviewedAt = new Date("2026-07-01T12:00:00.000Z");
  const documentData = [
    {
      id: "seed-document-garcia-id",
      businessId: garcia.id,
      type: DocumentType.ID_DOCUMENT,
      fileUrl: "https://example.com/seed/garcia-identification.pdf",
      status: DocumentStatus.APPROVED,
      reviewedById: users.admin.id,
      reviewedAt,
      notes: "Documento verificado para datos de demostración.",
    },
    {
      id: "seed-document-garcia-address",
      businessId: garcia.id,
      type: DocumentType.ADDRESS_PROOF,
      fileUrl: "https://example.com/seed/garcia-address-proof.pdf",
      status: DocumentStatus.APPROVED,
      reviewedById: users.admin.id,
      reviewedAt,
      notes: "Domicilio comercial verificado.",
    },
    {
      id: "seed-document-garcia-policy",
      businessId: garcia.id,
      type: DocumentType.INSURANCE_POLICY,
      fileUrl: "https://example.com/seed/garcia-insurance-policy.pdf",
      status: DocumentStatus.APPROVED,
      reviewedById: users.admin.id,
      reviewedAt,
      notes: "Póliza vigente para datos de demostración.",
    },
    {
      id: "seed-document-volta-id",
      businessId: volta.id,
      type: DocumentType.ID_DOCUMENT,
      fileUrl: "https://example.com/seed/volta-identification.pdf",
      status: DocumentStatus.PENDING,
      reviewedById: null,
      reviewedAt: null,
      notes: null,
    },
    {
      id: "seed-document-volta-address",
      businessId: volta.id,
      type: DocumentType.ADDRESS_PROOF,
      fileUrl: "https://example.com/seed/volta-address-proof.pdf",
      status: DocumentStatus.PENDING,
      reviewedById: null,
      reviewedAt: null,
      notes: null,
    },
  ] satisfies readonly Prisma.BusinessDocumentUncheckedCreateInput[];

  const documents = await Promise.all(
    documentData.map(({ id, ...values }) =>
      prisma.businessDocument.upsert({
        where: { id },
        create: { id, ...values },
        update: values,
      }),
    ),
  );

  return {
    garcia,
    volta,
    clima,
    branches: { centro, campestre, zonaDorada },
    workers: { plumber, courier },
    subscriptions: {
      garcia: garciaSubscription,
      clima: climaSubscription,
    },
    documents,
  };
}
