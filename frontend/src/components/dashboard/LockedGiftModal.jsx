import Modal from "../ui/Modal.jsx";
import InlineAlert from "../ui/InlineAlert.jsx";

export default function LockedGiftModal({ gift, onClose }) {
  return (
    <Modal
      description="כבר התקבל תשלום עבור המתנה הזו."
      isOpen={Boolean(gift)}
      onClose={onClose}
      title="לא ניתן לשנות את המתנה"
    >
      <InlineAlert tone="warning">
        לאחר שמשתתף אחד לפחות שילם, אי אפשר לערוך או למחוק את "{gift?.title}".
      </InlineAlert>
      <div className="flex justify-end">
        <button className="btn-primary" type="button" onClick={onClose}>
          אישור
        </button>
      </div>
    </Modal>
  );
}
