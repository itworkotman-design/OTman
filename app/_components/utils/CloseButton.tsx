type CloseButtonProps = {
  onClose: () => void;
};

export function CloseButton({ onClose }: CloseButtonProps) {
  return (
    <button
      type="button"
      onClick={onClose}
      className="absolute customButtonEnabled text-xl right-5 top-5 z-10 grid w-8! h-8! px-0! py-0! place-items-center align-middle rounded-full"
      aria-label="Close modal"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        viewBox="-1 -1 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="lucide lucide-x-icon lucide-x"
      >
        <path d="M18 6 6 18" />
        <path d="M6 6 18 18" />
      </svg>
    </button>
  );
}
