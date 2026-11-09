// src/lib/shared.ts — types & constants used by BOTH server and client (no Node imports here).

export type TicketStatus =
  | 'RECEIVED' | 'QUOTED' | 'AWAITING_DEPOSIT' | 'IN_PROGRESS' | 'READY' | 'COMPLETED' | 'CANCELLED';

export const STATUS_FLOW: TicketStatus[] = ['RECEIVED', 'QUOTED', 'AWAITING_DEPOSIT', 'IN_PROGRESS', 'READY', 'COMPLETED'];

export const STATUS_LABEL: Record<TicketStatus, string> = {
  RECEIVED: 'Received',
  QUOTED: 'Quote sent',
  AWAITING_DEPOSIT: 'Awaiting deposit',
  IN_PROGRESS: 'In progress',
  READY: 'Ready for pickup / delivery',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export type PayNetwork = 'MTN' | 'AIRTEL' | 'OTHER';
export type PayStatus = 'SUBMITTED' | 'CONFIRMED' | 'REJECTED';

export interface PublicTicket {
  id: string;
  kind: 'repair' | 'design' | 'template';
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  slot?: { date: string; time: string };
  history: { at: string; status: TicketStatus; note?: string }[];
  quoteUGX?: number;
  depositUGX?: number;
  depositPaid: boolean;
  /** Template orders: the customer's website .zip can be downloaded. */
  downloadReady?: boolean;
  payments: { network: PayNetwork; txId: string; status: PayStatus; at: string }[];
  pay?: { accountName: string; mtn: string; airtel: string; reference: string };
}

export const formatUGX = (n?: number) => (typeof n === 'number' ? `UGX ${n.toLocaleString('en-UG')}` : '—');
