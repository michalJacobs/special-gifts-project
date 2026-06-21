import { Trash2 } from "lucide-react";
import Modal from "../ui/Modal.jsx";
import InlineAlert from "../ui/InlineAlert.jsx";
import Spinner from "../ui/Spinner.jsx";

export default function DeleteGiftModal({ gift, isDeleting, onClose, onConfirm }) {
  return (
    <Modal
      closeDisabled={isDeleting}
      description="הפעולה תמחק את המתנה ותשלח הודעת ביטול למשתתפים."
      isOpen={Boolean(gift)}
      onClose={onClose}
      title="מחיקת מתנה"
    >
      <InlineAlert tone="danger">למחוק את "{gift?.title}"?</InlineAlert>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button className="btn-secondary" type="button" onClick={onClose} disabled={isDeleting}>
          ביטול
        </button>
        <button className="btn-primary bg-red-700 hover:bg-red-800" type="button" onClick={onConfirm} disabled={isDeleting}>
          {isDeleting ? <Spinner /> : <Trash2 className="h-4 w-4" />}
          {isDeleting ? "מוחק..." : "מחיקה"}
        </button>
      </div>
    </Modal>
  );
}
