export type TransactionStatus = "borrowed" | "returned";

export interface Equipment {
  id: string;
  name: string;
  image_url: string | null;
  total_stock: number;
  available_stock: number;
  created_at?: string;
}

export interface Transaction {
  id: string;
  line_user_id: string;
  display_name: string;
  department: string;
  equipment_id: string;
  borrow_date: string;
  return_date: string | null;
  status: TransactionStatus;
  created_at?: string;
  equipments?: Equipment;
}

export interface BorrowRequestPayload {
  line_user_id: string;
  display_name: string;
  department: string;
  equipment_id: string;
  borrow_date: string;
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
