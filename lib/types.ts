export type TransactionStatus = "borrowed" | "returned";
export type ItemStatus = "available" | "borrowed" | "maintenance" | "retired";

export interface EquipmentItem {
  id: string;
  equipment_id: string;
  item_code: string;
  serial_number: string | null;
  asset_number: string | null;
  status: ItemStatus;
  note?: string | null;
  created_at?: string;
}

export interface Equipment {
  id: string;
  name: string;
  category?: string | null;
  image_url: string | null;
  total_stock: number;
  available_stock: number;
  created_at?: string;
  items?: EquipmentItem[];
}

export interface Transaction {
  id: string;
  line_user_id: string;
  display_name: string;
  department: string;
  equipment_id: string;
  item_id?: string | null;
  serial_number?: string | null;
  asset_number?: string | null;
  borrow_date: string;
  return_date: string | null;
  status: TransactionStatus;
  time_slot?: string;
  purpose?: string;
  internal_phone?: string;
  created_at?: string;
  equipments?: Equipment;
  equipment_items?: EquipmentItem;
}

export interface BorrowRequestPayload {
  line_user_id: string;
  display_name: string;
  department: string;
  equipment_id: string;
  item_id?: string | null;
  borrow_date: string;
  time_slot?: string;
  purpose?: string;
  internal_phone?: string;
}

export interface BorrowResponse {
  success: boolean;
  message: string;
  transaction?: {
    id: string;
    equipment_name: string;
    borrow_date: string;
  };
  notifySent?: boolean;
}

export interface UserProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
}

export interface EquipmentFormData {
  id?: string;
  name: string;
  category?: string;
  image_url: string;
  total_stock: number;
}

export interface AdminAuthVerifyRequest {
  passcode?: string;
  line_user_id?: string;
}

export interface AdminAuthVerifyResponse {
  success: boolean;
  message?: string;
  token?: string;
  is_admin?: boolean;
}
