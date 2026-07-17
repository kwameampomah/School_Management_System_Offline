import { toast } from "sonner";

export const useToast = () => {
  return {
    toast: (props: { title?: string; description?: React.ReactNode; variant?: "default" | "destructive" }) => {
      if (props.variant === "destructive") {
        toast.error(props.title, { description: props.description });
      } else {
        toast.success(props.title, { description: props.description });
      }
    }
  }
}
